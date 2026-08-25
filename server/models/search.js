let pool = require("../../config/connections");
const urlTransformer = require("../utils/url-transformer");

let routeFunctions = {
  search: (query, callback) => {
    pool.query(
      `SELECT title, posterUrl FROM movies WHERE title LIKE '${query.searchVal}%'
        UNION
        SELECT showName, posterUrl FROM tv WHERE showName LIKE '${query.searchVal}%'
        LIMIT 5;`,
      (err, res) => {
        console.log(err, res);
        const rows = Array.isArray(res)
          ? res.map((row) => urlTransformer.prepareRecordForResponse({ ...row }, ['posterUrl']))
          : res;
        callback(null, rows);
      }
    );
  },
};

module.exports = routeFunctions;
