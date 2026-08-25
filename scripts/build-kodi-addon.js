const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'dist-kodi');
const serverConfigPath = path.join(root, 'server-config.json');
const webConfigPath = path.join(
  root,
  'kodi',
  'webinterface.adaptivestreaming',
  'http',
  'config.json'
);

const addons = [
  'plugin.program.adaptivestreaming',
  'webinterface.adaptivestreaming',
];

function syncWebConfig() {
  if (!fs.existsSync(serverConfigPath)) {
    console.warn('build-kodi-addon: no server-config.json — webinterface config.json unchanged');
    return;
  }
  const cfg = JSON.parse(fs.readFileSync(serverConfigPath, 'utf8'));
  const webCfg = {
    serverIp: cfg.serverIp || '10.0.0.15',
    serverPort: cfg.serverPort || '5012',
    kodiBoxIp: cfg.kodiBoxIp || '',
  };
  fs.mkdirSync(path.dirname(webConfigPath), { recursive: true });
  fs.writeFileSync(webConfigPath, JSON.stringify(webCfg, null, 2) + '\n');
  console.log('Synced server-config.json -> webinterface http/config.json');
}

function zipAddon(addonId) {
  const addonSource = path.join(root, 'kodi', addonId);
  const outZip = path.join(outDir, addonId + '.zip');

  if (!fs.existsSync(addonSource)) {
    console.error('build-kodi-addon: missing', addonSource);
    process.exit(1);
  }

  if (fs.existsSync(outZip)) {
    fs.unlinkSync(outZip);
  }

  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const psSource = addonSource.replace(/'/g, "''");
    const psDest = outZip.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${psSource}\\*' -DestinationPath '${psDest}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd "${path.dirname(addonSource)}" && zip -r "${outZip}" ${addonId}`, {
      stdio: 'inherit',
    });
  }

  console.log('Kodi add-on packaged ->', outZip);
}

fs.mkdirSync(outDir, { recursive: true });
syncWebConfig();
addons.forEach(zipAddon);
