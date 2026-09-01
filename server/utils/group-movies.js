const urlTransformer = require("./url-transformer");

function prepareMovieRecord(movie) {
  urlTransformer.prepareRecordForResponse(movie);
  if (movie.posterUrl) {
    movie.posterUrl = urlTransformer.encodeUrlPath(movie.posterUrl);
  }
  if (movie.coverArt) {
    movie.coverArt = urlTransformer.encodeUrlPath(movie.coverArt);
  }
  if (movie.movieCard) {
    movie.movieCard = urlTransformer.encodeUrlPath(movie.movieCard);
  }
  if (movie.trailerUrl) {
    movie.trailerUrl = urlTransformer.encodeUrlPath(movie.trailerUrl);
  }
  if (movie.srtUrl) {
    movie.srtUrl = urlTransformer.encodeUrlPath(movie.srtUrl);
  }
  if (movie.location && urlTransformer.isServerServedPath(movie.location)) {
    movie.location = urlTransformer.encodeUrlPath(movie.location);
  }
  return movie;
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/disc\s*\d+/i, "")
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .replace(/\s*3d\s*$/i, "")
    .replace(/\s*extended\s*(edition|cut|version)?\s*$/i, "")
    .replace(/\s*director'?s\s*cut\s*$/i, "")
    .replace(/\s*unrated\s*$/i, "")
    .replace(/\s*theatrical\s*$/i, "")
    .trim();
}

function groupMovieRows(rows) {
  const groups = {};

  for (const row of rows) {
    const key = normalizeTitle(row.title);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  }

  const movies = [];
  const defaultPosterUrl = urlTransformer.toPublicUrl("/assets/four0four.gif");

  for (const key in groups) {
    const groupItems = groups[key];

    const findFirstValid = (fieldName, defaultValue = null) => {
      for (const item of groupItems) {
        if (
          item[fieldName] &&
          item[fieldName] !== defaultPosterUrl &&
          String(item[fieldName]).trim() !== ""
        ) {
          return item[fieldName];
        }
      }
      return defaultValue;
    };

    movies.push({
      title: groupItems[0].title,
      id: groupItems[0].id,
      created_at: latestCreatedAt(groupItems),
      versions: groupItems,
      posterUrl: findFirstValid("posterUrl", defaultPosterUrl),
      movieCard: findFirstValid("movieCard", defaultPosterUrl),
      backdropPhotoUrl: findFirstValid("backdropPhotoUrl", defaultPosterUrl),
      coverArt: findFirstValid("coverArt", defaultPosterUrl),
      trailer: findFirstValid("trailer", null) || findFirstValid("trailerUrl", null),
      cast: findFirstValid("cast", null),
      overview: findFirstValid("overview", null),
      duration: findFirstValid("duration", null),
      resolution: findFirstValid("resolution", null),
      channels: findFirstValid("channels", null),
      audio: findFirstValid("audio", null),
      subtitles: findFirstValid("subtitles", null),
      subtitleSelect: findFirstValid("subtitleSelect", null),
      seekTime: findFirstValid("seekTime", null),
      tmdbId: findFirstValid("tmdbId", null),
      srtLocation: findFirstValid("srtLocation", null),
      location: findFirstValid("location", null),
      trailerUrl: findFirstValid("trailerUrl", null),
      srtUrl: findFirstValid("srtUrl", null),
      bonusFeatures: findFirstValid("bonusFeatures", null),
      vbr: findFirstValid("vbr", null),
      transmuxToPixie: findFirstValid("transmuxToPixie", null),
      threeD: findFirstValid("threeD", null),
      dolbyVision: findFirstValid("dolbyVision", null),
      originalLang: findFirstValid("originalLang", null),
      filePath: findFirstValid("filePath", null),
      fileName: findFirstValid("fileName", null),
      fileformat: findFirstValid("fileformat", null),
    });
  }

  return movies;
}

function latestCreatedAt(items) {
  let latest = null;
  let latestTime = 0;
  for (const item of items || []) {
    if (!item || !item.created_at) {
      continue;
    }
    const time = new Date(item.created_at).getTime();
    if (!Number.isNaN(time) && time >= latestTime) {
      latestTime = time;
      latest = item.created_at;
    }
  }
  return latest;
}

function getLatestAddedTime(movie) {
  const versions =
    movie && movie.versions && movie.versions.length
      ? movie.versions
      : movie
        ? [movie]
        : [];
  let max = 0;
  for (const version of versions) {
    if (!version || !version.created_at) {
      continue;
    }
    const time = new Date(version.created_at).getTime();
    if (!Number.isNaN(time) && time > max) {
      max = time;
    }
  }
  if (max === 0 && movie && movie.id) {
    return Number(movie.id) || 0;
  }
  return max;
}

function sortGroupedMovies(movies, sort) {
  if (sort !== "added" || !Array.isArray(movies)) {
    return movies;
  }
  return movies.slice().sort((a, b) => {
    const timeDiff = getLatestAddedTime(b) - getLatestAddedTime(a);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    const idDiff = Number(b.id || 0) - Number(a.id || 0);
    if (idDiff !== 0) {
      return idDiff;
    }
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

module.exports = {
  prepareMovieRecord,
  groupMovieRows,
  sortGroupedMovies,
};
