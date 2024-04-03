let returnVideoInfo = {
  getVideoResoluion: (movieInfo) => {
    if (movieInfo["resolution"] == "3840x2160") {
      return "3840x2160";
    }
    if (movieInfo["resolution"] == "1920x1080") {
      return "1920x1080";
    }
  },
  getVideoFormat: (movieInfo) => {
    if (movieInfo["browser"] == "Safari") {
      switch (movieInfo["videoFormat"]) {
        case "vc1":
          return "libx264";
        case "h264":
          return "libx264";
        case "hevc":
          return "libx265";
      }
    }
    if (movieInfo["browser"] == "Chrome") {
      switch (movieInfo["videoFormat"]) {
        case "vc1":
          return "libx264";
        case "h264":
          return "libx264";
        case "hevc":
          return "libx265";
      }
    }
  },
};

module.exports = returnVideoInfo;
