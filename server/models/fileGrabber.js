const fs = require("fs");
const path = require("path");
// const files = [];

const getFilesRecursively = (directory, files) => {
  const filesInDirectory = fs.readdirSync(directory);
  for (const file of filesInDirectory) {
    const absolute = path.join(directory, file);
    if (fs.statSync(absolute).isDirectory()) {
      getFilesRecursively(absolute, files);
    } else {
      files.push(absolute.replace(/\\/g, "/"));
    }
  }
};

const getShowsList = () => {
  const shows = fs.readdirSync("J:/Shows");
  return shows;
};

module.exports = { getFilesRecursively, getShowsList };
