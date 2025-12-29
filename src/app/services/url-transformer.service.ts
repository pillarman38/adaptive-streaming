import { Injectable } from '@angular/core';
import { PlatformService } from './platform.service';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class UrlTransformerService {
  constructor(
    private platformService: PlatformService,
    private apiConfig: ApiConfigService
  ) {}

  transformUrl(url: string | undefined | null): string {
    if (!url) {
      return '';
    }

    // Use the API config service to transform URLs
    return this.apiConfig.transformUrl(url);
  }
}

