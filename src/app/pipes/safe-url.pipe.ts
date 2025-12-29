import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { UrlTransformerService } from '../services/url-transformer.service';

@Pipe({
  name: 'safeUrl'
})
export class SafeUrlPipe implements PipeTransform {
  constructor(
    private sanitizer: DomSanitizer,
    private urlTransformer: UrlTransformerService
  ) {}

  transform(url: string | undefined | null): SafeUrl | string {
    if (!url) {
      return '';
    }
    
    // Transform the URL (replace pixable.local with IP on Android)
    url = this.urlTransformer.transformUrl(url);
    
    // If it's already a full URL, use it as-is (Angular will sanitize it)
    // For Android, we need to ensure HTTP URLs work despite mixed content
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return this.sanitizer.bypassSecurityTrustUrl(url);
    }
    
    // If it's a relative path, return as-is
    return url;
  }
}

