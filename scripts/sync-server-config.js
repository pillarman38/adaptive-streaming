const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'server-config.json');
const target = path.join(root, 'src', 'assets', 'server-config.json');

if (!fs.existsSync(source)) {
  console.error('sync-server-config: missing server-config.json at repo root');
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log('Synced server-config.json -> src/assets/server-config.json');
