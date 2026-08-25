import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

const COMPACT_MEDIA_QUERY = '(max-width: 1024px)';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  private readonly compactSubject = new BehaviorSubject<boolean>(this.readCompact());
  readonly compact$: Observable<boolean> = this.compactSubject.asObservable();
  private mediaQueryList: MediaQueryList | null = null;
  private mediaListener?: (event: MediaQueryListEvent) => void;

  constructor(private ngZone: NgZone) {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mediaQueryList = window.matchMedia(COMPACT_MEDIA_QUERY);
      this.mediaListener = (event: MediaQueryListEvent) => {
        this.ngZone.run(() => this.compactSubject.next(event.matches));
      };
      if (this.mediaQueryList.addEventListener) {
        this.mediaQueryList.addEventListener('change', this.mediaListener);
      } else {
        this.mediaQueryList.addListener(this.mediaListener);
      }
    }
  }

  get isCompactLayout(): boolean {
    return this.compactSubject.value;
  }

  private readCompact(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return window.matchMedia(COMPACT_MEDIA_QUERY).matches;
  }
}
