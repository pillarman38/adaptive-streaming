let express = require('express')
let router = express.Router()
let pool = require('../../config/connections')
let models = require('../models/movies.models')
let fs = require("fs")
let fetch = require('node-fetch')
let transcoder = require('../models/transcoder')
let tv = require('../models/tvShows.models')
let pixie = require('../models/pixie')

router.post('/movies', (req, res)=>{
    console.log("body", req.body)
    models.getAllMovies(
        {
            pid: req.body['pid']
        },
        (err, results)=>{
        if(err){
            res.send(err)
        } else {
            res.send(results)
        }
    })
})

router.post('/selectedShow', (req, res)=>{
    tv.getSelectedShow(
        req.body,
        (err, results)=>{
        if(err){
            res.send(err)
        } else {
            res.send(results)
        }
    })
})

router.post('/tv', (req, res)=>{
    console.log("body", req.body)
    tv.getAllShows(
        {
            pid: req.body['pid']
        },
        (err, results)=>{
        if(err){
            res.send(err)
        } else {
            res.send(results)
        }
    })
})

router.post('/transcodedMovieDirectoryInfo', (req, res)=>{
    pixie.getDirAfterTranscode(
        req.body,
        (err, results)=>{
        if(err){
            res.send(err)
        } else {
            res.send(results)
        }
    })
})

router.post('/homevideos', (req, res)=>{
    console.log("body", req.body)
    models.getAllHomeVids(
        {
            pid: req.body['pid']
        },
        (err, results)=>{
        if(err){
            res.send(err)
        } else {
            res.send(results)
        }
    })
})

router .post('/video', (req, res)=>{
    models.getAHomeVideoList({
        title: req.body['title'],
        browser: req.body['browser'],
        fileformat: req.body['fileformat']
    }, (err, results)=>{
        if(err){
            res.send(err)
        } else {
            res.send(results)
        }
    })
})

router.post('/pidkill', (req, res) => {
    console.log(req.body, res)
    models.pidKiller(req.body, (err, results)=>{
        console.log("PID Return", err, results);
        if(err){
            res.send(err)
        } else {
            res.send(results)
        }
    })
})

router.post('/show', (req, res)=>{
    console.log("body", req.body)
    tv.getAShow(
        {
            title: req.body['title'],
            tvId: req.body['tvId'],
            backdropPhotoUrl: req.body['backdropPhotoUrl'],
            browser: req.body['browser'],
            dirName: req.body['dirName'],
            fileformat: req.body['fileformat'],
            overview: req.body['overview'],
            photoUrl: req.body['photoUrl'],
            url: req.body['url']
        },
        (err, results)=>{
            console.log(err, results)
        if(err){
            res.send(err)
        } else {
            res.send(results)
        }
    })
})

router.get('/transcodedmovie', (req, res)=>{
    models.getTranscodedMovie((err, results)=>{
        if(err){
            return res.send({err: err})
        } else {
            res.send(results)
        }
    })
})

router.post('/pullVideo', (req, res)=>{
    transcoder.startConverting(
        {
            title: req.body['title'],
            browser: req.body['browser'],
            location: req.body['location'],
            fileformat: req.body['fileformat'],
            duration: req.body['duration'],
            backdrop_path: req.body['backdrop_path'],
            original_language: req.body['original_language'],
            original_title: req.body['original_title'],
            overview: req.body['overview'],
            popularity: req.body['popularity'],
            poster_path: req.body['poster_path'],
            release_date: req.body['release_date'],
            vote_average: req.body['vote_average'],
            vote_count: req.body['vote_count'],
            filePath: req.body['filePath'],
            fileName: req.body['fileName'],
            photoUrl: req.body['photoUrl'],
            channels: req.body['channels'],
            resolution: req.body['resolution'],
            videoFormat: req.body['videoFormat'],
            screenRes: req.body['screenRes'],
            hdrEnabled: req.body['hdrEnabled'],
            color_range: req.body['color_range'],
            color_space: req.body['color_space'],
            color_transfer: req.body['color_transfer'],
            seekTime: req.body['seekTime'],
            subtitles: req.body['subtitles'],
            subtitleSelect: req.body['subtitleSelect'],
            audio: req.body['audio'],
            audioSelect: req.body['audioSelect'],
            pid: req.body['pid'],
            pixFmt: req.body['pixFmt']
        }
    , (err, results)=>{
        if(err){
            
            return res.send({err: err})
        } else {
            res.send(results)
        }
    })
})

router.post('/transcodeMovies', (req, res)=>{
    console.log("body", req.body)
    pixie.transcodeMovies(
        req.body,
        (err, results)=>{
            console.log(err, results)
        if(err){
            res.send(err)
        } else {
            res.send(results)
        }
    })
})

module.exports = router