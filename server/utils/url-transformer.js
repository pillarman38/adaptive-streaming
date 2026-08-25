const fs = require('fs');
const path = require('path');

let serverConfig = null;
let configLoaded = false;

/** DB columns / JSON fields that hold app-served HTTP paths (not local file paths). */
const SERVER_URL_FIELDS = [
  'posterUrl',
  'coverArt',
  'movieCard',
  'trailerUrl',
  'srtUrl',
  'backdropPhotoUrl',
  'photoUrl',
  'posterPhotoUrl',
  'tvCard',
  'location',
];

/**
 * Load server config from repo root
 */
function loadConfig() {
  if (configLoaded) {
    return;
  }

  try {
    const configPath = path.join(__dirname, '../../server-config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      serverConfig = JSON.parse(configData);
      console.log('Loaded server config:', serverConfig);
    } else {
      console.warn('server-config.json not found, using 10.0.0.15 as default');
      serverConfig = { serverIp: null, serverPort: '5012' };
    }
  } catch (error) {
    console.error('Error loading server-config.json:', error);
    serverConfig = { serverIp: null, serverPort: '5012' };
  }

  configLoaded = true;
}

/**
 * Normalize a stored or generated path to a leading-slash endpoint.
 */
function normalizeEndpoint(value) {
  if (!value || typeof value !== 'string') {
    return value;
  }
  let path = value.trim();
  if (/^https?:\/\//i.test(path)) {
    const match = path.match(/^https?:\/\/[^/]+(\/.*)?$/i);
    path = match && match[1] ? match[1] : '/';
  }
  try {
    if (path.includes('%')) {
      const qIndex = path.indexOf('?');
      if (qIndex === -1) {
        path = decodeURIComponent(path);
      } else {
        let pathOnly = path.slice(0, qIndex);
        const query = path.slice(qIndex + 1);
        if (pathOnly.includes('%')) {
          pathOnly = decodeURIComponent(pathOnly);
        }
        path = `${pathOnly}?${query}`;
      }
    }
  } catch (_) {
    /* keep path as-is if not valid URI encoding */
  }
  if (path.startsWith('//')) {
    return path;
  }
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * True when value is an HTTP(S) URL or a path served by this app.
 * Windows drive paths (G:/...) and bare filesystem paths are excluded.
 */
function isServerServedPath(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  if (/^[A-Za-z]:[/\\]/.test(value)) {
    return false;
  }
  if (/^https?:\/\//i.test(value)) {
    return true;
  }
  const normalized = normalizeEndpoint(value);
  return normalized.startsWith('/') && !normalized.startsWith('//');
}

/**
 * Strip scheme/host/port; store only the path (e.g. /MovieCards/foo.jpg).
 */
function toEndpoint(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  if (!isServerServedPath(url)) {
    return url;
  }
  return normalizeEndpoint(url);
}

/**
 * Build a full URL from a stored endpoint using server-config.json.
 */
function toPublicUrl(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') {
    return endpoint;
  }
  if (!isServerServedPath(endpoint)) {
    return endpoint;
  }
  if (!configLoaded) {
    loadConfig();
  }
  const base = getBaseUrl();
  const pathPart = normalizeEndpoint(endpoint);
  return `${base}${pathPart}`;
}

/**
 * Encode each path segment; preserves http://host:port when present.
 */
function encodeUrlPath(url) {
  if (!url) {
    return url;
  }
  if (url.includes('://')) {
    const urlMatch = url.match(/^([^:]+:\/\/[^/]+)(\/.*)?$/);
    if (urlMatch) {
      const protocolAndHost = urlMatch[1];
      const pathPart = urlMatch[2] || '';
      if (!pathPart) {
        return protocolAndHost;
      }
      const pathSegments = pathPart.split('/').map((segment) => {
        if (!segment) {
          return '';
        }
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch (e) {
          return encodeURIComponent(segment);
        }
      });
      return protocolAndHost + pathSegments.join('/');
    }
    return encodeURI(url);
  }
  const pathPart = normalizeEndpoint(url);
  if (!pathPart.startsWith('/')) {
    return url;
  }
  const pathSegments = pathPart.split('/').map((segment) => {
    if (!segment) {
      return '';
    }
    try {
      return encodeURIComponent(decodeURIComponent(segment));
    } catch (e) {
      return encodeURIComponent(segment);
    }
  });
  return pathSegments.join('/');
}

/**
 * @deprecated Use toPublicUrl — kept for existing call sites during migration.
 */
function transformUrl(url) {
  return toPublicUrl(url);
}

/**
 * Get the base URL from server-config.json
 * @returns {string} - The base URL
 */
function getBaseUrl() {
  if (!configLoaded) {
    loadConfig();
  }

  if (serverConfig && serverConfig.serverIp) {
    return `http://${serverConfig.serverIp}:${serverConfig.serverPort || '5012'}`;
  }

  return `http://10.0.0.15:${serverConfig?.serverPort || '5012'}`;
}

/** Base URL for device HTTP playback (Kodi, Shield, etc.). */
function getStreamBaseUrl() {
  return getBaseUrl();
}

/**
 * Get the server config (for API endpoint)
 * @returns {object} - The server config
 */
function getConfig() {
  if (!configLoaded) {
    loadConfig();
  }
  return serverConfig;
}

/**
 * Normalize URL fields on a record before INSERT/UPDATE.
 */
function prepareRecordForStorage(record, fields = SERVER_URL_FIELDS) {
  if (!record || typeof record !== 'object') {
    return record;
  }
  for (const field of fields) {
    if (record[field]) {
      record[field] = toEndpoint(record[field]);
    }
  }
  return record;
}

/**
 * Expand stored endpoints to full URLs for API responses.
 */
function prepareRecordForResponse(record, fields = SERVER_URL_FIELDS) {
  if (!record || typeof record !== 'object') {
    return record;
  }
  for (const field of fields) {
    if (record[field]) {
      record[field] = toPublicUrl(record[field]);
    }
  }
  return record;
}

module.exports = {
  SERVER_URL_FIELDS,
  isServerServedPath,
  normalizeEndpoint,
  toEndpoint,
  toPublicUrl,
  encodeUrlPath,
  transformUrl,
  getBaseUrl,
  getStreamBaseUrl,
  getConfig,
  loadConfig,
  prepareRecordForStorage,
  prepareRecordForResponse,
};
