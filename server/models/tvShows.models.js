let pool = require("../../config/connections");
let fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const { getFilesRecursively } = require("./fileGrabber");
const urlTransformer = require("../utils/url-transformer");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const { showInfoGrabber } = require("./showInfoGrabber");
const Downloader = require("./downloader");

async function queryForEps(season, show) {
  return new Promise(function (resolve, reject) {
    pool.query(
      `SELECT * FROM episodes WHERE season = '${season}' AND title = '${show}'`,
      (err, res) => {
        resolve({ err, res });
      }
    );
  });
}

let tv = {
  getAllShows: (pid, callback) => {
    fs.readdir("/mnt/263A6E793A6E45C1/Shows", async (err, res) => {
      pool.query(`SELECT * FROM tv`, async (error, dbRes) => {
        var i = 0;
        dbRes = dbRes.map((itm) => {
          itm.backdropPhotoUrl = urlTransformer.transformUrl(`http://pixable.local:5012${itm.backdropPhotoUrl}`);
          itm.posterPhotoUrl = urlTransformer.transformUrl(`http://pixable.local:5012${itm.posterUrl}`);
          itm.coverArt = urlTransformer.transformUrl(`http://pixable.local:5012${itm.coverArt}`);
          return itm;
        });
        let titlesOnly = dbRes.map((itm) => itm.title);
        let showsToAdd = res.filter((itm) => {
          return !titlesOnly.includes(itm);
        });

        async function showIterator() {
          let showInfo = await showInfoGrabber(showsToAdd[i]);

          if (showsToAdd.length > 0) {
            let showSeasonsInfo = await fs.promises.readdir(
              `/mnt/263A6E793A6E45C1/Shows/${showsToAdd[i]}`
            );
            let castinfo;

            let showId = showInfo.results[0] ? showInfo.results[0].id : "";
            let numberOfSeasons = showSeasonsInfo.length || 1;

            const downloader = new Downloader();
            const tvPoster = await downloader.getPoster(
              showsToAdd[i],
              showInfo,
              "tv"
            );
            const tvCoverArt = await downloader.getCoverArt(
              showsToAdd[i],
              showInfo.results[0],
              "tv"
            );

            let episodesInfo = []; // Initialize as empty array since it may be used later
            let files = [];

            getFilesRecursively(`/mnt/263A6E793A6E45C1/Shows/${showsToAdd[i]}`, files);

            // Get audio information from showInfo (extracted from first episode of Season 1)
            let audioArr = showInfo.audioArr || [];
            var resolution = showInfo.resolution || "1920x1080";
            let language = showInfo.language || "en";

            let showInfoToSave = {
              showName: showsToAdd[i],
              numberOfSeasons,
              overview: showInfo.results[0] ? showInfo.results[0].overview : "",
              coverArt: tvCoverArt ? tvCoverArt : "/assets/four0four.gif",
              cast: castinfo ? JSON.stringify(castinfo) : JSON.stringify(""),
              audio: audioArr.length > 0 && audioArr[0].codec_name ? audioArr[0].codec_name : "",
              resolution,
              language,
              epTotal: files.length,
              posterUrl: tvPoster,
            };

            pool.query(`INSERT INTO tv SET ?`, showInfoToSave, (err, res) => {
              console.log(err, res);
            });

            let l = 1;
            async function seasonIterator() {
              pool.query(
                `SELECT * FROM seasons WHERE showName = '${showsToAdd[i]}'`,
                async (er, re) => {
                  console.log(er, re);

                  if (l > re.length || re === undefined) {
                    // let seasonReq;
                    let seasonResp;

                    if (showId) {
                      // seasonReq = await fetch(
                      //   `https://api.themoviedb.org/3/tv/${showId}/season/${l}?api_key=490cd30bbbd167dd3eb65511a8bf2328`
                      // );
                      // seasonResp = await seasonReq.json();
                    }
                    // Get episodes per season from showInfo (already calculated in showInfoGrabber with metadata)
                    // const episodesPerSeason = showInfo.episodesPerSeason || {};
                    // const seasonEpisodes = episodesPerSeason[l];
                    // const episodesWithMetadata = seasonEpisodes ? seasonEpisodes.episodes : [];
                    // const numOfEpsInSeason = seasonEpisodes ? seasonEpisodes.files : [];

                    // Get episodes metadata for this season
                    const seasonEpisodes = showInfo.episodesPerSeason && showInfo.episodesPerSeason[l] ? showInfo.episodesPerSeason[l] : null;
                    const episodesWithMetadata = seasonEpisodes && seasonEpisodes.episodes ? seasonEpisodes.episodes : [];
                    
                    // Create season object for database (without episodes array)
                    const seasonInfoObj = {
                      showName: showsToAdd[i],
                      seasonNum: l,
                      numOfEpsInSeason: seasonEpisodes ? seasonEpisodes.count : 0,
                    };
                    
                    async function saver() {
                      return await pool.query(
                        `INSERT INTO seasons SET ?`,
                        seasonInfoObj,
                        async (err, resp) => {
                          if(err) {
                            console.log(err);
                            return;
                          }
                          for (var e = 0; e < episodesWithMetadata.length; e++) {
                            // Get pre-computed metadata for this episode
                            const episodeMetadata = episodesWithMetadata[e];
                            if (!episodeMetadata) {
                              console.error(`No metadata found for episode ${e + 1} of season ${l}`);
                              continue;
                            }
                            const episodeFilePath = episodeMetadata.filePath;
                            const episodeResolution = episodeMetadata.resolution || showInfo.resolution || "1920x1080";
                            const episodeDuration = episodeMetadata.duration || 0;

                            // epInfoGrab is from TMDB API, but episodesInfo may not be available
                            // Using null as default since episodesInfo is commented out
                            const epInfoGrab = episodesInfo && episodesInfo.length > 0 
                              ? episodesInfo.filter((episode) => {
                                  if (
                                    e + 1 === episode.episode_number &&
                                    l === episode.season_number
                                  ) {
                                    return episode;
                                  }
                                })[0]
                              : null;
                            
                            let epCoverArt = "/assets/four0four.gif";
                            try {
                              if (epInfoGrab) {
                                epCoverArt = await downloader.getEPCoverArt(
                                  epInfoGrab,
                                  showsToAdd[i]
                                );
                              }
                            } catch (error) {
                              console.error(`Error getting cover art for episode:`, error);
                            }

                            let epInfo = {
                              showName: showsToAdd[i],
                              epTitle: epInfoGrab
                                ? epInfoGrab.name
                                    .replace(/[^\w\s\!\?]/g, "")
                                    .replace("?", "")
                                : `${showsToAdd[i]} EP ${e}`,
                              filePath: episodeFilePath,
                              overview: epInfoGrab ? epInfoGrab.overview : "",
                              posterUrl: epCoverArt,
                              epNumber: e + 1,
                              location: `${episodeFilePath
                                .replace(".mkv", "")
                                .replace(new RegExp(" ", "g"), "%20")}.m3u8`,
                              season: l,
                              resolution: episodeResolution,
                              seekTime: 0,
                              duration: episodeDuration,
                            };

                            await pool.query(
                              `INSERT INTO episodes SET ?`,
                              epInfo,
                              async (err, res) => {
                                console.log(err, res);
                                
                                console.log(
                                  "EP VS SEASON: ",
                                  e + 1,
                                  episodesWithMetadata.length,
                                  l,
                                  numberOfSeasons
                                );
                                if (e === episodesWithMetadata.length) {
                                  if (l < numberOfSeasons) {
                                    l += 1;
                                    await seasonIterator();
                                  } else {
                                    if (i + 1 !== showsToAdd.length) {
                                      i += 1;
                                      await showIterator();
                                    } else {
                                      callback(err, dbRes);
                                    }
                                  }
                                }
                              }
                            );
                          }
                        }
                      );
                    }
                    await saver();
                  }
                }
              );
            }
            await seasonIterator();
            let episodeInfoToSave = [];
          } else {
            callback(err, dbRes);
          }
        }
        showIterator();
      });
    });
  },

  getSelectedShow: async (show, callback) => {
    pool.query(
      `SELECT * FROM tv WHERE title = '${show.title}'`,
      async (error, response) => {
        let seasons = [];
        await new Promise((resolve) => {
          pool.query(
            `SELECT * FROM seasons WHERE title = '${show.title}'`,
            (er, resp) => {
              seasons = resp;
              resolve();
            }
          );
        });

        pool.query(
          `SELECT * FROM episodes WHERE title = '${show.title}'`,
          (err, res) => {
            let seasonGrabFromEp = res.map((episode) => episode.season);
            let setSeasons = [...new Set(seasonGrabFromEp)];
            let seasonsList = [];

            for (var i = 0; i < setSeasons.length; i++) {
              let seasonEps = res
                .filter((ep) => {
                  return ep.season === setSeasons[i];
                })
                .sort((a, b) => {
                  return a.epNumber - b.epNumber;
                });

              const seasonObj = {
                title: seasons[i].title,
                episodes: seasonEps,
                seasonNum: seasons[i].season_number,
                poster: seasons[i]
                  ? seasons[i].poster
                  : "/assets/four0four.gif",
              };
              seasonsList.push(seasonObj);

              if (i + 1 === setSeasons.length) {
                const showObject = {
                  title: show.title,
                  numOfSeasons: setSeasons.length,
                  seasonsList,
                  epTotal: res.length,
                  overview: response[0].overview,
                  audio: response[0].audio,
                  resolution: response[0].resolution,
                  languages: response[0].languages,
                  backdropPhotoUrl: response[0].backdropPhotoUrl,
                  coverArt: response[0].coverArt,
                  cast: response[0].cast,
                  allEps: res,
                };
                callback(err, showObject);
              }
            }
          }
        );
      }
    );
  },
  getSeasons: (show, callback) => {
    console.log("SHOW: ", show);
    pool.query(
      `SELECT * FROM seasons WHERE title = '${show.show}'`,
      async (er, re) => {
        console.log(er, re);
        for (let i = 0; i < re.length; i++) {
          const eps = await queryForEps(re[i].season_number, show.show);
          eps.res = eps.res.map((episode) => {
            episode.backdropPhotoUrl = urlTransformer.transformUrl(`http://pixable.local:5012/${episode.backdropPhotoUrl}`);
            return episode;
          });
          if (eps.res) {
            re[i].episodes = eps.res;
          }
        }

        callback(er, re);
      }
    );
  },
  getNextEp: (currentEp, callback) => {
    pool.query(
      `SELECT * FROM seasons WHERE title = '${currentEp.title}' AND season_number = '${currentEp.season}'`,
      (er, re) => {
        console.log(er, re);
        if (currentEp.epNumber === re[0].numOfEpsInseason) {
          pool.query(
            `SELECT * FROM episodes WHERE season = '${
              currentEp.season + 1
            }' AND epNumber = 1 AND title = '${currentEp.title}'`,
            (e, r) => {
              console.log(e, r);
              callback(e, r);
            }
          );
        } else {
          pool.query(
            `SELECT * FROM episodes WHERE season = '${
              currentEp.season
            }' AND epNumber = '${currentEp.epNumber + 1}' AND title = '${
              currentEp.title
            }'`,
            (e, r) => {
              console.log(e, r);
              callback(e, r);
            }
          );
        }
      }
    );
  },
  getAllEps: (callback) => {
    pool.query(`SELECT * FROM episodes`, (err, res) => {
      if (err) {
        console.log(err);
      } else {
        callback(res);
      }
    });
  },
  getSpecificSeason: (showAndSeason, callback) => {
    pool.query(
      `SELECT * FROM seasons WHERE title = '${showAndSeason.show}' AND season_number = '${showAndSeason.season}'`,
      (err, res) => {
        callback(err, res);
      }
    );
  },
};
module.exports = tv;
