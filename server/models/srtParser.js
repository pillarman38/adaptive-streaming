var srtParser2 = import("srt-parser-2");
const fs = require("fs");
// var srt2vtt = require('srt-to-vtt')
// var toWebVTT = require("srt-webvtt")
const { spawn } = require("child_process");

class Parser {
  toSeconds(time) {
    var splitTime = time.split(/[:,]+/);

    var seconds =
      +splitTime[0] * 60 * 60 +
      +splitTime[1] * 60 +
      +splitTime[2] +
      "." +
      splitTime[3];
    return parseFloat(seconds);
  }

  timeCodeGenerator(vttArr) {
    for (var i = 0; i < vttArr.length; i++) {
      if (vttArr[i].includes("-->")) {
        let splitter = vttArr[i].split("-->");
        let startTime = splitter[0];
        let endTime = splitter[1];

        function timeString(number) {
          const time = new Date(number * 1000).toISOString().slice(11, 23);
          return time;
        }

        startTime = timeString(startTime);
        endTime = timeString(endTime);
        vttArr[
          i
        ] = `${startTime} --> ${endTime} line:-4 position:50% size:20% align:center\n`;
      }
    }
    return vttArr;
  }

  async parser(srtFilePath, seekTime, title) {
    const time = new Date(seekTime * 1000).toISOString().slice(11, 23);
    var srtParser = new srtParser2();
    const buffer = fs.readFileSync(srtFilePath);
    const fileContent = buffer.toString();
    const parser = srtParser.fromSrt(fileContent);
    const timeCorrection = parser.filter((line) => {
      var startTime = this.toSeconds(line.startTime);
      var endTime = this.toSeconds(line.endTime);
      if (startTime >= seekTime) {
        line.startTime = startTime - seekTime;
        line.endTime = endTime - seekTime;
        return line;
      }
    });
    const hi = srtParser.toSrt(timeCorrection).toString();

    await fs.promises.writeFile(
      `F:/modifiedVtts/${title}.srt`,
      hi,
      function (err) {
        if (err) return console.log(err);

        return timeCorrection;
      }
    );
    var vttFileStr = await fs
      .readFileSync(`F:/modifiedVtts/${title}.srt`)
      .toString("utf8");
    let vttArr = vttFileStr.split("\n");

    vttArr = vttArr.filter((line) => {
      if (isNaN(line)) {
        return line;
      }
    });

    vttArr = vttArr.map((line) => {
      return line + "\n\n";
    });

    const timeCorrectionVtt = this.timeCodeGenerator(vttArr);

    vttArr.unshift("WEBVTT \n\n\n");
    vttFileStr = vttArr.join("");
    await fs.promises.writeFile(
      `F:/modifiedVtts/${title}.vtt`,
      vttFileStr,
      function (err) {
        if (err) return console.log(err);

        return timeCorrection;
      }
    );
  }
  parserFfmpeg(srtFilePath, seekTime, title) {
    var newProc = spawn("F:/ffmpeg", [
      "-ss",
      `${h}:${m}:${s}`,
      "-i",
      `${srtFilePath}`,
      "-y",
      `F:/modifiedVtts/${title}.vtt`,
    ]);
    newProc.on("error", function (err) {
      console.log("ls error", err);
    });

    newProc.stdout.on("data", function (data) {
      console.log("stdout: " + data);
    });

    newProc.stderr.on("data", function (data) {
      console.log("stderr: " + data);
    });

    newProc.on("close", function (code) {
      console.log("child process exited with code " + code);
    });
  }
}

module.exports = Parser;
