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

async function openFile(fileUrl, options = {}) {
  if (!fileUrl) {
    throw new Error("Missing playback URL for Kodi");
  }

  const introUrl = options.introUrl;
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

  console.log("[kodi-remote] Player.Open", fileUrl);
  await kodiCall("Player.Open", { item: { file: fileUrl } }, 120000);

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
  seekRelative,
  stop,
  navigate,
  getActivePlayerId,
};
