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
} from "@angular/core";
import { InfoStoreService } from "../info-store.service";
import { HttpClient } from "@angular/common/http";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";

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
export class PlayerComponent implements OnInit {
  location: SafeResourceUrl = "";
  index: number = 0;
  currentTime: number = 0;
  event: any;
  show: boolean = false;

  @ViewChild("videoContainer") videoContainer!: ElementRef;
  @ViewChild("seekBar") seekBar!: ElementRef;
  @ViewChildren("controls") controls!: QueryList<ElementRef>;
  @ViewChild("videoElem") videoElem!: ElementRef;
  @ViewChildren("controlBtns") controlBtns!: QueryList<ElementRef>;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event);

    const ind = this.smartTv.smartTv?.navigate(event);
    console.log("THI IND: ", ind);
  }

  constructor(
    private infoStore: InfoStoreService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private smartTv: SmartTvLibSingletonService
  ) {}

  seekBarClick($event: any) {
    var totalWidth = 1920;
    var percentage = $event.pageX / totalWidth;
    this.currentTime = Math.floor(
      this.infoStore.videoInfo.duration * percentage
    );
    this.videoElem.nativeElement.pause();
    console.log("CURRENTTIME: ", this.currentTime);

    this.infoStore.videoInfo.seekTime = this.currentTime;
    console.log("EVVENT: ", this.event, this.currentTime);
    if (this.event.fileformat === "dvhe" || this.event.fileformat === "dvh1") {
      this.videoElem.nativeElement.currentTime = this.currentTime;
    } else {
      this.getVideo();
    }
  }

  getNextEp() {
    this.http
      .post(
        `http://192.168.0.154:4012/api/mov/nextep`,
        this.infoStore.videoInfo
      )
      .subscribe((res: any) => {
        console.log("NEXT EP: ", res);
        this.infoStore.videoInfo = res[0];
        this.infoStore.videoInfo.seekTime = 0;
        this.infoStore.videoInfo.browser = "Safari";
        this.videoElem.nativeElement.pause();
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

    if (this?.event?.pid) {
      this.infoStore.videoInfo.pid = this.event.pid;
    }

    this.http
      .post(
        "http://192.168.0.154:4012/api/mov/pullVideo",
        this.infoStore.videoInfo
      )
      .subscribe((event: any) => {
        this.event = event;
        console.log("EVENT: ", this.event);
        this.infoStore.videoInfo.pid = this.event.pid;

        this.videoElem.nativeElement.src = this.event.location.replace(
          new RegExp(" ", "g"),
          "%20"
        );
        // this.videoElem.nativeElement.src =
        //   "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

        this.videoElem.nativeElement.addEventListener("timeupdate", () => {
          this.currentTime += 0.25;
          const percentComplete =
            (this.currentTime / this.infoStore.videoInfo.duration) * 100;
          console.log("TIMEUPDATE", Math.floor(this.currentTime));

          this.seekBar.nativeElement.style.width = `${percentComplete}%`;
        });
        this.videoElem.nativeElement.load();
        this.videoElem.nativeElement.play();
      });
  }

  ngOnInit(): void {
    console.log(this.infoStore);
    // this.location = this.infoStore.videoInfo.location
    this.infoStore.videoInfo.browser = "Safari";

    // this.getVideo();

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
}
