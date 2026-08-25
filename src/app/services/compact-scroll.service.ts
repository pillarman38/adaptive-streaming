import { Injectable } from "@angular/core";
import { LayoutService } from "./layout.service";
import { PlatformService } from "./platform.service";

@Injectable({
  providedIn: "root",
})
export class CompactScrollService {
  private topTapInitialized = false;

  constructor(
    private layout: LayoutService,
    private platform: PlatformService
  ) {}

  usesDocumentScroll(): boolean {
    return this.layout.isCompactLayout && this.platform.isIOSLike();
  }

  syncDocumentScrollClass(): void {
    const enabled = this.usesDocumentScroll();
    document.documentElement.classList.toggle("compact-ios-scroll", enabled);
    document.body.classList.toggle("compact-ios-scroll", enabled);
  }

  getScrollMetrics(scrollContainer: HTMLElement | null): {
    scrollTop: number;
    clientHeight: number;
    scrollHeight: number;
  } {
    if (this.usesDocumentScroll()) {
      return {
        scrollTop: window.scrollY || document.documentElement.scrollTop || 0,
        clientHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
      };
    }

    return {
      scrollTop: scrollContainer?.scrollTop ?? 0,
      clientHeight: scrollContainer?.offsetHeight ?? 0,
      scrollHeight: scrollContainer?.scrollHeight ?? 0,
    };
  }

  scrollToTop(scrollContainer: HTMLElement | null): void {
    if (this.usesDocumentScroll()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    scrollContainer?.scrollTo({ top: 0, behavior: "smooth" });
  }

  bindScroll(
    scrollContainer: HTMLElement | null,
    handler: () => void
  ): () => void {
    const target: HTMLElement | Window | null = this.usesDocumentScroll()
      ? window
      : scrollContainer;
    if (!target) {
      return () => undefined;
    }

    const listener = () => handler();
    target.addEventListener("scroll", listener, { passive: true });
    return () => target.removeEventListener("scroll", listener);
  }

  initTopTapToScroll(): void {
    if (this.topTapInitialized || typeof document === "undefined") {
      return;
    }
    this.topTapInitialized = true;

    document.addEventListener("click", (event) => {
      if (!this.usesDocumentScroll()) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest("input, textarea, button, select, a, label")) {
        return;
      }

      const topChrome = target.closest(".compact-page-header, .compact-search-area");
      if (!topChrome) {
        return;
      }

      const page = topChrome.closest(".compact-scroll-page") as HTMLElement | null;
      this.scrollToTop(page);
    });
  }
}
