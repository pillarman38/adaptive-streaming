import {
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren,
  HostListener,
  OnDestroy,
} from "@angular/core";
import { Router } from "@angular/router";
import { InfoStoreService } from "../info-store.service";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
import { HttpClient } from "@angular/common/http";
import { ApiConfigService } from "../services/api-config.service";

@Component({
  selector: "app-side-bar",
  templateUrl: "./side-bar.component.html",
  styleUrls: ["./side-bar.component.css"],
})
export class SideBarComponent implements OnInit, OnDestroy {
  isScanning = false;
  scanProgress = 0;
  scanTotal = 0;
  currentFile = "";
  demoScanProgress = 0;
  demoScanTotal = 0;
  demoCurrentFile = "";
  tvScanProgress = 0;
  tvScanTotal = 0;
  tvCurrentFile = "";
  private progressInterval: any = null;

  // smartTv: any;
  constructor(
    private router: Router,
    private infoStore: InfoStoreService, // private smarTvCompenent: SmartTvComponent
    private smartTv: SmartTvLibSingletonService,
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  @ViewChildren("homepageList") homepageList!: QueryList<ElementRef>;
  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    if (!this.smartTv.smartTv) {
      return;
    }

    const currentListName = this.smartTv.smartTv.currentListName;

    // Only call navigate() if we're on the sidebar
    // This prevents double navigation when on other lists (like movies)
    if (currentListName !== "sideBar") {
      return;
    }

    // Navigate within the sidebar
    const ind = this.smartTv.smartTv?.navigate(event);

    // Handle switching from sidebar to content list (when pressing right at right edge)
    if (
      ind?.borderReached === "right edge" &&
      ind.currentListName === "sideBar"
    ) {
      this.clearSidebarBorders();
      const targetList = this.getContentListForRoute();
      this.smartTv.smartTv?.switchList(targetList, 0);
      return;
    }

    if (ind?.currentIndex !== undefined) {
      this.updateBorderStyling(ind.currentIndex);
    }

    // console.log("THI IND SIDE BAAR: ", ind);

    // Handle Enter/Select button on remote
    // Android TV remotes may send "Enter", "NumpadEnter", or keyCode 13
    const isEnterKey = event.code === "Enter" || 
                       event.code === "NumpadEnter" || 
                       event.key === "Enter" ||
                       event.keyCode === 13;

    if (isEnterKey && ind?.currentListName === "sideBar") {
      const currentIndex = ind.currentIndex ?? 0;
      // console.log("Sidebar Enter pressed at index:", currentIndex);
      
      switch (currentIndex) {
        case 0:
          // Refresh/Scan Library button
          this.scanLibrary();
          break;
        case 1:
          // Video Selection
          this.router.navigateByUrl("/videoSelection");
          break;
        case 2:
          // Demo Videos
          this.router.navigateByUrl("/demoSelection");
          break;
        case 3:
          // TV
          this.router.navigateByUrl("/tv");
          break;
        default:
          // console.log("Unknown sidebar index:", currentIndex);
      }
    }
  }

  onHover(e: number) {
    this.updateBorderStyling(e);
    this.infoStore.onSideBarHover(e);
  }

  private getContentListForRoute(): string {
    const url = this.router.url;
    if (url.includes("demoSelection")) {
      return "demos";
    }
    if (url.includes("/tv") || url.includes("/seasons")) {
      return "tv";
    }
    return "movies";
  }

  private clearSidebarBorders(): void {
    this.homepageList?.forEach((box) => {
      box.nativeElement?.classList.remove("elementBorder");
    });
    this.smartTv.smartTv?.boxes?.forEach((box: any) => {
      box?.element?.nativeElement?.classList.remove("elementBorder");
    });
  }

  updateBorderStyling(currentIndex: number): void {
    if (currentIndex < 0) {
      return;
    }
    this.homepageList?.forEach((box, index) => {
      if (box.nativeElement) {
        if (index === currentIndex) {
          box.nativeElement.classList.add("elementBorder");
        } else {
          box.nativeElement.classList.remove("elementBorder");
        }
      }
    });
    this.smartTv.smartTv?.boxes?.forEach((box: any, index: number) => {
      if (box?.element?.nativeElement) {
        if (index === currentIndex) {
          box.element.nativeElement.classList.add("elementBorder");
        } else {
          box.element.nativeElement.classList.remove("elementBorder");
        }
      }
    });
  }

  navigateTo(url: string) {
    this.router.navigateByUrl(url);
  }

  isActive(path: string): boolean {
    return this.router.url.includes(path);
  }

  scanLibrary() {
    if (this.isScanning) {
      return; // Prevent multiple scans
    }

    this.isScanning = true;
    this.scanProgress = 0;
    this.scanTotal = 0;
    this.currentFile = "";
    this.demoScanProgress = 0;
    this.demoScanTotal = 0;
    this.demoCurrentFile = "";
    this.tvScanProgress = 0;
    this.tvScanTotal = 0;
    this.tvCurrentFile = "";

    const url = `${this.apiConfig.getBaseUrl()}/api/mov/scanLibrary`;
    console.log('Calling scanLibrary:', url);
    
    // Start the scan
    this.http.get(url).subscribe({
      next: (res: any) => {
        // console.log('Scan completed:', res);
      },
      error: (err) => {
        console.error('Scan error:', err);
        this.isScanning = false;
        this.stopProgressPolling();
      }
    });

    // Start polling for progress
    this.startProgressPolling();
  }

  startProgressPolling() {
    this.progressInterval = setInterval(() => {
      this.http.get(`${this.apiConfig.getBaseUrl()}/api/mov/scanProgress`).subscribe({
        next: (progress: any) => {
          // Handle movies progress
          if (progress.movies) {
            if (progress.movies.isScanning) {
              this.scanProgress = progress.movies.current || 0;
              this.scanTotal = progress.movies.total || 0;
              this.currentFile = progress.movies.currentFile || "";
            } else {
              this.scanProgress = progress.movies.total || 0;
              this.scanTotal = progress.movies.total || 0;
              this.currentFile = "";
            }
          }

          // Handle demo videos progress
          if (progress.demoVideos) {
            if (progress.demoVideos.isScanning) {
              this.demoScanProgress = progress.demoVideos.current || 0;
              this.demoScanTotal = progress.demoVideos.total || 0;
              this.demoCurrentFile = progress.demoVideos.currentFile || "";
            } else {
              this.demoScanProgress = progress.demoVideos.total || 0;
              this.demoScanTotal = progress.demoVideos.total || 0;
              this.demoCurrentFile = "";
            }
          }

          // Handle TV shows progress
          if (progress.tvShows) {
            if (progress.tvShows.isScanning) {
              this.tvScanProgress = progress.tvShows.current || 0;
              this.tvScanTotal = progress.tvShows.total || 0;
              this.tvCurrentFile = progress.tvShows.currentFile || "";
            } else {
              this.tvScanProgress = progress.tvShows.total || 0;
              this.tvScanTotal = progress.tvShows.total || 0;
              this.tvCurrentFile = "";
            }
          }

          // Check if all scans are complete
          const moviesScanning = progress.movies?.isScanning || false;
          const demoVideosScanning = progress.demoVideos?.isScanning || false;
          const tvShowsScanning = progress.tvShows?.isScanning || false;

          if (!moviesScanning && !demoVideosScanning && !tvShowsScanning) {
            // All scans completed
            this.isScanning = false;
            this.stopProgressPolling();
          }
        },
        error: (err) => {
          console.error('Progress polling error:', err);
        }
      });
    }, 500); // Poll every 500ms
  }

  stopProgressPolling() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  ngOnDestroy() {
    this.stopProgressPolling();
  }

  ngOnInit() {
    this.infoStore.catchSideBarHover().subscribe((index: number) => {
      if (this.smartTv.smartTv?.currentListName === "sideBar") {
        this.updateBorderStyling(index);
      }
    });

    setTimeout(() => {
      this.smartTv.smartTv?.addCurrentList({
        startingIndex: 0,
        listName: "sideBar",
        listElements: this.homepageList,
      });
    }, 1000);
  }
}
