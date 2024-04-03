require('./config/config')
let pool = require('./config/connections')
const { promisify, log } = require('util');
const exec = promisify(require('child_process').exec);
const ffmpeg = require('fluent-ffmpeg');
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const movies = require('./server/models/movies.models')
ffmpeg.setFfprobePath(ffprobePath);

async function execute(command, callback){
    try {
        const { stdout, stderr } = await exec (command);
        console.log (`stdout: ${stdout}`);
        console.log (`stderr: ${stderr}`);
      } catch (error) {
        console.error (`exec error: ${error}`);
      }
};

async function main(video) { 
    try {
        await execute(`I:/ffmpeg -y -i "I:/Videos/${video}.mkv" -map 0:0 -c copy I:/BL_EL_RPU.hevc -map 0:1 -c eac3 -ac 6 I:/pcm.mov`)
        await execute(`I:/dovi_tool -m 2 convert I:/BL_EL_RPU.hevc --discard`)
        await execute(`I:/mp4box -tmp "I:/" -add BL_RPU.hevc:dvp=5 -add I:/pcm.mov:lang=eng -new "I:/Videos/${video}.mp4"`)
        await execute(`move "I:\\Videos\\${video}.mkv" "I:\\ConvertedDVMKVs\\${video}.mkv"`)
        // await ffmpeg.ffprobe(`I:/Videos/${video}.mp4`, async function(err, metaData) {
          // console.log(err, metaData);
          pool.query(`SELECT * FROM movies WHERE titlte = '${video}'`, (err, res) => {
            if(err.sqlMessage.includes('Unknown column')) {
              movies.getAllMovies(0, () => {
                console.log("Done inserting new movie in DB");
              })
            }

            if(res) {
              pool.query(`DELETE FROM movies WHERE title = '${video}'`, (er, re) => {
                movies.getAllMovies(0, () => {
                  console.log("Done updating new movie in DB");
                })
              })
            }
        })
        console.log('Done! Saving to DB.');

    } catch (error) {
    console.error("Something went wrong:", error);
  }
}

main(process.argv[2])