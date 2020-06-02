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

const cp = require("child_process");
const { spawn } = require('child_process')

var arrOfObj = []
var exec = require('child_process').exec;
var newArr = []
var url = ''
var i = 0
var fileLocation = ''
var newSrc;

var arr = []
var killProcess = false
var ffstream = ffmpeg()
var exec = require('child_process').exec
let routeFunctions = {

    getAllMovies: (pid, callback) => {
      if(pid['pid'] == 0) {
        console.log("nothing to kill")
      }
      if(pid['pid'] != 0) {
        var pidInt = parseInt(pid['pid'])
        process.kill(pid['pid'])
      }

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
            // console.log(metaData['streams'][0]['tags'], metaData['format'])
          fetch(`${firstObj['movieListUrl']}`).then((data) => {
            return data.json()
          }).then((data)=>{
          // console.log(data['results'][0])
            if(metaData) {
              var metaDataObj = {
                title: file.replace('.mkv', ''),
                filePath: metaData['format']['filename'],
                location: `http://192.168.1.86:4012/${metaData['format']['tags']['title'].replace(new RegExp(' ', 'g'), '%20')}.mkv`,
                // photoUrl: `https://image.tmdb.org/t/p/w500${data['results'][0]['poster_path']}`,
                // backdropPhotoUrl: `https://image.tmdb.org/t/p/w500${data['results'][0]['backdrop_path']}`,
                overview: data['results'][0]['overview'],
                duration: metaData['format']['duration'],
                location: `http://192.168.1.86:4012/${metaData['format']['tags']['title'].replace(new RegExp(' ', 'g'), '%20')}.mkv`,
                resolution: `${metaData['streams'][0]['coded_width']}x${metaData['streams'][0]['coded_height']}`,
                channels: metaData['streams'][1]['channels'],
                fileformat: metaData['streams'][0]['codec_name'],
                // originalLang: data['results'][0]['original_language'],
                pixFmt: metaData['streams'][0]['pix_fmt'],
                color_range: metaData['streams'][0]['color_range'],
                color_space: metaData['streams'][0]['color_space'],
                color_transfer: metaData['streams'][0]['color_transfer'],
                seekTime: 0,
                fileName: file.replace('.mkv', '')
              }
              if(data['results'][0]['backdrop_path'] == null) {
                metaDataObj['backdropPhotoUrl'] = 'http://192.168.1.86:4012/assets/images/four0four.gif'
              } else {
                metaDataObj['backdropPhotoUrl'] = `https://image.tmdb.org/t/p/w500${data['results'][0]['backdrop_path']}`
              }

              if(data['results'][0]['poster_path'] == null) {
                metaDataObj['photoUrl'] = 'http://192.168.1.86:4012/assets/images/placeholder.jpg'
              } else {
                metaDataObj['photoUrl'] = `https://image.tmdb.org/t/p/w500${data['results'][0]['poster_path']}`
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

    
    startconvertingMovie: (movieTitle, callback)=>{
        var thing = false
 
                killProcess = false
                startConverting(movieTitle, killProcess, callback)
               
             
    }
}

function startConverting(movieTitle, killProcess, callback) {
  var getRes = codecGetter.getVideoResoluion(movieTitle)
  var getFormat = codecGetter.getVideoFormat(movieTitle)
  console.log("Here is movie title", movieTitle)

  var h = Math.floor(movieTitle['seekTime'] / 3600);
  var m = Math.floor(movieTitle['seekTime'] % 3600 / 60);
  var s = Math.floor(movieTitle['seekTime'] % 3600 % 60);
  ffstream.kill()
  
  if (movieTitle['browser'] == "Safari") {
    if(movieTitle['resolution'] == '1920x1080' && movieTitle['pixFmt'] == "yuv420p") {
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
      .on('start', function(commandLine) {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('progress', function(progress) {
        
      })
      .on('error', function(err) {
        // console.log('An error occurred: ' + err.message);
      })
      .on('stderr', function(stderrLine) {
        // console.log('An stderror occurred: ' + stderrLine);
      })

      .save(`D:/plexTemp/${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), ''))
      }

    if(movieTitle['resolution'] == '1920x1080' && movieTitle['pixFmt'] == "yuv420p10le") {
      ffstream = ffmpeg(movieTitle['filePath'])
    .videoCodec('libx265')
    .size('1920x1080')
    .audioCodec('aac')
    // .addOption('-pix_fmt', 'yuv420p10le')
    // .addOption("-x265-params", "colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc")
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
    .on('start', function(commandLine) {
      console.log('Spawned Ffmpeg with command: ' + commandLine);
    })
    .on('progress', function(progress) {
  
    })
    .on('error', function(err) {
      // console.log('An error occurred: ' + err.message);
    })
    .on('stderr', function(stderrLine) {
      // console.log('An stderror occurred: ' + stderrLine);
    })
    .save(`D:/plexTemp/${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), ''))
    }
    if(movieTitle['resolution'] == '3840x2160' && movieTitle['pixFmt'] == "yuv420p10le") {
      console.log(movieTitle['fileName'])
      ffstream = ffmpeg(movieTitle['filePath'])
    .videoCodec('libx265')
    .size(movieTitle['screenRes'])
    .audioCodec('aac')
    .addOption('-pix_fmt', 'yuv420p10le')
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
    .on('start', function(commandLine) {
      console.log('Spawned Ffmpeg with command: ' + commandLine);
    })
    .on('progress', function(progress) {
  
    })
    .on('error', function(err) {
      // console.log('An error occurred: ' + err.message);
    })
    .on('stderr', function(stderrLine) {
      // console.log('An stderror occurred: ' + stderrLine);
    })
    .save(`D:/plexTemp/${movieTitle['fileName']}.m3u8`.replace(new RegExp(' ', 'g'), ''))
    
    }
    
    if(process == true) {
      ffstream.kill()
    }
    
    var watcher = fs.watch("D:/plexTemp/", (event, filename) => {
     
      if(filename == `${movieTitle['fileName'].replace(new RegExp(' ', 'g'), '')}.m3u8`){
        watcher.close()

        var movieReturner = {
          browser: movieTitle['browser'],
          duration: movieTitle['duration'].toString,
          fileformat: movieTitle['fileformat'],
          location: 'http://192.168.1.86:4012/plexTemp/' + movieTitle['fileName'].replace(new RegExp(' ', 'g'), '') + '.m3u8',
          title: movieTitle['title'],
          seekTime: movieTitle['seekTime']
        }
        callback(movieReturner)
        return
      }
  });
}

if(movieTitle['browser'] == "Chrome") {

      var arr = []
      var h = Math.floor(movieTitle['seekTime'] / 3600);
      var m = Math.floor(movieTitle['seekTime'] % 3600 / 60);
      var s = Math.floor(movieTitle['seekTime'] % 3600 % 60);
      
      var processId = 0
      var newJob = function () {
        // D:/ffmpeg -ss ${h}:${m}:${s} -i "${movieTitle['filePath']}" -y -acodec aac -ac 6 -vcodec libx264 -filter:v scale=w=1920:h=1080 -crf 18 -start_number 0 -hls_time 5 
        // -force_key_frames expr:gte(t,n_forced*5) -hls_list_size 0 -f hls "D:/plexTemp/${movieTitle['fileName']}.m3u8"`
        var newProc = spawn('D:/ffmpeg', [
          '-ss', `${h}:${m}:${s}`,
          '-i', `${movieTitle['filePath']}`,
          '-y', 
          '-acodec', 
          'aac','-ac', '6', 
          '-vcodec', 'libx264', 
          '-filter:v', 'scale=w=1920:h=1080', 
          '-crf', '18', 
          '-start_number', 0, 
          '-hls_time', '5', 
          '-force_key_frames', 'expr:gte(t,n_forced*5)', 
          '-hls_list_size', '0', 
          '-f', 'hls', `D:/plexTemp/${movieTitle['fileName']}.m3u8`
        ])
        newProc.on('error', function (err) {
          console.log('ls error', err);
        });
        
        newProc.stdout.on('data', function (data) {
            console.log('stdout: ' + data);
        });
        
        newProc.stderr.on('data', function (data) {
            console.log('stderr: ' + data);
        });
        
        newProc.on('close', function (code) {
            console.log('child process exited with code ' + code);
        });
        processId = newProc.pid
      }
      newJob()
      

  var watcher = fs.watch("D:/plexTemp/", (event, filename) => {
  console.log("HERE IS PID", processId)
  if(filename == `${movieTitle['fileName']}.m3u8`){
    watcher.close()
    console.log("its here")
    var movieReturner = {
      browser: movieTitle['browser'],
      pid: processId,
      duration: movieTitle['duration'],
      fileformat: movieTitle['fileformat'],
      location: 'http://192.168.1.86:4012/plexTemp/' + movieTitle['fileName'] + '.m3u8',
      title: movieTitle['title']
    }

      callback(movieReturner)

    return
  }
  });
  }
}
module.exports = routeFunctions