const fetch = require("node-fetch");

async function getEpmetadata(epFile) {
  await new Promise((resolve) => {
    ffmpeg.ffprobe(`${epFile}`, function (err, metaData) {
      if (err) {
        console.log(err);
      }
      language = metaData["streams"][0]["tags"]["language"];
      resolution = `${metaData.streams[0].coded_width}x${metaData.streams[0].coded_height}`;
      audioArr = metaData.streams.filter((data) => {
        if (data.codec_type === "audio") {
          {
            return data;
          }
        }
      });
      resolve();
    });
  });
}

async function showInfoGrabber() {
  let showInfo = await fetch(
    `https://api.themoviedb.org/3/search/tv?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${show}`
  );
  showInfo = await showInfo.json();

  if (showInfo.results.length > 0) {
    let cast = await fetch(
      `https://api.themoviedb.org/3/tv/${showInfo.results[0].id}/credits?api_key=490cd30bbbd167dd3eb65511a8bf2328&language=en-US&append_to_response=episode_groups`
    );
    castinfo = await cast.json();
    castinfo = castinfo.cast.map((castmember) => {
      return {
        name: castmember.name,
        picture: `https://image.tmdb.org/t/p/original/${castmember.profile_path}`,
      };
    });
  }

  const downloader = new Downloader();
  const tvPoster = await downloader.getPoster(showsToAdd[i], showInfo, "tv");
  const tvCoverArt = await downloader.getCoverArt(
    showsToAdd[i],
    showInfo.results[0],
    "tv"
  );

  const numOfEpsInSeason = files.filter((filePath) => {
    const filesParsed = filePath.split("\\");
    let seasonNumGrab = parseInt(filesParsed[3].split(" ")[1]);
    if (seasonNumGrab !== l) {
      return false;
    } else {
      return true;
    }
  });

  const seasonsList = [];
  for (let l = 1; l <= numberOfSeasons; l++) {
    let seasonReq = await fetch(
      `https://api.themoviedb.org/3/tv/${showId}/season/${l}?api_key=490cd30bbbd167dd3eb65511a8bf2328`
    );
    seasonResp = await seasonReq.json();
    seasonsList.push(seasonResp);
  }
  for (let l = 1; l <= numOfEpsInSeason; l++) {}
}

module.exports = { showInfoGrabber };
