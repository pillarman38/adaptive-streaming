let pool = require('../../config/connections')
let fs = require('fs')
const ffmpeg = require('fluent-ffmpeg');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const rimraf = require('rimraf');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
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
var killProcess = false
var ffstream = ffmpeg()

function runThis(movieObj, url) {
  var met;
  var promTwo = new Promise((resolve, reject) => {
    ffmpeg.ffprobe(`F:/Videos/${movieObj['title']}`, function(err, metaData) {
    met = metaData
    if(metaData) {
      resolve(metaData)
      }
    })
  }) 
  promTwo.then(resolve => {
    fetch(`${movieObj['movieListUrl']}`).then((data) => {
        return data.json()
        }).then((moreData) => {
      if(moreData['results']) {
        
        delete moreData['results'][0]['genre_ids']; 
        delete moreData['results'][0]['video']; 
        moreData['results'].length = 1
        moreData['results'][0]['fileName'] = url
        moreData['results'][0]['duration'] = met['format']['duration']
        moreData['results'][0]['photoUrl'] = `https://image.tmdb.org/t/p/w500${moreData['results'][0]['poster_path']}`
        moreData['results'][0]['backdropPhotoUrl'] = `https://image.tmdb.org/t/p/w500${moreData['results'][0]['backdrop_path']}`
        moreData['results'][0]['location'] = `http://192.168.1.19:4012/${url.replace(new RegExp(' ', 'g'), '%20')}.mkv`
        moreData['results'][0]['filePath'] = `F:/Videos/${url}.mkv`
        // moreData['results'][0]['ffprobeStuff'] = met
        moreData['results'][0]['channels'] = met['streams'][1]['channels']
        moreData['results'][0]['resolution'] = `${met['streams'][0]['coded_width']}x${met['streams'][0]['coded_height']}`
        return arrOfObj.push(moreData['results'])
      }
    })
  })
}

let routeFunctions = {
    getAllMovies: (callback) => {
      setTimeout(function() {
      ffstream.on('error', function() {
        console.log('Ffmpeg has been killed');
      });

      ffstream.kill();
    }, 1000);
      fs.readdir("F:/Videos/", (err, files) => {
        var prom = new Promise((resolve, reject) => {
          for(var k = 0; k < files.length; k++) {
            
            url = files[k].replace('.mkv', '')
            movieObj = {
              title: files[k],
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
            if(err) {
              pool.query('INSERT INTO `moviesplaying` SET ?',movieTitle, (err, resultstwo) =>{
                
                console.log(err, resultstwo)
                killProcess = false
                startConverting(movieTitle, killProcess, callback)
               
              })  
            }
          //ffmpeg -i "Alita- Battle Angel-FPL_MainFeature_t99.mkv" -b:v 1M -g 60 -hls_list_size 0 output.m3u8  
        })
    }
}



function startConverting(movieTitle, killProcess, callback) {
  
  if (movieTitle['browser'] == "Safari") {
    console.log("Hello there", movieTitle['location'])
    ffstream = ffmpeg(movieTitle['filePath'])
    .videoCodec('copy')
    // size
    .audioCodec('aac')

    .audioChannels(6)
    // start_number
    .addOption('-start_number', 0)
    // set hls segments time
    .addOption('-hls_time', 10)
    // include all the segments in the list
    .addOption('-hls_list_size', 0)
    // format -f
    .format('hls')
    // setup event handlers
    .on('start', function(cmd) {
       console.log('Started ' + cmd);
    })

    .save(`F:/transcoding/${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), ''))
    if(process == true) {
      ffstream.kill()
    }
    var watcher = fs.watch("F:/transcoding/", (event, filename) => {
      console.log(filename)
      if(filename == `${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), '')){
        watcher.close()
        console.log("its here")
        var movieReturner = {
          browser: movieTitle['browser'],
          duration: movieTitle['duration'],
          fileformat: movieTitle['fileformat'],
          location: 'http://192.168.1.19:4012/transcoding/' + movieTitle['fileName'].replace(new RegExp(' ', 'g'), '') + '.m3u8',
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
    ffstream = ffmpeg(movieTitle['filePath'])
    .videoCodec('copy')
    // size
    .audioCodec('aac')

    .audioChannels(6)
    // start_number
    .addOption('-start_number', 0)
    // set hls segments time
    .addOption('-hls_time', 10)
    // include all the segments in the list
    .addOption('-hls_list_size', 0)
    // format -f
    .format('hls')
    // setup event handlers
    .on('start', function(cmd) {
    console.log('Started ' + cmd);
  })

  .save(`F:/transcoding/${movieTitle['fileName']}.m3u8`)
  if(process == true) {
    ffstream.kill()
  }
  var watcher = fs.watch("F:/transcoding/", (event, filename) => {
  console.log(filename)
  if(filename == `${movieTitle['fileName']}.m3u8`){
    watcher.close()
    console.log("its here")
    var movieReturner = {
      browser: movieTitle['browser'],
      duration: movieTitle['duration'],
      fileformat: movieTitle['fileformat'],
      location: 'http://192.168.1.19:4012/transcoding/' + movieTitle['fileName'].replace(new RegExp(' ', 'g'), '%20') + '.m3u8',
      title: movieTitle['title']
    }

      callback(movieReturner)
  
    
    return
  }
  });

  return console.log("This video already exisits in the database")
  }
}
module.exports = routeFunctions