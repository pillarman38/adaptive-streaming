let pool = require('../../config/connections')
let fs = require('fs')
const ffmpeg = require('fluent-ffmpeg');
let codecGetter = require('./codec-determine')
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



let routeFunctions = {
    getAllMovies: (callback) => {
      setTimeout(function() {
        ffstream.on('error', function() {
          console.log('Ffmpeg has been killed');
        });
  
        ffstream.kill();
      }, 1000);
     arrOfObj = []
      fs.readdir("D:/Videos/", (err, files) => {
        async function foo() {
          for(var k = 0; k < files.length; k++) {
    
            
              var firstObj = new Promise((resolve, reject) => {
                url = files[k].replace('.mkv', ''),
                movieObj = {
                url: files[k],
                title: files[k].replace('.mkv', ''),
                movieListUrl: `https://api.themoviedb.org/3/search/movie?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${url.replace(new RegExp(' ', 'g'), '%20')}`,
              }
                
                ffmpeg.ffprobe(`D:/Videos/${movieObj['url']}`, function(err, metaData) {

              if(metaData) {
                var metaDataoObj = {
                  title: movieObj['title'],
                  location: movieObj['url'],
                  format: metaData['format'],
                  streams: metaData['streams']
                }
                // console.log(metaDataoObj);
                
                resolve(metaDataoObj)
                // console.log(metaDataoObj['streams'][0]['codec_name']);
                
                return metaDataoObj
                } 
                if(!metaData) {
                  console.log(err);
                }
              })
            }).then((returnedMetaData) => {
              // console.log(returnedMetaData);
              
              
              fetch(`${movieObj['movieListUrl']}`).then((data) => {
                
                return data.json()
                }).then((moreData) => {

              if(moreData['results']) {
                  
                  moreData['results'][0]['fileName'] = returnedMetaData['format']['tags']['title'].replace(/[~"#%&*:<>?]/g, '')
                  moreData['results'][0]['duration'] = returnedMetaData['format']['duration']
                  moreData['results'][0]['photoUrl'] = `https://image.tmdb.org/t/p/w500${moreData['results'][0]['poster_path']}`
                  moreData['results'][0]['backdropPhotoUrl'] = `https://image.tmdb.org/t/p/w500${moreData['results'][0]['backdrop_path']}`
                  moreData['results'][0]['location'] = `http://192.168.1.19:4012/${returnedMetaData['title'].replace(new RegExp(' ', 'g'), '%20')}.mkv`
                  moreData['results'][0]['filePath'] = `D:/Videos/${returnedMetaData['title']}.mkv`
                  moreData['results'][0]['resolution'] = `${returnedMetaData['streams'][0]['coded_width']}x${returnedMetaData['streams'][0]['coded_height']}`
                  moreData['results'][0]['channels'] = returnedMetaData['streams'][1]['channels']
                  moreData['results'][0]['videoFormat'] = returnedMetaData['streams'][0]['codec_name']

                  arrOfObj.push(moreData['results'][0])
                  return arrOfObj
                }

              }).then((res) => {
               
                console.log(arrOfObj.length, k);
                
              if(k == arrOfObj.length) {

                callback(res)
                
                
                return arrOfObj
            }
          })
            })
              var results = await firstObj;
            }   
          }
          foo()
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
  console.log("yooooooooooooooooooooooooooooo", movieTitle);
  
  var getRes = codecGetter.getVideoResoluion(movieTitle)
  var getFormat = codecGetter.getVideoFormat(movieTitle)
  console.log("gotFormat", codecGetter.getVideoFormat(movieTitle), codecGetter.getVideoResoluion(movieTitle));
  
  if (movieTitle['browser'] == "Safari") {
    console.log("Hello there", movieTitle['location'])
    ffstream = ffmpeg(movieTitle['filePath'])
    .videoCodec(getFormat)
    // size
    .audioCodec('aac')

    .audioChannels(6)
    // start_number
    .addOption('-start_number', 0)
    // set hls segments time
    .addOption('-hls_time', 5)
    // include all the segments in the list
    .addOption('-hls_list_size', 0)
    // format -f
    .format('hls')
    // setup event handlers
    .on('start', function(cmd) {
       console.log('Started ' + cmd);
    })

    .save(`D:/plexTemp/${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), ''))
    if(process == true) {
      ffstream.kill()
    }
    var watcher = fs.watch("D:/plexTemp/", (event, filename) => {
      console.log(filename)
      if(filename == `${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), '')){
        watcher.close()
        console.log("its here")
        var movieReturner = {
          browser: movieTitle['browser'],
          duration: movieTitle['duration'],
          fileformat: movieTitle['fileformat'],
          location: 'http://192.168.1.19:4012/plexTemp/' + movieTitle['fileName'].replace(new RegExp(' ', 'g'), '') + '.m3u8',
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
    .videoCodec(getFormat)
    // size
    .audioCodec('aac')

    .audioChannels(6)
    // start_number
    .addOption('-start_number', 0)
    // set hls segments time
    .addOption('-hls_time', 2)
    // include all the segments in the list
    .addOption('-hls_list_size', 0)
    // format -f
    .format('hls')
    // setup event handlers
    .on('start', function(cmd) {
    console.log('Started ' + cmd);
  })
  .on('start', function(commandLine) {
    console.log('Spawned Ffmpeg with command: ' + commandLine);
  })
  .on('progress', function(progress) {
    console.log('Processing: ' + progress.percent + '% done');
  })
  .on('error', function(err) {
    console.log('An error occurred: ' + err.message);
  })
  .on('stderr', function(stderrLine) {
    console.log('Stderr output: ' + stderrLine);
  })
  .save(`D:/plexTemp/${movieTitle['fileName']}.m3u8`)

 

  if(process == true) {
    ffstream.kill()
  }
  var watcher = fs.watch("D:/plexTemp/", (event, filename) => {
  console.log(filename)
  if(filename == `${movieTitle['fileName']}.m3u8`){
    watcher.close()
    console.log("its here")
    var movieReturner = {
      browser: movieTitle['browser'],
      duration: movieTitle['duration'],
      fileformat: movieTitle['fileformat'],
      location: 'http://192.168.1.19:4012/plexTemp/' + movieTitle['fileName'].replace(new RegExp(' ', 'g'), '%20') + '.m3u8',
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