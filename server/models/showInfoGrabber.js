const fetch = require("node-fetch");
const Downloader = require("./downloader");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;

// Configure ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Gets metadata from a video file using ffprobe
 * @param {string} epFile - Path to the episode file
 * @returns {Promise<Object>} Object containing audioArr, language, resolution, and duration
 */
async function getEpmetadata(epFile) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(epFile, function (err, metaData) {
      if (err) {
        console.error(`Error getting metadata for ${epFile}:`, err);
        return reject(err);
      }

      let language = "en";
      let resolution = "1920x1080";
      let audioArr = [];
      let duration = 0;

      if (metaData.streams && metaData.streams.length > 0) {
        // Get language from first stream if available
        if (metaData.streams[0].tags && metaData.streams[0].tags.language) {
          language = metaData.streams[0].tags.language;
        }

        // Get resolution from first video stream
        const videoStream = metaData.streams.find(
          (stream) => stream.codec_type === "video"
        );
        if (videoStream && videoStream.coded_width && videoStream.coded_height) {
          resolution = `${videoStream.coded_width}x${videoStream.coded_height}`;
        }

        // Get all audio streams
        audioArr = metaData.streams.filter((data) => {
          return data.codec_type === "audio";
        });
      }

      // Get duration from format
      if (metaData.format && metaData.format.duration) {
        duration = Math.floor(metaData.format.duration);
      }

      resolve({
        audioArr,
        language,
        resolution,
        duration,
      });
    });
  });
}

/**
 * Gets audio information from the first episode of Season 1
 * @param {string} show - The show name (directory name)
 * @param {string} showsPath - Base path to the shows directory (default: /mnt/263A6E793A6E45C1/Shows)
 * @returns {Promise<Object>} Object containing audioArr, language, and resolution, or null if not found
 */
async function getAudioFromFirstEpisode(show, showsPath = "/mnt/263A6E793A6E45C1/Shows") {
  try {
    // Get episodes per season
    const episodesPerSeason = countEpisodesPerSeason(show, showsPath);

    // Check if Season 1 exists and has episodes
    if (!episodesPerSeason[1] || !episodesPerSeason[1].files || episodesPerSeason[1].files.length === 0) {
      console.log(`No episodes found in Season 1 for show "${show}"`);
      return null;
    }

    // Get the first episode file path
    const firstEpisodePath = episodesPerSeason[1].files[0];

    // Get metadata from the first episode
    const metadata = await getEpmetadata(firstEpisodePath);

    return metadata;
  } catch (error) {
    console.error(`Error getting audio from first episode for show "${show}":`, error);
    return null;
  }
}

/**
 * Recursively finds all MKV files in a directory and its subdirectories
 * @param {string} dirPath - The directory path to search
 * @param {Array<string>} mkvFiles - Array to collect MKV file paths
 */
function findMkvFilesRecursively(dirPath, mkvFiles = []) {
  try {
    const items = fs.readdirSync(dirPath);

    items.forEach((item) => {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        // Recursively search subdirectories
        findMkvFilesRecursively(itemPath, mkvFiles);
      } else if (stats.isFile() && item.toLowerCase().endsWith(".mkv")) {
        // Add MKV file to the list
        mkvFiles.push(itemPath);
      }
    });
  } catch (error) {
    console.error(`Error reading directory "${dirPath}":`, error);
  }

  return mkvFiles;
}

/**
 * Counts the number of episodes (MKV files) in each season directory for a given show
 * Recursively searches through all subdirectories within each Season directory
 * @param {string} show - The show name (directory name)
 * @param {string} showsPath - Base path to the shows directory (default: /mnt/263A6E793A6E45C1/Shows)
 * @returns {Object} Object with season numbers as keys and episode counts as values, plus episode file paths
 * Example: { 1: { count: 10, files: [...] }, 2: { count: 12, files: [...] } }
 */
function countEpisodesPerSeason(show, showsPath = "/mnt/263A6E793A6E45C1/Shows") {
  const showPath = path.join(showsPath, show);
  const episodesPerSeason = {};

  try {
    // Read the show directory
    const items = fs.readdirSync(showPath);

    // Filter for "Season X" directories
    const seasonDirs = items.filter((item) => {
      const itemPath = path.join(showPath, item);
      const stats = fs.statSync(itemPath);
      return stats.isDirectory() && /^Season\s+\d+$/i.test(item);
    });

    // For each season directory, recursively find all MKV files
    seasonDirs.forEach((seasonDir) => {
      const seasonPath = path.join(showPath, seasonDir);
      
      // Extract season number from directory name (e.g., "Season 1" -> 1)
      const seasonMatch = seasonDir.match(/Season\s+(\d+)/i);
      if (seasonMatch) {
        const seasonNum = parseInt(seasonMatch[1], 10);
        
        // Recursively find all MKV files in this season directory and its subdirectories
        const mkvFiles = findMkvFilesRecursively(seasonPath);

        episodesPerSeason[seasonNum] = {
          count: mkvFiles.length,
          files: mkvFiles,
        };
      }
    });
  } catch (error) {
    console.error(`Error counting episodes for show "${show}":`, error);
    return {};
  }

  return episodesPerSeason;
}

/**
 * Gets metadata for all episodes in all seasons
 * @param {Object} episodesPerSeason - Object with season numbers as keys and episode file paths
 * @returns {Promise<Object>} Object with season numbers as keys, each containing episodes with metadata
 */
async function getAllEpisodesMetadata(episodesPerSeason) {
  const episodesWithMetadata = {};

  // Process each season
  for (const [seasonNum, seasonData] of Object.entries(episodesPerSeason)) {
    const seasonNumber = parseInt(seasonNum, 10);
    episodesWithMetadata[seasonNumber] = {
      count: seasonData.count,
      files: seasonData.files,
      episodes: [],
    };

    // Get metadata for each episode in this season
    for (let i = 0; i < seasonData.files.length; i++) {
      const episodePath = seasonData.files[i];
      try {
        const metadata = await getEpmetadata(episodePath);
        episodesWithMetadata[seasonNumber].episodes.push({
          filePath: episodePath,
          audioArr: metadata.audioArr,
          language: metadata.language,
          resolution: metadata.resolution,
          duration: metadata.duration,
          episodeIndex: i,
        });
      } catch (error) {
        console.error(`Error getting metadata for episode ${episodePath}:`, error);
        // Add episode with default values if metadata extraction fails
        episodesWithMetadata[seasonNumber].episodes.push({
          filePath: episodePath,
          audioArr: [],
          language: "en",
          resolution: "1920x1080",
          duration: 0,
          episodeIndex: i,
        });
      }
    }
  }

  return episodesWithMetadata;
}

async function showInfoGrabber(show) {
  let showInfo = await fetch(
    `https://api.themoviedb.org/3/search/tv?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${show}`
  );
  showInfo = await showInfo.json();

  if (showInfo.results.length > 0) {
    let cast = await fetch(
      `https://api.themoviedb.org/3/tv/${showInfo.results[0].id}/credits?api_key=490cd30bbbd167dd3eb65511a8bf2328&language=en-US&append_to_response=episode_groups`
    );
    castinfo = await cast.json();
    castinfo = castinfo.cast.map((castmember) => {
      return {
        name: castmember.name,
        picture: `https://image.tmdb.org/t/p/original/${castmember.profile_path}`,
      };
    });
  }

  const downloader = new Downloader();
  const tvPoster = await downloader.getPoster(show, showInfo, "tv");
  const tvCoverArt = await downloader.getCoverArt(
    show,
    showInfo.results[0],
    "tv"
  );

  // Count episodes per season
  const episodesPerSeason = countEpisodesPerSeason(show);
  
  // Get metadata for all episodes in all seasons
  const episodesWithMetadata = await getAllEpisodesMetadata(episodesPerSeason);
  showInfo.episodesPerSeason = episodesWithMetadata;

  // Get audio information from the first episode of Season 1 for show-level defaults
  const epMetadata = await getAudioFromFirstEpisode(show);
  if (epMetadata) {
    showInfo.audioArr = epMetadata.audioArr;
    showInfo.language = epMetadata.language;
    showInfo.resolution = epMetadata.resolution;
  } else {
    // Default values if we can't get audio info
    showInfo.audioArr = [];
    showInfo.language = "en";
    showInfo.resolution = "1920x1080";
  }

  // Return showInfo for backward compatibility (tvShows.models.js expects this)
  // The episodesPerSeason, audioArr, language, and resolution are now included in the showInfo object
  return showInfo;
}

module.exports = { showInfoGrabber };
