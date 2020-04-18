let pool = require('../../config/connections')
let fs = require('fs')
const ffmpeg = require('fluent-ffmpeg');
let codecGetter = require('./codec-determine')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const rimraf = require('rimraf');
const path = require('path');
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

var arr = []
var killProcess = false
var ffstream = ffmpeg()

let routeFunctions = {
    getAllMovies: (callback) => {
      
      setTimeout(function() {
        ffstream.on('error', function() {
          console.log('Ffmpeg has been killed');
        });
  
      }, 1000);
     arrOfObj = []
      fs.readdir("D:/Videos/", (err, files) => {
        console.log(files.length)

        var arr = []
       
        var prom = new Promise((resolve, reject) => {
          pool.query('SELEC * FROM ')
          
          files.forEach(function getMovieInfo(file) {

          var url = file.replace('.mkv', '')
          var firstObj = {
            url: file.replace('.mkv', ''),
            title: file.replace('.mkv', ''),
            movieListUrl: `https://api.themoviedb.org/3/search/movie?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${url.replace(new RegExp(' ', 'g'), '%20')}`,
          }
 
          ffmpeg.ffprobe(`D:/Videos/${firstObj['url']}.mkv`, function(err, metaData) {
          fetch(`${firstObj['movieListUrl']}`).then((data) => {
            return data.json()
          }).then((data)=>{
            if(metaData) {
          //         moreData['results'][0]['duration'] = returnedMetaData['format']['duration']
          //         moreData['results'][0]['photoUrl'] = `https://image.tmdb.org/t/p/w500${moreData['results'][0]['poster_path']}`
          //         moreData['results'][0]['backdropPhotoUrl'] = `https://image.tmdb.org/t/p/w500${moreData['results'][0]['backdrop_path']}`
          //         moreData['results'][0]['location'] = `http://192.168.1.86:4012/${returnedMetaData['title'].replace(new RegExp(' ', 'g'), '%20')}.mkv`
          //         moreData['results'][0]['filePath'] = `D:/Videos/${returnedMetaData['title']}.mkv`
          //         moreData['results'][0]['resolution'] = `${returnedMetaData['streams'][0]['coded_width']}x${returnedMetaData['streams'][0]['coded_height']}`
          //         moreData['results'][0]['channels'] = returnedMetaData['streams'][1]['channels']
          //         moreData['results'][0]['videoFormat'] = returnedMetaData['streams'][0]['codec_name']
          //         moreData['results'][0]['seekTime'] = 0 
          //         if(returnedMetaData['streams'][0]['pix_fmt'] == "yuv420p10le") {
          //           moreData['results'][0]['hdrEnabled'] = true,
          //           moreData['results'][0]['color_range'] = returnedMetaData['streams'][0]['color_range'],
          //           moreData['results'][0]['color_space'] = returnedMetaData['streams'][0]['color_space'],
          //           moreData['results'][0]['color_transfer'] = returnedMetaData['streams'][0]['color_transfer']
          //           } else {
          //             moreData['results'][0]['hdrEnabled'] = false,
          //             moreData['results'][0]['color_range'] = 'undefined'
          //             moreData['results'][0]['color_space'] = 'undefined'
          //             moreData['results'][0]['color_transfer'] = 'undefined'
          //           }

              var metaDataObj = {
                title: data['results'][0]['original_title'],
                location: `http://192.168.1.86:4012/${metaData['format']['tags']['title'].replace(new RegExp(' ', 'g'), '%20')}.mkv`,
                photoUrl: `https://image.tmdb.org/t/p/w500${data['results'][0]['poster_path']}`,
                backdropPhotoUrl: `https://image.tmdb.org/t/p/w500${data['results'][0]['backdrop_path']}`,
                overview: data['results'][0]['overview'],
                duration: metaData['format']['duration'],
                location: `http://192.168.1.86:4012/${metaData['format']['tags']['title'].replace(new RegExp(' ', 'g'), '%20')}.mkv`,
                resolution: `${metaData['streams'][0]['coded_width']}x${metaData['streams'][0]['coded_height']}`,
                channels: metaData['streams'][1]['channels'],
                fileformat: metaData['streams'][0]['codec_name']
              }

              if(metaData['streams'][0]['pix_fmt'] == "yuv420p10le") {
                    metaDataObj['hrdEnabled'] = true,
                    metaDataObj['color_range'] = metaData['streams'][0]['color_range'],
                    metaDataObj['color_space'] = metaData['streams'][0]['color_space'],
                    metaDataObj['color_transfer'] = metaData['streams'][0]['color_transfer']
                  } else {
                    metaDataObj['hrdEnabled'] = false,
                    metaDataObj['color_range'] = 'undefined'
                    metaDataObj['color_space'] = 'undefined'
                    metaDataObj['color_transfer'] = 'undefined'
                          }
              arrOfObj.push(metaDataObj)
              if(arrOfObj.length == files.length){
                callback(arrOfObj)
              }            
            }          
          })
        })          
      })
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
            
            
            if(err) {
              pool.query('INSERT INTO `moviesplaying` SET ?',movieTitle, (err, resultstwo) =>{
                
    
                killProcess = false
                startConverting(movieTitle, killProcess, callback)
               
              })  
            }
        })
    }
}

function startConverting(movieTitle, killProcess, callback) {

  var getRes = codecGetter.getVideoResoluion(movieTitle)
  var getFormat = codecGetter.getVideoFormat(movieTitle)
  console.log("Here is movie title", movieTitle)

  var h = Math.floor(movieTitle['seekTime'] / 3600);
      var m = Math.floor(movieTitle['seekTime'] % 3600 / 60);
      var s = Math.floor(movieTitle['seekTime'] % 3600 % 60);
  if (movieTitle['browser'] == "Safari") {
    if(movieTitle['screenRes'] == '1920x1080' && movieTitle['hdrEnabled'] == false) {
      ffstream = ffmpeg(movieTitle['filePath'])
      .videoCodec('libx264')
      .size(movieTitle['screenRes'])
      .audioCodec('aac')
      // .addOption('-color_primaries', '9')
      .addOption('-crf', '18')
      .seekInput(`${h}:${m}:${s}`)
      .audioChannels(6)
      // start_number
      .addOption('-start_number', 0)
  
      // set hls segments time
      .addOption('-hls_time', 5)
  
      .addOption("-force_key_frames", "expr:gte(t,n_forced*5)")
      // include all the segments in the list
      .addOption('-hls_list_size', 0)
      // format -f
  
      .format('hls')
      // setup event handlers
      .on('start', function(cmd) {
         console.log('Started ' + cmd);
      })
  
      .save(`D:/plexTemp/${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), ''))
    }
    if(movieTitle['screenRes'] == '1920x1080' && movieTitle['hdrEnabled'] == true) {
      ffstream = ffmpeg(movieTitle['filePath'])
    .videoCodec('libx265')
    .size('3840x2160')
    .audioCodec('aac')
    .addOption('-pix_fmt', 'yuv420p10')
    .addOption("-x265-params", "colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc")
    // .addOption('-color_primaries', '9')
    .addOption('-crf', '18')
    .seekInput(`${h}:${m}:${s}`)
    .audioChannels(6)
    // start_number
    .addOption('-start_number', 0)

    // set hls segments time
    .addOption('-hls_time', 5)

    .addOption("-force_key_frames", "expr:gte(t,n_forced*5)")
    // include all the segments in the list
    .addOption('-hls_list_size', 0)
    // format -f

    .format('hls')
    // setup event handlers
    .on('start', function(cmd) {
       console.log('Started ' + cmd);
    })

    .save(`D:/plexTemp/${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), ''))
    }
    if(movieTitle['screenRes'] == '3840x2160' && movieTitle['hdrEnabled'] == true) {
      ffstream = ffmpeg(movieTitle['filePath'])
    .videoCodec('libx265')
    .size(movieTitle['screenRes'])
    .audioCodec('aac')
    .addOption('-pix_fmt', 'yuv420p10')
    .addOption("-x265-params", "colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc")

    .addOption('-crf', '18')
    .seekInput(`${h}:${m}:${s}`)
    .audioChannels(6)
    // start_number
    .addOption('-start_number', 0)
    // set hls segments time
    .addOption('-hls_time', 5)

    .addOption("-force_key_frames", "expr:gte(t,n_forced*5)")
    // include all the segments in the list
    .addOption('-hls_list_size', 0)
    // format -f

    .format('hls')
    // setup event handlers
    .on('start', function(cmd) {
       console.log('Started ' + cmd);
    })

    .save(`D:/plexTemp/${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), ''))
    }
    
    if(process == true) {
      ffstream.kill()
    }
    
    var watcher = fs.watch("D:/plexTemp/", (event, filename) => {
     
      if(filename == `${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), '')){
        watcher.close()

        var movieReturner = {
          browser: movieTitle['browser'],
          duration: movieTitle['duration'],
          fileformat: movieTitle['fileformat'],
          location: 'http://192.168.1.86:4012/plexTemp/' + movieTitle['fileName'].replace(new RegExp(' ', 'g'), '') + '.m3u8',
          title: movieTitle['title']
        }
        callback(movieReturner)
        return
      }
  });
return console.log("This video already exisits in the database")
}

if(movieTitle['browser'] == "Chrome") {
  
//   ffstream.kill()
    
//     if(movieTitle['seekTime'] != 0){
//       fs.readdir("D:/plexTemp/", (err, files) => {
//     if (err) throw err;
  
//     for (var i = 0; i < files.length; i++) {
//       fs.unlink(path.join("D:/plexTemp/", files[i]), err => {
//         console.log("hiiiii", files)
//         if (err) throw err;
//       });
//     }
//   });
// }
 
      var h = Math.floor(movieTitle['seekTime'] / 3600);
      var m = Math.floor(movieTitle['seekTime'] % 3600 / 60);
      var s = Math.floor(movieTitle['seekTime'] % 3600 % 60);
      ffstream.kill()
    ffstream = ffmpeg(movieTitle['filePath'])

    .videoCodec('libx264')
    .size(movieTitle['screenRes'])
    .audioCodec('aac')
    .addOption('-crf', '18')
    .seekInput(`${h}:${m}:${s}`)
    .audioChannels(6)
    // start_number
    .addOption('-start_number', 0)

    // set hls segments time
    .addOption('-hls_time', 5)

    .addOption("-force_key_frames", "expr:gte(t,n_forced*5)")
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

  })
  .on('error', function(err) {
    // console.log('An error occurred: ' + err.message);
  })
  .on('stderr', function(stderrLine) {
    console.log('An stderror occurred: ' + stderrLine);
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
      location: 'http://192.168.1.86:4012/plexTemp/' + movieTitle['fileName'].replace(new RegExp(' ', 'g'), '%20') + '.m3u8',
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