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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'platform.service.ts:48',message:'isZidoo called',data:{isAndroid:this.isAndroid()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (!this.isAndroid()) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'platform.service.ts:52',message:'Not Android - returning false',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return false;
    }
    
    // Zidoo devices typically have specific manufacturer/model identifiers
    // Check user agent and device info
    const userAgent = navigator.userAgent.toLowerCase();
    const fullUserAgent = navigator.userAgent;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'platform.service.ts:60',message:'Checking user agent for Zidoo',data:{userAgent:fullUserAgent,userAgentLower:userAgent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    console.log('[PlatformService] Checking for Zidoo device...');
    console.log('[PlatformService] User Agent:', fullUserAgent);
    console.log('[PlatformService] User Agent (lowercase):', userAgent);
    
    // Common Zidoo identifiers
    const hasZidoo = userAgent.includes('zidoo');
    const hasZ9x = userAgent.includes('z9x');
    const hasZ10 = userAgent.includes('z10');
    const hasZ20 = userAgent.includes('z20');
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'platform.service.ts:70',message:'Zidoo detection check results',data:{hasZidoo,hasZ9x,hasZ10,hasZ20,result:hasZidoo||hasZ9x||hasZ10||hasZ20},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (hasZidoo || hasZ9x || hasZ10 || hasZ20) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'platform.service.ts:75',message:'Zidoo device detected',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.log('[PlatformService] Zidoo device detected via user agent');
      return true;
    }
    
    // Check device model via Capacitor if available
    // Note: This requires accessing native device info
    // For now, we'll rely on user agent and add a manual check option
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'platform.service.ts:85',message:'Not a Zidoo device',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('[PlatformService] Not a Zidoo device');
    return false;
  }
}

