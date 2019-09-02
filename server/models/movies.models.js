let pool = require('../../config/connections')
let fs = require('fs')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
let chokidar = require('chokidar')

let routeFunctions = {
    getAllMovies: (callback) => {
        pool.query('SELECT * FROM movies', (err, results)=>{
            callback(err,results)
        })
    },

    getTranscodedMovie: (callback) => {
      pool.query('SELECT * FROM moviesplaying', (err, results)=>{
          callback(err,results)
      })
  },
    
    startconvertingMovie: (movieTitle, callback)=>{
        var thing = false
        pool.query('SELECT * FROM `moviesplaying` WHERE `title` = ?', movieTitle, (err, res)=>{
            console.log("hiiiiiiiiiiiiiiiiiiiiiiiiiiiii", movieTitle)
            movieTitle['location'] = 'http://192.168.1.19:4012/transcoding/' + movieTitle['title'].replace(new RegExp(' ', 'g'), '%20') + '.webm'
           
            if(err) {
              pool.query('INSERT INTO `moviesplaying` SET ?',movieTitle, (err, resultstwo) =>{
                movieTitle['location'] = 'F:/Videos/' + movieTitle['title'] + '.mkv'
                console.log(err, resultstwo)
                if (movieTitle['browser'] == "Safari") {
                  ffmpeg(movieTitle['location'])
                  .videoCodec('libx264')
                  .size('1920x1080')
                  .on('error', function(err) {
                    console.log('An error occurred: ' + err.message);
                  })
                  .on('end', function() {
                    console.log('Processing finished !');
                  })
                  .save(`F:/Videos/transcoding/${movieTitle['title'] + movieTitle['fileformat']}`);

                  callback("its here")
                  
                  return console.log("This video already exisits in the database")
                  }
              })
                }
                //ffmpeg -i "Alita- Battle Angel-FPL_MainFeature_t99.mkv" -b:v 1M -g 60 -hls_list_size 0 output.m3u8  
        })
    }
}

module.exports = routeFunctions