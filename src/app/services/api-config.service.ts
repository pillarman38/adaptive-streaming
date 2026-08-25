import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PlatformService } from './platform.service';
import { firstValueFrom } from 'rxjs';

interface ServerConfig {
  serverIp: string;
  serverPort?: string;
  kodiWsHost?: string;
  kodiWsPort?: string | number;
  kodiBoxIp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  // This will be set from config file
  private serverHost: string = '10.0.0.15';
  private serverPort: string = '5012';
  private serverIp: string | null = null;
  private kodiWsHost: string = '127.0.0.1';
  private kodiBoxIp: string | null = null;
  private kodiWsPort: number = 9090;
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
      let config: ServerConfig | null = null;
      
      // Try loading from bundled assets first (this works without network)
      try {
        config = await firstValueFrom(
          this.http.get<ServerConfig>('/assets/server-config.json')
        );
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
          const baseUrl = `http://${this.serverHost}:${this.serverPort}`;
          config = await firstValueFrom(
            this.http.get<ServerConfig>(`${baseUrl}/api/mov/server-config`)
          );
        } catch (apiError) {
          // API fallback unavailable until config is reachable
        }
      }
      
      if (config && config.serverIp) {
        this.serverIp = config.serverIp;
        if (config.serverPort) {
          this.serverPort = config.serverPort;
        }
        if (config.kodiWsPort) {
          this.kodiWsPort = Number(config.kodiWsPort);
        }
        if (config.kodiBoxIp) {
          this.kodiBoxIp = config.kodiBoxIp;
        }
        this.kodiWsHost = this.resolveKodiWsHost(config);
        this.enableKodiPlaybackTarget();
        // console.log('[ApiConfig] Loaded server IP from config:', this.serverIp);
        // console.log('[ApiConfig] Base URL will be:', this.getBaseUrl());
      } else {
        // console.warn('[ApiConfig] No server IP found in config, will use pixable.local (may not work on Android TV)');
        // console.warn('[ApiConfig] Config object:', config);
      }

      this.applyPageHostForWeb();
    } catch (error) {
      // console.error('[ApiConfig] Error loading server config:', error);
    }
    this.configLoaded = true;
  }

  async ensureConfigLoaded(): Promise<void> {
    if (!this.configLoaded) {
// console.log("LOADING CONFIG");
      await this.loadConfig();
}
    // console.log("CONFIG LOADED");
  }

  getBaseUrl(): string {
    // If we have a server IP, use it; otherwise fall back to serverHost
    const baseUrl = this.serverIp 
      ? `http://${this.serverIp}:${this.serverPort}`
      : `http://${this.serverHost}:${this.serverPort}`;
// console.log(`[ApiConfig] getBaseUrl() called - serverIp: ${this.serverIp}, returning: ${baseUrl}`);
    return baseUrl;
  }

  /**
   * When the web UI is opened from the server's own URL (e.g. http://10.0.0.15:5012),
   * use that host for API calls. Bundled assets may have a stale LAN IP.
   */
  private applyPageHostForWeb(): void {
    if (this.platformService.isNative()) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const pageHost = window.location.hostname;
    if (!pageHost || pageHost === 'localhost' || pageHost === '127.0.0.1') {
      return;
    }
    this.serverIp = pageHost;
  }

  private forceKodiRemote = false;

  /**
   * Web clients (desktop + iPhone Safari) with a configured CoreELEC box → play on
   * the box via JSON-RPC. Skips native Android (ExoPlayer/Ugoos).
   */
  enableKodiPlaybackTarget(): boolean {
    if (typeof window === 'undefined' || !this.kodiBoxIp) {
      return false;
    }
    if (this.platformService.isAndroid()) {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('platform') === 'web' || params.get('platform') === 'chrome') {
      return false;
    }
    const pageHost = window.location.hostname;
    this.forceKodiRemote = true;
    try {
      sessionStorage.setItem('platform', 'kodi');
      sessionStorage.setItem(
        'kodiHost',
        pageHost === this.kodiBoxIp ? '127.0.0.1' : this.kodiBoxIp
      );
    } catch {
      /* private mode / blocked storage — in-memory flag still applies */
    }
    return true;
  }

  /** True when this browser should drive CoreELEC via JSON-RPC (not local HTML5). */
  isKodiRemotePlayback(): boolean {
    if (this.forceKodiRemote) {
      return true;
    }
    return this.platformService.isKodi();
  }

  transformUrl(url: string): string {
    if (!url) {
      return '';
    }

    // Legacy URLs in the DB may still reference the old hostname.
    if (this.serverIp && url.includes('pixable.local')) {
      const transformed = url.replace(/pixable\.local/g, this.serverIp);
      console.log(`[ApiConfig] Transformed: ${url} -> ${transformed}`);
      return transformed;
    }

    return url;
  }

  /** @deprecated Use transformUrl — kept for Kodi player call sites. */
  transformStreamUrl(url: string): string {
    return this.transformUrl(url);
  }

  // Check if config is loaded (synchronous check)
  isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  // Method to set IP programmatically (can be called from app initialization)
  setServerIp(ip: string) {
    this.serverIp = ip;
  }

  getKodiWsConfig(): { host: string; port: number } {
    const host = this.resolveKodiWsHost();
    return { host, port: this.kodiWsPort };
  }

  /** Hosts to try in order when opening the Kodi JSON-RPC WebSocket. */
  getKodiWsHostCandidates(): string[] {
    const pageHost =
      typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalDev =
      pageHost === 'localhost' || pageHost === '127.0.0.1';

    if (this.isKodiRemotePlayback()) {
      const fromUrl = this.platformService.getKodiHost();
      const boxIp = this.kodiBoxIp;
      const candidates: string[] = [];

      // Angular dev on PC: stale kodiHost=127.0.0.1 must target the box IP.
      if (
        isLocalDev &&
        fromUrl &&
        (fromUrl === '127.0.0.1' || fromUrl === 'localhost') &&
        boxIp
      ) {
        candidates.push(boxIp);
      } else if (fromUrl) {
        candidates.push(fromUrl);
      } else if (boxIp) {
        // iPhone / remote browser: JSON-RPC is on the CoreELEC box LAN IP.
        candidates.push(boxIp);
      } else {
        candidates.push('127.0.0.1');
      }

      if (boxIp && !candidates.includes(boxIp)) {
        candidates.push(boxIp);
      }
      if (!candidates.includes('127.0.0.1')) {
        candidates.push('127.0.0.1');
      }

      return [...new Set(candidates.filter(Boolean))];
    }

    const primary = this.resolveKodiWsHost();
    const candidates = [primary];
    const boxIp = this.kodiBoxIp;
    if (boxIp && boxIp !== primary) {
      candidates.push(boxIp);
    }
    return [...new Set(candidates.filter(Boolean))];
  }

  getKodiBoxIp(): string | null {
    return this.kodiBoxIp;
  }

  /** Kodi JSON-RPC target: URL kodiHost → server-config kodiBoxIp → kodiWsHost (127.0.0.1 on-box only). */
  private resolveKodiWsHost(config?: ServerConfig): string {
    const pageHost =
      typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalDev =
      pageHost === 'localhost' || pageHost === '127.0.0.1';
    const boxIp = this.kodiBoxIp || config?.kodiBoxIp;

    if (this.isKodiRemotePlayback()) {
      const fromUrl = this.platformService.getKodiHost();
      if (fromUrl) {
        // Angular dev on PC: stale session kodiHost=127.0.0.1 must not override box IP.
        if (
          isLocalDev &&
          (fromUrl === '127.0.0.1' || fromUrl === 'localhost') &&
          boxIp
        ) {
          return boxIp;
        }
        return fromUrl;
      }
      return boxIp || '127.0.0.1';
    }
    if (boxIp) {
      return boxIp;
    }
    if (config?.kodiWsHost) {
      return config.kodiWsHost;
    }
    return this.kodiWsHost;
  }

  /** In-memory preference: TrueHD/Atmos titles play the Dolby unfold intro (default on). */
  private atmosIntroEnabled = true;

  isAtmosIntroEnabled(): boolean {
    return this.atmosIntroEnabled;
  }

  setAtmosIntroEnabled(enabled: boolean): void {
    this.atmosIntroEnabled = !!enabled;
  }
}

