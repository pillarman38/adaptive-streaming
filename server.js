require("./config/config");
require("./server/models/pixie");
const express = require("express");
const app = express();
const port = 5012;
let cors = require("cors");
let bparser = require("body-parser");

app.use(bparser.urlencoded({ extended: true }));
app.use(bparser.json());
app.use(express.static("/media/connorwoodford/F898C32498C2DFEC"));
app.use(express.static(__dirname + "/dist"));
// Serve server-config.json from repo root
app.use(express.static(__dirname));
// app.use(express.static("F:/"));
// app.use(express.static("D:/"));
// app.use(express.static("I:/"));
// app.use(express.static("J:/"));

app.use(cors());

let userRoutes = require("./server/routes/movies.routes");

app.use("/api/mov", userRoutes);

app.get("*", (req, res) => {
  res.sendFile("/dist/index.html", { root: __dirname });
});

let server = app.listen(port, function () {
  let host = "helloworld";
  let thisport = server.address().port;
  console.log(`Example app on port ${port}!`);
});
