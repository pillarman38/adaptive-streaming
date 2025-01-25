const fs = require("fs");
const path = require("path");

// Define the directory you want to list the files of
const directoryPath = "I:/Videos";

// Function to list all files in a directory
fs.readdir(directoryPath, (err, files) => {
  if (err) {
    return console.error("Unable to scan directory: " + err);
  }
  // Loop through and log all files
  files.forEach((file) => {
    console.log(file);
  });
});
