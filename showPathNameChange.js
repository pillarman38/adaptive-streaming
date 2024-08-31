const fs = require("fs");
const path = require("path");

function renameDirectories(dir) {
  fs.readdir(dir, { withFileTypes: true }, (err, files) => {
    if (err) {
      console.error(`Error reading directory ${dir}:`, err);
      return;
    }

    files.forEach((file) => {
      if (file.isDirectory()) {
        const oldPath = path.join(dir, file.name);
        const newPath = path.join(dir, file.name.replace(/Disk/g, "Disc"));
        console.log(`Renaming directory ${oldPath} to ${newPath}`);
        if (oldPath !== newPath) {
          fs.rename(oldPath, newPath, (err) => {
            if (err) {
              console.error(
                `Error renaming directory ${oldPath} to ${newPath}:`,
                err
              );
            } else {
              console.log(`Renamed directory ${oldPath} to ${newPath}`);
            }
          });
        }

        // Recursively check subdirectories
        renameDirectories(newPath);
      }
    });
  });
}

// Replace 'your-directory-path' with the path to the directory you want to check
const directoryPath = "J:/Shows";
renameDirectories(directoryPath);
