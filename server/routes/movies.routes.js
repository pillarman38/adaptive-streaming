let express = require('express')
let router = express.Router()
let pool = require('../../config/connections')
let models = require('../models/movies.models')
let fs = require("fs")

router.get('/movies', (req, res)=>{
    models.getAllMovies((err, results)=>{
        if(err){
            return res.send({err: err})
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
    models.startconvertingMovie(
        {
            title: req.body['title'],
            browser: req.body['browser'],
            location: req.body['location'],
            fileformat: req.body['fileformat'],
            image: req.body['image'],
            duration: req.body['duration']
        }
    , (err, results)=>{
        if(err){
            console.log(err)
            console.log("yoooooooooooooooooooooooooooooo1",req.body)
            return res.send({err: err})
            
        } else {
            res.send(results)
        }
    })
})

module.exports = router