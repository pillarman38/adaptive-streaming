let pool = require("../../config/connections");
let fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
let codecGetter = require("./codec-determine");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
let chokidar = require("chokidar");
var showPlayer = false;
var fetch = require("node-fetch");
var downloader = require("./downloader");
const cp = require("child_process");
const path = require("path");
const Downloader = require("./downloader");
var arrOfObj = [];
var newArr = [];
var url = "";
var i = 0;
var fileLocation = "";
var newSrc;

var arr = [];
var killProcess = false;
var ffstream = ffmpeg();

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
    fs.readdir("J:/Shows", async (err, res) => {
      pool.query(`SELECT * FROM tv`, async (error, dbRes) => {
        var i = 0;

        let titlesOnly = dbRes.map((itm) => itm.title);
        let showsToAdd = res.filter((itm) => {
          return !titlesOnly.includes(itm);
        });

        async function showIterator() {
          let showInfo = await fetch(
            `https://api.themoviedb.org/3/search/tv?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${showsToAdd[i]}`
          );
          showInfo = await showInfo.json();
          let showSeasonsInfo;
          if (showsToAdd.length > 0) {
            let showSeasonsInfo = await fs.promises.readdir(
              `J:/Shows/${showsToAdd[i]}`
            );
            let castinfo;
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
            let backgroundPoster = await downloader.getBackgroundPoster(
              showsToAdd[i],
              showInfo,
              "tv"
            );
            let episodesInfo = [];
            let numOfEpInSeason = 0;

            let files = [];

            const getFilesRecursively = (directory) => {
              const filesInDirectory = fs.readdirSync(directory);
              for (const file of filesInDirectory) {
                const absolute = path.join(directory, file);
                if (fs.statSync(absolute).isDirectory()) {
                  getFilesRecursively(absolute);
                } else {
                  files.push(absolute.replace(/\\/g, "/"));
                }
              }
            };

            getFilesRecursively(`J:/Shows/${showsToAdd[i]}`);

            let audio;
            let audioArr = [];
            var audiocounter = -1;
            var resolution = "1920x1080";
            let language = "en";

            await new Promise((resolve) => {
              ffmpeg.ffprobe(`${files[0]}`, function (err, metaData) {
                if (err) {
                  console.log(err);
                }
                language = metaData["streams"][0]["tags"]["language"];
                resolution = `${metaData.streams[0].coded_width}x${metaData.streams[0].coded_height}`;
                audioArr = metaData.streams.filter((data) => {
                  if (data.codec_type === "audio") {
                    {
                      return data;
                    }
                  }
                });
                resolve();
              });
            });

            let showInfoToSave = {
              title: showsToAdd[i],
              backdropPhotoUrl: tvPoster
                ? tvPoster
                : "http://192.168.0.153:4012/assets/images/four0four.gif",
              numberOfSeasons,
              overview: showInfo.results[0] ? showInfo.results[0].overview : "",
              coverArt: tvCoverArt
                ? tvCoverArt
                : "http://192.168.0.153:4012/assets/images/four0four.gif",
              cast: castinfo ? JSON.stringify(castinfo) : JSON.stringify(""),
              audio: audioArr[0].codec_name,
              resolution,
              language,
              epTotal: files.length,
              backgroundPoster,
            };

            pool.query(`INSERT INTO tv SET ?`, showInfoToSave, (err, res) => {
              console.log(err, res);
            });

            let l = 1;
            async function seasonIterator() {
              pool.query(
                `SELECT * FROM seasons WHERE title = '${showsToAdd[i]}'`,
                async (er, re) => {
                  console.log(er, re);

                  if (l > re.length || re === undefined) {
                    let seasonReq;
                    let seasonResp;

                    if (showId) {
                      seasonReq = await fetch(
                        `https://api.themoviedb.org/3/tv/${showId}/season/${l}?api_key=490cd30bbbd167dd3eb65511a8bf2328`
                      );
                      seasonResp = await seasonReq.json();
                    }
                    let files = [];
                    function throughDirectory(Directory) {
                      fs.readdirSync(Directory).forEach((File) => {
                        const absolute = path.join(Directory, File);
                        if (fs.statSync(absolute).isDirectory())
                          return throughDirectory(absolute);
                        else return files.push(absolute);
                      });
                    }
                    throughDirectory(`J:/Shows/${showsToAdd[i]}`);
                    const numOfEpsInSeason = files.filter((filePath) => {
                      const filesParsed = filePath.split("\\");
                      let seasonNumGrab = parseInt(
                        filesParsed[3].split(" ")[1]
                      );
                      if (seasonNumGrab !== l) {
                        return false;
                      } else {
                        return true;
                      }
                    });

                    let seasonInfoObj;

                    if (
                      seasonResp &&
                      seasonResp.status_message !==
                        "The resource you requested could not be found."
                    ) {
                      episodesInfo = [...episodesInfo, ...seasonResp.episodes];
                    } else {
                      seasonInfoObj = {
                        title: showsToAdd[i],
                        season_number: l,
                        numOfEpInSeason: numOfEpsInSeason.length,
                        // poster: 'http://192.168.0.153:4012/assets/images/four0four.gif'
                      };
                    }
                    let seasonArt;

                    seasonInfoObj = {
                      title: showsToAdd[i],
                      season_number: l,
                      numOfEpsInSeason: numOfEpsInSeason.length,
                      // poster: seasonArt,
                    };

                    async function saver() {
                      return await pool.query(
                        `INSERT INTO seasons SET ?`,
                        seasonInfoObj,
                        async (err, resp) => {
                          for (var e = 0; e < numOfEpsInSeason.length; e++) {
                            let duration;
                            await new Promise((resolve) => {
                              ffmpeg.ffprobe(
                                `${files[e]}`,
                                function (err, metaData) {
                                  duration = Math.floor(
                                    metaData.format.duration
                                  );
                                  resolve();
                                }
                              );
                            });

                            const epInfoGrab = episodesInfo.filter(
                              (episode) => {
                                if (
                                  e + 1 === episode.episode_number &&
                                  l === episode.season_number
                                ) {
                                  return episode;
                                }
                              }
                            )[0];
                            const epCoverArt = await downloader.getEPCoverArt(
                              epInfoGrab,
                              showsToAdd[i]
                            );
                            const substitueEpName =
                              numOfEpsInSeason[e].split("/");

                            let epInfo = {
                              title: showsToAdd[i],
                              epTitle: epInfoGrab
                                ? epInfoGrab.name
                                    .replace(/[^\w\s\!\?]/g, "")
                                    .replace("?", "")
                                : `${showsToAdd[i]} EP ${e}`,
                              filePath: numOfEpsInSeason[e],
                              overview: epInfoGrab ? epInfoGrab.overview : "",
                              backdropPhotoUrl: epCoverArt,
                              // backgroundPoster,
                              epNumber: e + 1,
                              location: `http://192.168.0.153:4012/plexTemp/${files[
                                e
                              ]
                                .replace(".mkv", "")
                                .replace(new RegExp(" ", "g"), "%20")}.m3u8`,
                              season: l,
                              resolution: resolution,
                              seekTime: 0,
                              duration,
                            };

                            await pool.query(
                              `INSERT INTO episodes SET ?`,
                              epInfo,
                              async (err, res) => {
                                console.log(
                                  "EP VS SEASON: ",
                                  e,
                                  numOfEpsInSeason.length,
                                  l,
                                  numberOfSeasons
                                );
                                if (e === numOfEpsInSeason.length) {
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
                  : "http://192.168.0.153:4012/assets/images/four0four.gif",
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
