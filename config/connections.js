const mysql = require('mysql2');
var pool = mysql.createPool({
    host: process.env.host,
    user: process.env.user,
    password: process.env.password,
    database: process.env.database,
    port:3306
})

var poolPlanet = mysql.createPool({
    host: process.env.planetHost,
    user: process.env.planetUsername,
    password: process.env.planetPassword,
    database: process.env.planetDatabase,
    port:3306
})


pool.getConnection((err, connection) => {
    if (err) {
        if (err.code == "PROTOCOL_CONNECTION_LOST") {
            console.log("Database connection was closed")
        }
        if (err.code == "ER_CON_COUNT_ERROR") {
            console.log("Database has to many connections")
        }
        if (err.code == "ERCONNREFUSED") {
            console.log("Database connection was refused")
        }
    }
    if (connection) {
        connection.release()
    }
    return
})

poolPlanet.getConnection((err, connection) => {
    if (err) {
        if (err.code == "PROTOCOL_CONNECTION_LOST") {
            console.log("Database connection was closed")
        }
        if (err.code == "ER_CON_COUNT_ERROR") {
            console.log("Database has to many connections")
        }
        if (err.code == "ERCONNREFUSED") {
            console.log("Database connection was refused")
        }
    }
    if (connection) {

        console.log("CONNECTEDDDDDD");
        connection.release()
    }
    return
})

module.exports = pool;