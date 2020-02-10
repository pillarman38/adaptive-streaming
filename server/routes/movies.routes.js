let express = require('express')
let router = express.Router()
let pool = require('../../config/connections')
let models = require('../models/movies.models')
let fs = require("fs")
let fetch = require('node-fetch')

router.get('/movies', (req, res)=>{
    models.getAllMovies((err, results)=>{
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
            return ress.send({err: err})
            
        } else {
            res.send(results)
        }
    })
})

router.post('/pullVideo', (req, res)=>{
    models.startconvertingMovie(
        {
            title: req.body['title'],
            browser: req.body['browser'],
            location: req.body['location'],
            fileformat: req.body['fileformat'],
            duration: req.body['duration'],
            adult: req.body['adult'],
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
            seekTime: req.body['seekTime']
        }
    , (err, results)=>{
        if(err){
            
            return res.send({err: err})
        } else {
            res.send(results)
        }
    })
})

module.exports = router