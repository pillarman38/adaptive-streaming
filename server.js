require("./config/config");
require("./server/models/pixie");
const express = require("express");
const app = express()
const port = 5012;
let cors = require("cors");
let bparser = require("body-parser");

app.use(bparser.urlencoded({ extended: true }));
app.use(bparser.json());
app.use(express.static("/mnt/F898C32498C2DFEC"));
app.use(express.static(__dirname + "/dist"));
// Serve server-config.json from repo root
app.use(express.static(__dirname));
// app.use(express.static("F:/"));
// app.use(express.static("D:/"));
// app.use(express.static("I:/"));
// app.use(express.static("J:/"));

app.use(cors());

// #region agent log - track all incoming requests
app.use((req, res, next) => {
  if (req.path.includes('scanLibrary')) {
    fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:20',message:'Incoming request to scanLibrary',data:{method:req.method,path:req.path,url:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
  }
  next();
});
// #endregion

let userRoutes = require("./server/routes/movies.routes");

// #region agent log
fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server.js:25',message:'Registering /api/mov route',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
// #endregion
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
