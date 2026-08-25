import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class PlatformService {
  private readonly kodiMode: boolean;
  private readonly kodiHost: string | null;

  constructor() {
    const kodiParams = this.readKodiParams();
    this.kodiHost = kodiParams.host;
    this.kodiMode = kodiParams.enabled;
    if (this.kodiMode) {
      console.log('[PlatformService] Kodi / CoreELEC mode enabled', this.kodiHost ? `(JSON-RPC @ ${this.kodiHost})` : '');
    }
  }

  private readKodiParams(): { enabled: boolean; host: string | null } {
    if (typeof window === 'undefined') {
      return { enabled: false, host: null };
    }
    const params = new URLSearchParams(window.location.search);
    const hostParam = params.get('kodiHost');
    if (hostParam) {
      sessionStorage.setItem('kodiHost', hostParam);
    }

    if (params.get('platform') === 'kodi') {
      sessionStorage.setItem('platform', 'kodi');
    }

    return {
      enabled: sessionStorage.getItem('platform') === 'kodi',
      host: hostParam || sessionStorage.getItem('kodiHost'),
    };
  }

  isKodi(): boolean {
    if (typeof window === 'undefined') {
      return this.kodiMode;
    }
    return sessionStorage.getItem('platform') === 'kodi';
  }

  /** Kodi JSON-RPC host (box IP when browsing remotely, 127.0.0.1 on-box browser). */
  getKodiHost(): string | null {
    if (typeof window === 'undefined') {
      return this.kodiHost;
    }
    return sessionStorage.getItem('kodiHost') || this.kodiHost;
  }

  isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  isIOS(): boolean {
    return Capacitor.getPlatform() === 'ios';
  }

  isIOSLike(): boolean {
    if (this.isIOS()) {
      return true;
    }
    if (typeof navigator === 'undefined') {
      return false;
    }
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  isWeb(): boolean {
    return Capacitor.getPlatform() === 'web';
  }

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  getDeviceName(): string {
    if (this.isKodi()) {
      return 'coreelec';
    }
    if (this.isAndroid()) {
      if (this.isZidoo()) {
        return 'zidoo';
      }
      if (this.isUgoos()) {
        return 'ugoos';
      }
      // Default Android TV path (Nvidia Shield and similar)
      return 'nvidia-shield';
    }
    if (this.isIOS()) {
      return 'ios';
    }
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

    const userAgent = navigator.userAgent.toLowerCase();
    const fullUserAgent = navigator.userAgent;
    console.log('[PlatformService] Checking for Zidoo device...');
    console.log('[PlatformService] User Agent:', fullUserAgent);
    console.log('[PlatformService] User Agent (lowercase):', userAgent);

    const hasZidoo = userAgent.includes('zidoo');
    const hasZ9x = userAgent.includes('z9x');
    const hasZ10 = userAgent.includes('z10');
    const hasZ20 = userAgent.includes('z20');
    if (hasZidoo || hasZ9x || hasZ10 || hasZ20) {
      console.log('[PlatformService] Zidoo device detected via user agent');
      return true;
    }

    console.log('[PlatformService] Not a Zidoo device');
    return false;
  }

  isUgoos(): boolean {
    if (!this.isAndroid()) {
      return false;
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const fullUserAgent = navigator.userAgent;
    console.log('[PlatformService] Checking for Ugoos device...');
    console.log('[PlatformService] User Agent:', fullUserAgent);

    const hasUgoos = userAgent.includes('ugoos');
    const hasAm6 = userAgent.includes('am6');
    const hasAm6b = userAgent.includes('am6b');
    if (hasUgoos || hasAm6 || hasAm6b) {
      console.log('[PlatformService] Ugoos device detected via user agent');
      return true;
    }

    console.log('[PlatformService] Not a Ugoos device');
    return false;
  }
}
