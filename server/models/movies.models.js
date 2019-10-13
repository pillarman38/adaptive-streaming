let pool = require('../../config/connections')
let fs = require('fs')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
let chokidar = require('chokidar')
var showPlayer = false
var fetch = require('node-fetch')


var arrOfObj = []

var newArr = []
var url = ''
var i = 0
var fileLocation = ''
var newSrc;
var movieObj = {}
var arr = []

function runThis(movieObj, url) {
  fetch(`${movieObj['movieListUrl']}`).then((data) => {
        return data.json()
        }).then((moreData) => {
      if(moreData['results']) {
        moreData['results'].length = 1
        moreData['results'][0]['fileName'] = url
        moreData['results'][0]['photoUrl'] = `https://image.tmdb.org/t/p/w500${moreData['results'][0]['poster_path']}`
        moreData['results'][0]['location'] = `http://192.168.1.19:4012/${url.replace(new RegExp(' ', 'g'), '%20')}.mkv`
        moreData['results'][0]['filePath'] = `F:/Videos/${url}.mkv`
        return arrOfObj.push(moreData['results'])
      }
  })
}

let routeFunctions = {
    getAllMovies: (callback) => {
      
      fs.readdir("F:/Videos/", (err, files) => {
        var prom = new Promise((resolve, reject) => {
          for(var k = 0; k < files.length; k++) {
            url = files[k].replace('.mkv', '')
            movieObj = {
              title: url,
              movieListUrl: `https://api.themoviedb.org/3/search/movie?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${url.replace(new RegExp(' ', 'g'), '%20')}`,
            }
            runThis(movieObj, url)
            if(arr.length == k) {
            resolve(arrOfObj)
          }
        }
      })
    
          prom.then(resolve => {
            var array = [].concat.apply([], arrOfObj)
          callback(array)
        }) 
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
            movieTitle['location'] = `http://192.168.1.19:4012/${movieTitle['fileName'].replace(new RegExp(' ', 'g'), '%20')}.m3u8`
            if(err) {
              pool.query('INSERT INTO `moviesplaying` SET ?',movieTitle, (err, resultstwo) =>{
                
                console.log(err, resultstwo)
               
                if (movieTitle['browser'] == "Safari") {
                  console.log("Hello there", movieTitle['location'])
                  var ffstream = ffmpeg(movieTitle['filePath'])
                  // set target codec
                  .videoCodec('libx264')
                  // set audio bitrate
             
                  // set audio codec
                  .audioCodec('aac')
                  // set number of audio channels
           
                  // set hls segments time
                  .addOption('-hls_time', 10)
                  // include all the segments in the list
                  .addOption('-hls_list_size',0)
                  // setup event handlers
                  .save(`F:/transcoding/${movieTitle['title'] + movieTitle['fileformat']}`)
                  
                  var watcher = fs.watch("F:/transcoding/", (event, filename) => {
                    console.log(filename)
                    if(filename == `${movieTitle['fileName']}.m3u8`){
                      watcher.close()
                      console.log("its here")
                      var movieReturner = {
                        browser: movieTitle['browser'],
                        duration: movieTitle['duration'],
                        fileformat: movieTitle['fileformat'],
                        location: 'http://192.168.1.19:4012/transcoding/' + movieTitle['title'].replace(new RegExp(' ', 'g'), '%20') + '.m3u8',
                        title: movieTitle['title']
                      }
                      callback(movieReturner)
                      return
                    }
                });
              return console.log("This video already exisits in the database")
            }
                  if(movieTitle['browser'] == "Chrome") {
                    console.log("Hello there", movieTitle['location'])
                  var ffstream = ffmpeg(movieTitle['filePath'])

                  // set target codec
                  .videoCodec('libx264')
                  // set audio bitrate
             
                  // set audio codec
                  .audioCodec('aac')
                  // set number of audio channels
           
                  // set hls segments time
                  .addOption('-hls_time', 10)
                  // include all the segments in the list
                  .addOption('-hls_list_size',0)
                  // setup event handlers
                  .on('end', function() {
                    console.log('file has been converted succesfully');
                  })
                  .on('error', function(err) {
                    console.log('an error happened: ' + err.message);
                  })
                  .save(`F:/transcoding/${movieTitle['fileName']}.m3u8`)
                  var watcher = fs.watch("F:/transcoding/", (event, filename) => {
                    console.log(filename)
                    if(filename == `${movieTitle['fileName']}.m3u8`){
                      watcher.close()
                      console.log("its here")
                      var movieReturner = {
                        browser: movieTitle['browser'],
                        duration: movieTitle['duration'],
                        fileformat: movieTitle['fileformat'],
                        location: 'http://192.168.1.19:4012/transcoding/' + movieTitle['title'].replace(new RegExp(' ', 'g'), '%20') + '.m3u8',
                        title: movieTitle['title']
                      }
                      setTimeout(() => {
                        callback(movieReturner)
                      },5000)
                      
                      return
                    }
                });
                
                  return console.log("This video already exisits in the database")
                  }
              })  
            }
          //ffmpeg -i "Alita- Battle Angel-FPL_MainFeature_t99.mkv" -b:v 1M -g 60 -hls_list_size 0 output.m3u8  
        })
    }
}

module.exports = routeFunctions