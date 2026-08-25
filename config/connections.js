var mysql = require("mysql2");
const util = require("util");

var pool = mysql.createPool({
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database,
  port: 3306,
});

var poolPlanet = mysql.createPool({
  host: process.env.planetHost,
  user: process.env.planetUsername,
  password: process.env.planetPassword,
  database: process.env.planetDatabase,
  port: 3306,
});

const shelfFitDatabaseName = process.env.shelfFitDatabase || "shelffit";

var poolShelfFit = mysql.createPool({
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: shelfFitDatabaseName,
  port: 3306,
});

const movieDatabaseName = process.env.movieDatabase || "movie";

var poolMovies = mysql.createPool({
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: movieDatabaseName,
  port: 3306,
});

pool.getConnection((err, connection) => {
  if (err) {
    if (err.code == "PROTOCOL_CONNECTION_LOST") {
      console.log("Database connection was closed");
    }
    if (err.code == "ER_CON_COUNT_ERROR") {
      console.log("Database has to many connections");
    }
    if (err.code == "ERCONNREFUSED") {
      console.log("Database connection was refused");
    }
  }
  if (connection) {
    console.log("CONNECTEDDDDDD");

    connection.release();
  }
  return;
});

poolPlanet.getConnection((err, connection) => {
  if (err) {
    if (err.code == "PROTOCOL_CONNECTION_LOST") {
      console.log("Database connection was closed");
    }
    if (err.code == "ER_CON_COUNT_ERROR") {
      console.log("Database has to many connections");
    }
    if (err.code == "ERCONNREFUSED") {
      console.log("Database connection was refused");
    }
  }
  if (connection) {
    connection.release();
  }
  return;
});
pool.query = util.promisify(pool.query);
poolShelfFit.query = util.promisify(poolShelfFit.query);
poolMovies.query = util.promisify(poolMovies.query);

module.exports = pool;
module.exports.poolShelfFit = poolShelfFit;
module.exports.shelfFitDatabaseName = shelfFitDatabaseName;
module.exports.poolMovies = poolMovies;
module.exports.movieDatabaseName = movieDatabaseName;
