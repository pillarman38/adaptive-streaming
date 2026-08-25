/**
 * Resolve ffmpeg/ffprobe: env override → project ffmpegBin/ → PATH → npm installers.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO_ROOT = path.join(__dirname, "../..");
const PROJECT_FFMPEG = path.join(REPO_ROOT, "ffmpegBin", "ffmpeg.exe");
const PROJECT_FFPROBE = path.join(REPO_ROOT, "ffmpegBin", "ffprobe.exe");
const BUNDLED_FFMPEG = require("@ffmpeg-installer/ffmpeg").path;
const BUNDLED_FFPROBE = require("@ffprobe-installer/ffprobe").path;

let loggedPaths = false;

function resolveOnPath(binaryName) {
  try {
    const cmd =
      process.platform === "win32"
        ? `where ${binaryName} 2>nul`
        : `which ${binaryName}`;
    const found = execSync(cmd, { encoding: "utf8" }).trim().split(/\r?\n/)[0];
    if (found && fs.existsSync(found)) return found;
  } catch (_) {}
  return null;
}

function resolveTool(envKey, projectPath, bundledPath, binaryName) {
  if (process.env[envKey] && fs.existsSync(process.env[envKey])) {
    return process.env[envKey];
  }
  if (fs.existsSync(projectPath)) {
    return projectPath;
  }
  const onPath = resolveOnPath(binaryName);
  if (onPath) return onPath;
  return bundledPath;
}

function getFfmpegPath() {
  return resolveTool("FFMPEG_PATH", PROJECT_FFMPEG, BUNDLED_FFMPEG, "ffmpeg");
}

function getFfprobePath() {
  return resolveTool("FFPROBE_PATH", PROJECT_FFPROBE, BUNDLED_FFPROBE, "ffprobe");
}

function logResolvedPaths() {
  if (loggedPaths) return;
  loggedPaths = true;
  const ffmpeg = getFfmpegPath();
  const ffprobe = getFfprobePath();
  console.log("[ffmpeg] ffmpeg:", ffmpeg);
  console.log("[ffmpeg] ffprobe:", ffprobe);
  try {
    const version = execSync(`"${ffmpeg}" -version`, { encoding: "utf8" })
      .split("\n")[0]
      .trim();
    console.log("[ffmpeg]", version);
  } catch (_) {}
}

/** Call once after requiring fluent-ffmpeg. */
function configureFluentFfmpeg(fluentFfmpeg) {
  logResolvedPaths();
  fluentFfmpeg.setFfmpegPath(getFfmpegPath());
  fluentFfmpeg.setFfprobePath(getFfprobePath());
}

module.exports = {
  getFfmpegPath,
  getFfprobePath,
  logResolvedPaths,
  configureFluentFfmpeg,
  PROJECT_FFMPEG,
  PROJECT_FFPROBE,
};
