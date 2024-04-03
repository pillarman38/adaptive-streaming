var vttParser = require('node-webvtt')
const fs = require("fs");

class Parser {
    parser(vttFilePath, seekTime) {
        const buffer = fs.readFileSync(vttFilePath);
        const fileContent = buffer.toString()
        const parser = vttParser.parse(fileContent);
        const timeCorrection = parser.cues.filter(line => {
            if(line.start > seekTime) {
                line.start -= seekTime
                line.end -= seekTime
                return line
            }
        })
        return timeCorrection
    } 
}

module.exports = Parser