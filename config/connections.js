var mysql = require('mysql')
var pool = mysql.createPool({
   
    host: process.env.host,
    user: process.env.user,
    password: process.env.password,
    database: process.env.database,
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

module.exports = pool;