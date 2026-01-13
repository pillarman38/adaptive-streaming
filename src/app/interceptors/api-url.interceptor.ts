import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ApiConfigService } from '../services/api-config.service';

@Injectable()
export class ApiUrlInterceptor implements HttpInterceptor {
  constructor(private apiConfig: ApiConfigService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    console.log(`[Interceptor] Intercepting request: ${req.url}`);
    
    // Skip transformation for config loading requests to avoid circular dependencies
    if (req.url.includes('/assets/server-config.json') || req.url.includes('/api/mov/server-config')) {
      console.log(`[Interceptor] Skipping transformation for config request: ${req.url}`);
      return next.handle(req);
    }

    // Transform URLs that contain pixable.local
    // Ensure config is loaded before transforming
    if (req.url && req.url.includes('pixable.local')) {
      console.log(`[Interceptor] Found pixable.local in URL, ensuring config loaded...`);
      return from(this.apiConfig.ensureConfigLoaded()).pipe(
        switchMap(() => {
          try {
            const transformedUrl = this.apiConfig.transformUrl(req.url);
            console.log(`[Interceptor] Transformed URL: ${req.url} -> ${transformedUrl}`);
            if (transformedUrl === req.url) {
              console.warn(`[Interceptor] URL was not transformed! serverIp might be null.`);
            }
            const clonedRequest = req.clone({
              url: transformedUrl
            });
            return next.handle(clonedRequest);
          } catch (error) {
            console.warn('Error transforming URL in interceptor:', error);
            // Fall through to original request
            return next.handle(req);
          }
        }),
        catchError((error) => {
          console.warn('Error ensuring config loaded in interceptor:', error);
          // Fall through to original request
          return next.handle(req);
        })
      );
    }

    console.log(`[Interceptor] No transformation needed for: ${req.url}`);
    return next.handle(req);
  }
}

