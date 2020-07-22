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
app.use(express.static("D:/"))

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
