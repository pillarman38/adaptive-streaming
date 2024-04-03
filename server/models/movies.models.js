let pool = require("../../config/connections");
let fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
let codecGetter = require("./codec-determine");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
ffmpeg.setFfprobePath(ffprobePath);
const rimraf = require("rimraf");
const path = require("path");
ffmpeg.setFfmpegPath(ffmpegPath);

let chokidar = require("chokidar");
var showPlayer = false;
var fetch = require("node-fetch");
const { spawn } = require("child_process");
const { networkInterfaces } = require("os");
const cp = require("child_process");
const { resolve } = require("core-js/fn/promise");
const Downloader = require("./downloader");
const BonusFeatures = require("./bonusFeatures");

var arrOfObj = [];
var newArr = [];
var url = "";
var i = 0;
var fileLocation = "";
var newSrc;

var arr = [];
var killProcess = false;
var ffstream = ffmpeg();
var exec = require("child_process").exec;
const { execSync } = require("child_process");
const { restart } = require("nodemon");

let routeFunctions = {
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
            backdropPhotoUrl:
              "http://192.168.0.153:4012/assets/images/four0four.gif",
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
            backdropPhotoUrl:
              "http://192.168.0.153:4012/assets/images/four0four.gif",
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
                  backdropPhotoUrl:
                    "http://192.168.0.153:4012/assets/images/four0four.gif",
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
              photoUrl: `http://192.168.0.153:4012/assets/images/four0four.gif`,
              backdropPhotoUrl: `http://192.168.0.153:4012/assets/images/four0four.gif`,
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

  getAllMovies: async (pid, callback) => {
    if (pid["pid"] != 0) {
      try {
        process.kill(pid["pid"]);
      } catch (err) {
        pid["pid"] = 0;
      }
    }

    setTimeout(function () {
      ffstream.on("error", function () {
        console.log("Ffmpeg has been killed");
      });
    }, 1000);
    arrOfObj = [];

    let loginOpenSubtitles = await fetch(
      `https://api.opensubtitles.com/api/v1/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": "yjiZSEgVBCJ2Uv5qMjWkherTHWd45BnR",
        },
        body: JSON.stringify({
          username: "pillarman38",
          password: "Goodkid38!!**()",
        }),
      }
    );

    var loginSuccess = true;
    let loginRes;
    try {
      loginRes = await loginOpenSubtitles.json();
    } catch (err) {
      loginSuccess = false;
    }

    fs.readdir("I:/Videos/", async (err, files) => {
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

        var l = 0;
        var openSubsApiLoginBearerToken = "";

        async function iterate() {
          if (notIncluded.length > 0) {
            var fileName = notIncluded[l];
            let fileNameNoExt = fileName
              .replace(".mp4", "")
              .replace(".mkv", "");
            var firstObj = {
              title: notIncluded[l],
              movieListUrl: `https://api.themoviedb.org/3/search/movie?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${fileNameNoExt
                .replace(new RegExp(" ", "g"), "%20")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")}`,
            };

            await ffmpeg.ffprobe(
              `I:/Videos/${fileName}`,
              async function (err, metaData) {
                let dolbyVision = false;
                let write = "";

                function cmd(...command) {
                  let p = spawn(command[0], command.slice(1));
                  return new Promise((resolveFunc) => {
                    p.stdout.on("data", (x) => {
                      process.stdout.write(x.toString());
                      write = x.toString().split(/\r?\n/);
                    });
                    p.stderr.on("data", (x) => {
                      process.stderr.write(x.toString());
                      write = x.toString().split(/\r?\n/);
                    });
                    p.on("exit", (code) => {
                      resolveFunc(code);
                    });
                  });
                }

                mbpsWithfixedDecimal = "";
                if (metaData.streams[0]) {
                  const Mbps = metaData.streams[0].bit_rate / 1000000; // Divide by 1,000,000 to get Mbps
                  mbpsWithfixedDecimal = Mbps.toFixed(2);
                }

                var fileExt = metaData.format.filename.split(".").pop();
                let location = "";

                if (fileExt === "mp4") {
                  location = `http://192.168.0.153:4012/Videos/${fileNameNoExt.replace(
                    new RegExp(" ", "g"),
                    "%20"
                  )}.${fileExt}`;
                }

                if (fileExt === "mkv") {
                  fileExt = "m3u8";
                  location = `http://192.168.0.153:4012/plexTemp/${fileNameNoExt.replace(
                    new RegExp(" ", "g"),
                    "&%20"
                  )}.${fileExt}`;
                }

                var subTarr = [];
                var audioArr = [];
                var subcounter = -1;
                var audiocounter = -1;

                if (metaData !== undefined) {
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
                }

                const downloader = new Downloader();
                const bonusFeatures = new BonusFeatures();

                let moviedata = await fetch(firstObj.movieListUrl);
                let data = await moviedata.json();
                let poster = await downloader.getPoster(
                  fileNameNoExt,
                  data,
                  "movies"
                );
                let trailerUrl = await downloader.getTrailer(
                  fileNameNoExt,
                  data
                );
                let coverArt = await downloader.getCoverArt(
                  fileNameNoExt,
                  data,
                  "movie"
                );
                let backgroundPoster = await downloader.getBackgroundPoster(
                  fileNameNoExt,
                  data,
                  "movie"
                );
                let subtitleSrts = "";
                if (loginSuccess === true && loginRes) {
                  subtitleSrts = await downloader.getSubtitleSrts(
                    fileNameNoExt,
                    data,
                    loginRes,
                    metaData
                  );
                }

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
                if (metaData.streams[0].codec_tag_string) {
                  fileformat = metaData.streams[0].codec_tag_string;
                }

                if (metaData) {
                  var metaDataObj = {
                    title: fileNameNoExt,
                    filePath: metaData["format"]["filename"],
                    posterUrl: poster || "",
                    coverArt,
                    cast: parsedCastList,
                    audio: audioArr[0].codec_name,
                    overview:
                      data["results"] === undefined ||
                      data["results"].length === 0
                        ? ""
                        : data["results"][0]["overview"],
                    duration: metaData["format"]["duration"],
                    resolution,
                    channels: audioArr[0].channels
                      ? audioArr[0].channels
                      : undefined,
                    fileformat,
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
                      ? `F:/Subtitles/${fileNameNoExt}.srt`
                      : "",
                    location,
                    trailerUrl,
                    srtUrl: subtitleSrts || "",
                    bonusFeatures: bf,
                    backgroundPoster,
                    vbr: mbpsWithfixedDecimal,
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
                    pool.query(
                      `SELECT * FROM movies ORDER BY title ASC`,
                      (err, resp) => {
                        pool.query(
                          `SELECT * from pickupwhereleftoff`,
                          (e, r) => {
                            callback(resp);
                          }
                        );
                      }
                    );
                  } else {
                    l += 1;
                    await iterate();
                  }
                }
              }
            );
          } else {
            res.map((movie) => {
              movie.subtitles = JSON.parse(movie.subtitles);
              return movie;
            });
            pool.query(`SELECT * from pickupwhereleftoff`, (e, r) => {
              res.map((movie, i) => {
                let hi = r.find((mo) => mo.titleOrEpisode === movie.title);

                if (hi) {
                  res[i].seekTime = hi ? hi.time : 0;
                  res[i].resumePressed = true;
                }
                return movie;
              });
              callback(err, res);
            });
          }
        }
        iterate();
      });
    });
  },
};

module.exports = routeFunctions;
