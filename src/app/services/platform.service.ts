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
      // Detect Zidoo devices
      if (this.isZidoo()) {
        return 'zidoo';
      }
      // For now, assume other Android devices are Nvidia Shield
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

  isZidoo(): boolean {
    if (!this.isAndroid()) {
      return false;
    }

    // Zidoo devices typically have specific manufacturer/model identifiers
    // Check user agent and device info
    const userAgent = navigator.userAgent.toLowerCase();
    const fullUserAgent = navigator.userAgent;
    console.log('[PlatformService] Checking for Zidoo device...');
    console.log('[PlatformService] User Agent:', fullUserAgent);
    console.log('[PlatformService] User Agent (lowercase):', userAgent);

    // Common Zidoo identifiers
    const hasZidoo = userAgent.includes('zidoo');
    const hasZ9x = userAgent.includes('z9x');
    const hasZ10 = userAgent.includes('z10');
    const hasZ20 = userAgent.includes('z20');
    if (hasZidoo || hasZ9x || hasZ10 || hasZ20) {
      console.log('[PlatformService] Zidoo device detected via user agent');
      return true;
    }

    // Check device model via Capacitor if available
    // Note: This requires accessing native device info
    // For now, we'll rely on user agent and add a manual check option
    console.log('[PlatformService] Not a Zidoo device');
    return false;
  }
}

