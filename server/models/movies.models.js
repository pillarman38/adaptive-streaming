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
        moreData['results'][0]['location'] = `F:/Videos/${url}.mkv`
        moreData['results'][0]['filePath'] = `http://192.168.1.19:4012/transcoding/${url.replace(new RegExp(' ', 'g'), '%20')}.m3u8`
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
            console.log(arrOfObj);
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
            
           
            if(err) {
              pool.query('INSERT INTO `moviesplaying` SET ?',movieTitle, (err, resultstwo) =>{
                
                console.log(err, resultstwo)
               
                if (movieTitle['browser'] == "Safari") {
                  console.log("Hello there", movieTitle['location'])
                  var ffstream = ffmpeg(movieTitle['location'])
                  .videoCodec('libx264')
                  .audioCodec('aac')

                  .on('error', function(err) {
                    console.log('An error occurred: ' + err.message);
                  })
                  .on('end', function() {
                    console.log('Processing finished !');
                  })
                  .on('stderr', function(stderrLine) {
                    // console.log('Stderr output: ' + stderrLine);
                  })
                  .save(`F:/transcoding/${movieTitle['title'] + movieTitle['fileformat']}`)
                  
                  var watcher = fs.watch("F:/Videos/", (event, filename) => {
                    console.log(filename)
                    if(filename == `${movieTitle['title']}.m3u8`){
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
                  var ffstream = ffmpeg(movieTitle['location'])
                  .videoCodec('libx264')
                  .audioCodec('aac')
                  
                  .on('error', function(err) {
                    console.log('An error occurred: ' + err.message);
                  })
                  .on('end', function() {
                    console.log('Processing finished !');
                  })
                  .on('stderr', function(stderrLine) {
                    // console.log('Stderr output: ' + stderrLine);
                  })
                  .save(`F:/transcoding/${movieTitle['title'] + movieTitle['fileformat']}`)
                  
                  var watcher = fs.watch("F:/Videos/", (event, filename) => {
                    console.log(filename)
                    if(filename == `${movieTitle['title']}.m3u8`){
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