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
} from "@angular/core";
import { InfoStoreService, movieInfo } from "../info-store.service";
import { Router } from "@angular/router";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { SmartTvComponent } from "smart-tv";
import { SideBarComponent } from "../side-bar/side-bar.component";
import { HttpClient } from "@angular/common/http";

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
export class OverviewComponent implements OnInit, AfterViewInit {
  plot: string = "";
  idx: any;
  cast: Array<any> = [];
  trailer: string = "";
  coverArt = "";
  currentBox: movieInfo = this.infoStore.videoInfo;
  smartTv: any;
  index = 0;

  @ViewChild("right") right!: ElementRef;
  @ViewChild("left") left!: ElementRef;
  @ViewChild("nav") nav!: ElementRef;
  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("iframePlacer") iframePlacer!: ElementRef;
  @ViewChild("castList") castList!: ElementRef;
  @ViewChild("info") info!: ElementRef;
  @ViewChildren("playBtn") playBtn!: QueryList<ElementRef>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event);

    this.smartTv.shifter(event);
    const ind = this.smartTv.getCurrentIndex();
    console.log("THI IND: ", ind);

    if (ind.list.name === "playBtn") {
      if (event.key === "Enter") {
        console.log(this.index, this.infoStore.videoInfo);
        this.playMovie();
      }
    }

    if (ind.list.name === "sideBar") {
      this.index = ind.index;

      console.log("SIDE BAR: ", event);

      if (event.key === "Enter") {
        // console.log(this.index, this.movies[this.index]);
        // this.infoStore.videoInfo = this.movies[this.index];
        if (this.index === 0) {
          this.router.navigateByUrl("/search");
        }
        if (this.index === 1) {
          this.router.navigateByUrl("/videoSelection");
        }
        if (this.index === 2) {
          this.router.navigateByUrl("/tv");
        }
      }
    }
  }

  constructor(
    private infoStore: InfoStoreService,
    private router: Router,
    private renderer: Renderer2,
    private http: HttpClient
  ) {
    // this.smartTv = new SmartTvComponent();
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
    this.castList.nativeElement.style.opacity = "1";
    this.info.nativeElement.style.opacity = "1";
  }

  hoverOut() {
    this.castList.nativeElement.style.opacity = "0";
    this.info.nativeElement.style.opacity = "0";
  }

  ngAfterViewInit() {
    this.trailer = this.infoStore.videoInfo.trailerUrl.replace(
      new RegExp(" ", "g"),
      "%20"
    );
    const iframeHtml = `<iframe id="youtubeFrame" style="width: 100%; height: 100%;"
    src="https://www.youtube.com/embed/${this.trailer}?autoplay=1&controls=0&rel=0&fs=0&modestbranding=1&showinfo=0&fs=0" frameborder="0">
    </iframe>`;
    const divElement = this.renderer.createElement("div");
    divElement.id = "iframeHolder";
    this.renderer.setProperty(divElement, "innerHTML", iframeHtml);

    // Append the div (with iframe) to the container
    this.renderer.appendChild(this.iframePlacer.nativeElement, divElement);
    setTimeout(() => {
      // coverArt.style.opacity = "0"
      // coverArt.style.transition = "opacity 2.0s"
      // plotSection.style.opacity = "0"
      // plotSection.style.transition = "opacity 2.0s"
      this.castList.nativeElement.style.opacity = "0";
      this.info.nativeElement.style.opacity = "0";

      // this.castList.style.transition = "opacity 2.0s"
    }, 3000);
  }

  ngOnInit(): void {
    this.plot = this.infoStore.videoInfo.overview;
    this.cast = JSON.parse(this.infoStore.videoInfo.cast);
    this.coverArt = this.infoStore.videoInfo.coverArt;
    console.log("PID: ", this.infoStore.videoInfo.pid);

    if (this.infoStore.videoInfo.pid > 0) {
      console.log("INSIDE PID: ");

      this.http
        .post(`http://192.168.0.154:4012/api/mov/pidkill`, {
          pid: this.infoStore.videoInfo.pid,
        })
        .subscribe((res) => {
          console.log("RESPONDED: ", res);
        });
    }

    setTimeout(() => {
      this.smartTv.addOrChangeElems(
        [
          {
            name: "playBtn",
            elements: this.playBtn,
            listDirections: [
              {
                moveToNewListOn: {
                  direction: "left",
                },
                newFocusList: "sideBar",
              },
            ],
          },
          {
            name: "sideBar",
            elements: this.sideBar.homepageList,
            wrap: false,
            listDirections: [
              {
                moveToNewListOn: {
                  direction: "right",
                },
                newFocusList: "playBtn",
              },
            ],
          },
        ],
        {
          listToStartWith: "playBtn",
          indexOfStart: 0,
          delay: 500,
        }
      );
    }, 500);
  }
}
