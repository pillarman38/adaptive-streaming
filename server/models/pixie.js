let pool = require('../../config/connections')
let fs = require('fs')
const ffmpeg = require('fluent-ffmpeg');
let codecGetter = require('./codec-determine')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const path = require('path');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
let chokidar = require('chokidar')
var showPlayer = false
var fetch = require('node-fetch')
let net = require('net')
const spawn = require("child_process").spawn
var ffstream = ffmpeg()
var exec = require('child_process').exec
var AdmZip = require("adm-zip");

let connectedClients = []
const server = net.createServer((socket)=> {
    sock = socket
    socket.on('data', (data) => {
        console.log(data.toString());
    })
    // socket.write('SERVER: Helloo! this is your sever speaking.\n')
    // socket.end('SERVER: CLosing connection now.\n')
}).on('error', (err)=>{
    console.log(err);
})

server.on('connection', (client)=>{
    connectedClients.push(client)
    console.log(connectedClients);
})

server.listen(9898, () =>{
    console.log('opened server on: ', server.address().port);
})

let pixie = {
  transcodeMovies: (movie, callback) => {
      callback({},"we'll be back...")
    var newJob = function () {
        
          fs.mkdir(path.join('F:/toPixie', `${movie['movie']}`), (err) => {
            if (err) {
                return console.error(err);
            }
            console.log('Directory created successfully!');
          })
          console.log("MOVIEEEE", movie);
          var newProc = spawn('F:/ffmpeg', [
            // '-ss', '0', '-t', '20',
            '-i', `F:/Videos/${movie['movie']}.mkv`,
            '-y', 
            '-vf', 'scale=w=1920:h=1080', 
            '-c:v', 'libx265', 
            '-crf', '18',
            '-c:a', 'ac3',
            '-tag:v', 'hvc1',
            // '-movflags', '+faststart',
            `F:/toPixie/${movie['movie']}/${movie['movie']}.mp4`
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

          connectedClients[0].write(movie['movie'])
          console.log('child process exited with code ' + code);
          // });
          processId = newProc.pid
          })
        }
      newJob() 
  },
  transcodeHomeVideos: (video, callback) =>{
    callback({},"we'll be back...")
    var newJob = function () {
        
          fs.mkdir(path.join('F:/toPixie', `${movie['movie']}`), (err) => {
            if (err) {
                return console.error(err);
            }
            console.log('Directory created successfully!');
          })
          console.log("MOVIEEEE", movie);
          var newProc = spawn('F:/ffmpeg', [
            '-ss', '0', '-t', '20',
            '-i', `F:/Videos/${movie['movie']}.mkv`,
            '-y', 
            '-vf', 'scale=w=1920:h=1080', 
            '-c:v', 'libx265', 
            '-crf', '18',
            '-c:a', 'aac',
            '-tag:v', 'hvc1',
            `F:/toPixie/${movie['movie']}/${movie['movie']}.mp4`
        ])
        newProc.on('error', function (err) {
          console.log('ls error', err);
        });
        
        newProc.stdout.on('data', function (data) {
            console.log('stdout: ' + data, movie['movie']);
        });
        
        newProc.stderr.on('data', function (data) {
            console.log('stderr: ' + data, movie['movie']);
        });
        
        newProc.on('close', function (code) {

          connectedClients[0].write(movie['movie'])
          console.log('child process exited with code ' + code, movie['movie']);
          // });
          processId = newProc.pid
          })
        }
      newJob() 
  },
  getDirAfterTranscode: (movie, callback) => {
    fs.readdir(`F:/toPixie/${movie['movie']}`, (err, files)=>{
      console.log("", err, files);
      callback(files)
    })
  }
}

module.exports = pixie