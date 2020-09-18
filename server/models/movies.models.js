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
const { spawn } = require('child_process');
const { collapseTextChangeRangesAcrossMultipleVersions } = require('typescript');
const { forEach } = require('core-js/fn/array');

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
    pidKiller: (pid, callback) => {
      console.log(pid)
      if(pid['pid'] == 0) {
        console.log("nothing to kill")
        callback("nothing to kill")
      }
      if(pid['pid'] != 0) {
        try {
          process.kill(pid['pid'])
          callback('ded')
        }
          catch(err) {
            pid = 0
            console.log(pid)
            callback({error: err})
          }
      }
    },
    getAllHomeVids: (pid, callback) => {
      var arrOfTvObj = []
      if(pid['pid'] == 0) {
        console.log("nothing to kill")
      }
      if(pid['pid'] != 0) {
        try {
          process.kill(pid['pid'])
        }
          catch(err) {
            pid = 0
            console.log(pid)
          }
      }
      
      fs.readdir('D:/HomeVideo/', (err, files) => {  
        
        files.forEach(function getTvInfo(file) {
    
          fs.readdir('D:/HomeVideo/' + file, (err, fileTwo) => {
              console.log(file, fileTwo);
              var arr = []
              for(var i = 0; i < fileTwo.length; i++) {
                ffmpeg.ffprobe(`D:/HomeVideo/${file}/${fileTwo[i]}`, function(err, metaData) {
                  
                  var what = {
                    title: metaData['format']['filename'],
                    photoUrl: 'http://192.168.1.86:4012/assets/images/four0four.gif',
                    backdropPhotoUrl: 'http://192.168.1.86:4012/assets/images/four0four.gif',
                    show: true,
                    browser: "Safari",
                    filePath: metaData['format']['filename'],
                    pid: pid,
                    resolution: '720x480',
                    channels: metaData['streams'][1]['channels'],
                    fileformat: '.m3u8',
                    pixFmt: metaData['streams'][0]['pix_fmt'],
                    duration: metaData['format']['duration'],
                    audioSelect: 0,
                    color_range: metaData['streams'][0]['color_range'],
                    color_space: metaData['streams'][0]['color_space'],
                    color_transfer: metaData['streams'][0]['color_transfer'],
                    seekTime: 0,
                  }
                  arr.push(what)

                  var homeVideoListObj = {
                    photoUrl: 'http://192.168.1.86:4012/assets/images/four0four.gif',
                    backdropPhotoUrl: 'http://192.168.1.86:4012/assets/images/four0four.gif',
                    // overview: metaData['results'][0]['overview'],
                    title: file,
                    // url: url,
                    show: true,
                    
                    dirName: file,
                    folders: [{
                      title: fileTwo[i],
                      photoUrl: 'http://192.168.1.86:4012/assets/images/four0four.gif',
                      backdropPhotoUrl: 'http://192.168.1.86:4012/assets/images/four0four.gif',
                      show: true,
                      filePath: metaData['format']['filename'],
                      browser: 'Safari',
                      pid: pid,
                      resolution: '720x480',
                      channels: metaData['streams'][1]['channels'],
                      fileformat: '.m3u8',
                      pixFmt: metaData['streams'][0]['pix_fmt'],
                      duration: metaData['format']['duration'],
                      audioSelect: 0,
                      files: arr,
                      color_range: metaData['streams'][0]['color_range'],
                      color_space: metaData['streams'][0]['color_space'],
                      color_transfer: metaData['streams'][0]['color_transfer'],
                      seekTime: 0,
                      fileName: file.replace('.mkv', '')
      
                    }]
                    
                    }
                   arrOfTvObj.push(homeVideoListObj)
              if(arrOfTvObj.length == files.length){
                  callback(JSON.stringify(arrOfTvObj))
                } 
              })
              
              }
            })
          })
        })
      
    },
    getAHomeVideoList: (videoList, callback) => {
      var vidList = []
      fs.readdir(`D:/HomeVideo/${videoList['title']}/`, (err, files) => {  
        console.log("Videos", files)
        files.forEach(function getShowInfoi(file, i) {
          ffmpeg.ffprobe(`D:/Shows/${videoList['title']}`, function(err, metaData) {
          var videoPlaylistObj = {
            title: file,
            photoUrl: `http://192.168.1.86:4012/assets/images/four0four.gif`,
            backdropPhotoUrl: `http://192.168.1.86:4012/assets/images/four0four.gif`,
            }
            vidList.push(videoPlaylistObj)
            if(vidList.length == files.length) {
              callback(vidList)
            }
          })
        })
      })
    },
    getAShow: (show, callback) =>{
      console.log(show)
      if(show['pid'] == 0) {
        console.log("nothing to kill")
      }
      if(show['pid'] != 0) {
        var pidInt = parseInt(show['pid']['pid'])
        process.kill(show['pid']['pid'])
      }
      console.log(show)
      fs.readdir(`D:/Shows/${show['dirName']}/`, (err, files) => {
        console.log(files)

        var arr = []
       
        var prom = new Promise((resolve, reject) => {
          pool.query('SELEC * FROM ')
          
          files.forEach(function getShowInfoi(file, i) {
          // console.log(i, file)
          var url = file.replace('.mkv', '')
          var firstObj = {

            url: file.replace('.mkv', ''),
            title: i,
            movieListUrl: ``,
          }
 
          ffmpeg.ffprobe(`D:/Shows/${show['dirName']}/${firstObj['url']}.mkv`, function(err, metaData) {
            // console.log(err, metaData)
            var subTArr = []
            var audioArr = []
            var subcounter = -1
            var audiocounter = -1
            
            for(var i = 0; i < metaData['streams'].length; i++) {
              // metaData['streams'][i]['stream_number'] = i
              if(metaData['streams'][i].hasOwnProperty('codec_name')) {
                if(metaData['streams'][i]['codec_type'] == "subtitle") {
                    // console.log(metaData['streams'][i]['tags']['language'])
                    subcounter += 1
                    metaData['streams'][i]['indexInt'] = subcounter
                    subTArr.push(metaData['streams'][i])
                  }
                if(metaData['streams'][i]['codec_type'] == "audio") {
                    // console.log(metaData['streams'][i]['tags']['language'])
                    audiocounter += 1
                    metaData['streams'][i]['indexInt'] = audiocounter
                    audioArr.push(metaData['streams'][i])
                  }
                }   
              }
            // console.log(firstObj)
            console.log(`https://api.themoviedb.org/3/tv/${show['tvId']}/season/1?api_key=490cd30bbbd167dd3eb65511a8bf2328&language=en-US`)
          fetch(`https://api.themoviedb.org/3/tv/${show['tvId']}/season/1?api_key=490cd30bbbd167dd3eb65511a8bf2328&language=en-US`).then((data) => {
            return data.json()
          }).then((data)=>{
          // console.log(data)
            if(metaData) {
              var metaDataObj = {
                title: data['episodes'][firstObj['title']]['episode_number'],
                filePath: metaData['format']['filename'],
                photoUrl: show['photoUrl'],
                backdropPhotoUrl: show['backdropPhotoUrl'],
                overview: data['episodes'][firstObj['title']]['overview'],
                duration: metaData['format']['duration'],
                resolution: `${metaData['streams'][0]['coded_width']}x${metaData['streams'][0]['coded_height']}`,
                channels: metaData['streams'][1]['channels'],
                fileformat: metaData['streams'][0]['codec_name'],
                pixFmt: metaData['streams'][0]['pix_fmt'],
                subtitles: subTArr,
                subtitleSelect: 0,
                audio: audioArr,
                show: false,
                audioSelect: 0,
                color_range: metaData['streams'][0]['color_range'],
                color_space: metaData['streams'][0]['color_space'],
                color_transfer: metaData['streams'][0]['color_transfer'],
                seekTime: 0,
                fileName: file.replace('.mkv', '')
              }
              
              arr.push(metaDataObj)
              arr.sort((a, b) => (a.title > b.title) ? 1 : -1)
              if(arr.length == files.length){
                // console.log(arr)
                callback(arr)
              }            
            }          
          })
        })          
      })
    })
  })
},

    getAllMovies: (pid, callback) => {
      console.log(pid)
      if(pid['pid'] == 0) {
        console.log("nothing to kill")
      }
      if(pid['pid'] != 0) {
        try {
          process.kill(pid['pid'])
        }
          catch(err) {
            pid['pid'] = 0
            console.log(pid['pid'])
          }
      }

      setTimeout(function() {
        ffstream.on('error', function() {
          console.log('Ffmpeg has been killed');
        });
  
      }, 1000);
     arrOfObj = []
      fs.readdir("D:/Videos/", (err, files) => {
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
            var subTArr = []
            var audioArr = []
            var subcounter = -1
            var audiocounter = -1
            
            for(var i = 0; i < metaData['streams'].length; i++) {
              // metaData['streams'][i]['stream_number'] = i
              if(metaData['streams'][i].hasOwnProperty('codec_name')) {
                if(metaData['streams'][i]['codec_type'] == "subtitle") {
                    // console.log(metaData['streams'][i]['tags']['language'])
                    subcounter += 1
                    metaData['streams'][i]['indexInt'] = subcounter
                    subTArr.push(metaData['streams'][i])
                  }
                if(metaData['streams'][i]['codec_type'] == "audio") {
                    // console.log(metaData['streams'][i]['tags']['language'])
                    audiocounter += 1
                    metaData['streams'][i]['indexInt'] = audiocounter
                    audioArr.push(metaData['streams'][i])
                  }
                }   
              }
            // console.log(firstObj)
          fetch(`${firstObj['movieListUrl']}`).then((data) => {
            return data.json()
          }).then((data)=>{
            if(metaData) {
              var metaDataObj = {
                title: file.replace('.mkv', ''),
                filePath: metaData['format']['filename'],
                photoUrl: `https://image.tmdb.org/t/p/w500${data['results'][0]['poster_path']}`,
                backdropPhotoUrl: `https://image.tmdb.org/t/p/w500${data['results'][0]['backdrop_path']}`,
                overview: data['results'][0]['overview'],
                duration: metaData['format']['duration'],
                resolution: `${metaData['streams'][0]['coded_width']}x${metaData['streams'][0]['coded_height']}`,
                channels: metaData['streams'][1]['channels'],
                fileformat: metaData['streams'][0]['codec_name'],
                originalLang: data['results'][0]['original_language'],
                pixFmt: metaData['streams'][0]['pix_fmt'],
                subtitles: subTArr,
                subtitleSelect: 0,
                audio: audioArr,
                audioSelect: 0,
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
              // console.log(metaDataObj)
              arrOfObj.push(metaDataObj)
              if(arrOfObj.length == files.length){
                // console.log(arrOfObj)
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
  // console.log("Here is movie title", movieTitle)

  var h = Math.floor(movieTitle['seekTime'] / 3600);
  var m = Math.floor(movieTitle['seekTime'] % 3600 / 60);
  var s = Math.floor(movieTitle['seekTime'] % 3600 % 60);


  if(movieTitle['pid'] == 0) {
    console.log("nothing to kill")
  }
  if(movieTitle['pid'] != 0) {
    try {
      process.kill(movieTitle['pid'])
    }
      catch(err) {
        movieTitle['pid'] = 0
        console.log(movieTitle['pid'])
      }
  }
  
  if (movieTitle['browser'] == "Safari") {
    var processId = 0
 
    var arr = []
    var h = Math.floor(movieTitle['seekTime'] / 3600);
    var m = Math.floor(movieTitle['seekTime'] % 3600 / 60);
    var s = Math.floor(movieTitle['seekTime'] % 3600 % 60);

    if(movieTitle['resolution'] == '720x480' && movieTitle['pixFmt'] == "yuv420p") {
     
      var newJob = function () {
        // if(movieTitle['subtitles'] == -1) {
          var newProc = spawn('D:/ffmpeg', [
          '-ss', `${h}:${m}:${s}`,
          '-i', `${movieTitle['filePath']}`,
          '-y', 
          '-acodec', 
          'aac','-ac', '2', 
          '-vcodec', 'libx264', 
          '-filter:v', 'scale=w=720:h=480', 
          // '-crf', '18', 
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
          // }
        }
        
      newJob()
    }

    if(movieTitle['resolution'] == '1920x1080' && movieTitle['pixFmt'] == "yuv420p") {
      
      var newJob = function () {
        if(movieTitle['subtitleSelect'] != 0) {
          var newProc = spawn('D:/ffmpeg', [
          '-ss', `${h}:${m}:${s}`,
          '-i', `${movieTitle['filePath']}`, 
          '-filter_complex', `[0:v][0:s:${movieTitle['subtitleSelect']}]overlay[v]`, '-map', '[v]', '-map', `0:a:${movieTitle['audioSelect']}`,
          '-y', 
          '-acodec', 
          'aac','-ac', '6', 
          '-vcodec', 'libx264', 
          // '-filter:v', 'scale=w=1920:h=1080', 
          // '-crf', '18', 
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
            // console.log('stdout: ' + data);
        });
        
        newProc.stderr.on('data', function (data) {
            // console.log('stderr: ' + data);
        });
        
        newProc.on('close', function (code) {
            console.log('child process exited with code ' + code);
        });
        processId = newProc.pid
        }
        
        if(movieTitle['subtitleSelect'] == 0) {
          var newProc = spawn('D:/ffmpeg', [
            '-ss', `${h}:${m}:${s}`,
            '-i', `${movieTitle['filePath']}`,
            '-y', 
            '-acodec', 
            'aac','-ac', '6', 
            '-vcodec', 'libx264', 
            // '-filter:v', 'scale=w=1920:h=1080', 
            // '-crf', '18', 
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
              // console.log('stdout: ' + data);
          });
          
          newProc.stderr.on('data', function (data) {
              // console.log('stderr: ' + data);
          });
          
          newProc.on('close', function (code) {
              console.log('child process exited with code ' + code);
          });
          processId = newProc.pid
        }
      }
      newJob()
      }

    if(movieTitle['resolution'] == '1920x1080' && movieTitle['pixFmt'] == "yuv420p10le") {
     
      var newJob = function () {
        if(movieTitle['subtitles'] == -1) {
          var newProc = spawn('D:/ffmpeg', [
          '-ss', `${h}:${m}:${s}`,
          '-i', `${movieTitle['filePath']}`,
          '-y', 
          '-acodec', 
          'aac','-ac', '6', 
          '-vcodec', 'libx264', 
          '-filter:v', 'scale=w=1920:h=1080', 
          // '-crf', '18', 
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
            // console.log('stderr: ' + data);
        });
        
        newProc.on('close', function (code) {
            console.log('child process exited with code ' + code);
        });
        processId = newProc.pid
          }
        }
        
      newJob()
    }
    if(movieTitle['resolution'] == '3840x2160' && movieTitle['pixFmt'] == "yuv420p10le") {
      var newJob = function () {
        // D:/ffmpeg -ss ${h}:${m}:${s} -i "${movieTitle['filePath']}" -y -acodec aac -ac 6 -vcodec libx264 -filter:v scale=w=1920:h=1080 -crf 18 -start_number 0 -hls_time 5 
        // -force_key_frames expr:gte(t,n_forced*5) -hls_list_size 0 -f hls "D:/plexTemp/${movieTitle['fileName']}.m3u8"`
        var newProc = spawn('D:/ffmpeg', [
          '-ss', `${h}:${m}:${s}`,
          '-i', `${movieTitle['filePath']}`,
           '-crf', '18', 
          '-filter_complex', `[0:v]scale=1920:1080[scaled];[scaled][0:s:0]overlay[v]`, '-map', '[v]', '-map', `0:a:${movieTitle['audioSelect']}`,
          // '-filter:v', 'scale=w=1920:h=1080', 
          '-y', 
          '-acodec', 
          'aac','-ac', '6', 
          '-pix_fmt', 'yuv420p10le',
          '-vcodec', 'libx265',  
          "-x265-params", "colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc",
          // '-filter:v', 
          
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
    }
    
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

if(movieTitle['browser'] == "Chrome") {

      var arr = []
      var h = Math.floor(movieTitle['seekTime'] / 3600);
      var m = Math.floor(movieTitle['seekTime'] % 3600 / 60);
      var s = Math.floor(movieTitle['seekTime'] % 3600 % 60);
      
      var processId = 0
      var newJob = function () {
        if(movieTitle['subtitles'] != -1) {
          var newProc = spawn('D:/ffmpeg', [
          '-ss', `${h}:${m}:${s}`,
          '-i', `${movieTitle['filePath']}`, '-filter_complex', `[0:v][0:s:${movieTitle['subtitles']}]overlay[v]`, '-map', '[v]', '-map', `0:a:${movieTitle['audio']}`,
          '-y', 
          '-acodec', 
          'aac','-ac', '6', 
          '-vcodec', 'libx264', 
          // '-filter:v', 'scale=w=1920:h=1080', 
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
            // console.log('stdout: ' + data);
        });
        
        newProc.stderr.on('data', function (data) {
            // console.log('stderr: ' + data);
        });
        
        newProc.on('close', function (code) {
            console.log('child process exited with code ' + code);
        });
        processId = newProc.pid
        }
        
        if(movieTitle['subtitles'] == -1) {
          var newProc = spawn('D:/ffmpeg', [
            '-ss', `${h}:${m}:${s}`,
            '-i', `${movieTitle['filePath']}`, '-filter_complex', '[0:v][0:s]overlay[v]', '-map', '[v]', '-map', `0:a:${movieTitle['audio']}`,
            '-y', 
            '-acodec', 
            'aac','-ac', '6', 
            '-vcodec', 'libx264', 
            // '-filter:v', 'scale=w=1920:h=1080', 
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
              // console.log('stdout: ' + data);
          });
          
          newProc.stderr.on('data', function (data) {
              // console.log('stderr: ' + data);
          });
          
          newProc.on('close', function (code) {
              console.log('child process exited with code ' + code);
          });
          processId = newProc.pid
        }
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
      location: 'http://:4012/plexTemp/' + movieTitle['fileName'] + '.m3u8',
      title: movieTitle['title']
    }

      callback(movieReturner)

    return
  }
  });
  }
}
module.exports = routeFunctions