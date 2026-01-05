let express = require("express");
let router = express.Router();
let pool = require("../../config/connections");
let models = require("../models/movies.models");
let fs = require("fs");
let fetch = require("node-fetch");
let transcoder = require("../models/transcoder");
let tv = require("../models/tvShows.models");
let pixie = require("../models/pixie");
const BonusFeatures = require("../models/bonusFeatures");
let { search } = require("../models/search");
const urlTransformer = require("../utils/url-transformer");
const path = require("path");

router.get("/stream", (req, res) => {
  const filePath = decodeURIComponent(req.query.path); 
  if (!filePath) { 
    return res.status(400).send("Missing file path"); 
  } 
  if (!fs.existsSync(filePath)) { 
    return res.status(404).send("File not found"); 
  } 
  const stat = fs.statSync(filePath); 
  const fileSize = stat.size; 
  const range = req.headers.range; 
  
  // Determine optimal chunk size based on file size (larger files = larger chunks)
  // For very large files (90GB+), use larger chunks to reduce request overhead
  let CHUNK_SIZE;
  if (fileSize > 50 * 1024 * 1024 * 1024) { // > 50GB (very large 4K/8K files)
    CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks for very large files
  } else if (fileSize > 20 * 1024 * 1024 * 1024) { // > 20GB (likely 4K)
    CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks for 4K
  } else if (fileSize > 10 * 1024 * 1024 * 1024) { // > 10GB
    CHUNK_SIZE = 25 * 1024 * 1024; // 25MB chunks
  } else {
    CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for smaller files
  }
  // If no range header, serve the full file (ExoPlayer might make initial request without range)
  if (!range) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".mp4" ? "video/mp4" : ext === ".mkv" ? "video/x-matroska" : "application/octet-stream";
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600" // Cache for 1 hour
    });
    // Use highWaterMark for better buffering (8MB buffer)
    const stream = fs.createReadStream(filePath, { 
      highWaterMark: 8 * 1024 * 1024 
    });
    stream.pipe(res);
    return;
  }
  
  // Parse Range header: "bytes=start-end" or "bytes=start-" or "bytes=-suffix"
  const rangeMatch = range.match(/bytes=(\d*)-(\d*)/);
  if (!rangeMatch) {
    res.writeHead(416, {
      "Content-Range": `bytes */${fileSize}`,
      "Accept-Ranges": "bytes"
    });
    return res.end("Invalid Range header format");
  }
  
  let start = 0;
  let end = fileSize - 1;
  
  if (rangeMatch[1]) {
    start = parseInt(rangeMatch[1], 10);
  }
  
  if (rangeMatch[2]) {
    end = parseInt(rangeMatch[2], 10);
  } else {
    // If no end specified, use adaptive chunk size
    end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
  }
  
  // Validate range
  if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= fileSize) {
    res.writeHead(416, {
      "Content-Range": `bytes */${fileSize}`,
      "Accept-Ranges": "bytes"
    });
    return res.end("Range Not Satisfiable");
  }
  
  const contentLength = end - start + 1;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".mp4" ? "video/mp4" : ext === ".mkv" ? "video/x-matroska" : "application/octet-stream";
  
  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=3600" // Cache for 1 hour
  });
  
  // Use highWaterMark for better buffering - larger buffer for 4K files
  let bufferSize;
  if (fileSize > 50 * 1024 * 1024 * 1024) { // > 50GB
    bufferSize = 32 * 1024 * 1024; // 32MB buffer for very large files
  } else if (fileSize > 20 * 1024 * 1024 * 1024) { // > 20GB
    bufferSize = 16 * 1024 * 1024; // 16MB buffer for 4K
  } else {
    bufferSize = 8 * 1024 * 1024; // 8MB buffer for smaller files
  }
  const stream = fs.createReadStream(filePath, { 
    start, 
    end,
    highWaterMark: bufferSize // Larger buffer for better I/O performance
  });
    
  stream.pipe(res);
  
  // Handle stream errors
  stream.on("error", (err) => {
    console.error("Stream error:", err);
    if (!res.headersSent) {
      res.status(500).send("Stream error");
    }
  });
});

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
    } else {
      res.send(results);
    }
  });
});

router.get("/scanProgress", (req, res) => {
  const progress = models.getScanProgress();
  res.send(progress);
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

module.exports = router;
