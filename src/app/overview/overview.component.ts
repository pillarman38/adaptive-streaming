import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  ViewChildren,
  QueryList,
  Pipe,
  HostListener,
  PipeTransform,
  Renderer2,
  AfterViewInit,
  OnDestroy,
} from "@angular/core";
import { InfoStoreService, movieInfo } from "../info-store.service";
import { Router } from "@angular/router";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { SideBarComponent } from "../side-bar/side-bar.component";
import { HttpClient } from "@angular/common/http";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
import { ExoPlayerService } from "../services/exoplayer.service";
import { ApiConfigService } from "../services/api-config.service";
import { LayoutService } from "../services/layout.service";
import { PlatformService } from "../services/platform.service";

@Pipe({
  name: "safeHtml",
})
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: any): any {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}

@Component({
  selector: "app-overview",
  templateUrl: "./overview.component.html",
  styleUrls: ["./overview.component.css"],
})
export class OverviewComponent implements OnInit, AfterViewInit, OnDestroy {
  plot: string = "";
  idx: any;
  cast: Array<any> = [];
  trailer: string = "";
  coverArt = "";
  currentBox: movieInfo = this.infoStore.videoInfo;
  index = 0;
  transmuxToPixie: boolean = false;
  showVersionSelector: boolean = false
  availableVersions: movieInfo[] = []
  selectedVersionIndex: number = 0
  plotTopOffset: number = 100 // Default offset for plot position
  currentDuration: string = "" // Formatted duration of currently highlighted version
  trailerVisible = false;
  trailerPlayingNative = false;
  isUgoos = false;
  private uiHideTimeout: any = null; // Timer for hiding UI after inactivity

  private static readonly FALLBACK_POSTER_PATH = "/assets/404-poster.jpg";
  private posterFallbackApplied = false;

  get hasTrailer(): boolean {
    return !!this.trailer?.trim();
  }

  private get fallbackPosterUrl(): string {
    return OverviewComponent.FALLBACK_POSTER_PATH;
  }

  /** Poster URL for overview; falls back when cover art is missing or fails to load. */
  get displayCoverArt(): string {
    const art = (this.coverArt || "").trim();
    return art || this.fallbackPosterUrl;
  }

  onPosterError(event: Event): void {
    const img = event?.target as HTMLImageElement | null;
    const failedSrc = img?.currentSrc || img?.src || this.coverArt || "";
    const fallback = this.fallbackPosterUrl;
    if (this.posterFallbackApplied || String(failedSrc).includes(OverviewComponent.FALLBACK_POSTER_PATH)) {
      return;
    }
    this.posterFallbackApplied = true;
    this.coverArt = fallback;
  }

  /** Always read from shared preference so it survives navigating between movies. */
  get atmosIntroEnabled(): boolean {
    return this.apiConfig.isAtmosIntroEnabled();
  }

  get showAtmosIntroToggle(): boolean {
    if (this.infoStore.videoInfo?.audio === "truehd") {
      return true;
    }
    return (this.availableVersions || []).some(
      (version) => version?.audio === "truehd"
    );
  }

  get shouldAutoplayTrailer(): boolean {
    return !this.layout.isCompactLayout && !this.isUgoos && this.hasTrailer;
  }

  get showTrailerOption(): boolean {
    return this.hasTrailer && (this.layout.isCompactLayout || this.isUgoos);
  }

  constructor(
    public infoStore: InfoStoreService,
    private router: Router,
    private renderer: Renderer2,
    private http: HttpClient,
    private smartTv: SmartTvLibSingletonService,
    private exoPlayerService: ExoPlayerService,
    private apiConfig: ApiConfigService,
    public layout: LayoutService,
    private platformService: PlatformService
  ) {}

  @ViewChild("right") right!: ElementRef;
  @ViewChild("left") left!: ElementRef;
  @ViewChild("nav") nav!: ElementRef;
  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("iframePlacer") iframePlacer!: ElementRef;
  @ViewChild("videoPlayer") videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild("compactTrailerPlayer") compactTrailerPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild("castList") castList!: ElementRef;
  @ViewChild("info") info!: ElementRef;
  @ViewChildren("playBtn") playBtn!: QueryList<ElementRef>;
  @ViewChildren("versionOption") versionOptions!: QueryList<ElementRef>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;
  @ViewChild(SideBarComponent) sideBarComponent!: SideBarComponent;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event);

    // Check if D-pad keys are pressed (Arrow keys)
    const isDpadKey = event.code === "ArrowUp" || 
                      event.code === "ArrowDown" || 
                      event.code === "ArrowLeft" || 
                      event.code === "ArrowRight";
    
    // If any D-pad button is pressed, make UI visible and reset hide timer
    if (isDpadKey) {
      this.showUI();
      this.resetUIHideTimer();
    }

    // Determine available lists based on whether version selector is shown
    const availableLists = this.showVersionSelector 
      ? ["versionOptions", "sideBar"]
      : ["playBtn", "sideBar"];

    // Only handle navigation if current list is in available lists
    if (!this.smartTv.smartTv || 
        !availableLists.includes(this.smartTv.smartTv.currentListName)) {
      return;
    }

    const ind = this.smartTv.smartTv?.navigate(event);
    // console.log("THI IND: ", ind);

    const isEnterKey = event.code === "Enter" || 
    event.code === "NumpadEnter" || 
    event.key === "Enter" ||
    event.keyCode === 13;

    // Handle back button (Escape, Backspace, or Android TV Back button)
    const isBackKey = event.code === "Escape" || 
                      event.code === "Backspace" || 
                      event.key === "Escape" ||
                      event.key === "Backspace" ||
                      event.keyCode === 27 || // Escape
                      event.keyCode === 8;    // Backspace

    if (isBackKey) {
      // Navigate back to video selection page
      this.router.navigateByUrl("/videoSelection");
      return;
    }

    // Handle Enter key based on current list
    if (isEnterKey) {
      if (this.smartTv.smartTv.currentListName === "versionOptions") {
        // Select the version when Enter is pressed on version selector
        this.selectVersion(this.selectedVersionIndex);
      } else if (this.smartTv.smartTv.currentListName === "playBtn") {
        // Play movie when Enter is pressed on play button
        this.playMovie();
      }
      return;
    }

    // Navigation when version selector is visible
    if (this.showVersionSelector) {
      // Navigation from versionOptions to sideBar (left or right edge)
      if (
        (ind?.borderReached === "left edge" || ind?.borderReached === "right edge") &&
        ind?.currentListName === "versionOptions"
      ) {
        this.smartTv.smartTv?.switchList("sideBar", 0);
      }

      // Navigation from sideBar to versionOptions (left or right edge)
      if (
        (ind?.borderReached === "left edge" || ind?.borderReached === "right edge") &&
        ind?.currentListName === "sideBar"
      ) {
        this.smartTv.smartTv?.switchList("versionOptions", this.selectedVersionIndex);
      }

      // Update selected version index when navigating within version selector (up/down)
      if (this.smartTv.smartTv.currentListName === "versionOptions") {
        if (ind?.currentIndex !== undefined) {
          this.selectedVersionIndex = ind.currentIndex;
          // Update UI with the newly highlighted version's data
          this.updateUIForVersion(this.selectedVersionIndex);
        }
        // Handle wrapping at top/bottom of version list
        if (ind?.borderReached === "top edge" && this.selectedVersionIndex === 0) {
          // Stay at top or wrap to bottom
          this.selectedVersionIndex = this.availableVersions.length - 1;
          this.smartTv.smartTv?.setCurrentIndex(this.selectedVersionIndex);
          this.updateUIForVersion(this.selectedVersionIndex);
        } else if (ind?.borderReached === "bottom edge" && this.selectedVersionIndex === this.availableVersions.length - 1) {
          // Stay at bottom or wrap to top
          this.selectedVersionIndex = 0;
          this.smartTv.smartTv?.setCurrentIndex(this.selectedVersionIndex);
          this.updateUIForVersion(this.selectedVersionIndex);
        }
      }
    } else {
      // Navigation when version selector is NOT visible (normal flow)
      // Navigation from playBtn to sideBar (left or right edge)
      if (
        (ind?.borderReached === "left edge" || ind?.borderReached === "right edge") &&
        ind?.currentListName === "playBtn"
      ) {
        this.smartTv.smartTv?.switchList("sideBar", 0);
      }

      // Navigation from sideBar to playBtn (left or right edge)
      if (
        (ind?.borderReached === "left edge" || ind?.borderReached === "right edge") &&
        ind?.currentListName === "sideBar"
      ) {
        this.smartTv.smartTv?.switchList("playBtn", 0);
      }
    }
  }

  playMovie() {
    this.stopTrailerPlayback();
    if (this.videoPlayer?.nativeElement) {
      const el = this.videoPlayer.nativeElement;
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    this.router.navigateByUrl("/player");
  }

  onAtmosIntroToggle(enabled: boolean): void {
    this.apiConfig.setAtmosIntroEnabled(!!enabled);
  }

  async watchTrailer(): Promise<void> {
    if (!this.hasTrailer) {
      return;
    }

    if (this.isUgoos) {
      await this.playTrailerOnUgoos();
      return;
    }

    this.trailerVisible = true;
    setTimeout(() => this.playHtmlTrailer(this.compactTrailerPlayer?.nativeElement), 0);
  }

  closeTrailer(): void {
    this.stopTrailerPlayback();
  }

  private playHtmlTrailer(element?: HTMLVideoElement | null): void {
    if (!element || !this.trailer) {
      return;
    }

    element.src = this.trailer;
    element.load();
    element.play().catch((err) => {
      console.log("Trailer playback failed:", err);
    });
  }

  private async playTrailerOnUgoos(): Promise<void> {
    const initialized = await this.exoPlayerService.initialize("trailerPlayerContainer");
    if (!initialized) {
      this.trailerVisible = true;
      setTimeout(() => this.playHtmlTrailer(this.compactTrailerPlayer?.nativeElement), 0);
      return;
    }

    const loaded = await this.exoPlayerService.loadVideo(this.trailer);
    if (!loaded) {
      await this.exoPlayerService.release();
      return;
    }

    this.trailerPlayingNative = true;
    await this.exoPlayerService.play();
    await this.exoPlayerService.showControls();
  }

  private stopTrailerPlayback(): void {
    if (this.trailerPlayingNative) {
      this.exoPlayerService.release().catch((err) => {
        console.log("Error releasing trailer player:", err);
      });
      this.trailerPlayingNative = false;
    }

    if (this.compactTrailerPlayer?.nativeElement) {
      const el = this.compactTrailerPlayer.nativeElement;
      el.pause();
      el.removeAttribute("src");
      el.load();
    }

    this.trailerVisible = false;
  }

  goBack(): void {
    this.stopTrailerPlayback();
    this.router.navigateByUrl("/videoSelection");
  }

  leftEnter(e: any) {
    this.idx = setInterval(() => (this.nav.nativeElement.scrollLeft -= 2), 5);
  }

  rightEnter(e: any) {
    this.idx = setInterval(() => (this.nav.nativeElement.scrollLeft += 2), 5);
  }

  clear() {
    clearInterval(this.idx);
  }

  hover() {
    this.showUI();
    this.resetUIHideTimer();
  }

  hoverOut() {
    // Don't hide immediately on mouseout - let the timer handle it
    this.resetUIHideTimer();
  }

  private showUI() {
    if (this.castList && this.castList.nativeElement) {
      this.castList.nativeElement.style.opacity = "1";
    }
    if (this.info && this.info.nativeElement) {
      this.info.nativeElement.style.opacity = "1";
    }
  }

  private hideUI() {
    if (this.castList && this.castList.nativeElement) {
      this.castList.nativeElement.style.opacity = "0";
    }
    if (this.info && this.info.nativeElement) {
      this.info.nativeElement.style.opacity = "0";
    }
  }

  private resetUIHideTimer() {
    // Clear existing timer
    if (this.uiHideTimeout) {
      clearTimeout(this.uiHideTimeout);
      this.uiHideTimeout = null;
    }
    
    // Set new timer to hide UI after 3 seconds of inactivity
    this.uiHideTimeout = setTimeout(() => {
      this.hideUI();
      this.uiHideTimeout = null;
    }, 3000);
  }

  ngAfterViewInit() {
    this.setTrailerFromVideoInfo();

    // Set up navigation after view is initialized
    setTimeout(() => {
      if (this.showVersionSelector && this.versionOptions.length > 0) {
        // Version selector is visible - make it the starting list
        this.smartTv.smartTv?.addCurrentList({
          startingList: true,
          listName: "versionOptions",
          startingIndex: this.selectedVersionIndex,
          listElements: this.versionOptions,
        });
        this.smartTv.smartTv?.setCurrentIndex(this.selectedVersionIndex);
      } else if (this.playBtn.length > 0) {
        // Version selector not visible - use play button as starting list
        this.smartTv.smartTv?.addCurrentList({
          startingList: true,
          listName: "playBtn",
          startingIndex: 0,
          listElements: this.playBtn,
        });
        this.smartTv.smartTv?.setCurrentIndex(0);
      }
    }, 1200);
    
    setTimeout(() => {
      // Hide UI after 3 seconds, but timer will reset on D-pad activity
      this.hideUI();
      // Start the inactivity timer
      this.resetUIHideTimer();
    }, 3000);
  }
  onHover(e: number, listName: string) {
    console.log("EVVVENMT: ", e);
    if (listName === "movies") {
      const ind = this.smartTv.smartTv?.findAndSetIndex(e, "movies");
      this.index = ind.index;
    }
    if (listName === "sideBar") {
      this.smartTv.smartTv?.findAndSetIndex(e, "sideBar");
    }
  }

  changeTransmuxStatus(status: number) {
    this.infoStore.videoInfo.transmuxToPixie = status;
    this.apiConfig.ensureConfigLoaded().then(() => {
      this.http
        .post(
          `${this.apiConfig.getBaseUrl()}/api/mov/transmux`,
          this.infoStore.videoInfo
        )
        .subscribe((res: any) => {
          this.transmuxToPixie = res;
        });
    }).catch((error) => {
      console.error('Error loading config before transmux API call:', error);
      // Fallback
    this.http
      .post(
        `${this.apiConfig.getBaseUrl()}/api/mov/transmux`,
        this.infoStore.videoInfo
      )
      .subscribe((res: any) => {
        this.transmuxToPixie = res;
        });
      });
  }

  onVersionHover(index: number) {
    this.selectedVersionIndex = index;
    // Update Smart TV navigation index if version selector is active
    if (this.smartTv.smartTv?.currentListName === "versionOptions") {
      this.smartTv.smartTv?.findAndSetIndex(index, "versionOptions");
    }
    // Update UI with the highlighted version's data
    this.updateUIForVersion(index);
  }

  private updateUIForVersion(index: number) {
    if (index < 0 || index >= this.availableVersions.length) {
      return;
    }
    
    const version = this.availableVersions[index];
    
    // Update all UI properties with the selected version's data
    this.plot = version.overview;
    this.cast = JSON.parse(version.cast || "[]");
    this.coverArt = version.coverArt;
    this.posterFallbackApplied = false;
    this.currentDuration = this.formatDuration(version.duration);
    const newTrailer = this.formatTrailerUrl(version.trailerUrl);

    if (this.trailer !== newTrailer) {
      this.trailer = newTrailer;
      if (this.shouldAutoplayTrailer && this.videoPlayer?.nativeElement) {
        this.playHtmlTrailer(this.videoPlayer.nativeElement);
      } else if (this.trailerVisible && this.compactTrailerPlayer?.nativeElement) {
        this.playHtmlTrailer(this.compactTrailerPlayer.nativeElement);
      } else if (this.trailerPlayingNative) {
        this.stopTrailerPlayback();
      }
    } else {
      this.trailer = newTrailer;
    }
  }

  selectVersion(index: number) {
    this.selectedVersionIndex = index;
    this.infoStore.videoInfo = this.availableVersions[index];
    
    // Update component properties with new version data
    this.plot = this.infoStore.videoInfo.overview;
    this.cast = JSON.parse(this.infoStore.videoInfo.cast);
    this.coverArt = this.infoStore.videoInfo.coverArt;
    this.currentDuration = this.formatDuration(this.infoStore.videoInfo.duration);
    this.trailer = this.formatTrailerUrl(this.infoStore.videoInfo.trailerUrl);
    this.stopTrailerPlayback();
    
    // Navigate to player with selected version
    this.router.navigateByUrl("/player");
  }

  formatDuration(duration: number): string {
    if (!duration || duration <= 0) {
      return "";
    }
    
    const totalSeconds = Math.floor(duration);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }


  ngOnInit(): void {
    this.isUgoos = this.platformService.isUgoos();
    this.setTrailerFromVideoInfo();
    // console.log("INFOO: ", this.infoStore.videoInfo);
    // Filter movies by same title AND tmdbId
    this.availableVersions = this.infoStore.videoInfo.versions;
    
    if(this.availableVersions.length > 1) {
      this.showVersionSelector = true;
      // Find the index of the current movie in the versions array
      const currentIndex = this.availableVersions.findIndex(
        (version) => version.id === this.infoStore.videoInfo.id
      );
      this.selectedVersionIndex = currentIndex >= 0 ? currentIndex : 0;
    }
    
    // console.log("AVAILABLE VERSIONS: ", this.availableVersions);
    
    if (this.infoStore.videoInfo.transmuxToPixie === 0) {
      this.transmuxToPixie = false;
    } else {
      this.transmuxToPixie = true;
    }
    this.plot = this.infoStore.videoInfo.overview;
    this.cast = JSON.parse(this.infoStore.videoInfo.cast);
    this.coverArt = this.infoStore.videoInfo.coverArt;
    this.posterFallbackApplied = false;
    this.currentDuration = this.formatDuration(this.infoStore.videoInfo.duration);
    console.log("CURRENT DURATION: ", this.currentDuration);
    
    console.log("PID: ", this.infoStore.videoInfo.pid);
    // Show sidebar on overview page (player will hide it when navigating to player)
    this.smartTv.changeVisibility(true);

    // Navigation setup will be done in ngAfterViewInit after view elements are available

    if (this.infoStore.videoInfo.pid > 0) {
      console.log("INSIDE PID: ");

      this.apiConfig.ensureConfigLoaded().then(() => {
        this.http
          .post(`${this.apiConfig.getBaseUrl()}/api/mov/pidkill`, {
            pid: this.infoStore.videoInfo.pid,
          })
          .subscribe((res) => {
            console.log("RESPONDED: ", res);
          });
      }).catch((error) => {
        console.error('Error loading config before pidkill API call:', error);
        // Fallback
      this.http
        .post(`${this.apiConfig.getBaseUrl()}/api/mov/pidkill`, {
          pid: this.infoStore.videoInfo.pid,
        })
        .subscribe((res) => {
          console.log("RESPONDED: ", res);
          });
        });
    }
  }

  private formatTrailerUrl(url?: string): string {
    return (url || "").replace(/ /g, "%20");
  }

  private setTrailerFromVideoInfo(videoInfo?: movieInfo): void {
    this.trailer = this.formatTrailerUrl((videoInfo ?? this.infoStore.videoInfo).trailerUrl);
  }

  ngOnDestroy() {
    this.stopTrailerPlayback();

    if (this.uiHideTimeout) {
      clearTimeout(this.uiHideTimeout);
      this.uiHideTimeout = null;
    }
  }
}
