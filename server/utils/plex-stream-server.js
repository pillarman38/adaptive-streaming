/**
 * Plex-style server streaming: PMS reads the file on disk and serves a seek-friendly
 * direct stream (HLS, codecs copied). Shield never does raw HTTP range seeks on huge MKV.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const urlTransformer = require("./url-transformer");
const { getFfmpegPath, getFfprobePath } = require("./ffmpeg-paths");

const MP4_SAFE_AUDIO = new Set(["aac", "ac3", "eac3", "mp3", "flac", "opus"]);

function probeStreams(sourcePath) {
  return new Promise((resolve, reject) => {
    const ffprobe = getFfprobePath();
    const proc = spawn(
      ffprobe,
      ["-v", "quiet", "-print_format", "json", "-show_streams", sourcePath],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c) => {
      stdout += c;
    });
    proc.stderr.on("data", (c) => {
      stderr += c;
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.slice(-300) || `ffprobe exit ${code}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function sourceHasDolbyVision(probe) {
  for (const s of probe.streams || []) {
    if (s.codec_type !== "video") continue;
    const tag = String(s.codec_tag_string || "").toLowerCase();
    if (tag === "dvhe" || tag === "dvh1" || tag.includes("dv")) return true;
    for (const sd of s.side_data_list || []) {
      const t = String(
        sd.side_data_type_name || sd.side_data_type || ""
      ).toLowerCase();
      if (t.includes("dovi") || t.includes("dolby vision")) return true;
    }
  }
  return false;
}

function buildRemuxMaps(probe) {
  const streams = probe.streams || [];
  const audioStreams = streams.filter((s) => s.codec_type === "audio");
  const safeAudioIndexes = [];
  audioStreams.forEach((s, idx) => {
    if (MP4_SAFE_AUDIO.has(String(s.codec_name || "").toLowerCase())) {
      safeAudioIndexes.push(idx);
    }
  });
  const mapArgs = ["-map", "0:v:0"];
  if (safeAudioIndexes.length > 0) {
    safeAudioIndexes.forEach((idx) => mapArgs.push("-map", `0:a:${idx}`));
  } else if (audioStreams.length > 0) {
    mapArgs.push("-map", "0:a:0");
  }
  return mapArgs;
}

const PLEX_TEMP_ROOT =
  process.env.PLEX_TEMP_DIR || path.join("G:", "plexTemp");
/** Bumped when stream recipe changes (fMP4 + DV + Opus, Plex-style). */
const STREAM_ROOT = path.join(PLEX_TEMP_ROOT, "shield-streams-dv");

const jobs = new Map();
const siblingRemuxJobs = new Map();

function demoSiblingMkvPath(sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (!ext || ext === ".mkv") {
    return null;
  }
  return sourcePath.slice(0, -ext.length) + ".mkv";
}

async function mkvHasVideoFirst(mkvPath) {
  try {
    const probe = await probeStreams(mkvPath);
    const first = (probe.streams || [])[0];
    return first?.codec_type === "video";
  } catch {
    return false;
  }
}

function remuxDemoToSiblingMkv(sourcePath, mkvPath) {
  const tmpPath = `${mkvPath}.part`;
  if (fs.existsSync(tmpPath)) {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_) {}
  }

  const ffmpeg = getFfmpegPath();
  console.log(
    "[demo-mkv] Stream-copy to MKV (video first):",
    path.basename(mkvPath)
  );

  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "warning",
      "-i",
      sourcePath,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-c",
      "copy",
      "-f",
      "matroska",
      tmpPath,
    ];
    const proc = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    proc.on("close", (code) => {
      if (
        code === 0 &&
        fs.existsSync(tmpPath) &&
        fs.statSync(tmpPath).size > 1024
      ) {
        fs.renameSync(tmpPath, mkvPath);
        resolve(mkvPath);
        return;
      }
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}
      reject(
        new Error(
          `Demo sibling MKV failed (${code}): ${stderr.slice(-400) || "unknown"}`
        )
      );
    });
  });
}

/**
 * Kodi plays MKV over HTTP but often never reaches OnAVStart on DV MP4.
 * Stream-copy to a sibling .mkv in the same folder (video track first — required for Kodi HTTP).
 */
async function ensureDemoSiblingMkv(sourcePath) {
  const mkvPath = demoSiblingMkvPath(sourcePath);
  if (!mkvPath) {
    return sourcePath;
  }

  if (fs.existsSync(mkvPath) && fs.statSync(mkvPath).size > 1024) {
    if (await mkvHasVideoFirst(mkvPath)) {
      return mkvPath;
    }
    console.log(
      "[demo-mkv] Re-muxing MKV (video must be first track):",
      path.basename(mkvPath)
    );
    try {
      fs.unlinkSync(mkvPath);
    } catch (_) {}
  }

  const existing = siblingRemuxJobs.get(sourcePath);
  if (existing) {
    return existing;
  }

  const job = remuxDemoToSiblingMkv(sourcePath, mkvPath);

  siblingRemuxJobs.set(sourcePath, job);
  try {
    return await job;
  } finally {
    siblingRemuxJobs.delete(sourcePath);
  }
}

function safeDirName(sourcePath) {
  const base = path.basename(sourcePath, path.extname(sourcePath));
  return base
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 100);
}

function getStreamPaths(sourcePath) {
  const dir = path.join(STREAM_ROOT, safeDirName(sourcePath));
  const playlist = path.join(dir, "index.m3u8");
  return { dir, playlist };
}

function streamDirSnapshot(dir) {
  try {
    const files = fs.readdirSync(dir);
    const tsCount = files.filter(
      (f) => f.endsWith(".ts") && f.startsWith("media-")
    ).length;
    const m4sCount = files.filter((f) => f.endsWith(".m4s")).length;
    let initSize = 0;
    const initPath = path.join(dir, "init.mp4");
    if (files.includes("init.mp4") && fs.existsSync(initPath)) {
      initSize = fs.statSync(initPath).size;
    }
    let headerSize = 0;
    const headerPath = path.join(dir, "header");
    if (files.includes("header") && fs.existsSync(headerPath)) {
      headerSize = fs.statSync(headerPath).size;
    }
    return {
      files: files.slice(0, 20),
      fileCount: files.length,
      hasHeader: headerSize > 0,
      headerSize,
      hasInit: initSize > 0,
      initSize,
      m4sCount,
      tsCount,
      hasPlaylist: files.includes("index.m3u8"),
    };
  } catch {
    return {
      files: [],
      fileCount: 0,
      hasHeader: false,
      headerSize: 0,
      hasInit: false,
      initSize: 0,
      m4sCount: 0,
      tsCount: 0,
      hasPlaylist: false,
    };
  }
}

function fmp4InitReady(dir, playlistPath) {
  try {
    const body = fs.readFileSync(playlistPath, "utf8");
    if (!body.includes("#EXT-X-MAP") || !body.includes("init.mp4")) {
      return true;
    }
    const initPath = path.join(dir, "init.mp4");
    return fs.existsSync(initPath) && fs.statSync(initPath).size > 100;
  } catch {
    return false;
  }
}

const MIN_FIRST_SEGMENT_BYTES = 256 * 1024;

function firstTsSegmentStat(dir) {
  const seg = fs
    .readdirSync(dir)
    .find((f) => f.startsWith("media-") && f.endsWith(".ts"));
  if (!seg) return null;
  const segPath = path.join(dir, seg);
  try {
    return { name: seg, size: fs.statSync(segPath).size, path: segPath };
  } catch {
    return null;
  }
}

function tsSegmentsReady(dir, minCount, minBytesEach) {
  const segs = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("media-") && f.endsWith(".ts"))
    .sort();
  if (segs.length < minCount) return false;
  for (let i = 0; i < minCount; i++) {
    try {
      if (fs.statSync(path.join(dir, segs[i])).size < minBytesEach) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function fmp4SegmentsReady(dir, minCount, minBytesEach) {
  const playlist = path.join(dir, HLS_PLAYLIST_NAME);
  if (!fmp4InitReady(dir, playlist)) return false;
  const m4s = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".m4s"))
    .sort();
  if (m4s.length < minCount) return false;
  for (let i = 0; i < minCount; i++) {
    try {
      if (fs.statSync(path.join(dir, m4s[i])).size < minBytesEach) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function firstSegmentReady(dir, playlistPath) {
  const snap = streamDirSnapshot(dir);
  let body = "";
  try {
    body = fs.readFileSync(playlistPath, "utf8");
  } catch {
    return false;
  }
  if (body.includes(".m4s") || body.includes("init.mp4")) {
    return fmp4SegmentsReady(dir, 2, MIN_FIRST_SEGMENT_BYTES);
  }
  if (snap.tsCount > 0) {
    return tsSegmentsReady(dir, 2, MIN_FIRST_SEGMENT_BYTES);
  }
  return body.includes("#EXTINF");
}

function readPlaylistHead(playlistPath, maxLen = 400) {
  try {
    return fs.readFileSync(playlistPath, "utf8").slice(0, maxLen);
  } catch {
    return "";
  }
}

/** ExoPlayer can start when index.m3u8 lists a segment and media-*.ts exists on disk. */
function canStartHlsPlayback(dir, playlistPath) {
  const playlistPathOnDisk = fs.existsSync(playlistPath)
    ? playlistPath
    : path.join(dir, "index.m3u8");
  if (!fs.existsSync(playlistPathOnDisk)) return false;

  try {
    const body = fs.readFileSync(playlistPathOnDisk, "utf8");
    if (!body.includes("#EXTM3U") || !body.includes("#EXTINF")) return false;
  } catch {
    return false;
  }

  if (!fmp4InitReady(dir, playlistPathOnDisk)) return false;

  let body = "";
  try {
    body = fs.readFileSync(playlistPathOnDisk, "utf8");
  } catch {
    return false;
  }
  if (body.includes(".m4s") || body.includes("init.mp4")) {
    return fmp4SegmentsReady(dir, 2, MIN_FIRST_SEGMENT_BYTES);
  }
  return firstSegmentReady(dir, playlistPathOnDisk);
}

function playlistComplete(playlistPath) {
  if (!fs.existsSync(playlistPath)) return false;
  try {
    const body = fs.readFileSync(playlistPath, "utf8");
    return body.includes("#EXTM3U") && body.includes("#EXT-X-ENDLIST");
  } catch {
    return false;
  }
}

function isStreamCacheValid(sourcePath, playlistPath) {
  const { dir } = getStreamPaths(sourcePath);
  if (!playlistComplete(playlistPath) || !canStartHlsPlayback(dir, playlistPath)) {
    return false;
  }
  try {
    const src = fs.statSync(sourcePath);
    const pl = fs.statSync(playlistPath);
    return pl.mtimeMs >= src.mtimeMs;
  } catch {
    return false;
  }
}

function publicPlaylistUrl(sourcePath, cacheBust) {
  const safe = safeDirName(sourcePath);
  const rel = path.relative(PLEX_TEMP_ROOT, path.join(STREAM_ROOT, safe)).replace(/\\/g, "/");
  const base = urlTransformer.toPublicUrl(
    `/plexTemp/${rel}/index.m3u8`.replace(/ /g, "%20")
  );
  if (!cacheBust) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}v=${cacheBust}`;
}

function waitForPlaylist(dir, playlistPath, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (canStartHlsPlayback(dir, playlistPath)) return resolve();
      if (Date.now() - started > timeoutMs) {
        return reject(new Error("Timed out waiting for HLS playlist"));
      }
      setTimeout(tick, Date.now() - started < 5000 ? 100 : 300);
    };
    tick();
  });
}

function clearDir(dir) {
  try {
    for (const f of fs.readdirSync(dir)) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch (_) {}
    }
  } catch (_) {}
  for (const stale of ["init.mp4", "index.m3u8.tmp"]) {
    try {
      const p = path.join(dir, stale);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) {}
  }
}

/**
 * Plex cache layout: Matroska `header` + `media-*.ts` (Plex app protocol).
 * ExoPlayer plays standard MPEG-TS HLS with the same on-disk names + index.m3u8.
 * All ffmpeg outputs use cwd = stream dir (relative paths only).
 */
const HLS_PLAYLIST_NAME = "index.m3u8";
const PLEX_HEADER_NAME = "header";
const HLS_SEGMENT_TS = "media-%05d.ts";

function writePlexStyleHeader(ffmpeg, sourcePath, dir, mapArgs) {
  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-y",
      "-i",
      sourcePath,
      ...mapArgs,
      "-sn",
      "-dn",
      "-c",
      "copy",
      "-f",
      "matroska",
      "-t",
      "0.001",
      PLEX_HEADER_NAME,
    ];
    const proc = spawn(ffmpeg, args, {
      cwd: dir,
      stdio: ["ignore", "ignore", "pipe"],
    });
    proc.on("close", () => resolve());
    proc.on("error", () => resolve());
  });
}

function buildHlsCore(sourcePath, mapArgs) {
  return [
    "-hide_banner",
    "-y",
    "-fflags",
    "+genpts",
    "-i",
    sourcePath,
    ...mapArgs,
    "-sn",
    "-dn",
    "-max_muxing_queue_size",
    "9999",
    "-copyts",
    "-muxdelay",
    "0",
    "-muxpreload",
    "0",
    "-hls_time",
    "4",
    "-hls_playlist_type",
    "event",
    "-hls_list_size",
    "0",
    "-hls_flags",
    "append_list+omit_endlist",
    "-f",
    "hls",
  ];
}

function isShieldDirectHttpPlayable(probe) {
  const videoStream = (probe.streams || []).find((s) => s.codec_type === "video");
  if (!videoStream) return false;

  const vCodec = String(videoStream.codec_name || "").toLowerCase();
  if (!["h264", "hevc", "h265"].includes(vCodec)) return false;

  const audioStreams = (probe.streams || []).filter((s) => s.codec_type === "audio");
  if (audioStreams.length === 0) return true;

  return audioStreams.every((s) =>
    MP4_SAFE_AUDIO.has(String(s.codec_name || "").toLowerCase())
  );
}

function buildPlexStyleStreamPlans(sourcePath, probe) {
  const mapArgs = buildRemuxMaps(probe);
  const isDv = sourceHasDolbyVision(probe);
  const hlsCore = buildHlsCore(sourcePath, mapArgs);
  const mpegtsOut = [
    ...hlsCore,
    "-hls_segment_type",
    "mpegts",
    "-hls_segment_filename",
    HLS_SEGMENT_TS,
  ];

  const videoStream = (probe.streams || []).find((s) => s.codec_type === "video");
  const audioCodecs = (probe.streams || [])
    .filter((s) => s.codec_type === "audio")
    .map((s) => s.codec_name);
  const vCodec = String(videoStream?.codec_name || "").toLowerCase();

  const baseMeta = {
    isDv,
    mapArgs,
    videoCodec: videoStream?.codec_name,
    videoTag: videoStream?.codec_tag_string,
    audioCodecs,
  };

  if (vCodec === "h264") {
    return [
      {
        ...baseMeta,
        label: "h264-copy-audio-copy-mpegts",
        args: [
          ...mpegtsOut,
          "-c:v",
          "copy",
          "-c:a",
          "copy",
          HLS_PLAYLIST_NAME,
        ],
      },
    ];
  }

  return [
    {
      ...baseMeta,
      label: "hevc-copy-audio-copy-mpegts",
      args: [
        ...mpegtsOut,
        "-c:v",
        "copy",
        "-bsf:v",
        "hevc_metadata",
        "-c:a",
        "copy",
        HLS_PLAYLIST_NAME,
      ],
    },
  ];
}


/**
 * Ensure HLS direct stream exists; start ffmpeg remux from local file if needed.
 * @returns {Promise<{ location: string, pid: number, cached: boolean }>}
 */
async function ensureDirectStreamHls(sourcePath) {
  const { dir, playlist } = getStreamPaths(sourcePath);

  if (isStreamCacheValid(sourcePath, playlist)) {
    const bust = Math.floor(fs.statSync(playlist).mtimeMs);
    return {
      location: publicPlaylistUrl(sourcePath, bust),
      pid: 0,
      cached: true,
      plan: "hevc-copy-audio-copy-mpegts",
    };
  }

  const existing = jobs.get(sourcePath);
  if (existing) {
    await existing;
    if (isStreamCacheValid(sourcePath, playlist)) {
      const bust = Math.floor(fs.statSync(playlist).mtimeMs);
      return {
        location: publicPlaylistUrl(sourcePath, bust),
        pid: 0,
        cached: true,
      };
    }
    throw new Error("HLS stream build failed");
  }

  const job = (async () => {
    fs.mkdirSync(dir, { recursive: true });
    clearDir(dir);

    const probe = await probeStreams(sourcePath);
    const ffmpeg = getFfmpegPath();
    const plans = buildPlexStyleStreamPlans(sourcePath, probe);
    const isDv = plans[0]?.isDv === true;

    console.log(
      "[plex-stream] Shield stream (Plex-style TS):",
      path.basename(sourcePath),
      isDv ? "Dolby Vision source" : "SDR/HDR"
    );

    return new Promise((resolve, reject) => {
      let planIdx = 0;

      const tryPlan = () => {
        if (planIdx >= plans.length) {
          return reject(new Error("All Plex-style stream plans failed"));
        }
        const plan = plans[planIdx++];
        writePlexStyleHeader(ffmpeg, sourcePath, dir, plan.mapArgs);
        const proc = spawn(ffmpeg, plan.args, {
          cwd: dir,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";

        proc.stderr.on("data", (chunk) => {
          const line = String(chunk);
          stderr += line;
          if (line.includes("time=")) {
            process.stdout.write(`[plex-stream] ${line.trim()}\n`);
          }
        });

        waitForPlaylist(dir, playlist)
          .then(() => {
            const bust = Date.now();
            resolve({ pid: proc.pid, cached: false, plan: plan.label, cacheBust: bust });
          })
          .catch((err) => {
            try {
              proc.kill("SIGTERM");
            } catch (_) {}
            clearDir(dir);
            tryPlan();
          });

        proc.on("close", (code) => {
          if (code !== 0 && !canStartHlsPlayback(dir, playlist)) {
            console.error("[plex-stream] ffmpeg exit", code, sourcePath);
          }
        });
      };

      tryPlan();
    });
  })();

  jobs.set(sourcePath, job);

  try {
    const result = await job;
    return {
      location: publicPlaylistUrl(sourcePath, result.cacheBust),
      pid: result.pid,
      cached: result.cached,
    };
  } finally {
    jobs.delete(sourcePath);
  }
}

module.exports = {
  ensureDirectStreamHls,
  ensureDemoSiblingMkv,
  demoSiblingMkvPath,
  mkvHasVideoFirst,
  getStreamPaths,
  STREAM_ROOT,
  probeStreams,
  sourceHasDolbyVision,
  isShieldDirectHttpPlayable,
};
