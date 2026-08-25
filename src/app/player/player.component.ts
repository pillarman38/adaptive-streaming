import {
  Component,
  OnInit,
  SecurityContext,
  Pipe,
  PipeTransform,
  ViewChild,
  QueryList,
  ViewChildren,
  HostListener,
  ElementRef,
  OnDestroy,
  ChangeDetectorRef,
} from "@angular/core";
import { InfoStoreService } from "../info-store.service";
import { HttpClient } from "@angular/common/http";
import { Subscription } from "rxjs";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
import { PlatformService } from "../services/platform.service";
import { ExoPlayerService } from "../services/exoplayer.service";
import { KodiPlayerService } from "../services/kodi-player.service";
import { ApiConfigService } from "../services/api-config.service";
import { LayoutService } from "../services/layout.service";

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
  selector: "app-player",
  templateUrl: "./player.component.html",
  styleUrls: ["./player.component.css"],
})
export class PlayerComponent implements OnInit, OnDestroy {
  location: SafeResourceUrl = "";
  index: number = 0;
  currentTime: number = 0;
  event: any;
  show: boolean = false;
  paused: boolean = false;
  subtitle: Boolean = false;
  subtitleUrl: string = "";
  isAndroid: boolean = false;
  useExoPlayer: boolean = false;
  useKodiPlayer: boolean = false;
  kodiPlaybackActive: boolean = false;
  private kodiOpenInProgress = false;
  private videoLoadId = 0;
  private pullVideoSub?: Subscription;
  controlsVisible: boolean = false;
  controlsTimeout: any = null;
  playPauseListener: any = null;
  timeUpdateListener: any = null;
  private kodiStopUnsubscribe?: () => void;
  private kodiPositionTimer?: ReturnType<typeof setInterval>;
  isSeeking: boolean = false;
  wasPlayingBeforeSeek: boolean = false;
  
  // Audio track selection properties
  audioTracks: any = null;
  availableAudioTracks: any[] = [];
  currentAudioTrackIndex: number = -1;
  showAudioTrackList: boolean = false;
  hasMultipleAudioTracks: boolean = false;
  audioTracksSupported: boolean = false;

  @ViewChild("videoContainer") videoContainer!: ElementRef;
  @ViewChild("seekBar") seekBar!: ElementRef;
  @ViewChildren("controls") controls!: QueryList<ElementRef>;
  @ViewChild("videoElem") videoElem!: ElementRef;
  @ViewChildren("controlBtns") controlBtns!: QueryList<ElementRef>;
  @ViewChild("controlsContainer", { read: ElementRef }) controlsContainer!: ElementRef;

  /** HTML seek/play controls (web player or Kodi JSON-RPC remote). */
  usesWebPlayerControls(): boolean {
    return (
      (!this.useExoPlayer && !this.useKodiPlayer) ||
      (this.useKodiPlayer && this.kodiPlaybackActive)
    );
  }

  private registerControlBtnsForNavigation(): void {
    setTimeout(() => {
      if (this.controlBtns?.length > 0 && this.smartTv.smartTv) {
        this.smartTv.smartTv.addCurrentList({
          startingList: true,
          listName: "controlBtns",
          startingIndex: 0,
          listElements: this.controlBtns,
        });
      }
    }, 100);
  }

  private startKodiPositionPolling(): void {
    this.stopKodiPositionPolling();
    this.kodiPositionTimer = setInterval(() => {
      void this.pollKodiPosition();
    }, 2500);
  }

  private stopKodiPositionPolling(): void {
    if (this.kodiPositionTimer) {
      clearInterval(this.kodiPositionTimer);
      this.kodiPositionTimer = undefined;
    }
  }

  private async pollKodiPosition(): Promise<void> {
    if (!this.kodiPlaybackActive) {
      return;
    }
    try {
      const snap = await this.kodiPlayerService.getPlaybackSnapshot();
      if (snap.playerId === null) {
        return;
      }
      const dur =
        snap.duration > 0
          ? snap.duration
          : this.infoStore.videoInfo.duration || 0;
      if (!this.isSeeking && this.seekBar?.nativeElement && dur > 0) {
        this.currentTime = snap.position;
        this.seekBar.nativeElement.style.width = `${(snap.position / dur) * 100}%`;
      }
      this.paused = !snap.playing;
    } catch {
      /* player may be idle between polls */
    }
  }

  onPlayerContainerClick(): void {
    if (this.useKodiPlayer && this.kodiPlaybackActive) {
      this.showControls();
    }
  }

  /** After kodiPlaybackActive flips true, DOM controls are not ready until next CD cycle. */
  private activateKodiControlsUi(): void {
    this.kodiPlaybackActive = true;
    this.paused = false;
    this.cdr.detectChanges();
    this.startKodiPositionPolling();
    this.applyControlsVisibility();
  }

  private applyControlsVisibility(retry = 0): void {
    if (this.controlsContainer?.nativeElement) {
      this.controlsContainer.nativeElement.classList.add('visible');
      this.controlsVisible = true;
      this.registerControlBtnsForNavigation();
      return;
    }
    if (retry < 15) {
      setTimeout(() => this.applyControlsVisibility(retry + 1), 50);
    }
  }

  @HostListener("window:skipAction", ["$event"])
  onSkipAction(event: CustomEvent): void {
    if (event.detail && event.detail.action) {
      if (event.detail.action === 'skipForward') {
        console.log('[Player] Skip forward requested');
        this.skipButtons(15);
      } else if (event.detail.action === 'skipBackward') {
        console.log('[Player] Skip backward requested');
        this.skipButtons(-15);
      }
    }
  }

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event.code, event.key, event.keyCode);

    // Handle back button (Escape, Backspace, Android TV Back, browser Back)
    const isBackKey = event.code === "Escape" || 
                      event.code === "Backspace" ||
                      event.code === "BrowserBack" ||
                      event.key === "Escape" ||
                      event.key === "Backspace" ||
                      event.key === "Back" ||
                      event.key === "GoBack" ||
                      event.keyCode === 27 || // Escape
                      event.keyCode === 8 ||  // Backspace
                      event.keyCode === 4;    // Android KEYCODE_BACK

    if (isBackKey) {
      event.preventDefault();
      if (this.useKodiPlayer) {
        await this.stopKodiPlayback();
      }
      this.router.navigateByUrl("/overview");
      return;
    }

    // Show controls when arrow keys are pressed (for Nvidia Shield remote)
    if(event.code === "ArrowUp" || event.code === "ArrowDown" || event.code === "ArrowLeft" || event.code === "ArrowRight") {
      console.log('[Player] Arrow key pressed:', event.code, '- controlsVisible:', this.controlsVisible, 'useExoPlayer:', this.useExoPlayer, 'isAndroid:', this.isAndroid);
      
      // For native Android controls, show them and navigate them
      if (this.useExoPlayer && this.isAndroid) {
        let direction = '';
        if (event.code === 'ArrowUp') direction = 'up';
        else if (event.code === 'ArrowDown') direction = 'down';
        else if (event.code === 'ArrowLeft') direction = 'left';
        else if (event.code === 'ArrowRight') direction = 'right';
        
        if (direction) {
          void (async () => {
            const audioListOpen = await this.exoPlayerService.isAudioTrackListVisible();
            if (!this.controlsVisible && !audioListOpen) {
              this.showControls();
            } else if (this.controlsVisible) {
              this.resetControlsTimeout();
            }
            await this.exoPlayerService.navigateControls(direction);
          })().catch((error) => {
            console.error('[Player] Error navigating controls:', error);
          });
        }
        return; // Don't continue with web navigation logic
      }

      if (!this.controlsVisible) {
        console.log('[Player] Controls not visible, calling showControls()');
        this.showControls();
      } else {
        console.log('[Player] Controls already visible, resetting timeout');
        this.resetControlsTimeout();
      }

      // Ensure controls are registered for navigation
      if (this.smartTv.smartTv && this.usesWebPlayerControls() && this.controlBtns.length > 0) {
        // Check if controls list is already registered
        if (!this.smartTv.smartTv.currentListName || this.smartTv.smartTv.currentListName !== "controlBtns") {
          // Register controls if not already registered
          this.smartTv.smartTv.addCurrentList({
            startingList: true,
            listName: "controlBtns",
            startingIndex: 0,
            listElements: this.controlBtns,
          });
          console.log('[Player] Registered controls for navigation, currentListName:', this.smartTv.smartTv.currentListName);
        }
      } else if (this.smartTv.smartTv && this.usesWebPlayerControls() && this.controlBtns.length === 0) {
        console.warn('[Player] Arrow key pressed but controlBtns are not available yet');
      }
    }
    
    // Handle Space key for play/pause
    const isSpaceKey = event.code === "Space" || 
                       event.key === " " ||
                       event.keyCode === 32;

    if (isSpaceKey) {
      event.preventDefault(); // Prevent page scroll
      console.log('[Player] Space key pressed - toggling play/pause');
      this.playPause();
      return;
    }


    // Handle Enter key to trigger selected control
    const isEnterKey = event.code === "Enter" || 
                       event.code === "NumpadEnter" || 
                       event.key === "Enter" ||
                       event.keyCode === 13;

    if (isEnterKey) {
      // For Android ExoPlayer, simulate Enter key press on currently focused control
      if (this.useExoPlayer && this.isAndroid) {
        console.log('[Player] Enter key pressed on Android - simulating Enter on focused control');
        this.exoPlayerService.navigateControls('enter').catch((error) => {
          console.error('[Player] Error triggering control:', error);
        });
        return;
      }
      
      // If controls are registered and we're on the controlBtns list, trigger the selected control
      if (this.smartTv.smartTv && this.smartTv.smartTv.currentListName === "controlBtns") {
        const currentIndex = this.smartTv.smartTv.currentIndex ?? 0;
        const selectedControl = this.controlBtns.toArray()[currentIndex];
        if (selectedControl && selectedControl.nativeElement) {
          // Trigger click on the selected control
          selectedControl.nativeElement.click();
        }
        return;
      }
    }
    
    // Only handle navigation if controls are registered
    // This is for HTML controls on web, not native Android controls
    if (!this.smartTv.smartTv) {
      return;
    }

    // Only navigate if there's an active list
    if (!this.smartTv.smartTv.currentListName) {
      return;
    }

    const ind = this.smartTv.smartTv?.navigate(event);
    // console.log("THI IND: ", ind);
    
    // Reset controls timeout when navigating HTML controls
    if (ind && this.usesWebPlayerControls()) {
      this.resetControlsTimeout();
    }
  }

  showControls() {
    console.log('[Player] showControls() called - controlsVisible:', this.controlsVisible, 'useExoPlayer:', this.useExoPlayer, 'isAndroid:', this.isAndroid);
    this.controlsVisible = true;
    
    // Show native Android controls if using ExoPlayer
    if (this.useExoPlayer && this.isAndroid) {
      console.log('[Player] Calling exoPlayerService.showControls()');
      this.exoPlayerService.showControls().catch((error) => {
        console.error('[Player] Error calling exoPlayerService.showControls():', error);
      });
    } else {
      console.log('[Player] Not calling exoPlayerService.showControls() - useExoPlayer:', this.useExoPlayer, 'isAndroid:', this.isAndroid);
    }
    
    // Show web/Kodi overlay controls
    if (this.usesWebPlayerControls() && this.controlsContainer?.nativeElement) {
      this.controlsContainer.nativeElement.classList.add('visible');
    }
    
    // Clear existing timeout
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
    }
    
    // Hide controls after 5 seconds of inactivity
    this.controlsTimeout = setTimeout(() => {
      this.hideControls();
    }, 5000);
  }

  hideControls() {
    // Kodi Chrome UI stays visible — it's the only on-screen remote.
    if (this.useKodiPlayer && this.kodiPlaybackActive) {
      return;
    }
    this.controlsVisible = false;
    
    // Hide native Android controls if using ExoPlayer
    if (this.useExoPlayer && this.isAndroid) {
      this.exoPlayerService.hideControls();
    }
    
    if (this.usesWebPlayerControls() && this.controlsContainer?.nativeElement) {
      this.controlsContainer.nativeElement.classList.remove('visible');
    }
    
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
      this.controlsTimeout = null;
    }
  }
  
  resetControlsTimeout() {
    // Reset the auto-hide timer - called during navigation to keep controls visible
    if (this.controlsVisible) {
      if (this.controlsTimeout) {
        clearTimeout(this.controlsTimeout);
      }
      this.controlsTimeout = setTimeout(() => {
        this.hideControls();
      }, 5000);
    }
  }

  constructor(
    public infoStore: InfoStoreService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private router: Router,
    private smartTv: SmartTvLibSingletonService,
    private platformService: PlatformService,
    private exoPlayerService: ExoPlayerService,
    private kodiPlayerService: KodiPlayerService,
    private apiConfig: ApiConfigService,
    private cdr: ChangeDetectorRef,
    public layout: LayoutService,
  ) {
    this.isAndroid = this.platformService.isAndroid();
    this.useKodiPlayer = this.platformService.isKodi();
    // Don't use ExoPlayer for Zidoo devices - they have their own player
    this.useExoPlayer =
      this.isAndroid && !this.platformService.isZidoo() && !this.useKodiPlayer;
  }

  async playPause() {
    console.log("PLAY PAUSE: ", this.playPauseListener);
    
    if (this.useExoPlayer) {
      if (this.paused) {
        await this.exoPlayerService.play();
        this.paused = false;
      } else {
        await this.exoPlayerService.pause();
        this.paused = true;
      }
    } else if (this.useKodiPlayer) {
      await this.kodiPlayerService.playPause();
      this.paused = await this.kodiPlayerService.isPlaying().then((playing) => !playing);
    } else {
      this.videoElem.nativeElement.paused
        ? this.videoElem.nativeElement.play()
        : this.videoElem.nativeElement.pause();
      if (this.videoElem.nativeElement.paused) {
        this.paused = true;
      } else {
        this.paused = false;
      }
    }
  }

  async skipButtons(skipBy: number) {
    if (this.useExoPlayer) {
      const currentPos = await this.exoPlayerService.getCurrentPosition();
      const newTime = Math.max(0, currentPos + skipBy);
      await this.exoPlayerService.seekTo(newTime);
      this.currentTime = newTime;
    } else if (this.useKodiPlayer) {
      await this.kodiPlayerService.seekRelative(skipBy);
      const newTime = Math.max(
        0,
        (await this.kodiPlayerService.getCurrentPosition()) || this.currentTime + skipBy
      );
      this.currentTime = newTime;
    } else {
      const currentPos = this.videoElem.nativeElement.currentTime;
      const newTime = Math.max(0, currentPos + skipBy);
      this.videoElem.nativeElement.currentTime = newTime;
      this.currentTime = newTime;
    }
  }

  async seekBarClick($event: MouseEvent | Touch, skipReload: boolean = false) {
    if (!this.seekBar || !this.seekBar.nativeElement) {
      return;
    }

    const seekSpace = this.seekBar.nativeElement.parentElement;
    if (!seekSpace) {
      return;
    }

    const clientX = 'clientX' in $event ? $event.clientX : ($event as Touch).clientX;
    await this.seekFromClientX(clientX, skipReload);
  }

  private async seekFromClientX(clientX: number, skipReload: boolean = false): Promise<void> {
    if (!this.seekBar?.nativeElement) {
      return;
    }
    const seekSpace = this.seekBar.nativeElement.parentElement;
    if (!seekSpace) {
      return;
    }

    const rect = seekSpace.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));

    this.currentTime = Math.floor(
      this.infoStore.videoInfo.duration * percentage
    );

    if (this.useExoPlayer) {
      await this.exoPlayerService.seekTo(this.currentTime);
    } else if (this.useKodiPlayer) {
      await this.kodiPlayerService.seek(this.currentTime);
    } else {
      if (this.event.fileformat === "dvhe" || this.event.fileformat === "dvh1") {
        this.videoElem.nativeElement.currentTime = this.currentTime;
      } else {
        if (!skipReload) {
          this.videoElem.nativeElement.pause();
          this.infoStore.videoInfo.seekTime = this.currentTime;
          this.getVideo();
        } else {
          this.videoElem.nativeElement.pause();
        }
      }
    }
  }

  onSeekBarTouchStart(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length === 0) {
      return;
    }
    void this.onSeekBarMouseDown(this.touchToMouse(event, event.touches[0]));
  }

  onSeekBarTouchMove(event: TouchEvent): void {
    if (!this.isSeeking || event.touches.length === 0) {
      return;
    }
    event.preventDefault();
    this.onSeekBarMouseMove(this.touchToMouse(event, event.touches[0]));
  }

  onSeekBarTouchEnd(event: TouchEvent): void {
    if (event.changedTouches.length === 0) {
      return;
    }
    void this.onSeekBarMouseUp(this.touchToMouse(event, event.changedTouches[0]));
  }

  private touchToMouse(event: TouchEvent, touch: Touch): MouseEvent {
    return {
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => event.preventDefault(),
    } as MouseEvent;
  }

  async onSeekBarMouseDown($event: MouseEvent) {
    this.isSeeking = true;
    
    // Store whether video was playing before seeking
    if (this.useExoPlayer || this.useKodiPlayer) {
      this.wasPlayingBeforeSeek = !this.paused;
    } else {
      this.wasPlayingBeforeSeek = !this.videoElem.nativeElement.paused;
    }
    
    // Pause playback while user is scrubbing
    if (this.useExoPlayer) {
      if (!this.paused) {
        this.exoPlayerService.pause();
        this.paused = true;
      }
    } else if (this.useKodiPlayer) {
      if (!this.paused) {
        await this.kodiPlayerService.playPause();
        this.paused = true;
      }
    } else {
      if (!this.videoElem.nativeElement.paused) {
        this.videoElem.nativeElement.pause();
        this.paused = true;
      }
    }
    
    this.seekBarClick($event, true); // Skip reload during drag
  }

  onSeekBarMouseMove($event: MouseEvent) {
    if (this.isSeeking) {
      // Update the visual position of the seekbar during dragging
      const seekSpace = this.seekBar.nativeElement.parentElement;
      if (seekSpace) {
        const rect = seekSpace.getBoundingClientRect();
        const clickX = $event.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        this.seekBar.nativeElement.style.width = `${percentage * 100}%`;
      }
      this.seekBarClick($event, true); // Skip reload during drag
    }
  }

  async onSeekBarMouseUp($event: MouseEvent) {
    if (this.isSeeking) {
      this.isSeeking = false;
      
      // Now do the actual seek/reload for non-DV files
      if (this.useKodiPlayer) {
        if (this.wasPlayingBeforeSeek && this.paused) {
          await this.kodiPlayerService.playPause();
          this.paused = false;
        }
      } else if (!this.useExoPlayer && this.event.fileformat !== "dvhe" && this.event.fileformat !== "dvh1") {
        this.infoStore.videoInfo.seekTime = this.currentTime;
        this.getVideo();
        // Note: getVideo() will handle playback state, but we should resume if it was playing
        if (this.wasPlayingBeforeSeek) {
          // Wait a bit for video to load, then resume
          setTimeout(() => {
            if (!this.videoElem.nativeElement.paused) {
              this.paused = false;
            } else if (this.wasPlayingBeforeSeek) {
              this.videoElem.nativeElement.play();
              this.paused = false;
            }
          }, 100);
        }
      } else if (!this.useExoPlayer) {
        // For DV files, just set currentTime and resume if it was playing
        this.videoElem.nativeElement.currentTime = this.currentTime;
        if (this.wasPlayingBeforeSeek) {
          await this.videoElem.nativeElement.play();
          this.paused = false;
        }
      } else if (this.useExoPlayer) {
        // For ExoPlayer, resume if it was playing
        if (this.wasPlayingBeforeSeek) {
          await this.exoPlayerService.play();
          this.paused = false;
        }
      }
    }
  }

  async onSeekBarMouseLeave() {
    if (this.isSeeking) {
      this.isSeeking = false;
      
      // Do the actual seek/reload when mouse leaves during drag
      if (this.useKodiPlayer) {
        if (this.wasPlayingBeforeSeek && this.paused) {
          await this.kodiPlayerService.playPause();
          this.paused = false;
        }
      } else if (!this.useExoPlayer && this.event.fileformat !== "dvhe" && this.event.fileformat !== "dvh1") {
        this.infoStore.videoInfo.seekTime = this.currentTime;
        this.getVideo();
        // Resume if it was playing
        if (this.wasPlayingBeforeSeek) {
          setTimeout(() => {
            if (!this.videoElem.nativeElement.paused) {
              this.paused = false;
            } else if (this.wasPlayingBeforeSeek) {
              this.videoElem.nativeElement.play();
              this.paused = false;
            }
          }, 100);
        }
      } else if (!this.useExoPlayer) {
        this.videoElem.nativeElement.currentTime = this.currentTime;
        if (this.wasPlayingBeforeSeek) {
          await this.videoElem.nativeElement.play();
          this.paused = false;
        }
      } else if (this.useExoPlayer) {
        if (this.wasPlayingBeforeSeek) {
          await this.exoPlayerService.play();
          this.paused = false;
        }
      }
    }
  }

  async getNextEp() {
    this.http
      .post(`${this.apiConfig.getBaseUrl()}/api/mov/nextep`, this.infoStore.videoInfo)
      .subscribe(async (res: any) => {
        console.log("NEXT EP: ", res);
        this.infoStore.videoInfo = res[0];
        this.infoStore.videoInfo.seekTime = 0;
        this.infoStore.videoInfo.browser = this.useKodiPlayer ? "Kodi" : "Safari";
        if (this.useExoPlayer) {
          await this.exoPlayerService.pause();
        } else if (this.useKodiPlayer) {
          await this.stopKodiPlayback();
        } else {
          this.videoElem.nativeElement.pause();
        }
        this.getVideo();
      });
  }

  getVideo() {
    const loadId = ++this.videoLoadId;
    this.pullVideoSub?.unsubscribe();
    // console.log(
    //   "VIDEO INFO: ",
    //   this.infoStore.videoInfo,
    //   Object.keys(this.infoStore.videoInfo).includes("epNumber")
    // );
    if (Object.keys(this.infoStore.videoInfo).includes("epNumber")) {
      // console.log("A SHOW");
      // console.log("SENDING OUT: ", this.infoStore.videoInfo, this.event);

      this.show = true;
    } else {
      // console.log("A MOVIE");
      this.show = false;
    }
    this.subtitle = this.infoStore.videoInfo.srtUrl ? true : false;
    if (this.infoStore.videoInfo.srtUrl) {
      this.subtitleUrl = this.apiConfig.transformUrl(this.infoStore.videoInfo.srtUrl);
    }
    
    // Reset audio track state when loading a new video
    if (!this.useExoPlayer) {
      this.audioTracks = null;
      this.availableAudioTracks = [];
      this.currentAudioTrackIndex = -1;
      this.showAudioTrackList = false;
      this.hasMultipleAudioTracks = false;
    }

    if (this?.event?.pid) {
      this.infoStore.videoInfo.pid = this.event.pid;
    }

    // Drive CoreELEC when kodiBoxIp is configured (desktop + iPhone). Use in-memory
    // flag so blocked sessionStorage still targets the box.
    this.apiConfig.enableKodiPlaybackTarget();
    this.useKodiPlayer = this.apiConfig.isKodiRemotePlayback();
    const videoInfoWithDevice = {
      ...this.infoStore.videoInfo,
      device: this.useKodiPlayer
        ? 'coreelec'
        : this.platformService.getDeviceName(),
      browser: this.useKodiPlayer ? 'Kodi' : this.infoStore.videoInfo.browser,
      atmosIntroEnabled: this.apiConfig.isAtmosIntroEnabled(),
    };

    this.pullVideoSub = this.http
      .post(
        `${this.apiConfig.getBaseUrl()}/api/mov/pullVideo`,
        videoInfoWithDevice
      )
      .subscribe(async (event: any) => {
        if (loadId !== this.videoLoadId) {
          console.warn("[Player] Ignoring stale pullVideo response", loadId, this.videoLoadId);
          return;
        }

        this.event = event;

        if (!event || event.err || !event.location) {
          console.error('[Player] pullVideo missing location:', event);
          alert(
            'Server did not return a playback URL.\n\n' +
              JSON.stringify(event?.err || event, null, 2)
          );
          return;
        }

        this.infoStore.videoInfo.pid = this.event.pid;

        let videoUrl = this.event.location;
        // URL-encode spaces for HTTP only; local SMB/NFS paths must keep literal spaces.
        if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
          videoUrl = videoUrl.replace(/ /g, "%20");
        }
        // Transform URL to use IP address on Android
        console.log("VIDEO URL: ", videoUrl);
        
        videoUrl = this.apiConfig.transformUrl(videoUrl);
        console.log("USING EXOPLAYER: ", this.useExoPlayer);
        console.log("IS ZIDOO: ", this.platformService.isZidoo());

        const isZidooDevice = this.platformService.isZidoo();
        if (isZidooDevice) {
          console.log("Zidoo device detected - launching Zidoo player");
          try {
            const title = this.infoStore.videoInfo.title || "";
            const position = 0; // Start from beginning, could be enhanced to support resume
            const result = await this.exoPlayerService.launchZidooPlayer(videoUrl, title, position);
            if (result.success) {
              if (result.fallback) {
                console.log("Generic video player launched (Zidoo player not installed)");
              } else {
                console.log("Zidoo player launched successfully");
              }
              // Note: We don't set paused state since external player handles its own playback
            } else {
              // Zidoo player launch failed - log but don't show warning
              const filePath = (result as any).filePath || videoUrl;
              console.warn('Zidoo player launch failed, file path:', filePath);
              // Note: We don't show a warning overlay - the user can manually open Zidoo File Manager if needed
            }
          } catch (error: any) {
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            console.error('Error launching Zidoo player:', errorMessage);
            console.error('Full error object:', error);
            
            // Show error message to user
            alert(`Error launching Zidoo player\n\n${errorMessage}\n\nPlease open Zidoo File Manager manually and navigate to:\n${videoUrl}`);
          }
          return;
        }

        if (this.useKodiPlayer) {
          if (this.kodiOpenInProgress || this.kodiPlayerService.hasOpenInFlight()) {
            console.warn('[Player] Kodi open already in progress, skipping duplicate getVideo');
            return;
          }
          this.kodiOpenInProgress = true;
          console.log("[Player] Launching Kodi player via JSON-RPC");
          try {
          let kodiSubtitle: string | undefined;
          if (this.subtitle && this.subtitleUrl) {
            kodiSubtitle = this.apiConfig.transformStreamUrl(this.subtitleUrl);
          } else if (this.event?.subtitleFile) {
            kodiSubtitle = this.apiConfig.transformStreamUrl(
              this.apiConfig.transformUrl(this.event.subtitleFile)
            );
          }

          const connected = await this.kodiPlayerService.ensureConnected();
          if (!connected) {
            alert(
              "Cannot connect to Kodi JSON-RPC on port 9090.\n\n" +
                "In Kodi: Settings → Services → Control → enable\n" +
                "• Allow remote control from applications on this system\n" +
                "• Allow remote control from applications on other systems\n\n" +
                "If using Angular dev on a PC, open the app with ?platform=kodi&kodiHost=10.0.0.22"
            );
            return;
          }

          let kodiVideoUrl = this.apiConfig.transformStreamUrl(this.event.location);
          if (kodiVideoUrl.startsWith("http://") || kodiVideoUrl.startsWith("https://")) {
            kodiVideoUrl = kodiVideoUrl.replace(/ /g, "%20");
          }
          const fallbackUrl = this.event?.fallbackLocation
            ? this.apiConfig.transformStreamUrl(this.event.fallbackLocation)
            : undefined;
          let introUrl: string | undefined;
          if (
            this.event?.introLocation &&
            !(this.infoStore.videoInfo.seekTime > 0)
          ) {
            introUrl = this.apiConfig.transformStreamUrl(this.event.introLocation);
            console.log("[Player] CoreELEC/Kodi DV intro before movie:", introUrl);
          }

          console.log('[Player] Kodi URLs', {
            location: kodiVideoUrl,
            fallbackLocation: fallbackUrl,
            introLocation: introUrl,
            playbackMode: this.event?.playbackMode,
          });

          const success = await this.kodiPlayerService.openVideo(
            kodiVideoUrl,
            kodiSubtitle,
            fallbackUrl,
            introUrl
          );
          if (!success) {
            alert("Kodi could not open the video stream.");
            return;
          }

          this.activateKodiControlsUi();
          if (this.infoStore.videoInfo.seekTime > 0) {
            await this.kodiPlayerService.seek(this.infoStore.videoInfo.seekTime);
            this.currentTime = this.infoStore.videoInfo.seekTime;
          }
          } finally {
            this.kodiOpenInProgress = false;
          }
          return;
        }

        if (this.useExoPlayer) {
          // Use ExoPlayer for Android
          try {
            if (this.event?.playbackMode) {
              console.log("Plex playback mode:", this.event.playbackMode);
            }
            const subtitleTracks = Array.isArray(this.event?.subtitleTracks)
              ? this.event.subtitleTracks
              : [];
            let exoSubtitleFallback: string | undefined;
            if (this.subtitle && this.subtitleUrl) {
              exoSubtitleFallback = this.subtitleUrl;
            } else if (this.event?.subtitleFile) {
              exoSubtitleFallback = this.apiConfig.transformUrl(
                this.event.subtitleFile
              );
            }
            let fallbackStreamUrl = this.event?.fallbackLocation as string | undefined;
            if (fallbackStreamUrl) {
              fallbackStreamUrl = this.apiConfig.transformUrl(fallbackStreamUrl);
            }
            let introUrl: string | undefined;
            if (
              this.event?.introLocation &&
              !(this.infoStore.videoInfo.seekTime > 0)
            ) {
              introUrl = this.apiConfig.transformUrl(this.event.introLocation);
              console.log("[Player] DV intro before movie:", introUrl);
            }
            const loadSuccess = await this.exoPlayerService.loadVideo(
              videoUrl,
              exoSubtitleFallback,
              subtitleTracks,
              fallbackStreamUrl,
              introUrl
            );
            if (!loadSuccess) {
              console.error('Failed to load video in ExoPlayer');
              return;
            }
            
            await this.exoPlayerService.play();
            this.paused = false;
          } catch (error: any) {
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            console.error('Error loading/playing video:', errorMessage);
            console.error('Full error object:', error);
            return;
          }

          // Set up listeners for native control events
          console.log('=== BEFORE setupNativeControlListeners ===');
          console.log('useExoPlayer:', this.useExoPlayer);
          console.log('isAndroid:', this.isAndroid);

          // Set up time update listener for ExoPlayer
          // await this.exoPlayerService.addTimeUpdateListener((currentTime: number) => {
          //   this.currentTime = currentTime;
          //   const percentComplete =
          //     (this.currentTime / this.infoStore.videoInfo.duration) * 100;
          //   this.seekBar.nativeElement.style.width = `${percentComplete}%`;
          // });
          
        } else if (!this.useKodiPlayer) {
          // Use HTML5 video for web browsers
          console.log("VIDEO URL: ", videoUrl);
          
          this.videoElem.nativeElement.src = videoUrl;
          // this.videoElem.nativeElement.src =
          //   "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

          this.videoElem.nativeElement.addEventListener("timeupdate", () => {
            // Only update seekbar if user is not currently dragging
            // This prevents the seekbar from snapping back during dragging
            if (!this.isSeeking) {
              this.currentTime = this.videoElem.nativeElement.currentTime;
              const percentComplete =
                (this.currentTime / this.infoStore.videoInfo.duration) * 100;
              // console.log("TIMEUPDATE", Math.floor(this.currentTime));

              this.seekBar.nativeElement.style.width = `${percentComplete}%`;
            }
          });
          
          // Add event listener for metadata load to detect audio tracks
          this.videoElem.nativeElement.addEventListener("loadedmetadata", () => {
            this.detectAudioTracks();
          });
          
          this.videoElem.nativeElement.load();
          this.videoElem.nativeElement.play();
        }
      });
  }

  toggleSubtitle() {
    console.log("TOGGLE SUBTITLE", this.subtitle);

    this.subtitle = !this.subtitle;
  }

  /**
   * Detects available audio tracks from the HTML5 video element
   * Called after video metadata loads
   */
  detectAudioTracks() {
    if (this.useExoPlayer || this.useKodiPlayer || !this.videoElem?.nativeElement) {
      return;
    }

    const video = this.videoElem.nativeElement;
    console.log("VIDEO: ", video);
    console.log("AUDIO TRACKS: ", video.audioTracks);
    console.log("AUDIO TRACKS SUPPORTED: ", 'audioTracks' in video);
    console.log("AUDIO TRACKS SUPPORTED: ", 'audioTracks' in video);
    
    // Check browser support for audioTracks API
    if (!('audioTracks' in video)) {
      console.warn('AudioTracks API not supported in this browser');
      this.audioTracksSupported = false;
      this.hasMultipleAudioTracks = false;
      return;
    }

    this.audioTracksSupported = true;
    this.audioTracks = video.audioTracks;
    this.availableAudioTracks = [];

    if (!this.audioTracks || this.audioTracks.length === 0) {
      this.hasMultipleAudioTracks = false;
      return;
    }
    // console.log("AUDIO TRACKS: ", this.audioTracks);
    // Build array of available audio tracks
    for (let i = 0; i < this.audioTracks.length; i++) {
      const track = this.audioTracks[i];
      const trackInfo = {
        id: track.id || i,
        label: track.label || '',
        language: track.language || '',
        enabled: track.enabled || false,
        kind: track.kind || 'main'
      };
      
      this.availableAudioTracks.push(trackInfo);
      
      // Track which track is currently enabled
      if (track.enabled) {
        this.currentAudioTrackIndex = i;
      }
    }

    // Only show UI if there are multiple tracks
    this.hasMultipleAudioTracks = this.availableAudioTracks.length > 1;
    
    console.log('Audio tracks detected:', {
      count: this.availableAudioTracks.length,
      tracks: this.availableAudioTracks,
      currentIndex: this.currentAudioTrackIndex,
      hasMultiple: this.hasMultipleAudioTracks
    });
  }

  /**
   * Selects an audio track by index
   */
  selectAudioTrack(trackIndex: number) {
    if (!this.audioTracksSupported || !this.audioTracks) {
      console.warn('Cannot select audio track: API not supported or tracks not available');
      return;
    }

    if (trackIndex < 0 || trackIndex >= this.audioTracks.length) {
      console.warn('Invalid audio track index:', trackIndex);
      return;
    }

    // Disable all tracks first
    for (let i = 0; i < this.audioTracks.length; i++) {
      this.audioTracks[i].enabled = false;
    }

    // Enable the selected track
    this.audioTracks[trackIndex].enabled = true;
    this.currentAudioTrackIndex = trackIndex;

    const selectedTrack = this.availableAudioTracks[trackIndex];
    console.log('Selected audio track:', {
      index: trackIndex,
      label: selectedTrack.label || selectedTrack.language || `Track ${trackIndex + 1}`
    });

    // Hide the audio track list
    this.showAudioTrackList = false;
  }

  /**
   * Toggles the audio track list visibility
   */
  toggleAudioTrackList() {
    if (!this.hasMultipleAudioTracks) {
      return;
    }
    this.showAudioTrackList = !this.showAudioTrackList;
  }
  async ngOnInit(): Promise<void> {
    await this.apiConfig.ensureConfigLoaded();
    // Target CoreELEC/Kodi whenever kodiBoxIp is configured (desktop + iPhone Safari).
    this.apiConfig.enableKodiPlaybackTarget();
    this.useKodiPlayer = this.apiConfig.isKodiRemotePlayback();
    this.infoStore.videoInfo.browser = this.useKodiPlayer ? "Kodi" : "Safari";
    this.smartTv.changeVisibility(false);

    if (this.useKodiPlayer) {
      this.kodiStopUnsubscribe = this.kodiPlayerService.onNotification(
        "Player.OnStop",
        () => {
          this.kodiPlaybackActive = false;
          this.paused = true;
          this.stopKodiPositionPolling();
          this.hideControls();
        }
      );
      this.getVideo();
    } else if (this.useExoPlayer) {
      try {
        const initialized = await this.exoPlayerService.initialize("videoContainer");
        
        console.log("INITIALIZED: " , initialized);
        if (!initialized) {
          console.error("ExoPlayer initialization failed");
          this.useExoPlayer = false;
          this.getVideo();
        } else {
          console.log("=== Setting up native control listeners... ===");

          // Only call getVideo() after successful initialization
          this.getVideo();
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("Error initializing ExoPlayer:", error);
        this.useExoPlayer = false;
        this.getVideo();
      }
    } else {
      // Not using ExoPlayer, proceed with HTML5 video
      this.getVideo();
    }

    // ExoPlayer and Kodi use external/native players, not HTML controls
    if (!this.useExoPlayer && !this.useKodiPlayer) {
      setTimeout(() => {
        setTimeout(() => {
          // Only add if controlBtns exist and have elements
          if (this.controlBtns && this.controlBtns.length > 0) {
            this.smartTv.smartTv?.addCurrentList({
              startingList: true,
              listName: "controlBtns",
              startingIndex: 0,
              listElements: this.controlBtns,
            });
          }
        }, 500);
      });
    }
  }

  private async stopKodiPlayback(): Promise<void> {
    if (!this.useKodiPlayer) {
      return;
    }
    this.stopKodiPositionPolling();
    this.kodiPlaybackActive = false;
    try {
      await this.kodiPlayerService.stop();
    } catch (err) {
      console.warn('[Player] Kodi stop failed:', err);
    }
  }

  async ngOnDestroy(): Promise<void> {
    // Restore sidebar visibility when leaving the player
    this.smartTv.changeVisibility(true);
    // Clear controls timeout
    if (this.playPauseListener) {
      await this.playPauseListener.remove();
      this.playPauseListener = undefined; 

    }
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
    }
    if (this.useExoPlayer) {
      await this.exoPlayerService.release();
    }
    this.kodiStopUnsubscribe?.();
    this.pullVideoSub?.unsubscribe();
    if (this.useKodiPlayer) {
      this.kodiPlayerService.cancelPendingOpen();
      await this.stopKodiPlayback();
      await this.kodiPlayerService.disconnect();
    }
  }
}
