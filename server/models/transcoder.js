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

var exec = require('child_process').exec;

var arr = []
var killProcess = false
var ffstream = ffmpeg()
var exec = require('child_process').exec


const transcoder = {
    startConverting: (movieTitle, callback) => { 
    var getRes = codecGetter.getVideoResoluion(movieTitle)
    var getFormat = codecGetter.getVideoFormat(movieTitle)
  
  
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
            var newProc = spawn('F:/ffmpeg', [
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
            '-f', 'hls', `F:/plexTemp/${movieTitle['fileName']}.m3u8`
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
            var newProc = spawn('F:/ffmpeg', [
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
            '-f', 'hls', `F:/plexTemp/${movieTitle['fileName']}.m3u8`
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
            var newProc = spawn('F:/ffmpeg', [
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
              '-f', 'hls', `F:/plexTemp/${movieTitle['fileName']}.m3u8`
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
            var newProc = spawn('F:/ffmpeg', [
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
            '-f', 'hls', `F:/plexTemp/${movieTitle['fileName']}.m3u8`
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
          // F:/ffmpeg -ss ${h}:${m}:${s} -i "${movieTitle['filePath']}" -y -acodec aac -ac 6 -vcodec libx264 -filter:v scale=w=1920:h=1080 -crf 18 -start_number 0 -hls_time 5 
          // -force_key_frames expr:gte(t,n_forced*5) -hls_list_size 0 -f hls "F:/plexTemp/${movieTitle['fileName']}.m3u8"`
          var newProc = spawn('F:/ffmpeg', [
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
            '-f', 'hls', `F:/plexTemp/${movieTitle['fileName']}.m3u8`
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
      
        var watcher = fs.watch("F:/plexTemp/", (event, filename) => {
          console.log("HERE IS PID", processId)
          if(filename == `${movieTitle['fileName']}.m3u8`){
            watcher.close()
            console.log("its here")
            var movieReturner = {
              browser: movieTitle['browser'],
              pid: processId,
              duration: movieTitle['duration'],
              fileformat: movieTitle['fileformat'],
              location: 'http://192.168.0.153:4012/plexTemp/' + movieTitle['fileName'] + '.m3u8',
              title: movieTitle['title']
            }
              callback(movieReturner)
            return
          }
        });
    }
  
  if(movieTitle['browser'] == "Chrome") {
        console.log("hi");
        var arr = []
        var h = Math.floor(movieTitle['seekTime'] / 3600);
        var m = Math.floor(movieTitle['seekTime'] % 3600 / 60);
        var s = Math.floor(movieTitle['seekTime'] % 3600 % 60);
        
        var processId = 0
        var newJob = function () {
          // if(movieTitle['subtitles'] != -1) {
            var newProc = spawn('F:/ffmpeg', [
              '-ss', `${h}:${m}:${s}`,
              '-i', `${movieTitle['filePath']}`,
              // '-filter:v', 'scale=w=1920:h=1080', 
              '-acodec', 
              'aac','-ac', `${movieTitle['channels']}`, 
              '-vcodec', 'copy',
              
              '-start_number', 0, 
              '-hls_time', '5', 
              '-force_key_frames', 'expr:gte(t,n_forced*5)', 
              '-hls_list_size', '0', 
              '-f', 'hls', `F:/plexTemp/${movieTitle['fileName']}.m3u8`
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
          
          // if(movieTitle['subtitles'] == -1) {
          //   var newProc = spawn('F:/ffmpeg', [
          //     '-ss', `${h}:${m}:${s}`,
          //     '-i', `${movieTitle['filePath']}`, '-filter_complex', '[0:v][0:s]overlay[v]', '-map', '[v]', '-map', `0:a:${movieTitle['audio']}`,
          //     '-y', 
          //     '-acodec', 
          //     'aac','-ac', '6', 
          //     '-vcodec', 'libx264', 
          //     // '-filter:v', 'scale=w=1920:h=1080', 
          //     '-crf', '18', 
          //     '-start_number', 0, 
          //     '-hls_time', '5', 
          //     '-force_key_frames', 'expr:gte(t,n_forced*5)', 
          //     '-hls_list_size', '0', 
          //     '-f', 'hls', `F:/plexTemp/${movieTitle['fileName']}.m3u8`
          //   ])
          //   newProc.on('error', function (err) {
          //     console.log('ls error', err);
          //   });
            
          //   newProc.stdout.on('data', function (data) {
          //       // console.log('stdout: ' + data);
          //   });
            
          //   newProc.stderr.on('data', function (data) {
          //       // console.log('stderr: ' + data);
          //   });
            
          //   newProc.on('close', function (code) {
          //       console.log('child process exited with code ' + code);
          //   });
          //   processId = newProc.pid
          // }
        }
        newJob()
        
  
    var watcher = fs.watch("F:/plexTemp/", (event, filename) => {
    console.log("HERE IS PID", processId)
    if(filename == `${movieTitle['fileName']}.m3u8`){
      watcher.close()
      console.log("its here")
      var movieReturner = {
        browser: movieTitle['browser'],
        pid: processId,
        duration: movieTitle['duration'],
        fileformat: movieTitle['fileformat'],
        location: 'http://192.168.0.153:4012/plexTemp/' + movieTitle['fileName'] + '.m3u8',
        title: movieTitle['title']
      }
        callback(movieReturner)
  
      return
    }
    });
    }
  }
  }
  module.exports = transcoder