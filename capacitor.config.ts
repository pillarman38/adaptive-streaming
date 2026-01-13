import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.adaptivestreaming.app',
  appName: 'Adaptive Streaming',
  webDir: 'dist',
  server: {
    // Use HTTP for localhost to avoid mixed content issues
    // This allows HTTP requests to work without mixed content blocking
    androidScheme: 'http'
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  // Android Studio path for Linux
  linuxAndroidStudioPath: '/opt/android-studio-2025.2.2/android-studio/bin/studio.sh'
};

export default config;
