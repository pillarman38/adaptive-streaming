import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PlatformService } from './platform.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  // This will be set from config file
  private serverHost: string = 'pixable.local';
  private serverPort: string = '5012';
  private serverIp: string | null = null;
  private configLoaded: boolean = false;

  constructor(
    private platformService: PlatformService,
    private http: HttpClient
  ) {
    // Start loading config immediately
    // this.loadConfig().catch(err => {
    //   console.warn('Error loading config:', err);
    //   this.configLoaded = true; // Mark as loaded even on error
    // });
  }

  public async loadConfig(): Promise<void> {
    // On Android, try to load IP from bundled config file first
    // The config file is in src/assets/server-config.json and gets bundled with the app
    try {
      let config: { serverIp: string; serverPort?: string } | null = null;
      
      // Try loading from bundled assets first (this works without network)
      try {
        config = await firstValueFrom(
          this.http.get<{ serverIp: string; serverPort?: string }>('/assets/server-config.json')
        );
        // console.log('[ApiConfig] Loaded server config from bundled assets:', config);
      } catch (assetsError: any) {
        // console.error('[ApiConfig] Could not load config from assets:', assetsError);
        // console.error('[ApiConfig] Error details:', {
        //   status: assetsError?.status,
        //   statusText: assetsError?.statusText,
        //   url: assetsError?.url,
        //   message: assetsError?.message
        // });
        
        // Don't use hardcoded fallback - need to find why assets aren't loading
        // The issue is that server-config.json is not being copied to Android assets
        // This needs to be fixed by rebuilding the Angular app and syncing with Capacitor
        
        // Fallback: Try API endpoint (this will work if pixable.local resolves)
        try {
          const baseUrl = `http://pixable.local:${this.serverPort}`;
          config = await firstValueFrom(
            this.http.get<{ serverIp: string; serverPort?: string }>(`${baseUrl}/api/mov/server-config`)
          );
          // console.log('[ApiConfig] Loaded server config from API endpoint:', config);
        } catch (apiError) {
          // console.warn('[ApiConfig] Could not load server config from API endpoint, will try pixable.local (may not work on Android TV):', apiError);
        }
      }
      
      if (config && config.serverIp) {
        this.serverIp = config.serverIp;
        if (config.serverPort) {
          this.serverPort = config.serverPort;
        }
        // console.log('[ApiConfig] Loaded server IP from config:', this.serverIp);
        // console.log('[ApiConfig] Base URL will be:', this.getBaseUrl());
      } else {
        // console.warn('[ApiConfig] No server IP found in config, will use pixable.local (may not work on Android TV)');
        // console.warn('[ApiConfig] Config object:', config);
      }
    } catch (error) {
      // console.error('[ApiConfig] Error loading server config:', error);
    }
    this.configLoaded = true;
  }

  async ensureConfigLoaded(): Promise<void> {
    if (!this.configLoaded) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-config.service.ts:81',message:'Starting config load',data:{isAndroid:this.platformService?.isAndroid(),isWeb:this.platformService?.isWeb()},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // console.log("LOADING CONFIG");
      await this.loadConfig();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-config.service.ts:85',message:'Config load completed',data:{configLoaded:this.configLoaded,serverIp:this.serverIp,serverHost:this.serverHost,serverPort:this.serverPort},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
    // console.log("CONFIG LOADED");
  }

  getBaseUrl(): string {
    // If we have a server IP, use it; otherwise fall back to serverHost
    const baseUrl = this.serverIp 
      ? `http://${this.serverIp}:${this.serverPort}`
      : `http://${this.serverHost}:${this.serverPort}`;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-config.service.ts:89',message:'getBaseUrl called',data:{serverIp:this.serverIp,serverHost:this.serverHost,serverPort:this.serverPort,baseUrl,configLoaded:this.configLoaded},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // console.log(`[ApiConfig] getBaseUrl() called - serverIp: ${this.serverIp}, returning: ${baseUrl}`);
    return baseUrl;
  }

  transformUrl(url: string): string {
    if (!url) {
      return '';
    }

    // Replace pixable.local with IP if available (works on all platforms)
    // If config hasn't loaded yet, the serverIp will be null and we'll keep pixable.local
    // console.log(`[ApiConfig] transformUrl called with: ${url}, serverIp: ${this.serverIp}`);
    if (this.serverIp && url.includes('pixable.local')) {
      const transformed = url.replace(/pixable\.local/g, this.serverIp);
      console.log(`[ApiConfig] Transformed: ${url} -> ${transformed}`);
      return transformed;
    }
    
    if (url.includes('pixable.local') && !this.serverIp) {
      // console.warn(`[ApiConfig] Cannot transform URL - serverIp is null! URL: ${url}`);
    }

    return url;
  }

  // Check if config is loaded (synchronous check)
  isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  // Method to set IP programmatically (can be called from app initialization)
  setServerIp(ip: string) {
    this.serverIp = ip;
  }
}

