let pool = require("../../config/connections");
let fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
let codecGetter = require("./codec-determine");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const path = require("path");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
let chokidar = require("chokidar");
var showPlayer = false;
var fetch = require("node-fetch");
const spawn = require("child_process").spawn;
var ffstream = ffmpeg();
var exec = require("child_process").exec;
var WebSocketServer = require("ws").Server;
const { client } = require("websocket");
const { async } = require("rxjs/internal/scheduler/async");
const { execSync } = require("child_process");

let wss = new WebSocketServer({
  port: 4444,
});

function originIsAllowed(origin) {
  return true;
}
let clients = [];
var videoObj;

wss.on("connection", function (connection) {
  console.log(new Date() + " Connection accepted.");
  clients.push(connection);
  connection.on("message", async function (message) {
    if (!videoObj) {
      console.log("CLIENTS LENGTH: ", clients.length);

      try {
        videoObj = JSON.parse(message);
        console.log(videoObj);
      } catch (err) {
        console.log(err);
        videoObj = {};
      }

      var backendClient = undefined;

      if (videoObj.backOrFront === "backend") {
        backendClient = connection;
      }

      if (videoObj.type === "movie") {
        let dvMovies = await fs.readdirSync("I:/ConvertedDVMKVs");
        let movie = `I:/Videos/${videoObj.title}.mkv`;
        if (dvMovies.includes(`${videoObj.title}.mkv`)) {
          movie = `I:/Videos/${videoObj.title}.mp4`;
        }
        ffmpeg.ffprobe(`${movie}`, (e, metadata) => {
          var newJob = async () => {
            console.log("firing!!!!");
            let files = await fs.readdirSync("I:/toPixie");

            const toPixieDirlength = await fs.readdirSync(`I:/toPixie/`);

            if (toPixieDirlength.length > 0) {
              for (const file of toPixieDirlength) {
                await fs.unlinkSync(`I:/toPixie/${file}`);
              }
            }

            let command = [];

            command = [
              // "-ss", "0",
              "-t",
              "5",
              "-i",
              `${movie}`,
              "-y",
              "-vf",
              "scale=w=1920:h=1080",
              "-c:v",
              "libx264",
              "-c:a",
              "aac",
              "-ac",
              "6",
              // "-tag:v", "hvc1",
              "-pix_fmt",
              "yuv420p",
              "-b:v",
              "4000k",
              "-movflags",
              "+faststart",
              `I:/toPixie/${videoObj.title}.mp4`,
            ];

            var newProc = spawn("F:/ffmpeg", command);
            newProc.on("error", function (err) {
              console.log("ls error", err);
            });

            newProc.stdout.on("data", function (data) {
              console.log("stdout: " + data);
            });

            newProc.stderr.on("data", function (data) {
              console.log("DATA: ", String(data));
              if (metadata) {
                function secondsToDhms(hms) {
                  var a = hms.split(":");
                  var seconds = +a[0] * 60 * 60 + +a[1] * 60 + +a[2];
                  return seconds;
                }

                let stringData = String(data);
                let parser = stringData.split("=");

                if (parser[5]) {
                  // let totalDuration = metadata["format"]["duration"];
                  let totalDuration = 5;
                  let currentTranscodedTime = parser[5].split(" ")[0];
                  let seconds = secondsToDhms(currentTranscodedTime);
                  if (seconds) {
                    let predictedPercentage = parseInt(
                      String(Math.abs((seconds / totalDuration) * 100)).split(
                        "."
                      )[0]
                    );

                    if (clients) {
                      clients.forEach((client) => {
                        console.log(
                          "Predicted percentage: ",
                          predictedPercentage
                        );
                        client.send(
                          JSON.stringify({
                            type: "Syncing",
                            video: videoObj.video,
                            percentDone: predictedPercentage,
                            type: "movie",
                          })
                        );
                      });
                    }
                  }
                }
              }
            });
            newProc.on("close", function (code) {
              console.log("closing...");
              clients.forEach((client) => {
                client.send(
                  JSON.stringify({
                    type: "Syncing",
                    title: videoObj.title,
                    percentDone: 100,
                    type: "movie",
                  })
                );
              });
              videoObj = undefined;
            });
          };
          newJob();
        });
      }

      if (videoObj.type === "tv") {
        function emptyDir(dirPath) {
          const dirContents = fs.readdirSync(dirPath); // List dir content

          for (const fileOrDirPath of dirContents) {
            try {
              // Get Full path
              const fullPath = path.join(dirPath, fileOrDirPath);
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                // It's a sub directory
                if (fs.readdirSync(fullPath).length) emptyDir(fullPath);
                // If the dir is not empty then remove it's contents too(recursively)
                fs.rmdirSync(fullPath);
              } else fs.unlinkSync(fullPath); // It's a file
            } catch (ex) {
              console.error(ex.message);
            }
          }
        }

        const toPixieDirlength = await fs.readdirSync(`F:/toPixie/`);

        if (toPixieDirlength.length > 0) {
          for (const file of toPixieDirlength) {
            // await fs.rmdirSync(`F:/toPixie/${toPixieDirlength[i]}`)
            await fs.unlinkSync(`F:/toPixie/${file}`);
          }
        }

        console.log("Directory created successfully!");
        pool.query(
          `SELECT * FROM tv WHERE title = '${videoObj.show}'`,
          async (er, res) => {
            pool.query(
              `SELECT * FROM episodes WHERE title = '${videoObj.show}'`,
              async (e, epInfo) => {
                let seasonIterator = videoObj.season;
                videoObj.overview = epInfo[0].overview;
                const files = [];

                const filePath = videoObj.filePath;
                const seasonGrabber = videoObj.season;
                await ffmpeg.ffprobe(filePath, (e, metadata) => {
                  var newProc = spawn("J:/ffmpeg", [
                    // "-ss",
                    // "0",
                    // "-t",
                    // "15",
                    "-i",
                    filePath,
                    "-y",
                    "-vf",
                    "scale=w=1920:h=1080",
                    "-c:v",
                    "libx264",
                    "-c:a",
                    "aac",
                    "-ac",
                    "6",
                    // "-tag:v", "hvc1",
                    "-pix_fmt",
                    "yuv420p",
                    "-b:v",
                    "2000k",
                    "-movflags",
                    "+faststart",
                    `J:/toPixie/${videoObj.title.replace("?", "")}.mp4`,
                  ]);
                  newProc.on("error", function (err) {
                    console.log("ls error", err);
                  });

                  newProc.stdout.on("data", function (data) {
                    console.log("stdout: " + data);
                  });

                  newProc.stderr.on("data", function (data) {
                    console.log("DATA: ", String(data));
                    if (metadata) {
                      function secondsToDhms(hms) {
                        var a = hms.split(":");
                        var seconds = +a[0] * 60 * 60 + +a[1] * 60 + +a[2];
                        return seconds;
                      }

                      let stringData = String(data);
                      let parser = stringData.split("=");

                      if (parser[5]) {
                        let totalDuration = metadata["format"]["duration"];
                        // let totalDuration = 15;
                        let currentTranscodedTime = parser[5].split(" ")[0];
                        let seconds = secondsToDhms(currentTranscodedTime);
                        if (seconds) {
                          let predictedPercentage = parseInt(
                            String(
                              Math.abs((seconds / totalDuration) * 100)
                            ).split(".")[0]
                          );

                          if (clients) {
                            clients.forEach((client) => {
                              console.log(
                                "Predicted percentage: ",
                                predictedPercentage
                              );
                              client.send(
                                JSON.stringify({
                                  type: "Syncing",
                                  title: videoObj.title,
                                  percentDone: predictedPercentage,
                                  type: "tv",
                                })
                              );
                            });
                          }
                        }
                      }
                    }
                  });
                  newProc.on("close", function (code) {
                    clients.forEach((client) => {
                      client.send(
                        JSON.stringify({
                          type: "Syncing",
                          title: videoObj.show,
                          percentDone: 100,
                          type: "tv",
                          season: videoObj.season,
                          epTitle: videoObj.title,
                          overview: videoObj.overview,
                        })
                      );
                    });
                    videoObj = undefined;
                  });
                });
              }
            );
          }
        );
      }

      if (videoObj.type === "transcoding") {
        backendClient.send(
          JSON.stringify({ type: "transcoding", video: videoObj.video })
        );
      }

      if (videoObj.type === "Downloading") {
        clients.forEach((client) => {
          client.send(
            JSON.stringify({
              type: "Downloading",
              video: videoObj.video,
              percentDone: 100,
            })
          );
        });
      }

      if (message.type === "binary") {
        console.log(
          "Received Binary Message of " + message.binaryData.length + " bytes"
        );
        connection.sendBytes(message.binaryData);
      }

      if (videoObj.type === "finished downloading") {
        fs.rmdir(`F:/toPixie/${videoObj.video}`, (err, res) => {
          console.log(
            "Removed dir after complete download: ",
            videoObj.video,
            err,
            res
          );
        });
      }

      if (videoObj.type === "Syncing complete") {
        clients.send(
          JSON.stringify({
            type: "Syncing complete",
            video: videoObj.video,
            percentDone: 100,
          })
        );
      }
    }
  });
  connection.on("close", function (reasonCode, description) {
    console.log(
      new Date() + " Peer " + connection.remoteAddress + " disconnected."
    );
  });
});

let pixie = {
  getDirAfterTranscode: (movie, callback) => {
    fs.readdir(`F:/toPixie//${movie["movie"]}`, (err, files) => {
      console.log("", err, files);
      callback(files);
    });
  },
};

module.exports = pixie;
