require("./config/config");
const { logResolvedPaths } = require("./server/utils/ffmpeg-paths");
logResolvedPaths();
require("./server/models/pixie");
const express = require("express");
const fs = require("fs");
const app = express()
const port = 5012;
let cors = require("cors");
let bparser = require("body-parser");

app.use(bparser.urlencoded({ extended: true }));
app.use(bparser.json());
// app.use(express.static("/mnt/F898C32498C2DFEC"));
if (fs.existsSync("E:/")) {
  app.use(express.static("E:/"));
}
app.use(express.static("G:/"));
if (fs.existsSync("I:/")) {
  app.use(express.static("I:/"));
}
app.use(express.static(__dirname + "/dist"));
// Serve server-config.json from repo root
app.use(express.static(__dirname));
// app.use(express.static("F:/"));
// app.use(express.static("D:/"));
// app.use(express.static("J:/"));

app.use(cors());

let userRoutes = require("./server/routes/movies.routes");
app.use("/api/mov", userRoutes);

// Redirect root path to videoSelection
app.get("/", (req, res) => {
  res.redirect("/videoSelection");
});

app.get("*", (req, res) => {
  res.sendFile("/dist/index.html", { root: __dirname });
});

let server = app.listen(port, function () {
  let host = "helloworld";
  let thisport = server.address().port;
  console.log(`Example app on port ${port}!`);
});
