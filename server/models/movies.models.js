let pool = require("../../config/connections");
let fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
ffmpeg.setFfprobePath(ffprobePath);
ffmpeg.setFfmpegPath(ffmpegPath);
var fetch = require("node-fetch");
const Downloader = require("./downloader");
const BonusFeatures = require("./bonusFeatures");
const urlTransformer = require("../utils/url-transformer");
var arrOfObj = [];
var ffstream = ffmpeg();


// Global scan progress tracking
let scanProgress = {
  isScanning: false,
  current: 0,
  total: 0,
  currentFile: ""
};

async function updateMoviesInDB() {
  setTimeout(function () {
    ffstream.on("error", function () {
      console.log("Ffmpeg has been killed");
    });
  }, 1000);
  arrOfObj = [];

  // Reset scan progress
  scanProgress.isScanning = true;
  scanProgress.current = 0;
  scanProgress.total = 0;
  scanProgress.currentFile = "";

  // var loginSuccess = true;
  let loginRes;
  try {
    // loginRes = await loginOpenSubtitles.json();
  } catch (err) {
    loginSuccess = false;
  }

  fs.readdir("/mnt/F898C32498C2DFEC/Videos", async (err, files) => {
    var arr = [];
    var selection = await files;

    pool.query("SELECT * FROM movies", async (err, res) => {
      var fileList = files;
      var responseTitlteList = res ? res.map((itm) => itm.fileName) : [];

      var notIncluded = fileList.filter((itm) => {
        if (!responseTitlteList.includes(itm)) {
          return itm;
        }
      });

      // Set total files to scan
      scanProgress.total = notIncluded.length;
      scanProgress.current = 0;

      var l = 0;
      var openSubsApiLoginBearerToken = "";

      async function iterate() {
        if (notIncluded.length > 0) {
          // Update progress
          scanProgress.current = l;
          scanProgress.currentFile = notIncluded[l];
          var fileName = notIncluded[l];
          
          await ffmpeg.ffprobe(
            `/mnt/F898C32498C2DFEC/Videos/${fileName}`,
            async function (err, metaData) {
              let fileNameNoExt = metaData.format.tags.title ? metaData.format.tags.title : fileName.replace(".mkv", "");
              let dolbyVision = false;
              let write = "";

              var firstObj = {
                title: notIncluded[l],
                movieListUrl: `https://api.themoviedb.org/3/search/movie?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${fileNameNoExt
                  .replace(new RegExp(" ", "g"), "%20")
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")}`,
              };

              mbpsWithfixedDecimal = "";
              if (metaData.streams[0]) {
                const Mbps = metaData.streams[0].bit_rate / 1000000; // Divide by 1,000,000 to get Mbps
                mbpsWithfixedDecimal = Mbps.toFixed(2);
              }

              var fileExt = metaData.format.filename.split(".").pop();
              let location = "";

              // if (fileExt === "mp4") {
              //   location = `/Videos/${fileNameNoExt.replace(
              //     new RegExp(" ", "g"),
              //     "%20"
              //   )}.${fileExt}`;
              // }

              if (fileExt === "mkv") {
                // Check for Dolby Vision in the video stream
                const videoStream = metaData.streams[0];
                
                // Check codec_tag_string for Dolby Vision indicators (dvhe, dvh1, etc.)
                if (videoStream.codec_tag_string) {
                  const codecTag = videoStream.codec_tag_string.toLowerCase();
                  if (codecTag.includes('dvhe') || codecTag.includes('dvh1') || codecTag.includes('dovi')) {
                    dolbyVision = true;
                  }
                }

                // Check codec_tag_string for Dolby Vision indicators (dvhe, dvh1, etc.)
                if (videoStream.dv_profile) {
                  // const codecTag = videoStream.codec_tag_string.toLowerCase();
                  // if (codecTag.includes('dvhe') || codecTag.includes('dvh1') || codecTag.includes('dovi')) {
                  dolbyVision = true;
                  // }
                }
                
                // Check stream tags for Dolby Vision metadata
                if (!dolbyVision && videoStream.tags) {
                  const tags = videoStream.tags;
                  const tagKeys = Object.keys(tags).map(k => k.toLowerCase());
                  const tagValues = Object.values(tags).map(v => String(v).toLowerCase());
                  
                  if (tagKeys.some(k => k.includes('dovi') || k.includes('dolby')) ||
                      tagValues.some(v => v.includes('dovi') || v.includes('dolby'))) {
                    dolbyVision = true;
                  }
                }
                
                // Check profile for Dolby Vision (e.g., dvhe.08.06)
                if (!dolbyVision && videoStream.profile) {
                  const profile = String(videoStream.profile).toLowerCase();
                  if (profile.includes('dvhe') || profile.includes('dvh1') || profile.includes('dovi')) {
                    dolbyVision = true;
                  }
                }
                
                if (dolbyVision) {
                  // Dolby Vision detected - point to MKV file directly
                  location = `/mnt/F898C32498C2DFEC/Videos/${fileNameNoExt.replace(
                    new RegExp(" ", "g"),
                    "%20"
                  )}.mkv`;
                  console.log(`Dolby Vision detected in ${fileName} - using MKV file directly`);
                } else {
                  // No Dolby Vision - point to transcoded m3u8
                  fileExt = "m3u8";
                  location = `/plexTemp/${fileNameNoExt.replace(
                    new RegExp(" ", "g"),
                    "&%20"
                  )}.${fileExt}`;
                }
              }

              var subTarr = [];
              var audio;
              // var subcounter = -1;

              // if (metaData !== undefined) {
              //   if (fileExt === "mp4") {
              //     await ffmpeg.ffprobe(
              //       `F:/ConvertedDVMKVs/${fileNameNoExt}.mkv`,
              //       async function (err, metaDataFromConverted) {
              //         audio = {
              //           codecName:
              //             metaDataFromConverted?.streams[1].codec_name ?? "",
              //           channels:
              //             metaDataFromConverted?.streams[1].channels ?? 6,
              //         };
              //       }
              //     );
              //   } else {
              //     console.log("mkv");
                  audio = {
                    codecName: metaData.streams[1].codec_name,
                    channels: metaData.streams[1].channels,
                  };
              //   }
              // }

              const downloader = new Downloader();
              const bonusFeatures = new BonusFeatures();

              let moviedata = await fetch(firstObj.movieListUrl);
              let data = await moviedata.json();
              // Helper function to encode URL path while preserving protocol and host:port
              // Since filenames are already encoded by downloader functions, this mainly
              // handles URL transformation (pixable.local to IP) and ensures directory names are encoded
              const encodeUrlPath = (url) => {
                if (!url) return url;
                
                // If URL has protocol://host:port structure
                if (url.includes("://")) {
                  // Match protocol://host:port and path separately
                  const urlMatch = url.match(/^([^:]+:\/\/[^\/]+)(\/.*)?$/);
                  if (urlMatch) {
                    // urlMatch[1] = protocol://host:port
                    // urlMatch[2] = /path (or undefined if no path)
                    const protocolAndHost = urlMatch[1];
                    const path = urlMatch[2] || "";
                    
                    if (path) {
                      // Split path by '/' and encode each segment
                      // Filenames should already be encoded, but directory names might not be
                      const pathSegments = path.split('/').map(segment => {
                        if (!segment) return ''; // Keep empty strings for slashes
                        // Try to decode first - if it succeeds, the segment was encoded, so re-encode it
                        // If decode fails, the segment wasn't encoded, so encode it
                        try {
                          const decoded = decodeURIComponent(segment);
                          // If decoding succeeded and the result is different, it was encoded
                          // Re-encode to ensure proper encoding
                          return encodeURIComponent(decoded);
                        } catch (e) {
                          // Decoding failed, segment wasn't encoded, so encode it
                          return encodeURIComponent(segment);
                        }
                      });
                      // Join segments with '/' - this preserves the path structure
                      return protocolAndHost + pathSegments.join('/');
                    } else {
                      return protocolAndHost;
                    }
                  } else {
                    // Fallback: if regex doesn't match, encode entire URL
                    return encodeURI(url);
                  }
                } else {
                  // No protocol, try to decode first to handle already-encoded strings
                  try {
                    const decoded = decodeURIComponent(url);
                    return encodeURIComponent(decoded);
                  } catch (e) {
                    // Not encoded, encode it
                    return encodeURIComponent(url);
                  }
                }
              };
              
              // Get trailer URL and encode special characters in the path
              let trailerUrlRaw = await downloader.getTrailer(fileNameNoExt, data);
              let trailerUrl = trailerUrlRaw ? encodeUrlPath(trailerUrlRaw) : trailerUrlRaw;
              
              // Get cover art and encode special characters in the path
              let coverArtRaw = await downloader.getCoverArt(
                fileNameNoExt,
                data,
                "movie"
              );
              let coverArt = coverArtRaw ? encodeUrlPath(coverArtRaw) : coverArtRaw;
              
              // Get poster URL and encode special characters in the path
              let posterUrlRaw = await downloader.getBackgroundPoster(
                fileNameNoExt,
                data,
                "movie"
              );
              let posterUrl = posterUrlRaw ? encodeUrlPath(posterUrlRaw) : posterUrlRaw;
              
              // Get movie card and encode special characters in the path
              let movieCardRaw = await downloader.getCard(
                fileNameNoExt,
                fileName,
                data,
                "movies"
              );
              let movieCard = movieCardRaw ? encodeUrlPath(movieCardRaw) : movieCardRaw;
              
              let subtitleSrts = "";
              // if (loginSuccess === true && loginRes) {
              // subtitleSrts = await downloader.getSubtitleVtt(
              //   fileNameNoExt,
              //   data,
              //   loginRes,
              //   metaData
              // );
              // }

              let parsedCastList = await downloader.getCastList(
                fileNameNoExt,
                data
              );
              let bf = await bonusFeatures.getBonusFeatures(fileNameNoExt);

              let resolution = "";
              if (
                metaData["streams"][0]["coded_width"] &&
                metaData["streams"][0]["coded_height"]
              ) {
                resolution = `${metaData["streams"][0]["coded_width"]}x${metaData["streams"][0]["coded_height"]}`;
              } else if (
                metaData["streams"][0]["width"] &&
                metaData["streams"][0]["height"]
              ) {
                resolution = `${metaData["streams"][0]["width"]}x${metaData["streams"][0]["height"]}`;
              }

              let fileformat = "";
              if (metaData.streams[0].codec_tag_string && fileExt !== "mp4") {
                fileformat = metaData.streams[0].codec_tag_string;
              }
              // if (fileExt === "mp4") {
              //   fileformat = "dvh1";
              // }

              if (metaData) {
                var metaDataObj = {
                  title: fileNameNoExt,
                  filePath: metaData["format"]["filename"],
                  movieCard: movieCard || "",
                  coverArt: coverArt || "",
                  cast: parsedCastList,
                  audio: audio.codecName,
                  overview:
                    data["results"] === undefined ||
                    data["results"].length === 0
                      ? ""
                      : data["results"][0]["overview"],
                  duration: metaData["format"]["duration"],
                  resolution,
                  channels: audio.channels ? audio.channels : undefined,
                  dolbyVision,
                  originalLang:
                    data["results"] === undefined ||
                    data["results"].length === 0
                      ? ""
                      : data["results"][0]["original_language"],
                  subtitles: JSON.stringify(subTarr),
                  subtitleSelect: -1,
                  seekTime: 0,
                  fileName: fileName,
                  tmdbId: data.results[0] ? data.results[0].id : 0,
                  srtLocation: fileNameNoExt
                    ? `I:/Subtitles/${fileNameNoExt}.srt`
                    : "",
                  location,
                  trailerUrl,
                  srtUrl: subtitleSrts || "",
                  bonusFeatures: bf,
                  posterUrl,
                  vbr: mbpsWithfixedDecimal,
                  transmuxToPixie: false,
                  threeD: metaData.streams[0].side_data_type === "Stereo 3D" ? 1 : 0,
                };

                await new Promise((resolve, reject) => {
                  pool.query(
                    `INSERT INTO movies SET ?`,
                    metaDataObj,
                    (err, res) => {
                      if (res) {
                        console.log(res);
                        resolve();
                      }
                      if (err) {
                        console.log(err);
                        reject();
                      }
                    }
                  );
                });

                if (l + 1 === notIncluded.length) {
                  // Scan complete - reset progress
                  scanProgress.isScanning = false;
                  scanProgress.current = scanProgress.total;
                  scanProgress.currentFile = "";
                  
                  // pool.query(
                  //   `SELECT * FROM movies ORDER BY title ASC`,
                  //   (err, resp) => {
                  //     // pool.query(`SELECT * from pickupwhereleftoff`, (e, r) => {
                // callback(resp);
                  //     // });
                  //   }
                  // );
                } else {
                  l += 1;
                  await iterate();
                }
              }
            }
          );
        } else {
          // No new files to scan - reset progress
          scanProgress.isScanning = false;
          scanProgress.current = 0;
          scanProgress.total = 0;
          scanProgress.currentFile = "";
          
          res.map((movie) => {
            movie.subtitles = JSON.parse(movie.subtitles);
            return movie;
          });
          // pool.query(`SELECT * from pickupwhereleftoff`, (e, r) => {
          //   res.map((movie, i) => {
          //     let hi = r.find((mo) => mo.titleOrEpisode === movie.title);

          //     movie.posterUrl = urlTransformer.transformUrl(`http://pixable.local:5012${movie.posterUrl}`);
          //     movie.location = urlTransformer.transformUrl(`http://pixable.local:5012${movie.location}`);
          //     movie.coverArt = urlTransformer.transformUrl(`http://pixable.local:5012${movie.coverArt}`);

          //     if (hi) {
          //       res[i].seekTime = hi ? hi.time : 0;
          //       res[i].resumePressed = true;
          //     }
          //     return movie;
          //   });
          //   callback(err, res);
          // });
        }
      }
      iterate();
    });
  });
}

let routeFunctions = {
  updateMovies: (callback) => {
    updateMoviesInDB();
  },
  getScanProgress: () => {
    return scanProgress;
  },
  resumeOrNot: (title, callback) => {
    pool.query(
      `SELECT * FROM pickupwhereleftoff WHERE titleOrEpisode = '${title.title}'`,
      (err, res) => {
        console.log(err, res);
        callback(err, res);
      }
    );
  },

  getAllHomeVids: (pid, callback) => {
    var arrOfTvObj = [];
    if (pid["pid"] != 0) {
      try {
        process.kill(pid["pid"]);
      } catch (err) {
        pid = 0;
      }
    }

    pool.query(`SELECT * FROM homeVideoFolders`, (err, res) => {
      fs.readdir("F:/HomeVideo/", (err, folders) => {
        folders = folders.map((folder) => `F:/HomeVideo/${folder}`);
        var f = 0;

        let folderList = folders.map((item) => {
          return {
            backdropPhotoUrl: "/assets/four0four.gif",
            folderPath: `${item}`,
          };
        });

        let ressed = res.map((itm) => itm.folderPath);
        let folderListPaths = folderList.map((itm) => itm.folderPath);

        let leftovers = folderListPaths.filter((folder) => {
          return !ressed.includes(folder);
        });

        leftovers = leftovers.map((itm) => {
          return {
            folderTitle: itm.replace("F:/HomeVideo/", ""),
            backdropPhotoUrl: "/assets/four0four.gif",
            folderPath: itm,
            filePaths: [],
          };
        });

        let fi = 0;
        function folderIterator() {
          if (leftovers.length > 0) {
            fs.readdir(leftovers[fi].folderPath, (er, files) => {
              for (var f = 0; f < files.length; f++) {
                leftovers[fi]["filePaths"].push({
                  path: `${leftovers[fi].folderPath}/${files[f]}`,
                  resolution: "720x480",
                  backdropPhotoUrl: "/assets/four0four.gif",
                  title: files[f],
                });
              }

              leftovers[fi]["filePaths"] = JSON.stringify(
                leftovers[fi]["filePaths"]
              );

              pool.query(
                `INSERT INTO homevideofolders SET ?`,
                leftovers[fi],
                (error, response) => {
                  if (fi + 1 !== leftovers.length) {
                    fi += 1;
                    folderIterator();
                  } else {
                    pool.query(`SELECT * FROM homeVideoFolders`, (err, res) => {
                      callback(err, res);
                    });
                  }
                }
              );
            });
          } else {
            pool.query(`SELECT * FROM homeVideoFolders`, (err, res) => {
              callback(err, res);
            });
          }
        }
        folderIterator();
      });
    });
  },

  getAHomeVideoList: (videoList, callback) => {
    var vidList = [];
    fs.readdir(`F:/HomeVideo/${videoList["title"]}/`, (err, files) => {
      files.forEach(function getShowInfoi(file, i) {
        ffmpeg.ffprobe(
          `F:/Shows/${videoList["title"]}`,
          function (err, metaData) {
            var videoPlaylistObj = {
              title: file,
              photoUrl: `/assets/four0four.gif`,
              backdropPhotoUrl: `/assets/four0four.gif`,
            };
            vidList.push(videoPlaylistObj);
            if (vidList.length == files.length) {
              callback(vidList);
            }
          }
        );
      });
    });
  },

  getAShow: (show, callback) => {
    if (show["pid"] != 0) {
      var pidInt = parseInt(show["pid"]["pid"]);
      process.kill(show["pid"]["pid"]);
    }

    fs.readdir(`F:/Shows/${show["dirName"]}/`, (err, files) => {
      var arr = [];

      var prom = new Promise((resolve, reject) => {
        pool.query("SELEC * FROM ");

        files.forEach(function getShowInfoi(file, i) {
          var url = file.replace(".mkv", "");
          var firstObj = {
            url: file.replace(".mkv", ""),
            title: i,
            movieListUrl: ``,
          };

          ffmpeg.ffprobe(
            `F:/Shows/${show["dirName"]}/${firstObj["url"]}.mkv`,
            function (err, metaData) {
              var subTarr = [];
              var audioArr = [];
              var subcounter = -1;
              var audiocounter = -1;

              for (var i = 0; i < metaData["streams"].length; i++) {
                if (metaData["streams"][i].hasOwnProperty("codec_name")) {
                  if (metaData["streams"][i]["codec_type"] == "subtitle") {
                    subcounter += 1;
                    metaData["streams"][i]["indexInt"] = subcounter;
                    subTarr.push(metaData["streams"][i]);
                  }
                  if (metaData["streams"][i]["codec_type"] == "audio") {
                    audiocounter += 1;
                    metaData["streams"][i]["indexInt"] = audiocounter;
                    audioArr.push(metaData["streams"][i]);
                  }
                }
              }

              fetch(
                `https://api.themoviedb.org/3/tv/${show["tvId"]}/season/1?api_key=490cd30bbbd167dd3eb65511a8bf2328&language=en-US`
              )
                .then((data) => {
                  return data.json();
                })
                .then((data) => {
                  if (metaData) {
                    var metaDataObj = {
                      title:
                        data["episodes"][firstObj["title"]]["episode_number"],
                      filePath: metaData["format"]["filename"],
                      photoUrl: show["photoUrl"],
                      backdropPhotoUrl: show["backdropPhotoUrl"],
                      overview: data["episodes"][firstObj["title"]]["overview"],
                      duration: metaData["format"]["duration"],
                      resolution: `${metaData["streams"][0]["coded_width"]}x${metaData["streams"][0]["coded_height"]}`,
                      channels: metaData["streams"][1]["channels"],
                      fileformat: metaData["streams"][0]["codec_name"],
                      subtitles: subTarr,
                      subtitleSelect: -1,
                      seekTime: 0,
                      fileName: file.replace(".mkv", ""),
                    };

                    arr.push(metaDataObj);
                    arr.sort((a, b) => (a.title > b.title ? 1 : -1));
                    if (arr.length == files.length) {
                      callback(arr);
                    }
                  }
                });
            }
          );
        });
      });
    });
  },
  changeTransmuxStatus: (body, callback) => {
    console.log("STATUS: ", body);
    pool.query(
      `UPDATE movies SET transmuxToPixie = "${body["transmuxToPixie"]}" WHERE title = "${body["title"]}"`,
      (err, res) => {
        console.log(err, res);

        callback(err, res);
      }
    );
  },
  getAllMovies: async (reqObj, callback) => {
    if (reqObj.pid["pid"] != 0) {
      try {
        process.kill(reqObj.pid["pid"]);
      } catch (err) {
        reqObj.pid["pid"] = 0;
      }
    }

    pool.query(
      `SELECT * FROM movies ORDER BY title ASC LIMIT 50 OFFSET ${reqObj.offset}`,
      async (err, res) => {
        if (err) {
          callback(err, null);
          return;
        }
        
        // Helper function to encode URL path while preserving protocol and host:port
        const encodeUrlPath = (url) => {
          if (!url) return url;
          
          // If URL has protocol://host:port structure
          if (url.includes("://")) {
            // Match protocol://host:port and path separately
            const urlMatch = url.match(/^([^:]+:\/\/[^\/]+)(\/.*)?$/);
            if (urlMatch) {
              // urlMatch[1] = protocol://host:port
              // urlMatch[2] = /path (or undefined if no path)
              const protocolAndHost = urlMatch[1];
              const path = urlMatch[2] || "";
              
              if (path) {
                // Split path by '/' and encode each segment
                const pathSegments = path.split('/').map(segment => {
                  if (!segment) return ''; // Keep empty strings for slashes
                  // Try to decode first - if it succeeds, the segment was encoded, so re-encode it
                  // If decode fails, the segment wasn't encoded, so encode it
                  try {
                    const decoded = decodeURIComponent(segment);
                    // Re-encode to ensure proper encoding
                    return encodeURIComponent(decoded);
                  } catch (e) {
                    // Decoding failed, segment wasn't encoded, so encode it
                    return encodeURIComponent(segment);
                  }
                });
                // Join segments with '/' - this preserves the path structure
                return protocolAndHost + pathSegments.join('/');
              } else {
                return protocolAndHost;
              }
            } else {
              // Fallback: if regex doesn't match, encode entire URL
              return encodeURI(url);
            }
          } else {
            // No protocol, try to decode first to handle already-encoded strings
            try {
              const decoded = decodeURIComponent(url);
              return encodeURIComponent(decoded);
            } catch (e) {
              // Not encoded, encode it
              return encodeURIComponent(url);
            }
          }
        };
        
        res.map(
          (movie) =>
            (movie.posterUrl = encodeUrlPath(urlTransformer.transformUrl(`${movie.posterUrl}`)))
        );

        res.map(
          (movie) =>
            (movie.coverArt = encodeUrlPath(urlTransformer.transformUrl(`${movie.coverArt}`)))
        );
        res.map(
          (movie) =>
            (movie.movieCard = encodeUrlPath(urlTransformer.transformUrl(`${movie.movieCard}`)))
        );
        if (res.length > 0) {
          // Helper function to check if two titles are similar (one contains another)
          // Examples: "Avatar: The Way of Water" and "Avatar: The Way of Water Disc 1" are similar
          const areTitlesSimilar = (title1, title2) => {
            if (!title1 || !title2) return false;
            const t1 = title1.toLowerCase().trim();
            const t2 = title2.toLowerCase().trim();
            // Check if one title contains the other (or they're equal)
            // This handles cases like "Avatar: The Way of Water" and "Avatar: The Way of Water Disc 1"
            if (t1 === t2) return true;
            // Check if the shorter title is contained in the longer title
            // This ensures "Avatar: The Way of Water" matches "Avatar: The Way of Water Disc 1"
            const shorter = t1.length <= t2.length ? t1 : t2;
            const longer = t1.length > t2.length ? t1 : t2;
            return longer.includes(shorter);
          };
          
          // Helper function to find a group key for a movie based on movieCard and title similarity
          const findGroupKey = (movie, existingGroups) => {
            // First, try to find a group with the same movieCard
            for (const [key, group] of Object.entries(existingGroups)) {
              // Check if movieCard matches
              if (group.movieCard && movie.movieCard && 
                  group.movieCard === movie.movieCard) {
                // Check if title is similar to any version in this group
                const hasSimilarTitle = group.versions.some(version => 
                  areTitlesSimilar(version.title, movie.title)
                );
                if (hasSimilarTitle) {
                  return key;
                }
              }
            }
            // No matching group found, create a new key based on movieCard
            // Use movieCard as the key if it exists, otherwise use title
            return movie.movieCard || movie.title || `group_${Object.keys(existingGroups).length}`;
          };

          const movies = []
          
            try {
                      // Group the matching versions by normalized title (remove "Disc 1", "Disc 2", etc.)
                      // Group the matching versions by normalized title (remove "Disc 1", "Disc 2", etc.)
                      function normalize(title) { 
                        return title.toLowerCase()
                          .replace(/disc\s*\d+/i, '')  // Remove "Disc 1", "Disc 2", etc.
                          .replace(/\s*\(\d{4}\)\s*$/, '')  // Remove year in parentheses at the end like "(2025)"
                          .replace(/\s*3d\s*$/i, '')  // Remove "3D" at the end (case-insensitive)
                          .replace(/\s*extended\s*(edition|cut|version)?\s*$/i, '')  // Remove "Extended Edition", "Extended Cut", etc.
                          .replace(/\s*director'?s\s*cut\s*$/i, '')  // Remove "Director's Cut"
                          .replace(/\s*unrated\s*$/i, '')  // Remove "Unrated"
                          .replace(/\s*theatrical\s*$/i, '')  // Remove "Theatrical"
                          .trim(); 
                      }
                      const groups = {};
                      
                      // Use potentialVersions (the query result) - res is the initial batch from outer scope
                      for (const row of res) {
                        const key = normalize(row.title); 
                        if (!groups[key]) {
                          groups[key] = [];
                        }
                        groups[key].push(row);
                      }
                      
                      // Push each individual group to the movies array
                      for (const key in groups) {
                        const groupItems = groups[key];
                        const defaultPosterUrl = "http://10.0.0.13:5012/assets/four0four.gif";
                        
                        // Helper function to find first valid value for a field
                        const findFirstValid = (fieldName, defaultValue = null) => {
                          for (const item of groupItems) {
                            if (item[fieldName] && 
                                item[fieldName] !== defaultPosterUrl && 
                                String(item[fieldName]).trim() !== '') {
                              return item[fieldName];
                            }
                          }
                          return defaultValue;
                        };
                        
                        // Find the first valid values for each field
                        const posterUrl = findFirstValid('posterUrl', defaultPosterUrl);
                        const movieCard = findFirstValid('movieCard', defaultPosterUrl);
                        const backdropPhotoUrl = findFirstValid('backdropPhotoUrl', defaultPosterUrl);
                        const coverArt = findFirstValid('coverArt', defaultPosterUrl);
                        const trailer = findFirstValid('trailer', null) || findFirstValid('trailerUrl', null);
                        const cast = findFirstValid('cast', null);
                        const overview = findFirstValid('overview', null);
                        const duration = findFirstValid('duration', null);
                        const resolution = findFirstValid('resolution', null);
                        const channels = findFirstValid('channels', null);
                        const audio = findFirstValid('audio', null);
                        const subtitles = findFirstValid('subtitles', null);
                        const subtitleSelect = findFirstValid('subtitleSelect', null);
                        const seekTime = findFirstValid('seekTime', null);
                        const tmdbId = findFirstValid('tmdbId', null);
                        const srtLocation = findFirstValid('srtLocation', null);
                        const location = findFirstValid('location', null);
                        const trailerUrl = findFirstValid('trailerUrl', null);
                        const srtUrl = findFirstValid('srtUrl', null);
                        const bonusFeatures = findFirstValid('bonusFeatures', null);
                        const vbr = findFirstValid('vbr', null);
                        const transmuxToPixie = findFirstValid('transmuxToPixie', null);
                        const threeD = findFirstValid('threeD', null);  
                        const dolbyVision = findFirstValid('dolbyVision', null);
                        const originalLang = findFirstValid('originalLang', null);
                        const filePath = findFirstValid('filePath', null);
                        const fileName = findFirstValid('fileName', null);
                        const fileformat = findFirstValid('fileformat', null);

                        movies.push({
                          title: groupItems[0].title, 
                          versions: groupItems,
                          posterUrl: posterUrl,
                          movieCard: movieCard,
                          backdropPhotoUrl: backdropPhotoUrl,
                          coverArt: coverArt,
                          trailer: trailer,
                          cast: cast,
                          overview: overview,
                          duration: duration,
                          resolution: resolution,
                          channels: channels,
                          audio: audio,
                          subtitles: subtitles,
                          subtitleSelect: subtitleSelect,
                          seekTime: seekTime,
                          tmdbId: tmdbId,
                          srtLocation: srtLocation,
                          location: location,
                          trailerUrl: trailerUrl,
                          srtUrl: srtUrl,
                          bonusFeatures: bonusFeatures,
                          vbr: vbr,
                          transmuxToPixie: transmuxToPixie,
                          threeD: threeD,
                          dolbyVision: dolbyVision,
                          originalLang: originalLang,
                          filePath: filePath,
                          fileName: fileName,
                          fileformat: fileformat,
                        });
                      }
            } catch (queryErr) {
              console.error(`Error querying all versions for group "${groupKey}":`, queryErr);
              // Keep the grouped version from current batch if query fails
            }
          callback(err, movies);
        } else {
          callback(err, {
            message: "no more movies",
          });
        }
      }
    );
  },
};

module.exports = routeFunctions;
