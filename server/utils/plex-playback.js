/**
 * Shield / Ugoos / Kodi playback (Plex model):
 * - Demos + HD (≤1080p): always direct HTTP/static stream — no HLS.
 * - Local file when client mount maps server library path (server-config.json).
 * - 4K / large rips: HLS codec copy when direct HTTP is unreliable.
 * - Ugoos / CoreELEC: always direct HTTP/local play — never HLS remux.
 * - Dolby Vision: direct HTTP bitstream passthrough (never HLS for FEL).
 */
const fs = require("fs");
const path = require("path");
const urlTransformer = require("./url-transformer");
const plexStreamServer = require("./plex-stream-server");
const { detectDolbyVisionDetails } = require("./video-metadata");
const { listSubtitleTracksForTitle } = require("./subtitle-tracks");

function serverMkvStreamUrl(sourcePath) {
  const q = encodeURIComponent(sourcePath);
  const base = urlTransformer.getStreamBaseUrl();
  return `${base}/api/mov/stream?path=${q}`;
}

/** Direct static URL (express serves G:/ at web root) — better for MP4 on Kodi than custom range handler. */
function serverStaticFileUrl(sourcePath) {
  const norm = String(sourcePath || "").replace(/\\/g, "/");
  const match = norm.match(/^[A-Za-z]:\/?(.*)$/);
  if (!match) {
    return null;
  }
  const rel = match[1]
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const base = urlTransformer.getStreamBaseUrl();
  return `${base}/${rel}`;
}

/** Above this size, 4K content may use HLS — raw HTTP MKV range is unreliable on huge rips. */
function kodiHlsMinBytes() {
  const config = urlTransformer.getConfig() || {};
  const gb = Number(config.kodiHlsMinSizeGb);
  const sizeGb = Number.isFinite(gb) && gb > 0 ? gb : 12;
  return sizeGb * 1024 * 1024 * 1024;
}

function isDemoTitle(movieTitle) {
  return String(movieTitle.type || "").toLowerCase() === "demo";
}

/** Dolby branding intro before CoreELEC/Kodi/Ugoos movie playback (DV and/or TrueHD Atmos). */
function isTrueHdAudio(movieTitle) {
  return String(movieTitle?.audio || "").toLowerCase() === "truehd";
}

function shouldPlayDolbyIntro(movieTitle) {
  const v = movieTitle?.dolbyVision;
  const isDv = v === true || v === 1 || v === "1";
  if (isDv) {
    return true;
  }
  if (!isTrueHdAudio(movieTitle)) {
    return false;
  }
  // Client can disable unfold intro for Atmos-only titles (overview toggle).
  const atmosIntro = movieTitle?.atmosIntroEnabled;
  if (atmosIntro === false || atmosIntro === 0 || atmosIntro === "0") {
    return false;
  }
  return true;
}

function resolveDvIntroUrl(movieTitle) {
  const device = (movieTitle.device || "").toLowerCase();
  if (device !== "coreelec" && device !== "kodi" && device !== "ugoos") {
    return null;
  }
  // DV and TrueHD/Atmos movie titles get the branding intro.
  if (!shouldPlayDolbyIntro(movieTitle)) {
    return null;
  }
  if (isDemoTitle(movieTitle)) {
    return null;
  }
  if (
    movieTitle.epNumber != null ||
    movieTitle.episodeNumber != null ||
    movieTitle.showTitle
  ) {
    return null;
  }
  const config = urlTransformer.getConfig() || {};
  const configured =
    config.dvIntroPath ||
    config.ugoosDvIntroPath ||
    "G:/DvIntros/dolby-vision-amaze-(dolby-vision)-(www.demolandia.net).mp4";
  const fallbacks = [
    configured,
    "G:/DvIntros/dolby-unfold.mkv",
    "G:/DvIntros/unfold.mp4",
    "G:/DvIntros/dolby-vision-amaze-(dolby-vision)-(www.demolandia.net).mp4",
  ];
  let introPath = null;
  for (const candidate of fallbacks) {
    if (candidate && fs.existsSync(candidate)) {
      introPath = candidate;
      break;
    }
  }
  if (!introPath) {
    console.warn("[plex-playback] DV intro missing. Tried:", fallbacks);
    return null;
  }
  if (introPath !== configured) {
    console.warn(
      "[plex-playback] DV intro path missing, using fallback:",
      configured,
      "->",
      introPath
    );
  }
  // Prefer stream API over express.static — CoreELEC reached OnPlay then OnStop
  // before OnAVStart for the static /DvIntros/... URL (DV Profile 5 MP4).
  return serverMkvStreamUrl(introPath);
}

function isHdTitle(movieTitle, probe) {
  const res = String(movieTitle.resolution || "").toLowerCase();
  if (
    res &&
    (res.includes("2160") ||
      res.includes("3840") ||
      res.includes("4k") ||
      res.includes("uhd"))
  ) {
    return false;
  }
  if (
    res &&
    (res.includes("1080") ||
      res.includes("720") ||
      res.includes("576") ||
      res.includes("480"))
  ) {
    return true;
  }
  const video = (probe?.streams || []).find((s) => s.codec_type === "video");
  const h = Number(video?.coded_height || video?.height || 0);
  return h > 0 && h <= 1080;
}

/** Demos always direct; HD movies skip HLS remux. */
function shouldDirectHttpOnly(movieTitle, probe) {
  if (isDemoTitle(movieTitle)) {
    return true;
  }
  return isHdTitle(movieTitle, probe);
}

function buildDirectPlayResult(
  movieTitle,
  sourcePath,
  localPath,
  probe,
  { subtitleTracks, subtitleFile },
  logLabel
) {
  const stat = fs.statSync(sourcePath);
  const sizeGb = (stat.size / (1024 * 1024 * 1024)).toFixed(1);
  const ext = path.extname(sourcePath).toLowerCase();
  const isMp4 = ext === ".mp4" || ext === ".m4v";
  const httpUrl = serverMkvStreamUrl(sourcePath);
  const staticUrl = serverStaticFileUrl(sourcePath);
  const dvInfo = detectDolbyVisionDetails(probe);
  const isDv = movieTitle.dolbyVision === 1 || dvInfo.isDv;

  let location;
  let fallbackLocation;
  if (localPath) {
    location = localPath;
    fallbackLocation = httpUrl;
  } else {
    // Byte-range stream API first for Kodi HTTP (handles large MP4/DV better than express.static).
    location = httpUrl;
    fallbackLocation =
      staticUrl && staticUrl !== httpUrl ? staticUrl : httpUrl;
  }

  console.log(
    "[plex-playback]",
    logLabel + ":",
    path.basename(sourcePath),
    sizeGb + "GB",
    "url=" + location
  );

  const introLocation = resolveDvIntroUrl(movieTitle);
  if (introLocation) {
    console.log("[plex-playback] DV intro:", introLocation);
  }

  return {
    browser: movieTitle.browser || "Kodi",
    pid: 0,
    duration: movieTitle.duration,
    fileformat: movieTitle.fileformat || ext.slice(1) || "mkv",
    location,
    fallbackLocation,
    localMountPath: localPath,
    title: movieTitle.title,
    playbackMode: "directPlay",
    ...(introLocation ? { introLocation } : {}),
    ...(isDv
      ? {
          dolbyVisionProfile: dvInfo.profile,
          dolbyVisionFel: dvInfo.isProfile7Fel,
          requiresBitstreamPassthrough: true,
        }
      : {}),
    subtitleFile,
    subtitleTracks,
  };
}

function isDirectPlayOnlyDevice(device) {
  const normalized = (device || "").toLowerCase();
  // Browsers must never fall into the legacy HLS builder (can hang forever on large files).
  return (
    normalized === "ugoos" ||
    normalized === "coreelec" ||
    normalized === "chrome" ||
    normalized === "safari" ||
    normalized === "web" ||
    normalized === "ios" ||
    normalized === "firefox"
  );
}

async function resolveDirectPlaybackOnly(
  movieTitle,
  sourcePath,
  localPath,
  { subtitleTracks, subtitleFile }
) {
  let probe;
  try {
    probe = await plexStreamServer.probeStreams(sourcePath);
  } catch (err) {
    throw new Error(`Failed to probe source: ${err.message}`);
  }

  const dvInfo = detectDolbyVisionDetails(probe);
  const isDv = movieTitle.dolbyVision === 1 || dvInfo.isDv;

  return buildDirectPlayResult(
    movieTitle,
    sourcePath,
    localPath,
    probe,
    { subtitleTracks, subtitleFile },
    `${movieTitle.device || "native"} direct play (no transcode)`
  );
}

async function resolveKodiPlayback(movieTitle, sourcePath, localPath, { subtitleTracks, subtitleFile }) {
  const stat = fs.statSync(sourcePath);
  const sizeGb = (stat.size / (1024 * 1024 * 1024)).toFixed(1);

  let probe;
  try {
    probe = await plexStreamServer.probeStreams(sourcePath);
  } catch (err) {
    throw new Error(`Failed to probe source: ${err.message}`);
  }

  const dvInfo = detectDolbyVisionDetails(probe);
  const isDv = movieTitle.dolbyVision === 1 || dvInfo.isDv;
  const httpUrl = serverMkvStreamUrl(sourcePath);
  const staticUrl = serverStaticFileUrl(sourcePath);
  const ext = path.extname(sourcePath).toLowerCase();
  const isMp4 = ext === ".mp4" || ext === ".m4v";
  const httpPlayable = plexStreamServer.isShieldDirectHttpPlayable(probe);
  const preferHls = stat.size >= kodiHlsMinBytes();

  // Demos + HD: direct HTTP only — same as standard movie streaming, no HLS remux.
  if (shouldDirectHttpOnly(movieTitle, probe)) {
    let playSource = sourcePath;
    const playExt = path.extname(sourcePath).toLowerCase();
    if (isDemoTitle(movieTitle) && playExt !== ".mkv" && !localPath) {
      try {
        playSource = await plexStreamServer.ensureDemoSiblingMkv(sourcePath);
      } catch (err) {
        console.warn(
          "[plex-playback] Kodi demo sibling MKV failed, using MP4:",
          err.message
        );
      }
    }
    return buildDirectPlayResult(
      movieTitle,
      playSource,
      localPath,
      probe,
      { subtitleTracks, subtitleFile },
      playSource !== sourcePath
        ? "direct HTTP (demo MKV sibling)"
        : "direct HTTP (demo/HD)"
    );
  }

  // Large non-DV 4K rips: HLS codec copy. DV (incl. Profile 7 FEL) must never use HLS/remux.
  if (preferHls && !isDv) {
    const stream = await plexStreamServer.ensureDirectStreamHls(sourcePath);
    console.log(
      "[plex-playback] Kodi HLS (large file):",
      path.basename(sourcePath),
      sizeGb + "GB",
      stream.cached ? "cached" : "building"
    );
    return {
      browser: movieTitle.browser || "Kodi",
      pid: stream.pid,
      duration: movieTitle.duration,
      fileformat: "m3u8",
      location: stream.location,
      fallbackLocation: httpUrl,
      localMountPath: localPath,
      title: movieTitle.title,
      playbackMode: "directStream",
      subtitleFile,
      subtitleTracks,
    };
  }

  // Dolby Vision Profile 7 FEL: bitstream passthrough only (local SMB mount preferred).
  if (isDv) {
    const fel = dvInfo.isProfile7Fel;
    let location;
    let fallbackLocation;

    if (localPath && isMp4) {
      location = localPath;
      fallbackLocation = staticUrl || httpUrl;
    } else if (fel) {
      location = httpUrl;
      fallbackLocation = localPath || staticUrl || undefined;
    } else if (isMp4) {
      location = staticUrl || httpUrl;
      fallbackLocation = localPath || httpUrl;
    } else {
      location = httpUrl;
      fallbackLocation = localPath || staticUrl || undefined;
    }

    console.log(
      "[plex-playback] Kodi DV directPlay (bitstream passthrough):",
      path.basename(sourcePath),
      sizeGb + "GB",
      "profile=" + (dvInfo.profile ?? "?"),
      fel ? "FEL/P7" : "DV",
      "primary=" + location,
      fallbackLocation ? "fallback=" + fallbackLocation : "http-only"
    );
    return {
      browser: movieTitle.browser || "Kodi",
      pid: 0,
      duration: movieTitle.duration,
      fileformat: movieTitle.fileformat || path.extname(sourcePath).slice(1) || "mkv",
      location,
      fallbackLocation,
      localMountPath: localPath,
      title: movieTitle.title,
      playbackMode: "directPlay",
      dolbyVisionProfile: dvInfo.profile,
      dolbyVisionFel: fel,
      requiresBitstreamPassthrough: true,
      subtitleFile,
      subtitleTracks,
    };
  }

  if (httpPlayable) {
    const location = isMp4 && staticUrl ? staticUrl : httpUrl;
    console.log(
      "[plex-playback] Kodi HTTP directPlay:",
      path.basename(sourcePath),
      sizeGb + "GB",
      isMp4 && staticUrl ? "static" : "stream"
    );
    return {
      browser: movieTitle.browser || "Kodi",
      pid: 0,
      duration: movieTitle.duration,
      fileformat: movieTitle.fileformat || path.extname(sourcePath).slice(1) || "mkv",
      location,
      fallbackLocation: localPath || (isMp4 ? httpUrl : httpUrl),
      localMountPath: localPath,
      title: movieTitle.title,
      playbackMode: "directPlay",
      subtitleFile,
      subtitleTracks,
    };
  }

  const stream = await plexStreamServer.ensureDirectStreamHls(sourcePath);
  console.log(
    "[plex-playback] Kodi HLS (codec fallback):",
    path.basename(sourcePath),
    stream.cached ? "cached" : "building"
  );
  return {
    browser: movieTitle.browser || "Kodi",
    pid: stream.pid,
    duration: movieTitle.duration,
    fileformat: "m3u8",
    location: stream.location,
    fallbackLocation: httpUrl,
    localMountPath: localPath,
    title: movieTitle.title,
    playbackMode: "directStream",
    subtitleFile,
    subtitleTracks,
  };
}

function videosMountForDevice(device) {
  const config = urlTransformer.getConfig() || {};
  const normalized = (device || "").toLowerCase();
  if (normalized === "coreelec" || normalized === "kodi") {
    return config.coreelecVideosMount || config.ugoosVideosMount || null;
  }
  if (normalized === "ugoos") {
    return config.ugoosVideosMount || null;
  }
  if (normalized === "nvidia-shield" || normalized === "shield") {
    return config.shieldVideosMount || null;
  }
  return config.shieldVideosMount || config.ugoosVideosMount || null;
}

function joinClientPath(mount, rel) {
  const base = mount.replace(/\\/g, "/").replace(/\/$/, "");
  const suffix = rel.replace(/\\/g, "/").replace(/^\//, "");
  return `${base}/${suffix}`;
}

function resolveClientLocalPath(serverPath, device) {
  const config = urlTransformer.getConfig() || {};
  if (config.kodiUseLocalMount === false) {
    return null;
  }

  const mount = videosMountForDevice(device);
  if (!mount) {
    return null;
  }

  const normServer = serverPath.replace(/\\/g, "/");
  const clientMount = mount.replace(/\\/g, "/").replace(/\/$/, "");
  const demoMount = (
    config.coreelecDemoMount ||
    config.ugoosDemoMount ||
    `${clientMount.replace(/\/Videos\/?$/i, "")}/Demos`
  )
    .replace(/\\/g, "/")
    .replace(/\/$/, "");

  const mappings = [
    {
      serverRoot: (config.serverVideosRoot || "G:/Videos")
        .replace(/\\/g, "/")
        .replace(/\/$/, ""),
      clientMount,
    },
    {
      serverRoot: (config.serverDemoRoot || "G:/Demo videos")
        .replace(/\\/g, "/")
        .replace(/\/$/, ""),
      clientMount: demoMount,
    },
  ];

  for (const { serverRoot, clientMount: targetMount } of mappings) {
    const prefix = `${serverRoot}/`;
    if (normServer.toLowerCase().startsWith(prefix.toLowerCase())) {
      const rel = normServer.slice(prefix.length);
      const localPath = joinClientPath(targetMount, rel);
      return localPath;
    }
  }

  return null;
}

function subtitlePayload(movieTitle) {
  const subtitleTracks = listSubtitleTracksForTitle(
    movieTitle.title,
    movieTitle.filePath,
    movieTitle.srtLocation,
    movieTitle.srtUrl
  );
  const subtitleFile =
    subtitleTracks.length > 0 ? subtitleTracks[0].url : undefined;
  return { subtitleTracks, subtitleFile };
}

async function resolveShieldPlayback(movieTitle) {
  const sourcePath = movieTitle.filePath;
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const { subtitleTracks, subtitleFile } = subtitlePayload(movieTitle);
  const device = (movieTitle.device || "").toLowerCase();
  const localPath = resolveClientLocalPath(sourcePath, movieTitle.device);

  if (isDirectPlayOnlyDevice(device)) {
    return resolveDirectPlaybackOnly(movieTitle, sourcePath, localPath, {
      subtitleTracks,
      subtitleFile,
    });
  }

  const isKodiFamily = device === "kodi";

  if (isKodiFamily) {
    return resolveKodiPlayback(movieTitle, sourcePath, localPath, {
      subtitleTracks,
      subtitleFile,
    });
  }

  if (localPath) {
    console.log(
      "[plex-playback] directPlay (local file):",
      path.basename(sourcePath),
      "device=" + (movieTitle.device || "unknown"),
      "path=" + localPath
    );
    return {
      browser: movieTitle.browser || "Android",
      pid: 0,
      duration: movieTitle.duration,
      fileformat: movieTitle.fileformat || "mkv",
      location: localPath,
      fallbackLocation: serverMkvStreamUrl(sourcePath),
      title: movieTitle.title,
      playbackMode: "directPlay",
      subtitleFile,
      subtitleTracks,
    };
  }

  let probe;
  try {
    probe = await plexStreamServer.probeStreams(sourcePath);
  } catch (err) {
    throw new Error(`Failed to probe source: ${err.message}`);
  }

  if (shouldDirectHttpOnly(movieTitle, probe)) {
    return buildDirectPlayResult(
      movieTitle,
      sourcePath,
      localPath,
      probe,
      { subtitleTracks, subtitleFile },
      "direct HTTP (demo/HD)"
    );
  }

  const isDv =
    movieTitle.dolbyVision === 1 ||
    plexStreamServer.sourceHasDolbyVision(probe);
  const ext = path.extname(sourcePath).slice(1).toLowerCase() || "mkv";
  const directHttpPlayable =
    isDv || plexStreamServer.isShieldDirectHttpPlayable(probe);

  if (directHttpPlayable) {
    const location = serverMkvStreamUrl(sourcePath);
    console.log(
      "[plex-playback] directPlay (server HTTP):",
      path.basename(sourcePath),
      isDv ? "DV passthrough" : "compatible codecs"
    );
    return {
      browser: movieTitle.browser || "Android",
      pid: 0,
      duration: movieTitle.duration,
      fileformat: movieTitle.fileformat || ext,
      location,
      title: movieTitle.title,
      playbackMode: "directPlay",
      subtitleFile,
      subtitleTracks,
    };
  }

  const stream = await plexStreamServer.ensureDirectStreamHls(sourcePath);

  console.log(
    "[plex-playback] directStream (server HLS TS):",
    path.basename(sourcePath),
    stream.cached ? "cached" : "building"
  );

  return {
    browser: movieTitle.browser || "Android",
    pid: stream.pid,
    duration: movieTitle.duration,
    fileformat: "m3u8",
    location: stream.location,
    title: movieTitle.title,
    playbackMode: "directStream",
    subtitleFile,
    subtitleTracks,
  };
}

module.exports = {
  resolveShieldPlayback,
};
