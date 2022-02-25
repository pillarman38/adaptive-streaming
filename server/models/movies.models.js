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

var arrOfObj = []
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
      
      fs.readdir('F:/HomeVideo/', (err, files) => {  
        
        files.forEach(function getTvInfo(file) {
    
          fs.readdir('F:/HomeVideo/' + file, (err, fileTwo) => {
              console.log(file, fileTwo);
              var arr = []
              for(var i = 0; i < fileTwo.length; i++) {
                ffmpeg.ffprobe(`F:/HomeVideo/${file}/${fileTwo[i]}`, function(err, metaData) {
                  
                  var what = {
                    title: metaData['format']['filename'],
                    photoUrl: 'http://192.168.0.153:4012/assets/images/four0four.gif',
                    backdropPhotoUrl: 'http://192.168.0.153:4012/assets/images/four0four.gif',
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
                    photoUrl: 'http://192.168.0.153:4012/assets/images/four0four.gif',
                    backdropPhotoUrl: 'http://192.168.0.153:4012/assets/images/four0four.gif',
                    // overview: metaData['results'][0]['overview'],
                    title: file,
                    // url: url,
                    show: true,
                    
                    dirName: file,
                    folders: [{
                      title: fileTwo[i],
                      photoUrl: 'http://192.168.0.153:4012/assets/images/four0four.gif',
                      backdropPhotoUrl: 'http://192.168.0.153:4012/assets/images/four0four.gif',
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
      fs.readdir(`F:/HomeVideo/${videoList['title']}/`, (err, files) => {  
        console.log("Videos", files)
        files.forEach(function getShowInfoi(file, i) {
          ffmpeg.ffprobe(`F:/Shows/${videoList['title']}`, function(err, metaData) {
          var videoPlaylistObj = {
            title: file,
            photoUrl: `http://192.168.0.153:4012/assets/images/four0four.gif`,
            backdropPhotoUrl: `http://192.168.0.153:4012/assets/images/four0four.gif`,
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
      fs.readdir(`F:/Shows/${show['dirName']}/`, (err, files) => {
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
 
          ffmpeg.ffprobe(`F:/Shows/${show['dirName']}/${firstObj['url']}.mkv`, function(err, metaData) {
            var subTarr = []
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
                    subTarr.push(metaData['streams'][i])
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
                subtitles: subTarr,
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
      fs.readdir("F:/Videos/", async (err, files) => {
        var arr = []
          var selection = await files
        // var prom = new Promise((resolve, reject) => {
          
            

          pool.query('SELECT * FROM movies', async (err, res) => {
            var fileList = files.map(file => file.replace('.mkv', ''))
            var responseTitlteList = res ? res.map(itm => itm.title) : []

              var notIncluded = fileList.filter(itm => {
                if(!responseTitlteList.includes(itm)) {
                  return itm
                }
              })
            
            var l = 0
            
            async function iterate() {
              if(notIncluded.length > 0) {
              var fileName = notIncluded[l]
              var firstObj = {
                title: notIncluded[l],
                movieListUrl: `https://api.themoviedb.org/3/search/movie?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${fileName.replace(new RegExp(' ', 'g'), '%20')}`,
              }

            await ffmpeg.ffprobe(`F:/Videos/${firstObj['title']}.mkv`, async function(err, metaData) {
              // console.log(err, metaData);
              var subTarr = []
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
                      subTarr.push(metaData['streams'][i])
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
            let moviedata = await fetch(`${firstObj['movieListUrl']}`)
            let data = await moviedata.json()
              // console.log(data);
                if(metaData) {
                  var metaDataObj = {
                    title: fileName,
                    filePath: metaData['format']['filename'],
                    photoUrl: data['results'] === undefined || data['results'].length === 0 ? 'http://192.168.0.153:4012/assets/images/four0four.gif' : `https://image.tmdb.org/t/p/w500${data['results'][0]['poster_path']}`,
                    backdropPhotoUrl: data['results'] === undefined || data['results'][0] === undefined || data['results'][0]['backdrop_path'] === undefined || data['results'].length === 0 ? 'http://192.168.0.153:4012/assets/images/four0four.gif' : `https://image.tmdb.org/t/p/w500${data['results'][0]['backdrop_path']}`,
                    overview: data['results'] === undefined || data['results'].length === 0 ? '' : data['results'][0]['overview'],
                    duration: metaData['format']['duration'],
                    resolution: `${metaData['streams'][0]['coded_width']}x${metaData['streams'][0]['coded_height']}`,
                    channels: metaData['streams'][1]['channels'],
                    fileformat: metaData['streams'][0]['codec_name'],
                    originalLang: data['results'] === undefined || data['results'].length === 0 ? '' : data['results'][0]['original_language'],
                    pixFmt: metaData['streams'][0]['pix_fmt'],
                    subtitles: JSON.stringify(subTarr),
                    subtitleSelect: 0,
                    audio: JSON.stringify(audioArr),
                    audioSelect: 0,
                    color_range: metaData['streams'][0]['color_range'],
                    color_space: metaData['streams'][0]['color_space'],
                    color_transfer: metaData['streams'][0]['color_transfer'],
                    seekTime: 0,
                    fileName: fileName + '.mkv',
                  }

                  arrOfObj.push(metaDataObj)
                  // metaData = {}

                  pool.query(`INSERT INTO movies SET ?`, metaDataObj, (err, res)=>{
                    console.log(err, res);
                  })

                  try {
                    const tmdbSession = await fetch('https://api.themoviedb.org/3/authentication/token/new?api_key=490cd30bbbd167dd3eb65511a8bf2328');
                    const parsetoken = await tmdbSession.json();
                    const token = parsetoken.request_token
    
                    const tokenValidation = await fetch('https://api.themoviedb.org/3/authentication/token/validate_with_login?api_key=490cd30bbbd167dd3eb65511a8bf2328', {
                        method: 'POST',
                        headers: {
                          'Accept': 'application/json',
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          username: "pillarman38",
                          password: "goodkid38",
                          request_token: token
                        })
                      });
                      const content = await tokenValidation.json();
  
                      const session = await fetch('https://api.themoviedb.org/3/authentication/session/new?api_key=490cd30bbbd167dd3eb65511a8bf2328', {
                        method: 'POST',
                        headers: {
                          'Accept': 'application/json',
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          request_token: token
                        })
                      });
                      const ses = await session.json()
                      
                      await fetch(`https://api.themoviedb.org/3/list/8192894/add_item?api_key=490cd30bbbd167dd3eb65511a8bf2328&session_id=${ses.session_id}`, {
                        method: 'POST',
                        headers: {
                          'Accept': 'application/json',
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          "media_id": data.results[0].id
                        })
                        }).then((response) => {
                          return response.json()
                        }).then((waitForit)=>{
                          // console.log(waitForit);
                        })
                    } catch(err) {
                      console.log("Could not get id for: ", fileName);
                    }

                  if(l + 1 === notIncluded.length) {
                    console.log("HI")
                    callback(arrOfObj)
                  } else {
                    l += 1
                    console.log("I: ", l);
                    await iterate()
                  }
                } 
          })    
        } else {
          console.log("HI");
          callback(err, res)
        }
      }
        iterate()
      })
  })
  }
  }

module.exports = routeFunctions