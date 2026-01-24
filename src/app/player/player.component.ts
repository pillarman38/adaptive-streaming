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
} from "@angular/core";
import { InfoStoreService } from "../info-store.service";
import { HttpClient } from "@angular/common/http";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
import { PlatformService } from "../services/platform.service";
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
  controlsVisible: boolean = false;
  controlsTimeout: any = null;
  playPauseListener: any = null;
  timeUpdateListener: any = null;
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

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event.code, event.key, event.keyCode);

    // Show controls when arrow keys are pressed (for Nvidia Shield remote)
    if(event.code === "ArrowUp" || event.code === "ArrowDown" || event.code === "ArrowLeft" || event.code === "ArrowRight") {
      if (!this.controlsVisible) {
        // this.showControls();
      } else {
        // Controls already visible - reset the timeout to keep them visible during navigation
        this.resetControlsTimeout();
      }
      
      // For native Android controls, let them handle navigation
      // Don't interfere with native focus navigation
      if (this.useExoPlayer && this.isAndroid) {
        // Native controls handle their own focus, just keep them visible
        return;
      }
    }
    
    // Only handle navigation if controls are the current active list
    // For spacebar, always handle it regardless of list
    if (event.code === "Space") {
      // this.playPause();
      return;
    }

    // Only navigate if there's an active list (controls might not be registered)
    // This is for HTML controls on web, not native Android controls
    if (!this.smartTv.smartTv || !this.smartTv.smartTv.currentListName) {
      return;
    }

    const ind = this.smartTv.smartTv?.navigate(event);
    // console.log("THI IND: ", ind);
    
    // Reset controls timeout when navigating HTML controls
    if (ind && !this.useExoPlayer) {
      this.resetControlsTimeout();
    }
  }

  // showControls() {
  //   this.controlsVisible = true;
    
  //   // Show native Android controls if using ExoPlayer
  //   if (this.useExoPlayer && this.isAndroid) {
  //     this.exoPlayerService.showControls();
  //   }
    
  //   // Clear existing timeout
  //   if (this.controlsTimeout) {
  //     clearTimeout(this.controlsTimeout);
  //   }
    
  //   // Hide controls after 5 seconds of inactivity
  //   this.controlsTimeout = setTimeout(() => {
  //     this.hideControls();
  //   }, 5000);
  // }

  hideControls() {
    this.controlsVisible = false;
    
    // Hide native Android controls if using ExoPlayer
    if (this.useExoPlayer && this.isAndroid) {
      // this.exoPlayerService.hideControls();
    }
    
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
      this.controlsTimeout = null;
    }
  }
  
  resetControlsTimeout() {
    // Reset the auto-hide timer - called during navigation to keep controls visible
    // if (this.controlsVisible) {
    //   if (this.controlsTimeout) {
    //     clearTimeout(this.controlsTimeout);
    //   }
    //   this.controlsTimeout = setTimeout(() => {
    //     // this.hideControls();
    //   }, 5000);
    // }
  }

  constructor(
    private infoStore: InfoStoreService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private smartTv: SmartTvLibSingletonService,
    private platformService: PlatformService,
    private exoPlayerService: ExoPlayerService,
    private apiConfig: ApiConfigService,
  ) {
    this.isAndroid = this.platformService.isAndroid();
    // Don't use ExoPlayer for Zidoo devices - they have their own player
    this.useExoPlayer = this.isAndroid && !this.platformService.isZidoo();
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
    } else {
      const currentPos = this.videoElem.nativeElement.currentTime;
      const newTime = Math.max(0, currentPos + skipBy);
      this.videoElem.nativeElement.currentTime = newTime;
      this.currentTime = newTime;
    }
  }

  async seekBarClick($event: MouseEvent, skipReload: boolean = false) {
    if (!this.seekBar || !this.seekBar.nativeElement) {
      return;
    }

    const seekSpace = this.seekBar.nativeElement.parentElement;
    if (!seekSpace) {
      return;
    }

    // Get the actual width of the seekbar container
    const rect = seekSpace.getBoundingClientRect();
    const clickX = $event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    
    this.currentTime = Math.floor(
      this.infoStore.videoInfo.duration * percentage
    );
    console.log("SEEK TO: ", this.currentTime, "of", this.infoStore.videoInfo.duration);

    if (this.useExoPlayer) {
      await this.exoPlayerService.seekTo(this.currentTime);
    } else {
      // For Dolby Vision files, just set currentTime directly
      if (this.event.fileformat === "dvhe" || this.event.fileformat === "dvh1") {
        this.videoElem.nativeElement.currentTime = this.currentTime;
      } else {
        // For non-DV files, only reload if not dragging (skipReload = false)
        if (!skipReload) {
          this.videoElem.nativeElement.pause();
          this.infoStore.videoInfo.seekTime = this.currentTime;
          this.getVideo();
        } else {
          // During dragging, just update the visual position
          // The actual seek will happen on mouse up
          this.videoElem.nativeElement.pause();
        }
      }
    }
  }

  onSeekBarMouseDown($event: MouseEvent) {
    this.isSeeking = true;
    
    // Store whether video was playing before seeking
    if (this.useExoPlayer) {
      // For ExoPlayer, we'll check the paused state
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
      if (!this.useExoPlayer && this.event.fileformat !== "dvhe" && this.event.fileformat !== "dvh1") {
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
      if (!this.useExoPlayer && this.event.fileformat !== "dvhe" && this.event.fileformat !== "dvh1") {
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
        this.infoStore.videoInfo.browser = "Safari";
        if (this.useExoPlayer) {
          await this.exoPlayerService.pause();
        } else {
          this.videoElem.nativeElement.pause();
        }
        this.getVideo();
      });
  }

  getVideo() {
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

    // Add device name to videoInfo for transcoder
    const videoInfoWithDevice = {
      ...this.infoStore.videoInfo,
      device: this.platformService.getDeviceName()
    };

    this.http
      .post(
        `${this.apiConfig.getBaseUrl()}/api/mov/pullVideo`,
        videoInfoWithDevice
      )
      .subscribe(async (event: any) => {
        this.event = event;
        // console.log("EVENT: ", this.event);
        this.infoStore.videoInfo.pid = this.event.pid;

        let videoUrl = this.event.location.replace(
          new RegExp(" ", "g"),
          "%20"
        );
        // Transform URL to use IP address on Android
        console.log("VIDEO URL: ", videoUrl);
        
        videoUrl = this.apiConfig.transformUrl(videoUrl);
        console.log("USING EXOPLAYER: ", this.useExoPlayer);
        console.log("IS ZIDOO: ", this.platformService.isZidoo());
        
        // Check if Zidoo device - launch Zidoo player instead
        const isZidooDevice = this.platformService.isZidoo();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'player.component.ts:292',message:'Checking if Zidoo device',data:{isZidooDevice,deviceName:this.platformService.getDeviceName()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        if (isZidooDevice) {
          console.log("Zidoo device detected - launching Zidoo player");
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'player.component.ts:295',message:'Attempting to launch Zidoo player',data:{videoUrl:videoUrl.substring(0,50),title:this.infoStore.videoInfo.title},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          try {
            const title = this.infoStore.videoInfo.title || "";
            const position = 0; // Start from beginning, could be enhanced to support resume
            const result = await this.exoPlayerService.launchZidooPlayer(videoUrl, title, position);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'player.component.ts:300',message:'Zidoo player launch result',data:{success:result.success,fallback:result.fallback},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
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
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/949eafb2-bfe9-406c-822d-06a299cb45e3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'player.component.ts:308',message:'Zidoo player launch error',data:{errorMessage,error:JSON.stringify(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            console.error('Error launching Zidoo player:', errorMessage);
            console.error('Full error object:', error);
            
            // Show error message to user
            alert(`Error launching Zidoo player\n\n${errorMessage}\n\nPlease open Zidoo File Manager manually and navigate to:\n${videoUrl}`);
          }
          return; // Don't continue with ExoPlayer or HTML5 video
        }
        
        if (this.useExoPlayer) {
          // Use ExoPlayer for Android
          try {
            const loadSuccess = await this.exoPlayerService.loadVideo(
              videoUrl,
              this.subtitle ? this.subtitleUrl : undefined
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
          
        } else {
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
    if (this.useExoPlayer || !this.videoElem?.nativeElement) {
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

  async controlsdSetup() {
    // this.playPauseListener = await this.exoPlayerService.addListener('playPause', (data?: any) => {
    //   console.log('[PlayerComponent] === playPause event received from native ===');
    //   console.log('[PlayerComponent] playPause callback data:', data); 
    //   this.playPause();
    // });
    // this.timeUpdateListener = await this.exoPlayerService.addListener('timeupdate', (data?: any) => {
    //   // console.log('[PlayerComponent] === timeupdate event received from native ===');
    //   // console.log('[PlayerComponent] timeupdate callback data:', data); 
    //   this.currentTime = data.currentTime;
    // }); 
  }

  async ngOnInit(): Promise<void> {
    // console.log("INFO STORE: ", this.infoStore.videoInfo);
    // this.location = this.infoStore.videoInfo.location
    this.infoStore.videoInfo.browser = "Safari";
    this.smartTv.changeVisibility(false);

    // Initialize ExoPlayer on Android
    if (this.useExoPlayer) {
      try {
        const initialized = await this.exoPlayerService.initialize("videoContainer");
        
        console.log("INITIALIZED: " , initialized);
        
        if (!initialized) {
          console.warn("ExoPlayer initialization failed, falling back to HTML5 video");
          this.useExoPlayer = false;
          // Continue to getVideo() with HTML5 fallback
          this.getVideo();
        } else {
          console.log("=== Setting up native control listeners... ===");
          
          await this.controlsdSetup();
          
          // Only call getVideo() after successful initialization
          this.getVideo();
        }
      } catch (error) {
        console.error("Error initializing ExoPlayer:", error);
        console.error("Error details:", error instanceof Error ? error.message : String(error));
        // Fall back to HTML5 video if ExoPlayer fails
        this.useExoPlayer = false;
        // Continue to getVideo() with HTML5 fallback
        this.getVideo();
      }
    } else {
      // Not using ExoPlayer, proceed with HTML5 video
      this.getVideo();
    }

    // Only add controlBtns to Smart TV navigation if not using ExoPlayer
    // (ExoPlayer uses native Android controls, not HTML controls)
    if (!this.useExoPlayer) {
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
  }
}
