let pool = require("../../config/connections");

let routeFunctions = {
  search: (query, callback) => {
    pool.query(
      `SELECT title, posterUrl FROM movies WHERE title LIKE '${query.searchVal}%'
        UNION
        SELECT title, posterUrl FROM tv WHERE title LIKE '${query.searchVal}%'
        LIMIT 5;`,
      (err, res) => {
        console.log(err, res);
        callback(null, res);
      }
    );
  },
};

module.exports = routeFunctions;
