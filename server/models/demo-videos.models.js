const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const pool = require("../../config/connections");
const { configureFluentFfmpeg } = require("../utils/ffmpeg-paths");
const urlTransformer = require("../utils/url-transformer");
const plexStreamServer = require("../utils/plex-stream-server");
const {
  DEMO_ROOT,
  isDemoVideoFile,
  ensureDemoThumbnail,
} = require("../utils/demo-thumbnail");
const {
  getVideoResolution,
  detectDolbyVision,
  getAudioInfo,
} = require("../utils/video-metadata");

configureFluentFfmpeg(ffmpeg);

const DEMO_URL_FIELDS = ["thumbnailPath"];

let scanProgress = {
  isScanning: false,
  current: 0,
  total: 0,
  currentFile: "",
};

function probeFile(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) {
        reject(err);
      } else {
        resolve(meta);
      }
    });
  });
}

function insertDemoRow(row) {
  return new Promise((resolve, reject) => {
    pool.query("INSERT INTO demoVideo SET ?", row, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

function updateDemoRow(id, fileName, filePath) {
  return new Promise((resolve, reject) => {
    pool.query(
      "UPDATE demoVideo SET fileName = ?, filePath = ? WHERE id = ?",
      [fileName, filePath, id],
      (err, res) => (err ? reject(err) : resolve(res))
    );
  });
}

function mkvFileNameFor(fileName) {
  const ext = path.extname(fileName);
  if (!ext || ext.toLowerCase() === ".mkv") {
    return fileName;
  }
  return `${path.basename(fileName, ext)}.mkv`;
}

/** Skip mp4/m4v when a sibling .mkv is already in the folder. */
function shouldIndexDemoFile(fileName, allFiles) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".mkv") {
    return true;
  }
  return !allFiles.includes(mkvFileNameFor(fileName));
}

async function ensureDemoMkvOnDisk(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".mkv") {
    return fileName;
  }

  const mkvFileName = mkvFileNameFor(fileName);
  scanProgress.currentFile = `Converting ${fileName} → ${mkvFileName}`;
  console.log("[demo-sync]", scanProgress.currentFile);

  const sourcePath = path.join(DEMO_ROOT, fileName).replace(/\\/g, "/");
  const mkvPath = await plexStreamServer.ensureDemoSiblingMkv(sourcePath);
  return path.basename(mkvPath);
}

async function migrateNonMkvDemoRows() {
  const rows = await new Promise((resolve, reject) => {
    pool.query(
      "SELECT id, fileName FROM demoVideo WHERE LOWER(fileName) NOT LIKE '%.mkv'",
      (err, results) => (err ? reject(err) : resolve(results || []))
    );
  });

  for (const row of rows) {
    const sourcePath = path.join(DEMO_ROOT, row.fileName).replace(/\\/g, "/");
    if (!fs.existsSync(sourcePath)) {
      console.warn("[demo-sync] Skipping missing demo file:", row.fileName);
      continue;
    }

    const mkvFileName = await ensureDemoMkvOnDisk(row.fileName);
    const mkvPath = path.join(DEMO_ROOT, mkvFileName).replace(/\\/g, "/");
    await updateDemoRow(row.id, mkvFileName, mkvPath);
    console.log("[demo-sync] Updated DB entry:", row.fileName, "→", mkvFileName);
  }
}

async function processDemoFile(fileName) {
  const mkvFileName = await ensureDemoMkvOnDisk(fileName);
  const filePath = path.join(DEMO_ROOT, mkvFileName).replace(/\\/g, "/");
  const meta = await probeFile(filePath);
  const title = path.basename(mkvFileName, path.extname(mkvFileName));
  const audioInfo = getAudioInfo(meta);
  const duration = parseFloat(meta?.format?.duration) || 0;

  const thumbnailPath = await ensureDemoThumbnail(
    filePath,
    mkvFileName,
    duration
  );

  const row = {
    title,
    fileName: mkvFileName,
    filePath,
    duration,
    resolution: getVideoResolution(meta),
    channels: audioInfo.channels,
    audio: audioInfo.codecName,
    dolbyVision: detectDolbyVision(meta) ? 1 : 0,
    thumbnailPath: thumbnailPath || null,
    seekTime: 0,
  };

  urlTransformer.prepareRecordForStorage(row, DEMO_URL_FIELDS);
  await insertDemoRow(row);
}

function updateDemoVideosInDB(callback) {
  scanProgress.isScanning = true;
  scanProgress.current = 0;
  scanProgress.total = 0;
  scanProgress.currentFile = "";

  if (!fs.existsSync(DEMO_ROOT)) {
    scanProgress.isScanning = false;
    callback(null, []);
    return;
  }

  let files;
  try {
    files = fs
      .readdirSync(DEMO_ROOT)
      .filter((f) => isDemoVideoFile(f));
  } catch (err) {
    scanProgress.isScanning = false;
    callback(err);
    return;
  }

  const indexable = files.filter((f) => shouldIndexDemoFile(f, files));

  pool.query("SELECT fileName FROM demoVideo", async (err, rows) => {
    if (err) {
      scanProgress.isScanning = false;
      callback(err);
      return;
    }

    try {
      await migrateNonMkvDemoRows();

      const existingRows = await new Promise((resolve, reject) => {
        pool.query("SELECT fileName FROM demoVideo", (qErr, results) =>
          qErr ? reject(qErr) : resolve(results || [])
        );
      });
      const existing = new Set(existingRows.map((r) => r.fileName));
      const toAdd = indexable.filter((f) => !existing.has(mkvFileNameFor(f)));

      scanProgress.total = toAdd.length;
      scanProgress.current = 0;

      if (toAdd.length === 0) {
        scanProgress.isScanning = false;
        callback(null, []);
        return;
      }

      for (let i = 0; i < toAdd.length; i++) {
        scanProgress.current = i;
        scanProgress.currentFile = toAdd[i];
        await processDemoFile(toAdd[i]);
      }
      scanProgress.current = toAdd.length;
      scanProgress.isScanning = false;
      scanProgress.currentFile = "";
      callback(null, { added: toAdd.length });
    } catch (processErr) {
      scanProgress.isScanning = false;
      callback(processErr);
    }
  });
}

function getAllDemoVideos(callback) {
  pool.query(
    "SELECT * FROM demoVideo ORDER BY title ASC",
    (err, results) => {
      if (err) {
        callback(err);
        return;
      }

      const demos = (results || []).map((row) => {
        const demo = { ...row };
        urlTransformer.prepareRecordForResponse(demo, DEMO_URL_FIELDS);
        if (demo.thumbnailPath) {
          demo.thumbnailPath = urlTransformer.encodeUrlPath(
            demo.thumbnailPath
          );
        }
        demo.dolbyVision = demo.dolbyVision ? 1 : 0;
        demo.fileformat = path.extname(demo.fileName || "").slice(1) || "mkv";
        return demo;
      });

      callback(null, demos);
    }
  );
}

module.exports = {
  updateDemoVideos: (callback) => updateDemoVideosInDB(callback),
  getAllDemoVideos,
  getScanProgress: () => scanProgress,
};
