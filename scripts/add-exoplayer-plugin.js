const fs = require('fs');
const path = require('path');

const pluginsJsonPath = path.join(__dirname, '../android/app/src/main/assets/capacitor.plugins.json');

try {
  const pluginsJson = JSON.parse(fs.readFileSync(pluginsJsonPath, 'utf8'));
  
  // Check if ExoPlayer plugin is already in the list
  const hasExoPlayer = pluginsJson.some(plugin => plugin.classpath === 'com.adaptivestreaming.app.ExoPlayerPlugin');
  
  if (!hasExoPlayer) {
    pluginsJson.push({
      "pkg": "ExoPlayer",
      "classpath": "com.adaptivestreaming.app.ExoPlayerPlugin"
    });
    
    fs.writeFileSync(pluginsJsonPath, JSON.stringify(pluginsJson, null, '\t') + '\n');
    console.log('✅ Added ExoPlayer plugin to capacitor.plugins.json');
  } else {
    console.log('ℹ️  ExoPlayer plugin already in capacitor.plugins.json');
  }
} catch (error) {
  console.error('❌ Error adding ExoPlayer plugin:', error);
  process.exit(1);
}

