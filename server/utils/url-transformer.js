const fs = require('fs');
const path = require('path');

let serverConfig = null;
let configLoaded = false;

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
      console.warn('server-config.json not found, using pixable.local as default');
      serverConfig = { serverIp: null, serverPort: '5012' };
    }
  } catch (error) {
    console.error('Error loading server-config.json:', error);
    serverConfig = { serverIp: null, serverPort: '5012' };
  }
  
  configLoaded = true;
}

/**
 * Transform a URL containing pixable.local to use the IP from config
 * @param {string} url - The URL to transform
 * @returns {string} - The transformed URL
 */
function transformUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  // Load config if not already loaded
  if (!configLoaded) {
    loadConfig();
  }

  // If we have a server IP and the URL contains pixable.local, replace it
  if (serverConfig && serverConfig.serverIp && url.includes('pixable.local')) {
    return url.replace(/pixable\.local/g, serverConfig.serverIp);
  }

  return url;
}

/**
 * Get the base URL (IP or pixable.local)
 * @returns {string} - The base URL
 */
function getBaseUrl() {
  if (!configLoaded) {
    loadConfig();
  }

  if (serverConfig && serverConfig.serverIp) {
    return `http://${serverConfig.serverIp}:${serverConfig.serverPort || '5012'}`;
  }

  return `http://pixable.local:${serverConfig?.serverPort || '5012'}`;
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

module.exports = {
  transformUrl,
  getBaseUrl,
  getConfig,
  loadConfig
};

