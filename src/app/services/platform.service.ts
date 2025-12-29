import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class PlatformService {
  isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  isIOS(): boolean {
    return Capacitor.getPlatform() === 'ios';
  }

  isWeb(): boolean {
    return Capacitor.getPlatform() === 'web';
  }

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  getDeviceName(): string {
    if (this.isAndroid()) {
      // For now, assume Android devices are Nvidia Shield
      // This can be enhanced later to detect actual device model
      return 'nvidia-shield';
    }
    if (this.isIOS()) {
      return 'ios';
    }
    // For web, detect browser
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      return 'safari';
    }
    if (userAgent.includes('chrome')) {
      return 'chrome';
    }
    return 'web';
  }
}

