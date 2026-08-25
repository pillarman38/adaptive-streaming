/**
 * Push movies + artwork to ShelfOS on the Pi.
 *
 * - Compares local library to GET /api/apps/movies/sync/index
 * - Uploads any titles the Pi is missing (or missing local artwork files)
 * - Sends artwork as base64 so the Pi stores files under filesAvailibleForDL/movies/
 *   and can show covers when adaptive-streaming is offline
 *
 * Target is always ShelfOS (server.local:4012), NOT this app's /api/mov/... API.
 */ 
const fs = require("fs");
const path = require("path");
const urlTransformer = require("../utils/url-transformer");

const DEFAULT_SHELFOS_SYNC =
  "http://server.local:4012/api/apps/movies/sync";

const ART_ROOTS = {
  "/MovieCoverArt": process.env.MOVIE_COVER_ART_DIR || "G:/MovieCoverArt",
  "/MovieCards": process.env.MOVIE_CARDS_DIR || "G:/MovieCards",
  "/BackgroundImages":
    process.env.MOVIE_BACKDROP_DIR || "G:/BackgroundImages",
};

function syncUrl() {
  const fromEnv = String(process.env.SHELFOS_MOVIES_SYNC_URL || "").trim();
  if (!fromEnv) return DEFAULT_SHELFOS_SYNC;

  const lower = fromEnv.toLowerCase();
  if (
    lower.includes(":5012") ||
    lower.includes("/api/mov/") ||
    /10\.0\.0\.15/.test(lower)
  ) {
    console.warn(
      "[shelfos-sync] SHELFOS_MOVIES_SYNC_URL looks like adaptive-streaming (" +
        fromEnv +
        "); using " +
        DEFAULT_SHELFOS_SYNC
    );
    return DEFAULT_SHELFOS_SYNC;
  }
  return fromEnv;
}

function syncIndexUrl() {
  const base = syncUrl().replace(/\/+$/, "");
  if (base.endsWith("/sync")) return `${base}/index`;
  return `${base}/index`;
}

function syncKey() {
  return process.env.MOVIES_SYNC_KEY || "";
}

function syncHeaders() {
  const headers = { "Content-Type": "application/json" };
  const key = syncKey();
  if (key) headers["X-Movies-Sync-Key"] = key;
  return headers;
}

function getFetch() {
  return typeof fetch === "function" ? fetch : require("node-fetch");
}

function endpointPath(value) {
  if (!value || typeof value !== "string") return "";
  let p = value.trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname || "";
    } catch (_) {
      return "";
    }
  }
  try {
    p = decodeURIComponent(p);
  } catch (_) {
    /* keep */
  }
  return p.startsWith("/") ? p : `/${p}`;
}

function resolveLocalArtPath(stored) {
  const ep = endpointPath(stored);
  if (!ep) return null;
  for (const [prefix, root] of Object.entries(ART_ROOTS)) {
    if (ep === prefix || ep.startsWith(prefix + "/")) {
      const rel = ep.slice(prefix.length).replace(/^\/+/, "");
      if (!rel) return null;
      return path.join(root, rel);
    }
  }
  return null;
}

function readArtBase64(stored) {
  const abs = resolveLocalArtPath(stored);
  if (!abs || !fs.existsSync(abs)) return null;
  try {
    const buf = fs.readFileSync(abs);
    if (!buf.length) return null;
    const ext = path.extname(abs).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn("[shelfos-sync] art read failed", abs, err.message);
    return null;
  }
}

function movieKey(tmdbId, fileName) {
  return `${String(tmdbId || "0")}::${String(fileName || "")}`;
}

function buildPayload(metaDataObj, opts = {}) {
  const includeArt = opts.includeArt !== false;
  const abs = (v) => {
    if (!v || typeof v !== "string") return v || null;
    if (/^https?:\/\//i.test(v)) return v;
    return urlTransformer.toPublicUrl(v);
  };

  let cast = metaDataObj.cast;
  if (typeof cast === "string") {
    try {
      cast = JSON.parse(cast);
    } catch (_) {
      cast = [];
    }
  }

  const payload = {
    tmdbId: metaDataObj.tmdbId != null ? String(metaDataObj.tmdbId) : "0",
    fileName: metaDataObj.fileName || "",
    title: metaDataObj.title || "",
    overview: metaDataObj.overview || "",
    originalLang: metaDataObj.originalLang || "",
    duration: metaDataObj.duration,
    resolution: metaDataObj.resolution || "",
    audio: metaDataObj.audio || "",
    channels: metaDataObj.channels,
    dolbyVision: metaDataObj.dolbyVision ? 1 : 0,
    threeD: metaDataObj.threeD ? 1 : 0,
    isExtendedEdition: metaDataObj.isExtendedEdition ? 1 : 0,
    cast: Array.isArray(cast) ? cast : [],
    coverArt: abs(metaDataObj.coverArt),
    movieCard: abs(metaDataObj.movieCard),
    posterUrl: abs(metaDataObj.posterUrl),
    vbr: metaDataObj.vbr != null ? String(metaDataObj.vbr) : null,
  };

  if (includeArt) {
    const coverB64 = readArtBase64(metaDataObj.coverArt);
    const cardB64 = readArtBase64(metaDataObj.movieCard);
    const backdropB64 = readArtBase64(metaDataObj.posterUrl);
    if (coverB64) payload.coverArtBase64 = coverB64;
    if (cardB64) payload.movieCardBase64 = cardB64;
    if (backdropB64) payload.posterUrlBase64 = backdropB64;
  }

  return payload;
}

async function fetchShelfOsIndex() {
  const url = syncIndexUrl();
  const fetchFn = getFetch();
  const res = await fetchFn(url, { method: "GET", headers: syncHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`index ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function pushMovieToShelfOs(metaDataObj, opts = {}) {
  if (process.env.SHELFOS_MOVIES_SYNC_ENABLED === "false") {
    return null;
  }

  const url = syncUrl();
  const payload = buildPayload(metaDataObj, opts);
  console.log(
    "[shelfos-sync] POST",
    url,
    payload.title || payload.fileName,
    payload.coverArtBase64 ? "+cover" : "",
    payload.movieCardBase64 ? "+card" : "",
    payload.posterUrlBase64 ? "+backdrop" : ""
  );

  try {
    const fetchFn = getFetch();
    const res = await fetchFn(url, {
      method: "POST",
      headers: syncHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[shelfos-sync] failed",
        res.status,
        payload.title,
        text.slice(0, 200)
      );
      return null;
    }
    const body = await res.json().catch(() => ({}));
    console.log(
      "[shelfos-sync] ok",
      payload.title,
      body.id != null ? `id=${body.id}` : ""
    );
    return body;
  } catch (err) {
    console.warn(
      "[shelfos-sync] error",
      payload.title,
      err && err.message ? err.message : err
    );
    return null;
  }
}

/**
 * Diff local movies against ShelfOS and push anything missing
 * (or missing artwork on the Pi).
 */
async function syncLibraryMissingToShelfOs(localMovies) {
  if (process.env.SHELFOS_MOVIES_SYNC_ENABLED === "false") {
    return { pushed: 0, skipped: 0 };
  }

  const list = Array.isArray(localMovies) ? localMovies : [];
  let remoteMap = new Map();
  try {
    const index = await fetchShelfOsIndex();
    for (const k of index.keys || []) {
      remoteMap.set(movieKey(k.tmdbId, k.fileName), k);
    }
    console.log(
      "[shelfos-sync] Pi has",
      remoteMap.size,
      "movies; local",
      list.length
    );
  } catch (err) {
    console.warn(
      "[shelfos-sync] could not fetch Pi index; pushing all",
      err && err.message ? err.message : err
    );
    remoteMap = null;
  }

  let pushed = 0;
  let skipped = 0;
  for (const movie of list) {
    const key = movieKey(movie.tmdbId, movie.fileName);
    const remote = remoteMap ? remoteMap.get(key) : null;
    const missing = !remote;
    const needsArt =
      remote &&
      (!remote.hasCover || !remote.hasCard || !remote.hasBackdrop);
    if (!missing && !needsArt) {
      skipped += 1;
      continue;
    }
    const result = await pushMovieToShelfOs(movie, { includeArt: true });
    if (result) pushed += 1;
  }

  console.log("[shelfos-sync] reconcile done pushed=", pushed, "skipped=", skipped);
  return { pushed, skipped };
}

module.exports = {
  pushMovieToShelfOs,
  syncLibraryMissingToShelfOs,
  buildPayload,
  syncUrl,
  DEFAULT_SHELFOS_SYNC,
};
