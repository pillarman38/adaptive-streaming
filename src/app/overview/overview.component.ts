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
  private uiHideTimeout: any = null; // Timer for hiding UI after inactivity

  constructor(
    private infoStore: InfoStoreService,
    private router: Router,
    private renderer: Renderer2,
    private http: HttpClient,
    private smartTv: SmartTvLibSingletonService,
    private exoPlayerService: ExoPlayerService,
    private apiConfig: ApiConfigService
  ) {}

  @ViewChild("right") right!: ElementRef;
  @ViewChild("left") left!: ElementRef;
  @ViewChild("nav") nav!: ElementRef;
  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("iframePlacer") iframePlacer!: ElementRef;
  @ViewChild("videoPlayer") videoPlayer!: ElementRef<HTMLVideoElement>;
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
    console.log("THI IND: ", ind);

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
    this.router.navigateByUrl("/player");
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
    this.trailer = this.infoStore.videoInfo.trailerUrl.replace(
      new RegExp(" ", "g"),
      "%20"
    );
    // const iframeHtml = `<iframe id="youtubeFrame" style="width: 100%; height: 100%;"
    // src="https://www.youtube.com/embed/${this.trailer}?autoplay=1&controls=0&rel=0&fs=0&modestbranding=1&showinfo=0&fs=0" frameborder="0">
    // </iframe>`;
    // const divElement = this.renderer.createElement("div");
    // divElement.id = "iframeHolder";
    // this.renderer.setProperty(divElement, "innerHTML", iframeHtml);
    // Append the div (with iframe) to the container
    // this.renderer.appendChild(this.iframePlacer.nativeElement, divElement);
    
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
        `http://pixable.local:5012/api/mov/transmux`,
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
    this.currentDuration = this.formatDuration(version.duration);
    const newTrailer = version.trailerUrl.replace(new RegExp(" ", "g"), "%20");
    
    // Update trailer and reload video if it changed
    if (this.trailer !== newTrailer) {
      this.trailer = newTrailer;
      // Reload the video element with the new trailer
      if (this.videoPlayer && this.videoPlayer.nativeElement) {
        this.videoPlayer.nativeElement.src = this.trailer;
        this.videoPlayer.nativeElement.load();
        this.videoPlayer.nativeElement.play().catch(err => {
          console.log("Video autoplay prevented or failed:", err);
        });
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
    this.trailer = this.infoStore.videoInfo.trailerUrl.replace(
      new RegExp(" ", "g"),
      "%20"
    );
    
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
    console.log("INFOO: ", this.infoStore.videoInfo);
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
        .post(`http://pixable.local:5012/api/mov/pidkill`, {
          pid: this.infoStore.videoInfo.pid,
        })
        .subscribe((res) => {
          console.log("RESPONDED: ", res);
          });
        });
    }
  }

  ngOnDestroy() {
    // Clear the UI hide timer when component is destroyed
    if (this.uiHideTimeout) {
      clearTimeout(this.uiHideTimeout);
      this.uiHideTimeout = null;
    }
  }
}
