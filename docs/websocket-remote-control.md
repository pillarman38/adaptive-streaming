# WebSocket remote control API

External devices can connect to the Adaptive Streaming WebSocket server and:

1. Tell the **Ugoos** (CoreELEC/Kodi) box to play a title (`playRequest`)
2. Send **player controls** while something is playing (`playerControl` / `controller`)

## Playback target (CoreELEC / Kodi)

The Ugoos runs **CoreELEC + Kodi**, not the Adaptive Streaming Angular app. There is no UI client to register as `device: "ugoos"`.

When a controller sends `playRequest`, the server:

1. Uses an Angular client with `device: "ugoos"` if one is connected (optional / uncommon)
2. Otherwise opens the file on **Kodi JSON-RPC** at `kodiBoxIp` / `kodiWsPort` from `server-config.json` (typical: `10.0.0.22:9090`)
3. Otherwise forwards to any other connected display browser

Player controls use the same order: Angular Ugoos app if present, else Kodi `Player.*` / `Input.*` RPC.

Kodi must allow remote control (Settings → Services → Control → allow remote control via HTTP/WebSocket).

## Connection

| Item | Value |
|------|--------|
| URL | `ws://<serverIp>:4444` |
| Encoding | JSON text frames |
| HTTP API (separate) | `http://<serverIp>:5012` |
| Kodi JSON-RPC (server → box) | `ws://<kodiBoxIp>:9090/jsonrpc` |

Example: `ws://10.0.0.15:4444` → server plays on Kodi at `10.0.0.22:9090`.

A remote phone / Homey / ShelfOS / script should register as a controller:

```json
{
  "type": "register",
  "role": "controller",
  "clientId": "client_remote_1",
  "device": "homey"
}
```

---

## Play a title on the Ugoos

### Request

```json
{
  "type": "playRequest",
  "clientId": "client_remote_1",
  "movie": {
    "title": "1917",
    "filePath": "G:/Videos/1917.mkv",
    "fileName": "1917.mkv",
    "fileformat": "mkv",
    "duration": 7140,
    "audio": "truehd",
    "dolbyVision": 0,
    "type": "movie",
    "seekTime": 0,
    "atmosIntroEnabled": true
  }
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `type` | yes | Must be `"playRequest"` |
| `clientId` | no | Echo / logging |
| `movie` | yes | Title payload; server resolves playback via transcoder then `Player.Open` on Kodi |
| `movie.filePath` | **yes** | Server path used by `/api/mov/pullVideo` |
| `movie.title` | recommended | Shown in ack / logs |
| `movie.fileformat` | recommended | e.g. `"mkv"` |
| `movie.audio` | optional | `"truehd"` enables Atmos intro logic |
| `movie.dolbyVision` | optional | `1` / `0` |
| `movie.atmosIntroEnabled` | optional | `true` = play Dolby unfold intro before Atmos titles; `false` = skip |
| `movie.type` | optional | `"movie"`, `"demo"`, etc. |
| `movie.seekTime` | optional | Resume offset in seconds |
| `movie.srtUrl` / `movie.srtLocation` | optional | Subtitles |

Do **not** set `device` on the request. The server targets Kodi via `kodiBoxIp`.

### Responses (to the sender)

Success (Kodi):

```json
{
  "type": "playRequestResult",
  "ok": true,
  "title": "1917",
  "target": "kodi",
  "host": "10.0.0.22"
}
```

Kodi configured but open failed:

```json
{
  "type": "playRequestResult",
  "ok": false,
  "reason": "kodi_failed",
  "title": "1917",
  "error": "…"
}
```

No Kodi config and no display clients:

```json
{
  "type": "playRequestResult",
  "ok": false,
  "reason": "no_ugoos",
  "title": "1917"
}
```

Missing `movie`:

```json
{
  "type": "playRequestResult",
  "ok": false,
  "reason": "missing_movie"
}
```

---

## Player controls

While the Ugoos is playing (or browsing), send a control message. Both type names are accepted:

- `"playerControl"` (preferred for external devices)
- `"controller"` (used by the in-app `/controller` UI)

The server drives **Kodi on the Ugoos** via JSON-RPC when no Angular Ugoos app is connected (the usual CoreELEC setup). `back` maps to `Player.Stop`.

### Common shape

```json
{
  "type": "playerControl",
  "action": "<actionName>",
  "timestamp": 1710000000000
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `type` | yes | `"playerControl"` or `"controller"` |
| `action` | yes | See actions below |
| `timestamp` | no | Client-side timestamp (ms) |
| `seconds` | no | Only for skip actions; default `15` |
| `clientId` | no | Optional sender id |

---

### Actions

#### `playPause`

Toggle play / pause on the current title.

```json
{
  "type": "playerControl",
  "action": "playPause",
  "timestamp": 1710000000000
}
```

#### `skipForward`

Seek forward. Default **15** seconds; override with `seconds`.

```json
{
  "type": "playerControl",
  "action": "skipForward",
  "seconds": 15,
  "timestamp": 1710000000000
}
```

#### `skipBackward`

Seek backward. Default **15** seconds; override with `seconds`.

```json
{
  "type": "playerControl",
  "action": "skipBackward",
  "seconds": 15,
  "timestamp": 1710000000000
}
```

#### `back` — stop playback

Stops the movie completely: pauses/releases the player and leaves the player screen.

```json
{
  "type": "playerControl",
  "action": "back",
  "timestamp": 1710000000000
}
```

#### Navigation (on-player UI / menus)

These map to D-pad style keys on the Ugoos:

```json
{ "type": "playerControl", "action": "arrowUp", "timestamp": 1710000000000 }
```

```json
{ "type": "playerControl", "action": "arrowDown", "timestamp": 1710000000000 }
```

```json
{ "type": "playerControl", "action": "arrowLeft", "timestamp": 1710000000000 }
```

```json
{ "type": "playerControl", "action": "arrowRight", "timestamp": 1710000000000 }
```

```json
{ "type": "playerControl", "action": "enter", "timestamp": 1710000000000 }
```

| Action | Effect |
|--------|--------|
| `arrowUp` / `arrowDown` / `arrowLeft` / `arrowRight` | Move focus / show player controls |
| `enter` | Activate the focused control |
| `playPause` | Play or pause |
| `skipForward` | Seek ahead (`seconds`, default 15) |
| `skipBackward` | Seek back (`seconds`, default 15) |
| `back` | **Stop playback** and exit the player |

---

## Minimal remote example

```js
const ws = new WebSocket("ws://10.0.0.15:4444");

ws.onopen = () => {
  // Start a movie on the Ugoos
  ws.send(JSON.stringify({
    type: "playRequest",
    clientId: "script_1",
    movie: {
      title: "1917",
      filePath: "G:/Videos/1917.mkv",
      fileName: "1917.mkv",
      fileformat: "mkv",
      audio: "truehd",
      atmosIntroEnabled: true
    }
  }));
};

// Later: pause
ws.send(JSON.stringify({ type: "playerControl", action: "playPause" }));

// Skip ahead 30s
ws.send(JSON.stringify({
  type: "playerControl",
  action: "skipForward",
  seconds: 30
}));

// Stop and leave the player
ws.send(JSON.stringify({ type: "playerControl", action: "back" }));
```

---

## Notes

- Controls are handled on the **Ugoos** display client only.
- If no Ugoos is registered, the server may fall back to other display clients for relay; only a Ugoos app executes player actions.
- Volume up/down is **not** part of this WebSocket API today (the in-app controller uses HTTP `POST /api/mov/volume`).
