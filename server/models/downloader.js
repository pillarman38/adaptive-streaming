var fetch = require("node-fetch");
const { spawn, execSync } = require("child_process");
let fs = require("fs");
const urlTransformer = require("../utils/url-transformer");

class Downloader {
  async getCoverArt(notIncludedFileName, tmdbInfo, type) {
    const lowerCasedFileName = notIncludedFileName.toLowerCase();
    let totalBytes = 0;
    let downloadCount = 0;

    if (type === "tv") {
      const files = await fs.readdirSync(`/mnt/263A6E793A6E45C1/tvPosters`);
      if (!files.includes(notIncludedFileName + ".jpg") && tmdbInfo) {
        const coverArt = await fetch(
          `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tmdbInfo.poster_path}`
        );
        const fileStreamPosters = await fs.createWriteStream(
          `/mnt/263A6E793A6E45C1/tvPosters/${notIncludedFileName}.jpg`
        );

        let contentEncoding = coverArt.headers.get("content-encoding");
        let contentLength = coverArt.headers.get(
          contentEncoding ? "x-file-size" : "content-length"
        );

        // Add error handler to prevent unhandled error events
        fileStreamPosters.on("error", (error) => {
          console.error(`Error writing cover art file for ${notIncludedFileName}:`, error);
          fileStreamPosters.destroy();
        });

        return await new Promise(async (resolve, reject) => {
          coverArt.body.pipe(fileStreamPosters);
          coverArt.body.on("error", (error) => {
            console.error(`Error downloading cover art for ${notIncludedFileName}:`, error);
            fileStreamPosters.destroy();
            reject(error);
          });
          fileStreamPosters.on("error", (error) => {
            console.error(`Error writing cover art file for ${notIncludedFileName}:`, error);
            reject(error);
          });

          return await coverArt.body.on("data", (data) => {
            totalBytes += Buffer.byteLength(data);
            let downloadComplete = Math.floor(
              (100 * totalBytes) / contentLength
            );
            if (downloadComplete === 100) {
              return resolve(urlTransformer.transformUrl(`http://pixable.local:5012/tvCoverArt/${encodeURIComponent(notIncludedFileName)}.jpg`));
            }
          });
        });
      } else {
        return urlTransformer.transformUrl(`http://pixable.local:5012/tvCoverArt/${encodeURIComponent(notIncludedFileName)}.jpg`);
      }
    }

    if (type === "movie") {
      const files = await fs.readdirSync(`/mnt/F898C32498C2DFEC/MovieCoverArt`);
      if (
        !files.includes(notIncludedFileName + ".jpg") &&
        tmdbInfo.results[0]
      ) {
        const url = `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tmdbInfo.results[0].poster_path}`;
        const coverArt = await fetch(
          `https://image.tmdb.org/t/p/w600_and_h900_bestv2${tmdbInfo.results[0].poster_path}`
        );
        const fileStreamPosters = await fs.createWriteStream(
          `/mnt/F898C32498C2DFEC/MovieCoverArt/${notIncludedFileName}.jpg`
        );

        // Add error handler to prevent unhandled error events
        fileStreamPosters.on("error", (error) => {
          console.error(`Error writing movie cover art file for ${notIncludedFileName}:`, error);
          fileStreamPosters.destroy();
        });

        let contentEncoding = coverArt.headers.get("content-encoding");
        let contentLength = coverArt.headers.get(
          contentEncoding ? "x-file-size" : "content-length"
        );

        return await new Promise(async (resolve, reject) => {
          coverArt.body.pipe(fileStreamPosters);
          coverArt.body.on("error", (error) => {
            console.error(`Error downloading movie cover art for ${notIncludedFileName}:`, error);
            fileStreamPosters.destroy();
            reject(error);
          });
          fileStreamPosters.on("error", (error) => {
            console.error(`Error writing movie cover art file for ${notIncludedFileName}:`, error);
            reject(error);
          });

          return await coverArt.body.on("data", (data) => {
            totalBytes += Buffer.byteLength(data);
            let downloadComplete = Math.floor(
              (100 * totalBytes) / contentLength
            );
            if (downloadComplete === 100) {
              return resolve(urlTransformer.transformUrl(`http://pixable.local:5012/MovieCoverArt/${encodeURIComponent(notIncludedFileName)}.jpg`));
            }
          });
        });
      } else {
        return urlTransformer.transformUrl(`http://pixable.local:5012/MovieCoverArt/${encodeURIComponent(notIncludedFileName)}.jpg`);
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

      // Add error handler to prevent unhandled error events
      fileStreamPosters.on("error", (error) => {
        console.error(`Error writing episode poster file for ${show}-ep${epInfo.episode_number}-s${epInfo.season_number}:`, error);
        fileStreamPosters.destroy();
      });

      let contentEncoding = poster.headers.get("content-encoding");
      let contentLength = poster.headers.get(
        contentEncoding ? "x-file-size" : "content-length"
      );
      let totalBytes = 0;
      let downloadCount = 0;
      return await new Promise(async (resolve, reject) => {
        poster.body.pipe(fileStreamPosters);
        poster.body.on("error", (error) => {
          console.error(`Error downloading episode poster for ${show}-ep${epInfo.episode_number}-s${epInfo.season_number}:`, error);
          fileStreamPosters.destroy();
          reject(error);
        });
        fileStreamPosters.on("error", (error) => {
          console.error(`Error writing episode poster file for ${show}-ep${epInfo.episode_number}-s${epInfo.season_number}:`, error);
          reject(error);
        });

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
      return urlTransformer.transformUrl("http://pixable.local:5012/assets/four0four.gif");
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
          const existingTrailers = await fs.readdirSync("/mnt/F898C32498C2DFEC/Trailers/");
          // notIncluded is the disk title (from MKV TITLE tag or filename)
          // Use it as-is for the trailer filename to match the disk title
          const trailerFileName = `${notIncluded}.mp4`;
          if (!existingTrailers.includes(trailerFileName)) {
            const url = `https://www.youtube.com/watch?v=${resJson[0].key}`;
            // Download trailer with filename matching the disk title
             await execSync(
               `yt-dlp ${url} --remux-video mp4 -o "/mnt/F898C32498C2DFEC/Trailers/${trailerFileName}"`
             );
          }

          return urlTransformer.transformUrl(`http://pixable.local:5012/Trailers/${encodeURIComponent(notIncluded)}.mp4`);
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

  async getCard(notIncluded, fileName, data, type) {
    let posters;
    if (type === "movies") {
      try {
        posters = fs.readdirSync("/mnt/F898C32498C2DFEC/MovieCards");
      } catch (err) {
        console.error(`Error reading MovieCards directory:`, err);
        // If we can't read the directory, try to download the poster anyway
        posters = [];
      }
      let toCheck = notIncluded + ".jpg";
      if (!posters.includes(toCheck)) {
        let idGetter = undefined;
        var poster = "";
        try {
          idGetter = execSync(
            `mkvmerge -i "/mnt/F898C32498C2DFEC/Videos/${fileName}"`
          )
            .toString()
            .split("\n")
            .find((line) => line.includes("Attachment"))
            .split(" ")[2]
            .replace(":", "");

          let id = parseInt(idGetter);
          const command = `mkvextract "/mnt/F898C32498C2DFEC/Videos/${fileName}" attachments "${id}:/mnt/F898C32498C2DFEC/MovieCards/${notIncluded}.jpg"`;
          const extraction = await execSync(
            `mkvextract "/mnt/F898C32498C2DFEC/Videos/${fileName}" attachments "${id}:/mnt/F898C32498C2DFEC/MovieCards/${notIncluded}.jpg"`
          );
          return urlTransformer.transformUrl(`http://pixable.local:5012/MovieCards/${encodeURIComponent(notIncluded)}.jpg`);
        } catch (err) {
          try {
            if(data.results.length > 0 && data.results[0].backdrop_path) {
              var downloadUrl = `https://www.themoviedb.org/t/p/w533_and_h300_bestv2${data.results[0].backdrop_path}`;
              var downloadPosterFile = await fetch(downloadUrl);
              
              const posterPath = `/mnt/F898C32498C2DFEC/MovieCards/${notIncluded}.jpg`;
              let fileStreamPosters;
              
              try {
                fileStreamPosters = await fs.createWriteStream(posterPath);
              } catch (createError) {
                console.error(`Error creating WriteStream for ${notIncluded} at ${posterPath}:`, createError);
                throw createError;
              }
              
              // Add error handler to prevent unhandled error events
              fileStreamPosters.on("error", (error) => {
                console.error(`Error writing poster file for ${notIncluded}:`, error);
                fileStreamPosters.destroy();
              });
              
              await new Promise((resolve, reject) => {
                downloadPosterFile.body.pipe(fileStreamPosters);
                downloadPosterFile.body.on("error", (error) => {
                  console.error(`Error downloading poster for ${notIncluded}:`, error);
                  fileStreamPosters.destroy();
                  reject(error);
                });
                fileStreamPosters.on("error", (error) => {
                  console.error(`Error writing poster file for ${notIncluded}:`, error);
                  reject(error);
                });
                fileStreamPosters.on("finish", resolve);
              });

              return `http://pixable.local:5012/mnt/F898C32498C2DFEC/MovieCards/${encodeURIComponent(notIncluded)}.jpg`;
            }
          } catch (err) {
            console.error(`Failed to get poster for ${fileName}:`, err);
            return urlTransformer.transformUrl("http://pixable.local:5012/assets/four0four.gif");
          }
        }
      } else {
        // Poster already exists, return the path
        return urlTransformer.transformUrl(`http://pixable.local:5012/MovieCards/${encodeURIComponent(notIncluded)}.jpg`);
      }
    }

    if (type === "tv") {
      posters = fs.readdirSync("/mnt/263A6E793A6E45C1/tvPosters");
      let toCheck = +".jpg";
      if (!posters.includes(toCheck)) {
        let idGetter = undefined;
        var poster = "";
        try {
          idGetter = await execSync(
            `mkvmerge -i "/mnt/F898C32498C2DFEC/Videos/${fileName}"`
          )
            .toString()
            .split("\n")
            .find((line) => line.includes("Attachment"))
            .split(" ")[2]
            .replace(":", "");

          let id = parseInt(idGetter);
          const command = `mkvextract "/mnt/F898C32498C2DFEC/Videos/${fileName}" attachments "${id}:/mnt/263A6E793A6E45C1/tvPosters/${notIncluded}.jpg"`;
          const extraction = await execSync(
            `mkvextract "/mnt/F898C32498C2DFEC/Videos/${fileName}" attachments "${id}:/mnt/263A6E793A6E45C1/tvPosters/${notIncluded}.jpg"`
          );
          return urlTransformer.transformUrl(`/tvPosters/${encodeURIComponent(notIncluded)}.jpg`);
        } catch (err) {
          try {
            var downloadUrl = `https://www.themoviedb.org/t/p/original${data.results[0].backdrop_path}`;
            var downloadPosterFile = await fetch(downloadUrl);
            const fileStreamPosters = await fs.createWriteStream(
              `/mnt/263A6E793A6E45C1/tvPosters/${notIncluded}.jpg`
            );
            
            // Add error handler to prevent unhandled error events
            fileStreamPosters.on("error", (error) => {
              console.error(`Error writing TV poster file for ${notIncluded}:`, error);
              fileStreamPosters.destroy();
            });
            
            await new Promise((resolve, reject) => {
              downloadPosterFile.body.pipe(fileStreamPosters);
              downloadPosterFile.body.on("error", (error) => {
                console.error(`Error downloading TV poster for ${notIncluded}:`, error);
                fileStreamPosters.destroy();
                reject(error);
              });
              fileStreamPosters.on("error", (error) => {
                console.error(`Error writing TV poster file for ${notIncluded}:`, error);
                reject(error);
              });
              fileStreamPosters.on("finish", resolve);
            });

            return urlTransformer.transformUrl(`http://pixable.local:5012/tvPosters/${encodeURIComponent(notIncluded)}.jpg`);
          } catch (err) {
            console.error(`Failed to get TV poster for ${notIncluded}:`, err);
            return urlTransformer.transformUrl("http://pixable.local:5012/assets/four0four.gif");
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
        const posters = fs.readdirSync("/mnt/F898C32498C2DFEC/BackgroundImages/");
        if (!posters.includes(`${notIncluded}.jpg`)) {
          if (imageJSON.backdrops) {
            if (imageJSON.backdrops.length > 0) {
              var downloadUrl = `https://www.themoviedb.org/t/p/original${imageJSON.backdrops[0].file_path}`;
              var downloadPosterFile = await fetch(downloadUrl);
              const fileStreamPosters = await fs.createWriteStream(
                `/mnt/F898C32498C2DFEC/BackgroundImages/${notIncluded}.jpg`
              );
              
              // Add error handler to prevent unhandled error events
              fileStreamPosters.on("error", (error) => {
                console.error(`Error writing background image file for ${notIncluded}:`, error);
                fileStreamPosters.destroy();
              });
              
              await new Promise((resolve, reject) => {
                downloadPosterFile.body.pipe(fileStreamPosters);
                downloadPosterFile.body.on("error", (error) => {
                  console.error(`Error downloading background image for ${notIncluded}:`, error);
                  fileStreamPosters.destroy();
                  reject(error);
                });
                fileStreamPosters.on("error", (error) => {
                  console.error(`Error writing background image file for ${notIncluded}:`, error);
                  reject(error);
                });
                fileStreamPosters.on("finish", resolve);
              });
              return urlTransformer.transformUrl(`http://pixable.local:5012/BackgroundImages/${encodeURIComponent(notIncluded)}.jpg`);
            } else {
              return urlTransformer.transformUrl("http://pixable.local:5012/assets/four0four.gif");
            }
          } else {
            return urlTransformer.transformUrl("http://pixable.local:5012/assets/four0four.gif");
          }
        } else {
          return urlTransformer.transformUrl(`http://pixable.local:5012/BackgroundImages/${encodeURIComponent(notIncluded)}.jpg`);
        }
      } else {
        return urlTransformer.transformUrl("http://pixable.local:5012/assets/four0four.gif");
      }
    } catch (err) {
      console.log(err);
      return urlTransformer.transformUrl("http://pixable.local:5012/assets/four0four.gif");
    }
  }

  async getSubtitleVtt(notIncluded, data, access, metaData) {
    const alreadyStoredVtt = fs.readdirSync("/mnt/F898C32498C2DFEC/subtitles");
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
              "python3",
              ["/home/connorwoodford/Desktop/Projects/adaptive-streaming/server/models/pgs_to_vtt_simple.py", notIncluded, firstSubtitle.index]
            );

            pythonProcess.stdout.on("data", (data) => {
              result += data.toString();
            });

            let progressBar = {
              total: 0,
              current: 0,
              stage: "starting"
            };

            const updateProgressBar = () => {
              const width = 40;
              let percentage = 0;
              let bar = "";
              
              if (progressBar.total > 0) {
                percentage = Math.min(100, Math.round((progressBar.current / progressBar.total) * 100));
                const filled = Math.round((width * percentage) / 100);
                const empty = width - filled;
                bar = "█".repeat(filled) + "░".repeat(empty);
              } else {
                // Indeterminate progress - show animated bar
                const animChars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
                const animIndex = Math.floor(Date.now() / 200) % animChars.length;
                bar = animChars[animIndex].repeat(width);
                percentage = 0;
              }
              
              const stageNames = {
                "starting": "Starting",
                "collecting": "Collecting subtitles",
                "ripping": "Ripping subtitles",
                "converting": "Converting to VTT",
                "complete": "Complete"
              };
              
              const stageName = stageNames[progressBar.stage] || progressBar.stage;
              const countText = progressBar.total > 0 
                ? `${progressBar.current}/${progressBar.total}`
                : "processing...";
              process.stdout.write(
                `\r[Subtitle: ${notIncluded}] ${stageName} [${bar}] ${percentage}% (${countText})`
              );
            };

            pythonProcess.stderr.on("data", (data) => {
              // Output progress messages in real-time
              const message = data.toString().trim();
              if (message) {
                // Parse progress updates (format: PROGRESS:key:value or PROGRESS:key:value:key2:value2)
                if (message.startsWith("PROGRESS:")) {
                  const content = message.substring(9);
                  const parts = content.split(":");
                  
                  for (let i = 0; i < parts.length; i += 2) {
                    const key = parts[i];
                    const value = parts[i + 1];
                    
                    if (key === "total") {
                      progressBar.total = parseInt(value) || 0;
                    } else if (key === "current") {
                      progressBar.current = parseInt(value) || 0;
                    } else if (key === "stage") {
                      progressBar.stage = value;
                    } else if (key === "complete") {
                      progressBar.current = progressBar.total;
                      progressBar.stage = "complete";
                    } else if (key === "heartbeat") {
                      // Heartbeat message - just update the display to show it's still working
                      // Don't change stage, just refresh the progress bar
                      updateProgressBar();
                    }
                  }
                  updateProgressBar();
                } else {
                  // Regular message - show on new line
                  process.stdout.write(`\n[Subtitle: ${notIncluded}] ${message}\n`);
                  // Redraw progress bar
                  if (progressBar.total > 0) {
                    updateProgressBar();
                  }
                }
              }
            });

            pythonProcess.on("close", (code) => {
              // Clear progress bar and move to new line
              if (progressBar.total > 0) {
                process.stdout.write(`\n`);
              }
              
              if (code !== 0) {
                reject(`Python process exited with code ${code}`);
              } else {
                // Write the VTT content to file
                const vttPath = `/mnt/F898C32498C2DFEC/subtitles/${notIncluded}.vtt`;
                try {
                  fs.writeFileSync(vttPath, result, "utf8");
                  console.log(`[Subtitle: ${notIncluded}] VTT file written to: ${vttPath}`);
                } catch (err) {
                  console.error(`Error writing VTT file: ${err}`);
                }
                resolve(result);
              }
            });
          });
        }

        return urlTransformer.transformUrl(`http://pixable.local:5012/subtitles/${encodeURIComponent(notIncluded)}.vtt`);
      } catch (error) {
        console.error("Error executing the process:", error);
        return null;
      }
    } else {
      return urlTransformer.transformUrl(`http://pixable.local:5012/subtitles/${notIncluded.replaceAll(
        " ",
        "%20"
      )}.vtt`);
    }
  }
}

module.exports = Downloader;
