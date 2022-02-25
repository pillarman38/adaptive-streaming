let pool = require('../../config/connections')
let fs = require('fs')
const ffmpeg = require('fluent-ffmpeg');
let codecGetter = require('./codec-determine')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

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

let tv =  {
    getAllShows: (pid, callback) => {
        fs.readdir('F:/Shows', async(err, res) => {
          pool.query(`SELECT * FROM tv`, (error, dbRes) => {
            var i = 0
      
            let titlesOnly = dbRes.map(itm => itm.title)
            let showsToAdd = res.filter(itm => !titlesOnly.includes(itm))
      
            async function showIterator() {
              let showDetails;
              var url = encodeURI(`https://imdb-api.com/en/API/SearchSeries/k_l57p9b7x/${showsToAdd[i]}`)
              showDetails = await fetch(url)
              
              showDetails = await showDetails.json()
              
              let showWithId = await fetch(`https://imdb-api.com/en/API/Title/k_l57p9b7x/${showDetails.results[0].id}`)
              showWithId = await showWithId.json()
      
              let showImages = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=490cd30bbbd167dd3eb65511a8bf2328&query=${showDetails.results[0].title}`)
              showImages = await  showImages.json()
      
              let showId = showWithId.id
              let numberOfSeasons = showWithId.tvSeriesInfo.seasons.length
              var seasonStartPos = 1
      
              let showObj = {
                title: showsToAdd[i].replace(/[^a-zA-Z0-9 ]/g, ''),
                coverArt: `https://image.tmdb.org/t/p/w500${showImages.results[0].poster_path}`,
                backdropPhotoUrl: `https://image.tmdb.org/t/p/w500${showImages.results[0].backdrop_path}`,
                numOfSeasons: numberOfSeasons
              }
              pool.query(`INSERT INTO tv SET ?`, showObj, (e, resp) =>{
                console.log(e, resp);
              })
              
              async function seasonIterator() {
                var url = `https://imdb-api.com/en/API/SeasonEpisodes/k_l57p9b7x/${showId}/${seasonStartPos}`
                let seasonInfo = await fetch(url)
                seasonInfo = await seasonInfo.json()
                let seasonLen =  seasonInfo.episodes.length;
                
                let e = 0
                async function episodeIterator() {
                  try{
                    if(seasonInfo.errorMessage !== "404 Not Founded Error" || seasonInfo.episodes.length !== 0) {
                      
                  let episodeObj = {
                    tvSeries: seasonInfo.title.replace(/[^a-zA-Z0-9 ]/g, ''),
                    title: seasonInfo.episodes[e].title,
                    overview: seasonInfo.episodes[e].plot,
                    backdropPhotoUrl: seasonInfo.episodes[e].image,
                    episodeNumber: e,
                    season: seasonStartPos
                  }
                  
                  pool.query(`INSERT INTO episodes SET ?`, episodeObj, (err, resp)=>{
                    console.log(err, resp);
                  })
                  if(e + 1 !== seasonInfo.episodes.length) {
                    e += 1
                    episodeIterator()
                  } else {
                    e = 0
                  }
                }
                } catch(er) {
                  var url = `https://imdb-api.com/en/API/SeasonEpisodes/k_l57p9b7x/${showId}/${seasonStartPos}`
                  console.log(er);
                }
                }
                episodeIterator()
                
                if(seasonStartPos + 1 <= numberOfSeasons) {
                  seasonStartPos += 1
                  seasonIterator()
                } else {
                  seasonStartPos = 1
                }
              }
              seasonIterator()
              if(i + 1 !== showsToAdd.length) {
                i += 1
                showIterator()
              } else {
                console.log("shows loaded");
                callback(dbRes)
              }
            }
            if(showsToAdd.length !== 0) {
              showIterator()
            } else {
              console.log("all caught up!");
              callback(dbRes)
            }
          })
        })
      },
      getSelectedShow: (show, callback) => {
        pool.query(`SELECT * FROM tv WHERE title = '${show.title}'`, (error, response) => {
            pool.query(`SELECT * FROM episodes WHERE tvSeries = '${show.title}'`, (err, res)=>{

                let group = res.reduce((r, a) => {
                    r[a.season] = [...r[a.season] || [], a];
                    return r;
                   }, []).filter(itm => itm !== null)
                   
                
                callback(err, {
                    ...response,
                    seasons: group
                })
            })
        })
      } 
    }

module.exports = tv