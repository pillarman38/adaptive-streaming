var fetch = require("node-fetch");
const { spawn, execSync } = require("child_process");
let fs = require("fs");

class Downloader {
  async getCoverArt(notIncludedFileName, tmdbInfo, type) {
    const lowerCasedFileName = notIncludedFileName.toLowerCase();
    let totalBytes = 0;
    let downloadCount = 0;

    if (type === "tv") {
      const files = await fs.readdirSync(`J:/tvCoverArt`);
      if (!files.includes(notIncludedFileName + ".jpg") && tmdbInfo) {
        const coverArt = await fetch(
          `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tmdbInfo.poster_path}`
        );
        const fileStreamPosters = await fs.createWriteStream(
          `J:/tvCoverArt/${notIncludedFileName}.jpg`
        );

        let contentEncoding = coverArt.headers.get("content-encoding");
        let contentLength = coverArt.headers.get(
          contentEncoding ? "x-file-size" : "content-length"
        );

        return await new Promise(async (resolve, reject) => {
          coverArt.body.pipe(fileStreamPosters);
          coverArt.body.on("error", reject);

          return await coverArt.body.on("data", (data) => {
            totalBytes += Buffer.byteLength(data);
            let downloadComplete = Math.floor(
              (100 * totalBytes) / contentLength
            );
            if (downloadComplete === 100) {
              return resolve(`/tvCoverArt/${notIncludedFileName}.jpg`);
            }
          });
        });
      } else {
        return `/tvCoverArt/${notIncludedFileName}.jpg`;
      }
    }

    if (type === "movie") {
      const files = await fs.readdirSync(`I:/MovieCoverArt`);
      if (
        !files.includes(notIncludedFileName + ".jpg") &&
        tmdbInfo.results[0]
      ) {
        const url = `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tmdbInfo.results[0].poster_path}`;
        const coverArt = await fetch(
          `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tmdbInfo.results[0].poster_path}`
        );
        const fileStreamPosters = await fs.createWriteStream(
          `I:/MovieCoverArt/${notIncludedFileName}.jpg`
        );

        let contentEncoding = coverArt.headers.get("content-encoding");
        let contentLength = coverArt.headers.get(
          contentEncoding ? "x-file-size" : "content-length"
        );

        return await new Promise(async (resolve, reject) => {
          coverArt.body.pipe(fileStreamPosters);
          coverArt.body.on("error", reject);

          return await coverArt.body.on("data", (data) => {
            totalBytes += Buffer.byteLength(data);
            let downloadComplete = Math.floor(
              (100 * totalBytes) / contentLength
            );
            if (downloadComplete === 100) {
              return resolve(`/MovieCoverArt/${notIncludedFileName}.jpg`);
            }
          });
        });
      } else {
        return `/MovieCoverArt/${notIncludedFileName}.jpg`;
      }
    }
  }

  async getEPCoverArt(epInfo, show) {
    if (epInfo && epInfo.still_path) {
      const poster = await fetch(
        `https://image.tmdb.org/t/p/w533_and_h300_bestv2${epInfo.still_path}`
      );
      const fileStreamPosters = await fs.createWriteStream(
        `J:/epPosters/${show}-ep${epInfo.episode_number}-s${epInfo.season_number}.jpg`
      );

      let contentEncoding = poster.headers.get("content-encoding");
      let contentLength = poster.headers.get(
        contentEncoding ? "x-file-size" : "content-length"
      );
      let totalBytes = 0;
      let downloadCount = 0;
      return await new Promise(async (resolve, reject) => {
        poster.body.pipe(fileStreamPosters);
        poster.body.on("error", reject);

        return await poster.body.on("data", (data) => {
          totalBytes += Buffer.byteLength(data);
          let downloadComplete = Math.floor((100 * totalBytes) / contentLength);
          if (downloadComplete === 100) {
            return resolve(
              `/epPosters/${show}-ep${epInfo.episode_number}-s${epInfo.season_number}.jpg`
            );
          }
        });
      });
    } else {
      return "/assets/four0four.gif";
    }
  }

  // async getSeasonArt(path, show, seasonNum) {
  //   if(path) {

  //     const poster = await fetch(path)
  //     const posterJSON = await poster.json()

  //     let hdPosters = []

  //     if(posterJSON.posters) {
  //       hdPosters = posterJSON.posters.filter(poster => poster.width >= 1920 && poster.height >= 1080)
  //       const firstPosterUrl = await fetch(`https://image.tmdb.org/t/p/original${hdPosters[0].file_path}`)
  //       const fileStreamPosters = await fs.createWriteStream(`J:/seasonArt/${show}-season-${seasonNum}.jpg`);

  //       let contentEncoding = firstPosterUrl.headers.get('content-encoding')
  //       let contentLength = firstPosterUrl.headers.get(contentEncoding ? 'x-file-size' : 'content-length')
  //       let totalBytes = 0
  //       let downloadCount = 0

  //       return await new Promise(async(resolve, reject) => {
  //         firstPosterUrl.body.pipe(fileStreamPosters);
  //         firstPosterUrl.body.on("error", reject);

  //         return await firstPosterUrl.body.on('data', (data) => {
  //           totalBytes += Buffer.byteLength(data)
  //           let downloadComplete = Math.floor((100 * totalBytes) / contentLength)
  //           console.log('downloading', downloadComplete);
  //           if(downloadComplete === 100) {
  //             return resolve(`/seasonArt/${show}-season-${seasonNum}.jpg`.replace(new RegExp(' ', 'g'), '%20'))
  //           }
  //         })
  //       })
  //     } else {
  //       return '/assets/four0four.gif'
  //     }
  //   } else {
  //     return '/assets/four0four.gif'
  //   }
  // }

  async getTrailer(notIncluded, data) {
    try {
      let newTitles = data.results.filter(async (titles) => {
        if (titles.original_title === notIncluded) {
          return titles;
        }
      });
      if (newTitles.length > 0) {
        var results = await fetch(
          `https://api.themoviedb.org/3/movie/${newTitles[0].id}/videos?api_key=490cd30bbbd167dd3eb65511a8bf2328&language=en-US`
        );
        var resJson = await results.json();
        resJson = resJson.results.filter(async (video) => {
          if (
            video.type === "Trailer" ||
            (video.type === "Teaser" &&
              video.site === "YouTube" &&
              video.name.includes(notIncluded) &&
              video.official === true)
          ) {
            return video;
          }
        });

        if (resJson.length > 0) {
          const existingTrailers = await fs.readdirSync("I:/Trailers/");
          if (!existingTrailers.includes(`${notIncluded}.mp4`)) {
            const url = `https://www.youtube.com/watch?v=${resJson[0].key}`;
            await execSync(
              `I:/Trailers/yt-dlp.exe ${url} --remux-video mp4 -o "I:/Trailers/${notIncluded}.mp4"`
            );
          }

          return `http://192.168.1.6:5012/Trailers/${notIncluded}.mp4`.replace(
            / /g,
            "%20"
          );
        } else {
          return "";
        }
      }
      return "";
    } catch (err) {
      console.log(err);
      return "";
    }
  }

  async getCastList(notIncluded, data) {
    let getCastList;
    if (data.results.length > 0) {
      getCastList = await fetch(
        `https://api.themoviedb.org/3/movie/${data.results[0].id}/credits?api_key=490cd30bbbd167dd3eb65511a8bf2328`
      );
    } else {
      getCastList = {};
    }
    let parseCastList;
    let castList = [];
    if (Object.keys(getCastList).length > 0) {
      parseCastList = await getCastList.json();
      if (parseCastList.cast) {
        for (var i = 0; i < parseCastList.cast.length; i++) {
          var castMemberInfo = await fetch(
            `https://api.themoviedb.org/3/person/${parseCastList.cast[i].id}/images?api_key=490cd30bbbd167dd3eb65511a8bf2328`
          );
          var castMemberInfoJSON = await castMemberInfo.json();

          if (castMemberInfoJSON.profiles.length > 0) {
            castList.push({
              character: parseCastList.cast[i].character,
              name: parseCastList.cast[i].name,
              picture: `https://image.tmdb.org/t/p/original${castMemberInfoJSON.profiles[0].file_path}`,
            });
          } else {
            castList.push({
              character: parseCastList.cast[i].character,
              name: parseCastList.cast[i].name,
              picture: `/assets/images/noProfilePicture.JPG`,
            });
          }
        }
      } else {
        parseCastList = "";
      }
    } else {
      parseCastList = "";
    }
    return JSON.stringify(castList);
  }

  async getPoster(notIncluded, data, type) {
    let posters;
    if (type === "movies") {
      posters = fs.readdirSync("F:/MoviePosters");
      let toCheck = +".jpg";
      if (!posters.includes(toCheck)) {
        let idGetter = undefined;
        var poster = "";
        try {
          idGetter = execSync(
            `F:/MKVToolNix/mkvmerge -i "I:/Videos/${notIncluded}.mkv"`
          )
            .toString()
            .split("\n")
            .find((line) => line.includes("Attachment"))
            .split(" ")[2]
            .replace(":", "");

          let id = parseInt(idGetter);
          const command = `F:/MKVToolNix/mkvextract "I:/Videos/${notIncluded}.mkv" attachments "${id}:F:/MoviePosters/${notIncluded}.jpg"`;
          const extraction = await execSync(
            `F:/MKVToolNix/mkvextract "I:/Videos/${notIncluded}.mkv" attachments "${id}:F:/MoviePosters/${notIncluded}.jpg"`
          );
          return `/MoviePosters/${notIncluded.replace(
            new RegExp(" ", "g"),
            "%20"
          )}.jpg`;
        } catch (err) {
          try {
            var downloadUrl = `https://www.themoviedb.org/t/p/w533_and_h300_bestv2${data.results[0].backdrop_path}`;
            var downloadPosterFile = await fetch(downloadUrl);
            const fileStreamPosters = await fs.createWriteStream(
              `F:/MoviePosters/${notIncluded}.jpg`
            );
            new Promise((resolve, reject) => {
              downloadPosterFile.body.pipe(fileStreamPosters);
              downloadPosterFile.body.on("error", reject);
              fileStreamPosters.on("finish", resolve);
            });

            return `/MoviePosters/${notIncluded.replace(
              new RegExp(" ", "g"),
              "%20"
            )}.jpg`;
          } catch (err) {
            return "/assets/four0four.gif";
          }
        }
      }
    }

    if (type === "tv") {
      posters = fs.readdirSync("J:/tvPosters");
      let toCheck = +".jpg";
      if (!posters.includes(toCheck)) {
        let idGetter = undefined;
        var poster = "";
        try {
          idGetter = await execSync(
            `F:/MKVToolNix/mkvmerge -i "I:/Videos/${notIncluded}.mkv"`
          )
            .toString()
            .split("\n")
            .find((line) => line.includes("Attachment"))
            .split(" ")[2]
            .replace(":", "");

          let id = parseInt(idGetter);
          const command = `F:/MKVToolNix/mkvextract "I:/Videos/${notIncluded}.mkv" attachments "${id}:J:/tvPosters/${notIncluded}.jpg"`;
          const extraction = await execSync(
            `F:/MKVToolNix/mkvextract "I:/Videos/${notIncluded}.mkv" attachments "${id}:J:/tvPosters/${notIncluded}.jpg"`
          );
          return `/tvPosters/${notIncluded.replace(
            new RegExp(" ", "g"),
            "%20"
          )}.jpg`;
        } catch (err) {
          try {
            var downloadUrl = `https://www.themoviedb.org/t/p/original${data.results[0].backdrop_path}`;
            var downloadPosterFile = await fetch(downloadUrl);
            const fileStreamPosters = await fs.createWriteStream(
              `J:/tvPosters/${notIncluded}.jpg`
            );
            await new Promise((resolve, reject) => {
              downloadPosterFile.body.pipe(fileStreamPosters);
              downloadPosterFile.body.on("error", reject);
              fileStreamPosters.on("finish", resolve);
            });

            return `/tvPosters/${notIncluded.replace(
              new RegExp(" ", "g"),
              "%20"
            )}.jpg`;
          } catch (err) {
            return "/assets/four0four.gif";
          }
        }
      }
    }
  }

  async getBackgroundPoster(notIncluded, data, type) {
    try {
      if (data.results.length > 0) {
        const image = await fetch(
          `https://api.themoviedb.org/3/${type}/${data.results[0].id}/images?api_key=490cd30bbbd167dd3eb65511a8bf2328`
        );
        const imageJSON = await image.json();
        const posters = fs.readdirSync("F:/BackgroundImages/");
        if (!posters.includes(`${notIncluded}.jpg`)) {
          if (imageJSON.backdrops) {
            if (imageJSON.backdrops.length > 0) {
              var downloadUrl = `https://www.themoviedb.org/t/p/original${imageJSON.backdrops[0].file_path}`;
              var downloadPosterFile = await fetch(downloadUrl);
              const fileStreamPosters = await fs.createWriteStream(
                `F:/BackgroundImages/${notIncluded}.jpg`
              );
              new Promise((resolve, reject) => {
                downloadPosterFile.body.pipe(fileStreamPosters);
                downloadPosterFile.body.on("error", reject);
                fileStreamPosters.on("finish", resolve);
              });
              return `/BackgroundImages/${notIncluded.replace(
                new RegExp(" ", "g"),
                "%20"
              )}.jpg`;
            } else {
              return "";
            }
          } else {
            return "";
          }
        } else {
          return `/BackgroundImages/${notIncluded.replace(
            new RegExp(" ", "g"),
            "%20"
          )}.jpg`;
        }
      } else {
        return "";
      }
    } catch (err) {
      console.log(err);
      return "";
    }
  }

  async getSubtitleVtt(notIncluded, data, access, metaData) {
    const alreadyStoredVtt = fs.readdirSync("I:/subtitles");
    if (!alreadyStoredVtt.includes(`${notIncluded}.vtt`)) {
      const subtitlesFilter = metaData.streams.filter((stream, index) => {
        if (
          stream.codec_type === "subtitle" &&
          stream.tags.language === "eng"
        ) {
          return { ...stream, index: index };
        }
      });

      const firstSubtitle = subtitlesFilter[0];
      try {
        let result = "";
        if (firstSubtitle) {
          result = await new Promise((resolve, reject) => {
            console.log(
              "getting subtitles for ",
              notIncluded,
              " at index ",
              firstSubtitle.index
            );
            const pythonProcess = spawn(
              "C:/Users/Connor/Desktop/projects/adaptive-streaming/server/models/pgsripper.exe",
              [notIncluded, firstSubtitle.index]
            );

            pythonProcess.stdout.on("data", (data) => {
              result += data.toString();
            });

            pythonProcess.stderr.on("data", (data) => {
              console.error(`stderr: ${data}`);
            });

            pythonProcess.on("close", (code) => {
              if (code !== 0) {
                reject(`Python process exited with code ${code}`);
              } else {
                resolve(result);
              }
            });
          });
        }

        return `http://192.168.1.6:5012/subtitles/${notIncluded.replaceAll(
          " ",
          "%20"
        )}.vtt`;
      } catch (error) {
        console.error("Error executing the process:", error);
        return null;
      }
    } else {
      return `http://192.168.1.6:5012/subtitles/${notIncluded.replaceAll(
        " ",
        "%20"
      )}.vtt`;
    }
  }
}

module.exports = Downloader;
