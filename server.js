require('./config/config')
const express = require('express')
const app = express()
const appTwo = express()
const port = 4012
var cors = require('cors')
var http = require('http')
var bparser = require('body-parser').json()

app.use(bparser)
app.use(express.static(__dirname + '/dist'))
app.use(express.static("F:/Videos"))
app.use(express.static("F:/Videos/transcoding"))
app.use(cors())

let userRoutes = require('./server/routes/movies.routes')

app.use('/api/mov', userRoutes)

app.get('*', (req, res) => {
    res.sendFile('/dist/index.html', {root: __dirname})
})

var server = app.listen(port, function() {
    var host = 'localhost';
    var thisport = server.address().port;
    console.log(`Example app on port ${port}!`);
});
// This is the command(its good on cpu usage) = ffmpeg -i "Your Name/Your Name_t01.mkv" -c:v copy -pix_fmt yuv420p -c:a aac -ac 2 -b:a 640k -movflags frag_keyframe+empty_moov blade.mp4

// to create ts files = ffmpeg -re -i "Fighting with My Family_t14.mkv" -codec copy -f segment -segment_list_flags +live -segment_time 10 blade%03d.ts

// ffmpeg hls straming command = ffmpeg -i "Alita- Battle Angel-FPL_MainFeature_t99.mkv" -b:v 1M -g 60 -hls_list_size 0 output.m3u8