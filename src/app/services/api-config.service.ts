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
    this.loadConfig().catch(err => {
      console.warn('Error loading config:', err);
      this.configLoaded = true; // Mark as loaded even on error
    });
  }

  private async loadConfig(): Promise<void> {
    // On Android, try to load IP from bundled config file first
    // The config file is in src/assets/server-config.json and gets bundled with the app
    if (this.platformService.isAndroid()) {
      try {
        let config: { serverIp: string; serverPort?: string } | null = null;
        
        // Try loading from bundled assets first (this works without network)
        try {
          config = await firstValueFrom(
            this.http.get<{ serverIp: string; serverPort?: string }>('/assets/server-config.json')
          );
          console.log('Loaded server config from bundled assets');
        } catch (assetsError) {
          console.warn('Could not load config from assets, trying API endpoint:', assetsError);
          
          // Fallback: Try API endpoint (this will work if pixable.local resolves)
          try {
            const baseUrl = `http://pixable.local:${this.serverPort}`;
            config = await firstValueFrom(
              this.http.get<{ serverIp: string; serverPort?: string }>(`${baseUrl}/api/mov/server-config`)
            );
            console.log('Loaded server config from API endpoint');
          } catch (apiError) {
            console.warn('Could not load server config from API endpoint, will try pixable.local (may not work on Android TV):', apiError);
          }
        }
        
        if (config && config.serverIp) {
          this.serverIp = config.serverIp;
          if (config.serverPort) {
            this.serverPort = config.serverPort;
          }
          console.log('Loaded server IP from config:', this.serverIp);
          console.log('BASE URL:', this.getBaseUrl());
        } else {
          console.warn('No server IP found in config, will use pixable.local (may not work on Android TV)');
        }
      } catch (error) {
        console.warn('Error loading server config:', error);
      }
    }
    this.configLoaded = true;
  }

  async ensureConfigLoaded(): Promise<void> {
    if (!this.configLoaded) {
      await this.loadConfig();
    }
  }

  getBaseUrl(): string {
    if (this.platformService.isAndroid() && this.serverIp) {
      return `http://${this.serverIp}:${this.serverPort}`;
    }
    return `http://${this.serverHost}:${this.serverPort}`;
  }

  transformUrl(url: string): string {
    if (!url) {
      return '';
    }

    // On Android, replace pixable.local with IP if available
    // If config hasn't loaded yet, the serverIp will be null and we'll use pixable.local
    if (this.platformService.isAndroid() && this.serverIp) {
      url = url.replace(/pixable\.local/g, this.serverIp);
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

