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

  @ViewChild("videoContainer") videoContainer!: ElementRef;
  @ViewChild("seekBar") seekBar!: ElementRef;
  @ViewChildren("controls") controls!: QueryList<ElementRef>;
  @ViewChild("videoElem") videoElem!: ElementRef;
  @ViewChildren("controlBtns") controlBtns!: QueryList<ElementRef>;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event);

    // Only handle navigation if controls are the current active list
    // For spacebar, always handle it regardless of list
    if (event.code === "Space") {
      this.playPause();
      return;
    }

    // Only navigate if there's an active list (controls might not be registered)
    if (!this.smartTv.smartTv || !this.smartTv.smartTv.currentListName) {
      return;
    }

    const ind = this.smartTv.smartTv?.navigate(event);
    console.log("THI IND: ", ind);
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
    this.useExoPlayer = this.isAndroid;
  }

  async playPause() {
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

  async seekBarClick($event: any) {
    var totalWidth = 1920;
    var percentage = $event.pageX / totalWidth;
    this.currentTime = Math.floor(
      this.infoStore.videoInfo.duration * percentage
    );
    console.log("CURRENTTIME: ", this.currentTime);

    if (this.useExoPlayer) {
      await this.exoPlayerService.pause();
      await this.exoPlayerService.seekTo(this.currentTime);
      this.paused = true;
    } else {
      this.videoElem.nativeElement.pause();
      this.infoStore.videoInfo.seekTime = this.currentTime;
      console.log("EVVENT: ", this.event, this.currentTime);
      if (this.event.fileformat === "dvhe" || this.event.fileformat === "dvh1") {
        this.videoElem.nativeElement.currentTime = this.currentTime;
      } else {
        this.getVideo();
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
    console.log(
      "VIDEO INFO: ",
      this.infoStore.videoInfo,
      Object.keys(this.infoStore.videoInfo).includes("epNumber")
    );
    if (Object.keys(this.infoStore.videoInfo).includes("epNumber")) {
      console.log("A SHOW");
      console.log("SENDING OUT: ", this.infoStore.videoInfo, this.event);

      this.show = true;
    } else {
      console.log("A MOVIE");
      this.show = false;
    }
    this.subtitle = this.infoStore.videoInfo.srtUrl ? true : false;
    if (this.infoStore.videoInfo.srtUrl) {
      this.subtitleUrl = this.apiConfig.transformUrl(this.infoStore.videoInfo.srtUrl);
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
        console.log("EVENT: ", this.event);
        this.infoStore.videoInfo.pid = this.event.pid;

        let videoUrl = this.event.location.replace(
          new RegExp(" ", "g"),
          "%20"
        );
        // Transform URL to use IP address on Android
        videoUrl = this.apiConfig.transformUrl(videoUrl);

        if (this.useExoPlayer) {
          // Use ExoPlayer for Android
          await this.exoPlayerService.loadVideo(
            videoUrl,
            this.subtitle ? this.subtitleUrl : undefined
          );
          await this.exoPlayerService.play();
          this.paused = false;

          // Set up time update listener for ExoPlayer
          await this.exoPlayerService.addTimeUpdateListener((currentTime: number) => {
            this.currentTime = currentTime;
            const percentComplete =
              (this.currentTime / this.infoStore.videoInfo.duration) * 100;
            this.seekBar.nativeElement.style.width = `${percentComplete}%`;
          });
        } else {
          // Use HTML5 video for web browsers
          console.log("VIDEO URL: ", videoUrl);
          
          this.videoElem.nativeElement.src = videoUrl;
          // this.videoElem.nativeElement.src =
          //   "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

          this.videoElem.nativeElement.addEventListener("timeupdate", () => {
            this.currentTime = this.videoElem.nativeElement.currentTime;
            const percentComplete =
              (this.currentTime / this.infoStore.videoInfo.duration) * 100;
            // console.log("TIMEUPDATE", Math.floor(this.currentTime));

            this.seekBar.nativeElement.style.width = `${percentComplete}%`;
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

  async ngOnInit(): Promise<void> {
    console.log("INFO STORE: ", this.infoStore.videoInfo);
    // this.location = this.infoStore.videoInfo.location
    this.infoStore.videoInfo.browser = "Safari";
    this.smartTv.changeVisibility(false);

    // Initialize ExoPlayer on Android
    if (this.useExoPlayer) {
      try {
        const initialized = await this.exoPlayerService.initialize("videoContainer");
        if (!initialized) {
          console.warn("ExoPlayer initialization failed, falling back to HTML5 video");
          this.useExoPlayer = false;
        }
      } catch (error) {
        console.error("Error initializing ExoPlayer:", error);
        console.error("Error details:", error instanceof Error ? error.message : String(error));
        // Fall back to HTML5 video if ExoPlayer fails
        this.useExoPlayer = false;
      }
    }

    this.getVideo();

    setTimeout(() => {
      setTimeout(() => {
        this.smartTv.smartTv?.addCurrentList({
          startingList: true,
          listName: "controlBtns",
          startingIndex: 0,
          listElements: this.controlBtns,
        });
      }, 500);
    });
  }

  async ngOnDestroy(): Promise<void> {
    // Restore sidebar visibility when leaving the player
    this.smartTv.changeVisibility(true);
    if (this.useExoPlayer) {
      await this.exoPlayerService.release();
    }
  }
}
