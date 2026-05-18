const fs = require("fs");
const path = require("path");

const cueIndexCache = new Map();

function readSizeVint(buf, offset) {
  if (offset >= buf.length) return null;
  const first = buf[offset];
  let length = 1;
  let mask = 0x80;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length++;
  }
  if (length > 8) return null;
  let value = first & (mask - 1);
  for (let i = 1; i < length; i++) {
    if (offset + i >= buf.length) return null;
    value = (value << 8) | buf[offset + i];
  }
  return { value, length };
}

function readUIntBE(buf, offset, size) {
  let value = 0;
  for (let i = 0; i < size; i++) {
    value = (value << 8) | buf[offset + i];
  }
  return value;
}

function findBytes(buf, pattern, start = 0) {
  outer: for (let i = start; i <= buf.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (buf[i + j] !== pattern[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function parseHeaderInfo(filePath) {
  const fd = fs.openSync(filePath, "r");
  const headerSize = 1024 * 1024;
  const buf = Buffer.alloc(headerSize);
  fs.readSync(fd, buf, 0, headerSize, 0);
  fs.closeSync(fd);

  let timecodeScale = 1000000;
  let segmentOffset = 0;

  const segmentPos = findBytes(buf, Buffer.from([0x18, 0x53, 0x80, 0x67]));
  if (segmentPos >= 0) {
    const size = readSizeVint(buf, segmentPos + 4);
    if (size) {
      segmentOffset = segmentPos + 4 + size.length;
    }
  }

  const scalePos = findBytes(buf, Buffer.from([0x2a, 0xd7, 0xb1]));
  if (scalePos >= 0) {
    const size = readSizeVint(buf, scalePos + 3);
    if (size && scalePos + 3 + size.length + size.value <= buf.length) {
      const dataStart = scalePos + 3 + size.length;
      timecodeScale = readUIntBE(buf, dataStart, size.value) || 1000000;
    }
  }

  return { timecodeScale, segmentOffset };
}

function parseCuePointsInRange(buf, bufStartOffset, segmentOffset, timecodeScale, rangeStart, rangeEnd) {
  const cues = [];
  let searchAt = rangeStart;
  while (searchAt < rangeEnd) {
    const cuePointPos = findBytes(buf, Buffer.from([0xbb]), searchAt);
    if (cuePointPos < 0 || cuePointPos >= rangeEnd) break;

    const size = readSizeVint(buf, cuePointPos + 1);
    if (!size) break;
    const cueEnd = cuePointPos + 1 + size.length + Number(size.value);
    if (cueEnd > rangeEnd) break;

    let cueTime = null;
    let clusterPosition = null;
    let inner = cuePointPos + 1 + size.length;
    while (inner < cueEnd) {
      if (buf[inner] === 0xb3) {
        const fieldSize = readSizeVint(buf, inner + 1);
        if (fieldSize) {
          cueTime = readUIntBE(buf, inner + 1 + fieldSize.length, fieldSize.value);
          inner = inner + 1 + fieldSize.length + fieldSize.value;
          continue;
        }
      }
      if (buf[inner] === 0xf1) {
        const fieldSize = readSizeVint(buf, inner + 1);
        if (fieldSize) {
          clusterPosition = readUIntBE(buf, inner + 1 + fieldSize.length, fieldSize.value);
          inner = inner + 1 + fieldSize.length + fieldSize.value;
          continue;
        }
      }
      inner++;
    }

    if (cueTime != null && clusterPosition != null) {
      const timeMs = Math.floor((cueTime * timecodeScale) / 1000000);
      cues.push({ timeMs, position: segmentOffset + clusterPosition });
    }
    searchAt = cueEnd;
  }
  return cues;
}

function parseCuesFromTail(filePath, segmentOffset, timecodeScale) {
  const stat = fs.statSync(filePath);
  const tailSize = Math.min(32 * 1024 * 1024, stat.size);
  const tailStart = stat.size - tailSize;
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(tailSize);
  fs.readSync(fd, buf, 0, tailSize, tailStart);
  fs.closeSync(fd);

  const cuesPos = findBytes(buf, Buffer.from([0x1c, 0x53, 0xbb, 0x6b]));
  if (cuesPos < 0) {
    return [];
  }

  const cuesSize = readSizeVint(buf, cuesPos + 4);
  if (!cuesSize) {
    return [];
  }

  const cuesDataStart = cuesPos + 4 + cuesSize.length;
  const cuesDataEnd = cuesDataStart + Number(cuesSize.value);
  return parseCuePointsInRange(
    buf,
    tailStart,
    segmentOffset,
    timecodeScale,
    cuesDataStart,
    Math.min(cuesDataEnd, buf.length)
  );
}

function getMkvCueIndex(filePath) {
  const normalized = path.normalize(filePath);
  const cached = cueIndexCache.get(normalized);
  if (cached) {
    return cached;
  }

  const stat = fs.statSync(normalized);
  const { timecodeScale, segmentOffset } = parseHeaderInfo(normalized);
  const cues = parseCuesFromTail(normalized, segmentOffset, timecodeScale);

  const index = {
    contentLength: stat.size,
    timecodeScale,
    segmentOffset,
    cues,
  };
  cueIndexCache.set(normalized, index);
  return index;
}

module.exports = { getMkvCueIndex };
