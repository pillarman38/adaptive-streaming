let pool = require("../../config/connections");
let fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const { configureFluentFfmpeg } = require("../utils/ffmpeg-paths");
configureFluentFfmpeg(ffmpeg);
const path = require("path");
const spawn = require("child_process").spawn;

let WebSocketServer = require("ws").Server;

let wss = new WebSocketServer({
  port: 4444,
});
console.log("WSS: ");

let clients = [];

const {
  broadcastVoteState,
  sendVoteStateToConnection,
  handleVoteMessage,
  onClientDisconnect,
  voteSession,
} = require("../utils/voting-session");
const transcoder = require("./transcoder");
const kodiRemote = require("../utils/kodi-remote");
const urlTransformer = require("../utils/url-transformer");

function removeClient(connection) {
  clients = clients.filter((client) => client !== connection);
}

function broadcastToDisplays(message) {
  const payload = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === 1 && client.clientRole === "display") {
      client.send(payload);
    }
  });
}

function broadcastControllerMessage(message) {
  const payload = JSON.stringify(message);
  let targets = getUgoosClients();

  // Prefer the Angular Ugoos app; fall back to any connected display.
  if (targets.length === 0) {
    targets = clients.filter(
      (client) => client.readyState === 1 && client.clientRole === "display"
    );
  }

  targets.forEach((client) => client.send(payload));

  // CoreELEC/Kodi on the Ugoos has no Angular client — drive JSON-RPC directly.
  if (getUgoosClients().length === 0 && kodiRemote.isKodiConfigured()) {
    void handleKodiPlayerControl(message).catch((err) => {
      console.warn("[playerControl] Kodi control failed:", err.message);
    });
  }
}

function resolvePlaybackForKodi(movie) {
  return new Promise((resolve, reject) => {
    const body = {
      ...movie,
      device: "coreelec",
      browser: "Kodi",
    };
    transcoder.startConverting(body, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

async function playOnKodi(movie) {
  const target = kodiRemote.getKodiTarget();

  const playback = await resolvePlaybackForKodi(movie);
  if (!playback || !playback.location) {
    throw new Error("No playback URL from transcoder");
  }

  let fileUrl = playback.location;
  let introUrl = playback.introLocation || null;
  let subtitleUrl = playback.subtitleFile || null;

  // Prefer HTTP URLs Kodi can fetch from the media server.
  if (playback.fallbackLocation && !String(fileUrl).startsWith("http")) {
    fileUrl = playback.fallbackLocation;
  }
  if (fileUrl && urlTransformer.toPublicUrl && !String(fileUrl).startsWith("http")) {
    // leave local smb/nfs paths as-is for CoreELEC mounts
  }

  console.log("[playRequest] opening on Kodi", target.host, fileUrl);
  await kodiRemote.openFile(fileUrl, {
    introUrl,
    subtitleUrl,
  });

  return { fileUrl, host: target.host };
}

async function handleKodiPlayerControl(message) {
  const action = String(message.action || "");

  if (action === "playPause") {
    return kodiRemote.playPause();
  }
  if (action === "skipForward") {
    const seconds =
      typeof message.seconds === "number" && message.seconds > 0
        ? message.seconds
        : 15;
    return kodiRemote.seekRelative(seconds);
  }
  if (action === "skipBackward") {
    const seconds =
      typeof message.seconds === "number" && message.seconds > 0
        ? message.seconds
        : 15;
    return kodiRemote.seekRelative(-seconds);
  }
  if (action === "back") {
    // Stop playback entirely on the box.
    return kodiRemote.stop();
  }
  if (
    action === "arrowUp" ||
    action === "arrowDown" ||
    action === "arrowLeft" ||
    action === "arrowRight" ||
    action === "enter"
  ) {
    return kodiRemote.navigate(action);
  }
  return false;
}

async function handlePlayRequest(connection, message) {
  const movie = message.movie;
  if (!movie) {
    sendJson(connection, {
      type: "playRequestResult",
      ok: false,
      reason: "missing_movie",
    });
    return;
  }

  const forwarded = {
    type: "playRequest",
    movie,
    fromClientId: message.clientId || connection.clientId,
  };
  const payload = JSON.stringify(forwarded);
  const ugoosTargets = getUgoosClients().filter(
    (client) => client !== connection
  );

  // 1) Angular app on a device named "ugoos" (rare; CoreELEC has no app).
  if (ugoosTargets.length > 0) {
    console.log(
      "[playRequest] forwarding",
      movie.title,
      "to",
      ugoosTargets.length,
      "Angular Ugoos client(s)"
    );
    ugoosTargets.forEach((client) => client.send(payload));
    sendJson(connection, {
      type: "playRequestResult",
      ok: true,
      title: movie.title,
      target: "ugoos-app",
    });
    return;
  }

  // 2) CoreELEC/Kodi on the Ugoos (kodiBoxIp) — normal path.
  if (kodiRemote.isKodiConfigured()) {
    try {
      await playOnKodi(movie);
      sendJson(connection, {
        type: "playRequestResult",
        ok: true,
        title: movie.title,
        target: "kodi",
        host: kodiRemote.getKodiTarget().host,
      });
      return;
    } catch (err) {
      console.error("[playRequest] Kodi playback failed:", err.message);
      sendJson(connection, {
        type: "playRequestResult",
        ok: false,
        reason: "kodi_failed",
        title: movie.title,
        error: err.message,
      });
      return;
    }
  }

  // 3) Last resort: any other connected display browser.
  const displayTargets = clients.filter(
    (client) =>
      client.readyState === 1 &&
      client.clientRole === "display" &&
      client !== connection
  );
  if (displayTargets.length > 0) {
    console.log(
      "[playRequest] forwarding",
      movie.title,
      "to",
      displayTargets.length,
      "display client(s)"
    );
    displayTargets.forEach((client) => client.send(payload));
    sendJson(connection, {
      type: "playRequestResult",
      ok: true,
      title: movie.title,
      target: "display",
    });
    return;
  }

  console.log("[playRequest] no Kodi config and no display clients for", movie.title);
  sendJson(connection, {
    type: "playRequestResult",
    ok: false,
    reason: "no_ugoos",
    title: movie.title,
  });
}

function getUgoosClients() {
  return clients.filter(
    (client) =>
      client.readyState === 1 &&
      client.clientRole === "display" &&
      client.device === "ugoos"
  );
}

function sendJson(connection, message) {
  if (connection && connection.readyState === 1) {
    connection.send(JSON.stringify(message));
  }
}

wss.on("connection", function (connection) {
  console.log(new Date() + " Connection accepted.");
  connection.clientRole = "display";
  connection.clientId = null;
  clients.push(connection);
  // connection.send("Connection recieved!");
  connection.on("message", async function (message) {
    // console.log("message: ", message);
    message = JSON.parse(message);

    if (message.type === "register") {
      connection.clientRole =
        message.role === "controller" ? "controller" : "display";
      connection.clientId = message.clientId || null;
      connection.device = message.device || null;
      if (connection.clientRole === "display" && connection.clientId) {
        sendVoteStateToConnection(connection, clients);
        if (voteSession.active) {
          broadcastVoteState(clients, broadcastToDisplays);
        }
      }
      return;
    }

    if (
      message.type === "voteEnable" ||
      message.type === "voteDisable" ||
      message.type === "voteFinish" ||
      message.type === "voteParticipation" ||
      message.type === "voteNextRound" ||
      message.type === "voteKnockOff"
    ) {
      handleVoteMessage(message, connection, clients, broadcastToDisplays);
      return;
    }

    if (message.type === "Downloading") {
      clients.forEach((client) => {
        client.send(JSON.stringify(message));
      });
      return;
    }
    
    // Relay player/controller input to the Ugoos (preferred) or any display.
    if (message.type === "controller" || message.type === "playerControl") {
      broadcastControllerMessage(message);
      return;
    }

    if (message.type === "playRequest") {
      await handlePlayRequest(connection, message);
      return;
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
    removeClient(connection);
    onClientDisconnect(connection, clients, broadcastToDisplays);
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
