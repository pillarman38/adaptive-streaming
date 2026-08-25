const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const { configureFluentFfmpeg } = require("./ffmpeg-paths");
const urlTransformer = require("./url-transformer");

configureFluentFfmpeg(ffmpeg);

const DEMO_ROOT = "G:/Demo videos";
const THUMB_DIR = path.join(DEMO_ROOT, "demo thumbnails");

const VIDEO_EXTENSIONS = new Set([".mkv", ".mp4", ".m4v"]);

function ensureThumbDir() {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
}

function thumbFileName(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  return `${base}.jpg`;
}

function thumbAbsolutePath(fileName) {
  return path.join(THUMB_DIR, thumbFileName(fileName));
}

function thumbPublicPath(fileName) {
  const rel = path
    .join("Demo videos", "demo thumbnails", thumbFileName(fileName))
    .replace(/\\/g, "/");
  const segments = rel.split("/").map((s) => encodeURIComponent(s));
  return `/${segments.join("/")}`;
}

function tryExtractMkvAttachment(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext !== ".mkv") {
    return null;
  }

  try {
    const info = execSync(`mkvmerge -i "${filePath}"`, { encoding: "utf8" });
    const attachmentLine = info
      .split("\n")
      .find((line) => line.includes("Attachment"));
    if (!attachmentLine) {
      return null;
    }

    const id = parseInt(attachmentLine.split(" ")[2].replace(":", ""), 10);
    if (Number.isNaN(id)) {
      return null;
    }

    ensureThumbDir();
    const outPath = thumbAbsolutePath(fileName);
    execSync(
      `mkvextract "${filePath}" attachments "${id}:${outPath}"`,
      { encoding: "utf8" }
    );

    if (fs.existsSync(outPath)) {
      return urlTransformer.toEndpoint(thumbPublicPath(fileName));
    }
  } catch {
    /* fall through to ffmpeg */
  }

  return null;
}

function extractFfmpegFrame(filePath, fileName, durationSec) {
  ensureThumbDir();
  const outPath = thumbAbsolutePath(fileName);
  const offset =
    durationSec && durationSec > 60
      ? Math.min(30, durationSec * 0.1)
      : durationSec && durationSec > 5
        ? durationSec * 0.1
        : 1;

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .seekInput(offset)
      .frames(1)
      .outputOptions(["-q:v", "2"])
      .output(outPath)
      .on("end", () => {
        if (fs.existsSync(outPath)) {
          resolve(urlTransformer.toEndpoint(thumbPublicPath(fileName)));
        } else {
          reject(new Error("ffmpeg thumbnail file missing"));
        }
      })
      .on("error", reject)
      .run();
  });
}

async function ensureDemoThumbnail(filePath, fileName, durationSec) {
  ensureThumbDir();
  const existing = thumbAbsolutePath(fileName);
  if (fs.existsSync(existing)) {
    return urlTransformer.toEndpoint(thumbPublicPath(fileName));
  }

  const fromAttachment = tryExtractMkvAttachment(filePath, fileName);
  if (fromAttachment) {
    return fromAttachment;
  }

  return extractFfmpegFrame(filePath, fileName, durationSec);
}

function isDemoVideoFile(fileName) {
  return VIDEO_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

module.exports = {
  DEMO_ROOT,
  THUMB_DIR,
  isDemoVideoFile,
  ensureDemoThumbnail,
};
