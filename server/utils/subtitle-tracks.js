/**
 * Discover WebVTT sidecar files for a movie title (Shield / ExoPlayer picker).
 */
const fs = require("fs");
const path = require("path");
const urlTransformer = require("./url-transformer");

const DEFAULT_VTT_DIRS = [
  { dir: "E:/modifiedVtts", urlPrefix: "/modifiedVtts" },
  { dir: "G:/modifiedVtts", urlPrefix: "/modifiedVtts" },
  { dir: "G:/subtitles", urlPrefix: "/subtitles" },
  { dir: "I:/Subtitles", urlPrefix: "/Subtitles" },
];

/** Fallback when a path on another drive is missing */
const PATH_ALIASES = [
  { from: /^G:\/modifiedVtts\//i, to: "E:/modifiedVtts/" },
  { from: /^I:\/Subtitles\//i, to: "G:/subtitles/" },
  { from: /^I:\/subtitles\//i, to: "G:/subtitles/" },
];

function getVttDirs() {
  try {
    const configPath = path.join(__dirname, "../../server-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (Array.isArray(config.vttDirectories) && config.vttDirectories.length) {
        return config.vttDirectories;
      }
    }
  } catch {
    /* use defaults */
  }
  return DEFAULT_VTT_DIRS;
}

function normalizeKey(name) {
  return name
    .toLowerCase()
    .replace(/\.vtt$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function trackLabelFromFile(fileName, title) {
  const base = fileName.replace(/\.vtt$/i, "");
  if (base === title) {
    return "English (VTT)";
  }
  const suffix = base.slice(title.length).replace(/^[-_.\s]+/, "");
  return suffix ? `${suffix} (VTT)` : base;
}

function resolveServedAbsolutePath(absPath) {
  const normalized = absPath.replace(/\\/g, "/");
  if (fs.existsSync(normalized)) {
    return normalized;
  }
  for (const { from, to } of PATH_ALIASES) {
    if (from.test(normalized)) {
      const alt = normalized.replace(from, to);
      if (fs.existsSync(alt)) {
        return alt;
      }
    }
  }
  return null;
}

function urlPathForAbsolute(absPath, vttDirs) {
  const normalized = absPath.replace(/\\/g, "/");
  for (const { dir, urlPrefix } of vttDirs) {
    const root = dir.replace(/\\/g, "/").replace(/\/$/, "") + "/";
    if (normalized.toLowerCase().startsWith(root.toLowerCase())) {
      const rel = normalized.slice(root.length);
      const segments = rel.split("/").map((s) => encodeURIComponent(s));
      return `${urlPrefix}/${segments.join("/")}`;
    }
  }
  return null;
}

function buildCandidateAbsolutePaths(title, filePath, srtLocation, srtUrl) {
  const paths = new Set();
  const vttDirs = getVttDirs();

  if (filePath) {
    paths.add(filePath.replace(/\.[^.\\/]+$/i, ".vtt"));
  }

  for (const { dir } of vttDirs) {
    paths.add(path.join(dir, `${title}.vtt`));
    paths.add(path.join(dir, title, `${title}.vtt`));
  }

  if (srtLocation && typeof srtLocation === "string") {
    const loc = srtLocation.trim();
    if (/\.srt$/i.test(loc)) {
      paths.add(loc.replace(/\.srt$/i, ".vtt"));
    } else if (/\.vtt$/i.test(loc)) {
      paths.add(loc);
    } else if (!loc.includes("/") && !loc.includes("\\")) {
      for (const { dir } of vttDirs) {
        paths.add(path.join(dir, `${loc}.vtt`));
      }
    } else {
      paths.add(loc.endsWith(".vtt") ? loc : `${loc}.vtt`);
    }
  }

  if (srtUrl && urlTransformer.isServerServedPath(srtUrl)) {
    const endpoint = urlTransformer.normalizeEndpoint(srtUrl);
    for (const { dir, urlPrefix } of vttDirs) {
      if (endpoint.startsWith(`${urlPrefix}/`)) {
        const rel = endpoint.slice(urlPrefix.length + 1);
        try {
          paths.add(path.join(dir, decodeURIComponent(rel)));
        } catch {
          paths.add(path.join(dir, rel));
        }
      }
    }
  }

  return [...paths];
}

function keysMatch(fileKey, titleKey, fileBaseKey) {
  if (fileKey === titleKey || fileKey.startsWith(titleKey)) {
    return true;
  }
  if (fileBaseKey && (fileKey === fileBaseKey || fileKey.startsWith(fileBaseKey))) {
    return true;
  }
  return false;
}

function scanDirectory(dir, urlPrefix, title, titleKey, fileBaseKey, addTrack) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const exact = path.join(dir, `${title}.vtt`);
  const resolvedExact = resolveServedAbsolutePath(exact);
  if (resolvedExact) {
    const urlPath = urlPathForAbsolute(resolvedExact, getVttDirs());
    if (urlPath) {
      addTrack(path.basename(resolvedExact), urlPath);
    }
  }

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const dirKey = normalizeKey(entry.name);
      if (!keysMatch(dirKey, titleKey, fileBaseKey)) {
        continue;
      }
      let nested;
      try {
        nested = fs.readdirSync(fullPath);
      } catch {
        continue;
      }
      for (const file of nested) {
        if (!file.toLowerCase().endsWith(".vtt")) {
          continue;
        }
        const resolved = resolveServedAbsolutePath(path.join(fullPath, file));
        if (!resolved) {
          continue;
        }
        const relUrl = `${urlPrefix}/${encodeURIComponent(entry.name)}/${encodeURIComponent(file)}`;
        addTrack(file, relUrl);
      }
      continue;
    }

    if (!entry.name.toLowerCase().endsWith(".vtt")) {
      continue;
    }
    const fileKey = normalizeKey(entry.name);
    if (!keysMatch(fileKey, titleKey, fileBaseKey)) {
      continue;
    }
    const resolved = resolveServedAbsolutePath(fullPath);
    if (!resolved) {
      continue;
    }
    addTrack(entry.name, `${urlPrefix}/${encodeURIComponent(entry.name)}`);
  }
}

function listSubtitleTracksForTitle(title, filePath, srtLocation, srtUrl) {
  if (!title) {
    return [];
  }

  const titleKey = normalizeKey(title);
  const fileBaseKey = filePath
    ? normalizeKey(path.basename(filePath, path.extname(filePath)))
    : null;
  const vttDirs = getVttDirs();
  const seenUrls = new Set();
  const tracks = [];

  const addTrack = (fileName, urlPath) => {
    const publicUrl = urlTransformer.toPublicUrl(urlPath);
    if (seenUrls.has(publicUrl)) {
      return;
    }
    seenUrls.add(publicUrl);
    tracks.push({
      id: tracks.length,
      label: trackLabelFromFile(fileName, title),
      url: publicUrl,
      file: fileName,
    });
  };

  for (const candidate of buildCandidateAbsolutePaths(
    title,
    filePath,
    srtLocation,
    srtUrl
  )) {
    const resolved = resolveServedAbsolutePath(candidate);
    if (!resolved) {
      continue;
    }
    const urlPath = urlPathForAbsolute(resolved, vttDirs);
    if (urlPath) {
      addTrack(path.basename(resolved), urlPath);
    }
  }

  for (const { dir, urlPrefix } of vttDirs) {
    scanDirectory(dir, urlPrefix, title, titleKey, fileBaseKey, addTrack);
  }

  tracks.sort((a, b) => a.label.localeCompare(b.label));
  tracks.forEach((t, i) => {
    t.id = i;
  });

  return tracks;
}

module.exports = {
  listSubtitleTracksForTitle,
};
