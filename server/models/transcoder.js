let pool = require("../../config/connections");
let fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
let codecGetter = require("./codec-determine");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const rimraf = require("rimraf");
const path = require("path");
const urlTransformer = require("../utils/url-transformer");
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
        fs.readdir("/mnt/F898C32498C2DFEC", (err, files) => {
          if (err) throw err;
          if (files.length > 0) {
            for (const file of files) {
              fs.unlink(path.join("/mnt/F898C32498C2DFEC", file), (err) => {
                if (err) throw err;
              });
            }
          }
        });

        process.kill(pid["pid"]);
        // if (pid.currentVideoTime.item.seekTime > 0) {
        //   const timeSaveObj = {
        //     titleOrEpisode: pid.currentVideoTime.item.title,
        //     time: pid.currentVideoTime.item.seekTime,
        //   };
        //   pool.query(
        //     `INSERT INTO pickupwhereleftoff SET ?`,
        //     timeSaveObj,
        //     (err, res) => {
        //       console.log(err, res);
        //     }
        //   );
        // }
        callback("ded");
      } catch (err) {
        callback({ error: err });
      }
    }
  },
  startConverting: async (movieTitle, callback) => {
    var fileExt = movieTitle.filePath.split(".").pop();
    
    // Check if device is Nvidia Shield and file is MKV - skip transcoding
    if (movieTitle.device === 'nvidia-shield' && fileExt.toLowerCase() === 'mkv') {
      console.log('Nvidia Shield detected with MKV file - skipping transcoding, returning original file');
      
      const streamUrl = `http://pixable.local:5012/api/mov/stream?path=${encodeURIComponent(movieTitle.filePath)}`;
      
      var movieReturner = {
        browser: movieTitle["browser"] || "Android",
        pid: 0, // No transcoding process
        duration: movieTitle["duration"],
        fileformat: movieTitle["fileformat"] || "mkv",
        location: urlTransformer.transformUrl(streamUrl),
        title: movieTitle["title"],
        subtitleFile: movieTitle["srtLocation"] 
          ? urlTransformer.transformUrl(`http://pixable.local:5012/modifiedVtts/${movieTitle["title"]}.vtt`)
          : undefined,
      };
      
      callback(null, movieReturner);
      return;
    }
    
    // For Zidoo devices, return the file path directly (not HTTP URL)
    // Zidoo player requires file paths, not HTTP streaming URLs
    if (movieTitle.device === 'zidoo') {
      console.log('Zidoo device detected - returning file path instead of streaming URL');
      
      // Transform server path to Zidoo SMB mount path
      // Example: /mnt/F898C32498C2DFEC/Videos/1917.mkv -> /mnt/smb/10.0.0.13/Videos/1917.mkv
      const serverPath = movieTitle.filePath;
      
      // Replace server mount point with Zidoo SMB mount point
      // TODO: Update zidooMountPoint to match your actual SMB mount path on Zidoo
      // To find your mount path:
      // 1. On Zidoo, open File Manager
      // 2. Navigate to your SMB share
      // 3. Note the full path (e.g., /mnt/smb/10.0.0.13/Videos or /mnt/nfs/10.0.0.13/Videos)
      // 4. Update zidooMountPoint below
      const serverMountPoint = '/mnt/F898C32498C2DFEC/Videos';
      const zidooMountPoint = '/mnt/smb/10.0.0.13/Videos'; // UPDATE THIS with your actual Zidoo mount path
      
      let zidooPath = serverPath;
      if (serverPath.startsWith(serverMountPoint)) {
        zidooPath = serverPath.replace(serverMountPoint, zidooMountPoint);
        console.log('Transformed path for Zidoo:', serverPath, '->', zidooPath);
      } else {
        console.warn('Server path does not match expected mount point:', serverPath);
        // If path doesn't match, try to extract just the filename and directory structure
        const pathParts = serverPath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const directory = pathParts[pathParts.length - 2] || 'Videos';
        zidooPath = `${zidooMountPoint}/${fileName}`;
        console.log('Using fallback path transformation:', zidooPath);
      }
      
      var movieReturner = {
        browser: movieTitle["browser"] || "Android",
        pid: 0, // No transcoding process
        duration: movieTitle["duration"],
        fileformat: movieTitle["fileformat"] || "mkv",
        location: zidooPath, // Return Zidoo SMB mount path
        title: movieTitle["title"],
        subtitleFile: movieTitle["srtLocation"] || undefined,
      };
      
      callback(null, movieReturner);
      return;
    }
    
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
                var newProc = spawn("ffmpeg", [
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
                  `/mnt/F898C32498C2DFEC/plexTemp/${movieTitle["title"].replace(".mkv", "")}.m3u8`,
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
                var newProc = spawn("ffmpeg", [
                  "-ss",
                  `${h}:${m}:${s}`,
                  "-y",
                  // '-copyts',
                  // '-probesize', '10M',
                  // '-fflags', '+genpts',
                  "-i",
                  `${movieTitle["filePath"]}`,
                  // '-i', 'AlitaBattleAngel20191080pUHD2BDeng.srt',
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
                  `/mnt/F898C32498C2DFEC/plexTemp/${movieTitle["title"]}.m3u8`,
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
                var newProc = spawn("ffmpeg", [
                  "-ss",
                  `${h}:${m}:${s}`,
                  "-y",
                  // '-copyts',
                  // '-probesize', '10M',
                  "-i",
                  `${movieTitle["filePath"]}`,
                  // '-i', 'AlitaBattleAngel20191080pUHD2BDeng.srt',
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
                  `/mnt/F898C32498C2DFEC/plexTemp/${movieTitle["title"]}.m3u8`,
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

            var watcher = fs.watch("/mnt/F898C32498C2DFEC/plexTemp/", (event, filename) => {
              console.log("HERE IS PID", processId);
              if (filename == `${movieTitle["title"]}.m3u8.tmp`) {
                watcher.close();
                console.log("its here");
                var movieReturner = {
                  browser: movieTitle["browser"],
                  pid: processId,
                  duration: movieTitle["duration"],
                  fileformat: movieTitle["fileformat"],
                  location: urlTransformer.transformUrl(
                    "http://pixable.local:5012/plexTemp/" +
                    movieTitle["title"] +
                    ".m3u8".replace(new RegExp(" ", "g"), "%20")
                  ),
                  // location: 'http://pixable.local:5012/plexTemp/master.m3u8'.replace(new RegExp(' ', 'g'), '%20'),
                  title: movieTitle["title"],
                  subtitleFile: urlTransformer.transformUrl(`http://pixable.local:5012/modifiedVtts/${movieTitle["title"]}.vtt`),
                };
                callback(null, movieReturner);
                return;
              }
            });
          }

          if (movieTitle["browser"] == "Chrome") {
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
              var newProc = spawn("ffmpeg", [
                "-ss",
                `${h}:${m}:${s}`,
                "-i",
                `${movieTitle["filePath"]}`,
                // '-i', 'AlitaBattleAngel20191080UHD2BDeng.vtt',
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
                `/mnt/F898C32498C2DFEC/plexTemp/${movieTitle["title"]}.m3u8`,
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

            var watcher = fs.watch("/mnt/F898C32498C2DFEC/plexTemp/", (event, filename) => {
              watcher.close();
              console.log("its here");
              var movieReturner = {
                browser: movieTitle["browser"],
                pid: processId,
                duration: movieTitle["duration"],
                fileformat: movieTitle["fileformat"],
              location: urlTransformer.transformUrl(
                "http://pixable.local:5012/plexTemp/" +
                movieTitle["title"] +
                ".m3u8".replace(new RegExp(" ", "g"), "%20")
              ),
              title: movieTitle["title"],
              };
              callback(null, movieReturner);

              return;
            });
          }
        // } else {
        //   var movieReturner = {
        //     browser: movieTitle["browser"],
        //     pid: processId,
        //     duration: movieTitle["duration"],
        //     fileformat: movieTitle["fileformat"],
        //     location: movieTitle.location,
        //     // location: 'http://pixable.local:5012/plexTemp/master.m3u8'.replace(new RegExp(' ', 'g'), '%20'),
        //     title: movieTitle["title"],
        //     subtitleFile: urlTransformer.transformUrl(`http://pixable.local:5012/modifiedVtts/${movieTitle["title"]}.vtt`),
        //   };
        //   callback(null, movieReturner);
        // }
      }
    );
  },
};
module.exports = transcoder;
