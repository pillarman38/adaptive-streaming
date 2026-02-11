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
    
    // #region agent log
    if (req.url.includes('movies') || req.url.includes('scanLibrary')) {
      fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-url.interceptor.ts:12',message:'Interceptor handling request',data:{originalUrl:req.url,hasPixableLocal:req.url.includes('pixable.local')},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    }
    // #endregion
    
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
            // #region agent log
            if (req.url.includes('movies') || req.url.includes('scanLibrary')) {
              fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-url.interceptor.ts:33',message:'URL transformed in interceptor',data:{originalUrl:req.url,transformedUrl,serverIp:this.apiConfig['serverIp']},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            }
            // #endregion
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
    // #region agent log
    if (req.url.includes('scanLibrary')) {
      fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-url.interceptor.ts:50',message:'No transformation needed, passing through',data:{url:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
    }
    // #endregion
    return next.handle(req);
  }
}

