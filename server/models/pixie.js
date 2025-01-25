let pool = require("../../config/connections");
let fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const path = require("path");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const spawn = require("child_process").spawn;

let WebSocketServer = require("ws").Server;

let wss = new WebSocketServer({
  port: 4444,
});
console.log("WSS: ");

let clients = [];

wss.on("connection", function (connection) {
  console.log(new Date() + " Connection accepted.");
  clients.push(connection);
  // connection.send("Connection recieved!");
  connection.on("message", async function (message) {
    // console.log("message: ", message);
    message = JSON.parse(message);
    if (message.type === "Downloading") {
      clients.forEach((client) => {
        client.send(JSON.stringify(message));
      });
    }

    if (message) {
      // console.log("CLIENTS LENGTH: ", clients.length);

      try {
        // message = message;
        // console.log(message);
      } catch (err) {
        console.log(err);
        message = {};
      }

      let backendClient = undefined;

      if (message.backOrFront === "backend") {
        backendClient = connection;
      }

      if (message.type === "movie" && message.transmuxToPixie === 0) {
        let moviesList = await fs.readdirSync("I:/Videos");

        let movie = moviesList.find((element) =>
          element.includes(message.title)
        );
        movie = `I:/Videos/${movie}`;

        ffmpeg.ffprobe(`${movie}`, (e, metadata) => {
          let newJob = async () => {
            console.log("firing!!!!");
            let files = await fs.readdirSync("I:/toPixie");

            const toPixieDirlength = await fs.readdirSync(`I:/toPixie/`);

            if (toPixieDirlength.length > 0) {
              for (const file of toPixieDirlength) {
                await fs.unlinkSync(`I:/toPixie/${file}`);
              }
            }

            let command = [];
            if (metadata.streams[0].codec_name === "hevc") {
              command = [
                // "-t",
                // "5",
                "-y",
                "-i",
                `${movie}`,
                "-vf",
                "scale=w=1920:h=1080",
                "-c:v",
                "libx265",
                "-b:v",
                "4000k",
                "-bsf:v",
                "hevc_metadata",
                "-c:a",
                "eac3",
                "-b:a",
                "640k",
                "-tag:v",
                "hvc1",
                `I:/toPixie/${message.title}.mp4`,
              ];
            } else {
              command = [
                "-y",
                // "-ss", "0",
                // "-t",
                // "5",
                "-i",
                `${movie}`,
                "-y",
                "-vf",
                "scale=w=1920:h=1080",
                "-c:v",
                "libx265",
                "-c:a",
                "eac3",
                "-ac",
                "6",
                "-tag:v",
                "hvc1",
                "-pix_fmt",
                "yuv420p",
                "-b:v",
                "4000k",
                "-movflags",
                "+faststart",
                `I:/toPixie/${message.title}.mp4`,
              ];
            }

            let newProc = spawn("F:/ffmpeg", command);
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
                  let a = hms.split(":");
                  let seconds = +a[0] * 60 * 60 + +a[1] * 60 + +a[2];
                  return seconds;
                }

                let stringData = String(data);
                let parser = stringData.split("=");

                if (parser[5]) {
                  let totalDuration = metadata["format"]["duration"];
                  // let totalDuration = 5;
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
                            syncStatus: "Syncing",
                            title: message.title,
                            percentage: predictedPercentage,
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
                    title: message.title,
                    percentage: 100,
                    type: "movie",
                  })
                );
              });
              message = undefined;
            });
          };
          newJob();
        });
      }
      if (message.type === "movie" && message.transmuxToPixie === 1) {
        let moviesList = await fs.readdirSync("I:/Videos");

        let movie = moviesList.find((element) =>
          element.includes(message.title)
        );
        movie = `I:/Videos/${movie}`;

        ffmpeg.ffprobe(`${movie}`, (e, metadata) => {
          let newJob = async () => {
            console.log("firing!!!!");
            let files = await fs.readdirSync("I:/toPixie");

            const toPixieDirlength = await fs.readdirSync(`I:/toPixie/`);

            if (toPixieDirlength.length > 0) {
              for (const file of toPixieDirlength) {
                await fs.unlinkSync(`I:/toPixie/${file}`);
              }
            }

            let command = [];
            if (metadata.streams[0].codec_name === "hevc") {
              command = [
                "-y",
                // "-t",
                // "30",
                "-i",
                `${movie}`,
                "-c:v",
                "copy",
                "-c:a",
                "eac3",
                "-ac",
                "6",
                "-tag:v",
                "hvc1",
                "-movflags",
                "+faststart",
                `I:/toPixie/${message.title}.mp4`,
              ];
            }

            let newProc = spawn("F:/ffmpeg", command);
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
                  let a = hms.split(":");
                  let seconds = +a[0] * 60 * 60 + +a[1] * 60 + +a[2];
                  return seconds;
                }

                let stringData = String(data);
                let parser = stringData.split("=");

                if (parser[5]) {
                  let totalDuration = metadata["format"]["duration"];
                  // let totalDuration = 5;
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
                            syncStatus: "Syncing",
                            title: message.title,
                            percentage: predictedPercentage,
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
                    title: message.title,
                    percentage: 100,
                    type: "movie",
                  })
                );
              });
              message = undefined;
            });
          };
          newJob();
        });
      }

      if (message.type === "tv") {
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
          `SELECT * FROM tv WHERE title = '${message.show}'`,
          async (er, res) => {
            pool.query(
              `SELECT * FROM episodes WHERE title = '${message.show}'`,
              async (e, epInfo) => {
                let seasonIterator = message.season;
                message.overview = epInfo[0].overview;
                const files = [];

                const filePath = message.filePath;
                const seasonGrabber = message.season;
                await ffmpeg.ffprobe(filePath, (e, metadata) => {
                  let newProc = spawn("J:/ffmpeg", [
                    // "-ss",
                    // "0",
                    // "-t",
                    // "5",
                    "-y",
                    "-i",
                    filePath,
                    "-y",
                    "-vf",
                    "scale=w=1920:h=1080",
                    "-c:v",
                    "libx265",
                    "-c:a",
                    "eac3",
                    "-ac",
                    "6",
                    "-tag:v",
                    "hvc1",
                    // "-pix_fmt",
                    // "yuv420p",
                    "-b:v",
                    "4000k",
                    "-movflags",
                    "+faststart",
                    `J:/toPixie/${message.title.replace("?", "")}.mp4`,
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
                        let a = hms.split(":");
                        let seconds = +a[0] * 60 * 60 + +a[1] * 60 + +a[2];
                        return seconds;
                      }

                      let stringData = String(data);
                      let parser = stringData.split("=");

                      if (parser[5]) {
                        let totalDuration = metadata["format"]["duration"];
                        // let totalDuration = 5;
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
                                  title: message.title,
                                  percentage: predictedPercentage,
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
                      const senderObj = {
                        type: "Syncing",
                        title: message.show,
                        percentage: 100,
                        type: "tv",
                        season: message.season,
                        epTitle: message.title,
                        overview: message.overview,
                        epNumber: message.epNumber,
                      };
                      console.log(senderObj);
                      client.send(JSON.stringify(senderObj));
                    });
                    message = undefined;
                  });
                });
              }
            );
          }
        );
      }

      if (message.type === "transcoding") {
        backendClient.send(
          JSON.stringify({ type: "transcoding", video: message.video })
        );
      }

      // if (message.type === "Downloading") {
      //   clients.forEach((client) => {
      //     client.send(
      //       JSON.stringify({
      //         type: "Downloading",
      //         video: message.video,
      //         percentage: 100,
      //       })
      //     );
      //   });
      // }

      if (message.type === "binary") {
        console.log(
          "Received Binary Message of " + message.binaryData.length + " bytes"
        );
        connection.sendBytes(message.binaryData);
      }

      if (message.type === "finished downloading") {
        fs.rmdir(`F:/toPixie/${message.video}`, (err, res) => {
          console.log(
            "Removed dir after complete download: ",
            message.video,
            err,
            res
          );
        });
      }

      if (message.type === "Syncing complete") {
        clients.send(
          JSON.stringify({
            type: "Syncing complete",
            video: message.video,
            percentage: 100,
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
