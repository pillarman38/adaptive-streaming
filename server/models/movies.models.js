let pool = require('../../config/connections')
let fs = require('fs')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
let chokidar = require('chokidar')
var showPlayer = false
var fetch = require('node-fetch')

var arrOfObj = []
var movieObj = {}
var newArr = []
var url = ''
var i = 0
var fileLocation = ''
var newSrc;

let routeFunctions = {
    getAllMovies: (callback) => {
        var prom = new Promise(function(resolve, reject) {
          fs.readdir("F:/Videos", (err, files) => {
          files.forEach(file => {
          
            url = file.replace('.mkv', '')

            movieObj = {
              title: url,
              movieListUrl: `https://api.themoviedb.org/3/search/movie?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${url.replace(new RegExp(' ', 'g'), '%20')}`,
              location: file
            }
            
            arrOfObj.push(movieObj)
              i++;
            })
            
            for(var l = 0; l < i; l++) {
              
              fetch(`${arrOfObj[l]['movieListUrl']}`).then((data) => {
                  return data.json()
              }).then((dataInJSON) => {
              
                // console.log(dataInJSON['results'][0]['titlesss'] = arrOfObj[l]['title'])
                
                newSrc = Object.assign(dataInJSON['results'][0], {
                  photoUrl: `https://image.tmdb.org/t/p/w500${dataInJSON['results'][0]['poster_path']}`
              })
                newArr.push(dataInJSON['results'][0])
                if(newArr.length == arrOfObj.length) {
                  console.log(newArr);
                  
                  resolve(newArr)
                }
              })
            }
          })
        })
        
        prom.then(resolve => {
          callback(resolve)
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
                  .save(`F:/tanscoding/${movieTitle['title'] + movieTitle['fileformat']}`)
                  
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