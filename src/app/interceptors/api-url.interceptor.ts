import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from '../services/api-config.service';

@Injectable()
export class ApiUrlInterceptor implements HttpInterceptor {
  constructor(private apiConfig: ApiConfigService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Transform URLs that contain pixable.local
    // The config loads in the service constructor, so it should be available
    if (req.url && req.url.includes('pixable.local')) {
      try {
        const transformedUrl = this.apiConfig.transformUrl(req.url);
        const clonedRequest = req.clone({
          url: transformedUrl
        });
        return next.handle(clonedRequest);
      } catch (error) {
        console.warn('Error transforming URL in interceptor:', error);
        // Fall through to original request
      }
    }

    return next.handle(req);
  }
}

