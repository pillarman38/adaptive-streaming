const WebSocket = require("ws");
const urlTransformer = require("./url-transformer");

let requestId = 1;

function getKodiTarget() {
  const config = urlTransformer.getConfig() || {};
  const host = config.kodiBoxIp || config.kodiWsHost || null;
  const port = Number(config.kodiWsPort) || 9090;
  return { host, port };
}

function isKodiConfigured() {
  return !!getKodiTarget().host;
}

/**
 * One-shot JSON-RPC call over Kodi's WebSocket (port 9090 by default).
 */
function kodiCall(method, params = {}, timeoutMs = 30000) {
  const { host, port } = getKodiTarget();
  if (!host) {
    return Promise.reject(new Error("kodiBoxIp / kodiWsHost not configured"));
  }

  const wsUrl = `ws://${host}:${port}/jsonrpc`;
  const id = requestId++;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    let ws;

    const finish = (err, result) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      } catch (_) {}
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    };

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      finish(err);
      return;
    }

    timer = setTimeout(() => {
      finish(new Error(`Kodi JSON-RPC timeout: ${method}`));
    }, timeoutMs);

    ws.on("open", () => {
      const payload = JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id,
      });
      console.log("[kodi-remote] →", method, host);
      ws.send(payload);
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(String(data));
        if (msg.id !== id) {
          return;
        }
        if (msg.error) {
          finish(new Error(msg.error.message || JSON.stringify(msg.error)));
          return;
        }
        finish(null, msg.result);
      } catch (err) {
        finish(err);
      }
    });

    ws.on("error", (err) => {
      finish(err);
    });

    ws.on("close", () => {
      if (!settled) {
        finish(new Error(`Kodi WebSocket closed before reply: ${method}`));
      }
    });
  });
}

async function getActivePlayerId() {
  const players = await kodiCall("Player.GetActivePlayers", {});
  if (!Array.isArray(players) || players.length === 0) {
    return null;
  }
  const video = players.find((p) => p.type === "video");
  return (video || players[0]).playerid;
}

async function waitUntilIdle(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const playerId = await getActivePlayerId().catch(() => null);
    if (playerId === null) {
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function secondsToKodiTimeObject(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  const milliseconds = Math.round((sec - Math.floor(sec)) * 1000);
  return { hours, minutes, seconds, milliseconds };
}

async function waitForActivePlayer(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const playerId = await getActivePlayerId().catch(() => null);
    if (playerId !== null) {
      return playerId;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/** Absolute seek (seconds). Used after Player.Open for scene start positions. */
async function seek(seconds) {
  const playerId = await waitForActivePlayer(20000);
  if (playerId === null) {
    return false;
  }
  const time = secondsToKodiTimeObject(seconds);
  await kodiCall("Player.Seek", {
    playerid: playerId,
    value: { time },
  });
  return true;
}

async function openFile(fileUrl, options = {}) {
  if (!fileUrl) {
    throw new Error("Missing playback URL for Kodi");
  }

  const seekTime = Math.max(0, Number(options.seekTime) || 0);
  // Scene / resume starts: skip DV intro so we don't land at 0 after intro.
  const introUrl = seekTime > 0 ? null : options.introUrl;
  if (introUrl) {
    try {
      console.log("[kodi-remote] opening intro:", introUrl);
      await kodiCall("Player.Open", { item: { file: introUrl } }, 60000);
      await waitUntilIdle(90000);
    } catch (err) {
      console.warn(
        "[kodi-remote] intro open failed, continuing with movie:",
        err.message
      );
      try {
        const playerId = await getActivePlayerId();
        if (playerId !== null) {
          await kodiCall("Player.Stop", { playerid: playerId });
        }
      } catch (_) {}
    }
  }

  const openParams = { item: { file: fileUrl } };
  if (seekTime > 0) {
    openParams.options = { resume: secondsToKodiTimeObject(seekTime) };
  }
  console.log("[kodi-remote] Player.Open", fileUrl, seekTime > 0 ? `seekTime=${seekTime}` : "");
  await kodiCall("Player.Open", openParams, 120000);

  if (seekTime > 0) {
    // Resume-on-open is best-effort; enforce with Player.Seek once active.
    const ok = await seek(seekTime);
    console.log("[kodi-remote] post-open seek", seekTime, ok ? "ok" : "failed");
    if (!ok) {
      throw new Error(`Kodi seek to ${seekTime}s failed (no active player)`);
    }
  }

  if (options.subtitleUrl) {
    try {
      const playerId = await getActivePlayerId();
      if (playerId !== null) {
        await kodiCall("Player.AddSubtitle", {
          playerid: playerId,
          subtitle: options.subtitleUrl,
        });
      }
    } catch (err) {
      console.warn("[kodi-remote] AddSubtitle failed:", err.message);
    }
  }

  return true;
}

async function playPause() {
  const playerId = await getActivePlayerId();
  if (playerId === null) {
    return false;
  }
  await kodiCall("Player.PlayPause", { playerid: playerId });
  return true;
}

async function seekRelative(seconds) {
  const playerId = await getActivePlayerId();
  if (playerId === null) {
    return false;
  }
  await kodiCall("Player.Seek", {
    playerid: playerId,
    value: { seconds },
  });
  return true;
}

async function stop() {
  const playerId = await getActivePlayerId();
  if (playerId === null) {
    return false;
  }
  await kodiCall("Player.Stop", { playerid: playerId });
  return true;
}

async function navigate(action) {
  const map = {
    arrowUp: "Input.Up",
    arrowDown: "Input.Down",
    arrowLeft: "Input.Left",
    arrowRight: "Input.Right",
    enter: "Input.Select",
  };
  const method = map[action];
  if (!method) {
    return false;
  }
  await kodiCall(method, {});
  return true;
}

module.exports = {
  isKodiConfigured,
  getKodiTarget,
  kodiCall,
  openFile,
  playPause,
  seek,
  seekRelative,
  stop,
  navigate,
  getActivePlayerId,
};
