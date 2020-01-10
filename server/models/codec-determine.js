let returnVideoInfo = {
   getVideoResoluion: (movieInfo) => {
    if(movieInfo['resolution'] == "3840x2160") {
        return "3840x2160"
    } 
    if(movieInfo['resolution'] == "1920x1080") {
        return "1920x1080"
    } 
},
    getVideoFormat: (movieInfo) => {
    console.log(movieInfo['videoFormat']);

    switch(movieInfo['videoFormat']) {
        case "vc1":
            return "libx264";
        case "h264":
            return "libx264";
        case "hevc":
            return "libx264"
        
    }
 }
}

module.exports = returnVideoInfo