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

router.post("/movies", (req, res) => {
  console.log("body", req.body);
  models.getAllMovies(
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

module.exports = router;
