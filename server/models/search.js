let pool = require("../../config/connections");
let fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
let codecGetter = require("./codec-determine");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
ffmpeg.setFfprobePath(ffprobePath);
const rimraf = require("rimraf");
const path = require("path");
ffmpeg.setFfmpegPath(ffmpegPath);

let chokidar = require("chokidar");
var showPlayer = false;
var fetch = require("node-fetch");
const { spawn } = require("child_process");
const { networkInterfaces } = require("os");
const cp = require("child_process");
const { resolve } = require("core-js/fn/promise");
const Downloader = require("./downloader");
const BonusFeatures = require("./bonusFeatures");

var arrOfObj = [];
var newArr = [];
var url = "";
var i = 0;
var fileLocation = "";
var newSrc;

var arr = [];
var killProcess = false;
var ffstream = ffmpeg();
var exec = require("child_process").exec;
const { execSync } = require("child_process");
const { restart } = require("nodemon");

let routeFunctions = {
  search: (query, callback) => {
    pool.query(
      `SELECT title, coverArt FROM movies WHERE title LIKE '${query.searchVal}%'
        UNION
        SELECT title, coverArt FROM tv WHERE title LIKE '${query.searchVal}%'
        LIMIT 5;`,
      (err, res) => {
        console.log(err, res);
        callback(null, res);
      }
    );
  },
};

module.exports = routeFunctions;
