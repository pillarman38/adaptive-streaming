const fs = require("fs");
const { spawn, execSync } = require("child_process");
let pool = require("../../config/connections");
const ffmpeg = require("fluent-ffmpeg");
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
ffmpeg.setFfprobePath(ffprobePath);

class BonusFeatures {
  async getBonusFeatures(movie) {
    try {
      const featuresForMovie = await fs.readdirSync(
        `I:/bonusFeatures/${movie}`
      );
      if (featuresForMovie.length > 0) {
        var i = 0;

        async function recursivePromiseFunction(featuresForMovie, movie) {
          try {
            return await new Promise(async (resolve, reject) => {
              ffmpeg.ffprobe(
                `I:/bonusFeatures/${movie}/${featuresForMovie[i]}`,
                async function (err, metaData) {
                  const id = execSync(
                    `I:/MKVToolNix/mkvmerge -i "I:/bonusFeatures/${movie}/${featuresForMovie[i]}"`
                  )
                    .toString()
                    .split("\n")
                    .find((line) => line.includes("Attachment"))
                    .split(" ")[2]
                    .replace(":", "");

                  await execSync(
                    `I:/MKVToolNix/mkvextract "I:/bonusFeatures/${movie}/${
                      featuresForMovie[i]
                    }" attachments "${id}:I:/bonusFeatures/thumbnails/${featuresForMovie[
                      i
                    ].replace("mkv", "")}.jpg"`
                  );

                  const bfObj = {
                    title: movie,
                    resolution: `${metaData.streams[0].coded_width}x${metaData.streams[0].coded_height}`,
                    seekTime: 0,
                    location: `http://192.168.0.154:4012/plexTemp/${featuresForMovie[
                      i
                    ]
                      .replace(new RegExp(" ", "g"), "%20")
                      .replace(new RegExp("'", "g"), "")}`,
                    filePath: `I:/bonusFeatures/${movie}/${featuresForMovie[i]}`,
                    featureTitle: featuresForMovie[i],
                    posterUrl: `http://192.168.0.154:4012/bonusFeatures/thumbnails/${featuresForMovie[
                      i
                    ]
                      .replace(new RegExp(" ", "g"), "%20")
                      .replace(new RegExp("'", "g"), "")}`,
                  };

                  pool.query(
                    `INSERT INTO bonusfeatures SET ?`,
                    bfObj,
                    async (e, r) => {
                      if (i + 1 !== featuresForMovie.length) {
                        i += 1;
                        await recursivePromiseFunction(featuresForMovie, movie);
                        resolve();
                      } else {
                        resolve();
                      }
                    }
                  );
                }
              );
            });
          } catch (err) {
            console.log(err);
          }
        }

        const result = await recursivePromiseFunction(featuresForMovie, movie);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      return false;
    }
  }

  grabBonusFeatures(movie, callback) {
    pool.query(
      `SELECT * FROM bonusfeatures WHERE title = '${movie.title}'`,
      (err, res) => {
        if (err) {
          console.log(err);
        }
        // res.title = res.featureTitle
        // delete res.featureTitle
        callback(res);
      }
    );
  }
}
module.exports = BonusFeatures;
