let express = require("express");
let router = express.Router();
let pool = require("../../config/connections");
let models = require("../models/movies.models");
let fs = require("fs");
let fetch = require("node-fetch");
let transcoder = require("../models/transcoder");
let tv = require("../models/tvShows.models");
const demoVideos = require("../models/demo-videos.models");
let pixie = require("../models/pixie");
const BonusFeatures = require("../models/bonusFeatures");
let { search } = require("../models/search");
const urlTransformer = require("../utils/url-transformer");
const path = require("path");

router.get("/stream", handleStream);
router.head("/stream", handleStream);

function handleStream(req, res) {
  const rawPath = req.query.path;
  if (rawPath == null || rawPath === "" || rawPath === "undefined") {
    return res.status(400).send("Missing file path");
  }
  const filePath = decodeURIComponent(String(rawPath));
  if (!filePath || filePath === "undefined") {
    return res.status(400).send("Missing file path");
  }
  console.log("[stream] request:", filePath, "range:", req.headers.range || "none");
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === ".mp4"
      ? "video/mp4"
      : ext === ".mkv"
        ? "video/x-matroska"
        : "application/octet-stream";
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=3600",
  };

  // HEAD: metadata only — never send the file body.
  if (req.method === "HEAD") {
    res.writeHead(200, { ...baseHeaders, "Content-Length": fileSize });
    return res.end();
  }

  const range = req.headers.range;

  // No Range: return 200 with full Content-Length. A spontaneous truncated 206
  // (previous behavior) makes Kodi stop before OnAVStart — it never retries with Range.
  if (!range) {
    res.writeHead(200, {
      ...baseHeaders,
      "Content-Length": fileSize,
    });
    const stream = fs.createReadStream(filePath, {
      highWaterMark: bufferSizeFor(fileSize),
    });
    req.on("close", () => {
      if (!res.writableEnded) {
        console.log("[stream] client closed (no-range 200):", path.basename(filePath));
        stream.destroy();
      }
    });
    stream.on("error", (err) => {
      console.error("[stream] error:", err.message);
      if (!res.headersSent) {
        res.status(500).send("Stream error");
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
    return;
  }

  const rangeMatch = range.match(/bytes=(\d*)-(\d*)/);
  if (!rangeMatch) {
    res.writeHead(416, {
      "Content-Range": `bytes */${fileSize}`,
      "Accept-Ranges": "bytes",
    });
    return res.end("Invalid Range header format");
  }

  let start = 0;
  let end = fileSize - 1;

  if (!rangeMatch[1] && rangeMatch[2]) {
    // Suffix range: bytes=-500 (MKV cue index at end of file)
    const suffix = parseInt(rangeMatch[2], 10);
    if (isNaN(suffix) || suffix <= 0) {
      res.writeHead(416, {
        "Content-Range": `bytes */${fileSize}`,
        "Accept-Ranges": "bytes",
      });
      return res.end("Range Not Satisfiable");
    }
    start = Math.max(fileSize - suffix, 0);
    end = fileSize - 1;
  } else {
    if (rangeMatch[1]) {
      start = parseInt(rangeMatch[1], 10);
    }
    if (rangeMatch[2]) {
      end = parseInt(rangeMatch[2], 10);
    } else if (rangeMatch[1]) {
      // RFC 7233: bytes=N- means from N through end of file (not a fixed chunk cap).
      end = fileSize - 1;
    }
  }

  if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= fileSize) {
    res.writeHead(416, {
      "Content-Range": `bytes */${fileSize}`,
      "Accept-Ranges": "bytes",
    });
    return res.end("Range Not Satisfiable");
  }

  pipeByteRange(req, res, filePath, fileSize, start, end, baseHeaders, bufferSizeFor(fileSize));
}

function bufferSizeFor(fileSize) {
  if (fileSize > 50 * 1024 * 1024 * 1024) {
    return 32 * 1024 * 1024;
  }
  if (fileSize > 20 * 1024 * 1024 * 1024) {
    return 16 * 1024 * 1024;
  }
  return 8 * 1024 * 1024;
}

function pipeByteRange(req, res, filePath, fileSize, start, end, baseHeaders, highWaterMark) {
  const contentLength = end - start + 1;
  res.writeHead(206, {
    ...baseHeaders,
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Content-Length": contentLength,
  });

  const stream = fs.createReadStream(filePath, { start, end, highWaterMark });
  req.on("close", () => {
    if (!res.writableEnded) {
      console.log("[stream] client closed:", path.basename(filePath), `bytes ${start}-${end}`);
      stream.destroy();
    }
  });
  stream.on("error", (err) => {
    console.error("[stream] error:", err.message);
    if (!res.headersSent) {
      res.status(500).send("Stream error");
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

router.post("/movies", (req, res) => {
  console.log("body", req.body);
  models.getAllMovies(
    {
      pid: req.body["pid"],
      offset: req.body["offset"],
    },
    (err, results) => {
      if (err) {
        res.send(err);
      } else {
        res.send(results);
      }
    }
  );
});

router.get("/scanLibrary", (req, res) => {
  console.log("body", req.body);
  models.updateMovies((err, results) => {
    if (err) {
      res.send(err);
      return;
    }
    demoVideos.updateDemoVideos((demoErr, demoResults) => {
      if (demoErr) {
        res.send(demoErr);
        return;
      }
      tv.updateTvShows((tvErr, tvResults) => {
        if (tvErr) {
          res.send(tvErr);
        } else {
          res.send({
            movies: results,
            demoVideos: demoResults,
            tvShows: tvResults,
          });
        }
      });
    });
  });
});

router.get("/scanProgress", (req, res) => {
  const moviesProgress = models.getScanProgress();
  const demoProgress = demoVideos.getScanProgress();
  const tvShowsProgress = tv.getScanProgress();
  res.send({
    movies: moviesProgress,
    demoVideos: demoProgress,
    tvShows: tvShowsProgress,
  });
});

router.post("/demos", (req, res) => {
  demoVideos.getAllDemoVideos((err, results) => {
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/selectedShow", (req, res) => {
  tv.getSelectedShow(req.body, (err, results) => {
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/tv", (req, res) => {
  console.log("body", req.body);
  tv.getAllShows(
    {
      pid: req.body["pid"],
    },
    (err, results) => {
      if (err) {
        res.send(err);
      } else {
        res.send(results);
      }
    }
  );
});

router.post("/transcodedMovieDirectoryInfo", (req, res) => {
  pixie.getDirAfterTranscode(req.body, (err, results) => {
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/homevideos", (req, res) => {
  console.log("body", req.body);
  models.getAllHomeVids(
    {
      pid: req.body["pid"],
    },
    (err, results) => {
      if (err) {
        res.send(err);
      } else {
        res.send(results);
      }
    }
  );
});

router.post("/video", (req, res) => {
  models.getAHomeVideoList(
    {
      title: req.body["title"],
      browser: req.body["browser"],
      fileformat: req.body["fileformat"],
    },
    (err, results) => {
      if (err) {
        res.send(err);
      } else {
        res.send(results);
      }
    }
  );
});

router.post("/pidkill", (req, res) => {
  console.log(req.body, res);
  transcoder.pidKiller(req.body, (err, results) => {
    console.log("PID Return", err, results);
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/resume", (req, res) => {
  console.log(req.body, res);
  models.resumeOrNot(req.body, (err, results) => {
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/show", (req, res) => {
  console.log("body", req.body);
  tv.getSelectedShow(req.body, (err, results) => {
    console.log(err, results);
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.get("/transcodedmovie", (req, res) => {
  models.getTranscodedMovie((err, results) => {
    if (err) {
      return res.send({ err: err });
    } else {
      res.send(results);
    }
  });
});

router.post("/pullVideo", (req, res) => {
  transcoder.startConverting(req.body, (err, results) => {
    if (err) {
      return res.send({ err: err });
    } else {
      res.send(results);
    }
  });
});

router.post("/transcodeMoviesForPixie", (req, res) => {
  console.log("body", req.body);
  pixie.transcodeMovies(req.body, (err, results) => {
    console.log(err, results);
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/grabBonusFeatures", (req, res) => {
  console.log("body", req.body);
  const bf = new BonusFeatures();
  bf.grabBonusFeatures(req.body, (err, results) => {
    console.log(err, results);
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/search", (req, res) => {
  search(req.body, (err, results) => {
    console.log(err, results);
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/search/movies", (req, res) => {
  models.searchMovies(req.body, (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/search/tv", (req, res) => {
  tv.searchShows(req.body, (err, results) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/seasons", (req, res) => {
  tv.getSeasons(req.body, (err, results) => {
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/nextep", (req, res) => {
  tv.getNextEp(req.body, (err, results) => {
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.get("/eplist", (req, res) => {
  tv.getAllEps((err, results) => {
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/season", (req, res) => {
  tv.getSpecificSeason(req.body, (err, results) => {
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.post("/transmux", (req, res) => {
  models.changeTransmuxStatus(req.body, (err, results) => {
    if (err) {
      res.send(err);
    } else {
      res.send(results);
    }
  });
});

router.get("/server-config", (req, res) => {
  const config = urlTransformer.getConfig();
  // Only return the config if it has a serverIp (for security, don't expose if not configured)
  if (config && config.serverIp) {
    res.json({ serverIp: config.serverIp, serverPort: config.serverPort || "5012" });
  } else {
    res.json({ serverIp: null, serverPort: "5012" });
  }
});

// Proxy route for volume control to avoid CORS issues
router.post("/volume", async (req, res) => {
  try {
    const deviceUrl = "http://10.0.0.32/fcgi-bin/request.fcgi";
    const response = await fetch(deviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error proxying volume control request:", error);
    res.status(500).json({ error: "Failed to send volume control request" });
  }
});

module.exports = router;
