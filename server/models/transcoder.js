let pool = require("../../config/connections");
let fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
let codecGetter = require("./codec-determine");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const rimraf = require("rimraf");
const path = require("path");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const { spawn } = require("child_process");

const transcoder = {
  pidKiller: (pid, callback) => {
    if (pid["pid"] === 0) {
      callback("nothing to kill");
    }
    if (pid["pid"] !== 0) {
      try {
        fs.readdir("I:/plexTemp", (err, files) => {
          if (err) throw err;
          if (files.length > 0) {
            for (const file of files) {
              fs.unlink(path.join("I:/plexTemp", file), (err) => {
                if (err) throw err;
              });
            }
          }
        });

        process.kill(pid["pid"]);
        if (pid.currentVideoTime.item.seekTime > 0) {
          const timeSaveObj = {
            titleOrEpisode: pid.currentVideoTime.item.title,
            time: pid.currentVideoTime.item.seekTime,
          };
          pool.query(
            `INSERT INTO pickupwhereleftoff SET ?`,
            timeSaveObj,
            (err, res) => {
              console.log(err, res);
            }
          );
        }
        callback("ded");
      } catch (err) {
        callback({ error: err });
      }
    }
  },
  startConverting: async (movieTitle, callback) => {
    var fileExt = movieTitle.filePath.split(".").pop();
    pool.query(
      `DELETE FROM pickupwhereleftoff WHERE titleOrEpisode = '${movieTitle.title}'`,
      async (error, resp) => {
        console.log(error, resp);

        var getRes = codecGetter.getVideoResoluion(movieTitle);
        var getFormat = codecGetter.getVideoFormat(movieTitle);

        var h = Math.floor(movieTitle["seekTime"] / 3600);
        var m = Math.floor((movieTitle["seekTime"] % 3600) / 60);
        var s = Math.floor((movieTitle["seekTime"] % 3600) % 60);

        if (h < 0 || m < 0 || s < 0) {
          h = 0;
          m = 0;
          s = 0;
        }

        if (fileExt !== "mp4") {
          if (movieTitle["pid"] === 0 || movieTitle["pid"] === undefined) {
            console.log("nothing to kill");
          }
          if (movieTitle["pid"] !== 0 && movieTitle["pid"] !== undefined) {
            try {
              process.kill(movieTitle["pid"]);
            } catch (err) {
              movieTitle["pid"] = 0;
              console.log(movieTitle["pid"]);
            }
          }

          if (movieTitle["browser"] == "Safari") {
            var processId = 0;
            var h = Math.floor(movieTitle["seekTime"] / 3600);
            var m = Math.floor((movieTitle["seekTime"] % 3600) / 60);
            var s = Math.floor((movieTitle["seekTime"] % 3600) % 60);
            if (h < 0 || m < 0 || s < 0) {
              h = 0;
              m = 0;
              s = 0;
            }

            srtFilePath = movieTitle["srtLocation"];

            if (movieTitle["resolution"] == "720x480") {
              var newJob = function () {
                var newProc = spawn("F:/ffmpeg", [
                  "-ss",
                  `${h}:${m}:${s}`,
                  "-i",
                  `${movieTitle["filePath"]}`,
                  "-y",
                  "-acodec",
                  "aac",
                  "-ac",
                  "2",
                  "-c:v",
                  "libx264",
                  // '-crf', '18',
                  "-start_number",
                  0,
                  "-hls_time",
                  "5",
                  "-force_key_frames",
                  "expr:gte(t,n_forced*5)",
                  "-hls_list_size",
                  "0",
                  "-f",
                  "hls",
                  `I:/plexTemp/${movieTitle["title"].replace(".mkv", "")}.m3u8`,
                ]);
                newProc.on("error", function (err) {
                  console.log("ls error", err);
                });

                newProc.stdout.on("data", function (data) {
                  console.log("stdout: " + data);
                });

                newProc.stderr.on("data", function (data) {
                  console.log("stderr: " + data);
                });

                newProc.on("close", function (code) {
                  console.log("child process exited with code " + code);
                });
                processId = newProc.pid;
              };
              newJob();
            }

            if (movieTitle["resolution"] == "1920x1080") {
              var newJob = async function () {
                var newProc = spawn("F:/ffmpeg", [
                  "-ss",
                  `${h}:${m}:${s}`,
                  "-y",
                  // '-copyts',
                  // '-probesize', '10M',
                  // '-fflags', '+genpts',
                  "-i",
                  `${movieTitle["filePath"]}`,
                  // '-i', 'F:/AlitaBattleAngel20191080pUHD2BDeng.srt',
                  // '-ss', `${h}:${m}:${s}`,
                  // '-t', '00:30:00',
                  // '-map', '0',
                  "-c:v",
                  "copy",
                  "-c:a",
                  "eac3",
                  "-ac",
                  "6",
                  // '-pix_fmt', 'yuv420p10le',
                  // '-filter:v',
                  // '-tag:v', 'hevc',
                  // '-movflags', '+faststart',
                  // '-profile:v', 'baseline', // encoding profile
                  // `-copyts`, `-copytb`, `0`,
                  // '-start_number', 0,
                  // '-bsf:v', 'hevc_metadata',
                  "-hls_time",
                  "5",
                  "-force_key_frames",
                  "expr:gte(t,n_forced*5)",
                  "-hls_list_size",
                  "0",
                  "-strict",
                  "-2",
                  "-f",
                  "hls",
                  // '-hls_segment_type','mpegts',
                  `I:/plexTemp/${movieTitle["title"]}.m3u8`,
                ]);
                newProc.on("error", function (err) {
                  console.log("ls error", err);
                });

                newProc.stdout.on("data", function (data) {
                  console.log("stdout: " + data);
                });

                newProc.stderr.on("data", function (data) {
                  console.log("stderr: " + data);
                });

                newProc.on("close", function (code) {
                  console.log("child process exited with code " + code);
                });
                processId = newProc.pid;
              };
              newJob();
            }

            if (movieTitle["resolution"] === "3840x2160") {
              var newJob = async function () {
                var newProc = spawn("I:/ffmpeg", [
                  "-ss",
                  `${h}:${m}:${s}`,
                  "-y",
                  // '-copyts',
                  // '-probesize', '10M',
                  "-i",
                  `${movieTitle["filePath"]}`,
                  // '-i', 'F:/AlitaBattleAngel20191080pUHD2BDeng.srt',
                  // '-ss', `${h}:${m}:${s}`,
                  // '-t', '00:30:00',
                  // '-map', '0',
                  "-c:v",
                  "copy",
                  "-c:a",
                  "eac3",
                  "-ac",
                  "6",
                  "-pix_fmt",
                  "yuv420p10le",
                  // '-filter:v',
                  // '-tag:v', 'hevc',
                  // '-movflags', '+faststart',
                  // '-profile:v', 'baseline', // encoding profile
                  // `-copyts`, `-copytb`, `0`,
                  // '-start_number', 0,
                  "-bsf:v",
                  "hevc_metadata",
                  "-hls_time",
                  "5",
                  "-force_key_frames",
                  "expr:gte(t,n_forced*5)",
                  "-hls_list_size",
                  "0",
                  // '-strict', '-2',
                  "-f",
                  "hls",
                  "-hls_segment_type",
                  "mpegts",
                  `I:/plexTemp/${movieTitle["title"]}.m3u8`,
                ]);
                newProc.on("error", function (err) {
                  console.log("ls error", err);
                });

                newProc.stdout.on("data", function (data) {
                  console.log("stdout: " + data);
                });

                newProc.stderr.on("data", function (data) {
                  console.log("stderr: " + data);
                });

                newProc.on("close", function (code) {
                  console.log("child process exited with code " + code);
                });
                processId = newProc.pid;
              };
              newJob();
            }

            var watcher = fs.watch("I:/plexTemp/", (event, filename) => {
              console.log("HERE IS PID", processId);
              if (filename == `${movieTitle["title"]}.m3u8`) {
                watcher.close();
                console.log("its here");
                var movieReturner = {
                  browser: movieTitle["browser"],
                  pid: processId,
                  duration: movieTitle["duration"],
                  fileformat: movieTitle["fileformat"],
                  location:
                    "http://192.168.1.6:5012/plexTemp/" +
                    movieTitle["title"] +
                    ".m3u8".replace(new RegExp(" ", "g"), "%20"),
                  // location: 'http://192.168.1.6:5012/plexTemp/master.m3u8'.replace(new RegExp(' ', 'g'), '%20'),
                  title: movieTitle["title"],
                  subtitleFile: `http://192.168.1.6:5012/modifiedVtts/${movieTitle["title"]}.vtt`,
                };
                callback(null, movieReturner);
                return;
              }
            });
          }

          if (movieTitle["browser"] == "Chrome") {
            console.log("hi");
            var h = Math.floor(movieTitle["seekTime"] / 3600);
            var m = Math.floor((movieTitle["seekTime"] % 3600) / 60);
            var s = Math.floor((movieTitle["seekTime"] % 3600) % 60);
            if (h < 0 || m < 0 || s < 0) {
              h = 0;
              m = 0;
              s = 0;
            }

            var srtFilePath = movieTitle["srtLocation"];
            var processId = 0;

            var newJob = function () {
              // if(movieTitle['subtitles'] != -1) {
              var newProc = spawn("F:/ffmpeg", [
                "-ss",
                `${h}:${m}:${s}`,
                "-i",
                `${movieTitle["filePath"]}`,
                // '-i', 'F:/AlitaBattleAngel20191080UHD2BDeng.vtt',
                // '-filter:v', 'scale=w=1920:h=1080',
                "-c:v",
                "libx264",
                "-crf",
                "21",
                "-c:a",
                "aac",
                "-ac",
                "6",
                "-start_number",
                0,
                "-hls_time",
                "5",
                "-force_key_frames",
                "expr:gte(t,n_forced*5)",
                "-hls_list_size",
                "0",
                "-f",
                "hls",
                `I:/plexTemp/${movieTitle["title"]}.m3u8`,
              ]);
              newProc.on("error", function (err) {
                console.log("ls error", err);
              });

              newProc.stdout.on("data", function (data) {
                console.log("stdout: " + data);
              });

              newProc.stderr.on("data", function (data) {
                console.log("stderr: " + data);
              });

              newProc.on("close", function (code) {
                console.log("child process exited with code " + code);
              });
              processId = newProc.pid;
            };
            newJob();

            var watcher = fs.watch("I:/plexTemp/", (event, filename) => {
              watcher.close();
              console.log("its here");
              var movieReturner = {
                browser: movieTitle["browser"],
                pid: processId,
                duration: movieTitle["duration"],
                fileformat: movieTitle["fileformat"],
                location:
                  "http://192.168.1.6:5012/plexTemp/" +
                  movieTitle["title"] +
                  ".m3u8".replace(new RegExp(" ", "g"), "%20"),
                title: movieTitle["title"],
              };
              callback(null, movieReturner);

              return;
            });
          }
        } else {
          var movieReturner = {
            browser: movieTitle["browser"],
            pid: processId,
            duration: movieTitle["duration"],
            fileformat: movieTitle["fileformat"],
            location: movieTitle.location,
            // location: 'http://192.168.1.6:5012/plexTemp/master.m3u8'.replace(new RegExp(' ', 'g'), '%20'),
            title: movieTitle["title"],
            subtitleFile: `http://192.168.1.6:5012/modifiedVtts/${movieTitle["title"]}.vtt`,
          };
          callback(null, movieReturner);
        }
      }
    );
  },
};
module.exports = transcoder;
