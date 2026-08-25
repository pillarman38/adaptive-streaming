/**
 * Shared ffprobe metadata helpers for library scans.
 */
const { sourceHasDolbyVision } = require("./plex-stream-server");

function getFirstVideoStream(probe) {
  const streams = probe?.streams || [];
  return streams.find((s) => s.codec_type === "video") || null;
}

function getFirstAudioStream(probe) {
  const streams = probe?.streams || [];
  return streams.find((s) => s.codec_type === "audio") || null;
}

function getVideoResolution(probe) {
  const video = getFirstVideoStream(probe);
  if (!video?.coded_width || !video?.coded_height) {
    return "";
  }
  return `${video.coded_width}x${video.coded_height}`;
}

function detectDolbyVision(probe) {
  return detectDolbyVisionDetails(probe).isDv;
}

/**
 * DV Profile 7 with el_present_flag = FEL (base + enhancement layer).
 * Must use bitstream passthrough (local MKV or HTTP range) — never HLS/remux.
 */
function detectDolbyVisionDetails(probe) {
  const video = getFirstVideoStream(probe);
  if (!video) {
    return {
      isDv: false,
      profile: null,
      elPresent: false,
      blPresent: false,
      isProfile7Fel: false,
    };
  }

  let profile = video.dv_profile != null ? Number(video.dv_profile) : null;
  let elPresent = false;
  let blPresent = false;

  for (const sd of video.side_data_list || []) {
    const type = String(sd.side_data_type || "").toLowerCase();
    if (!type.includes("dovi")) {
      continue;
    }
    if (sd.dv_profile != null) {
      profile = Number(sd.dv_profile);
    }
    if (sd.el_present_flag != null) {
      elPresent = sd.el_present_flag === 1 || sd.el_present_flag === true;
    }
    if (sd.bl_present_flag != null) {
      blPresent = sd.bl_present_flag === 1 || sd.bl_present_flag === true;
    }
  }

  const tag = String(video.codec_tag_string || "").toLowerCase();
  if (tag.includes("dvhe.07") || tag.includes("dvh1.07") || tag.includes(".07")) {
    profile = 7;
  }

  const hevcVideoStreams = (probe?.streams || []).filter(
    (s) => s.codec_type === "video" && String(s.codec_name || "").toLowerCase() === "hevc"
  );
  if (hevcVideoStreams.length > 1) {
    elPresent = true;
  }

  const isDv =
    sourceHasDolbyVision(probe) ||
    profile != null ||
    detectDolbyVisionFromTags(video);
  const isProfile7Fel = profile === 7 && elPresent;

  return { isDv, profile, elPresent, blPresent, isProfile7Fel };
}

function detectDolbyVisionFromTags(video) {
  if (video.dv_profile != null && video.dv_profile !== 0) {
    return true;
  }
  if (video.codec_tag_string) {
    const codecTag = String(video.codec_tag_string).toLowerCase();
    if (
      codecTag.includes("dvhe") ||
      codecTag.includes("dvh1") ||
      codecTag.includes("dovi")
    ) {
      return true;
    }
  }
  if (video.tags) {
    const tagKeys = Object.keys(video.tags).map((k) => k.toLowerCase());
    const tagValues = Object.values(video.tags).map((v) =>
      String(v).toLowerCase()
    );
    if (
      tagKeys.some((k) => k.includes("dovi") || k.includes("dolby")) ||
      tagValues.some((v) => v.includes("dovi") || v.includes("dolby"))
    ) {
      return true;
    }
  }
  if (video.profile) {
    const profile = String(video.profile).toLowerCase();
    if (
      profile.includes("dvhe") ||
      profile.includes("dvh1") ||
      profile.includes("dovi")
    ) {
      return true;
    }
  }
  return false;
}

function getAudioInfo(probe) {
  const audio = getFirstAudioStream(probe);
  if (!audio) {
    return { codecName: "", channels: 0 };
  }
  return {
    codecName: audio.codec_name || "",
    channels: audio.channels > 0 ? audio.channels : 0,
  };
}

module.exports = {
  getFirstVideoStream,
  getFirstAudioStream,
  getVideoResolution,
  detectDolbyVision,
  detectDolbyVisionDetails,
  getAudioInfo,
};
