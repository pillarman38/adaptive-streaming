require('./config/config')
const express = require('express')
const app = express()
const appTwo = express()
const port = 4012
var cors = require('cors')
var http = require('http')
var bparser = require('body-parser')

app.use(bparser.urlencoded({ extended: true }));
app.use(bparser.json());

app.use(express.static(__dirname + '/dist'))
app.use(express.static("F:/"))

app.use(cors())

let userRoutes = require('./server/routes/movies.routes')

app.use('/api/mov', userRoutes)

app.get('*', (req, res) => {
    res.sendFile('/dist/index.html', {root: __dirname})
})

var server = app.listen(port, function() {
    var host = '192.168.0.153';
    var thisport = server.address().port;
    console.log(`Example app on port ${port}!`);
});




