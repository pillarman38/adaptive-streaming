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
import { SideBarComponent } from "../side-bar/side-bar.component";
import { HttpClient } from "@angular/common/http";
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
  index = 0;
  transmuxToPixie: boolean = false;

  constructor(
    private infoStore: InfoStoreService,
    private router: Router,
    private renderer: Renderer2,
    private http: HttpClient,
    private smartTv: SmartTvLibSingletonService
  ) {}

  @ViewChild("right") right!: ElementRef;
  @ViewChild("left") left!: ElementRef;
  @ViewChild("nav") nav!: ElementRef;
  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("iframePlacer") iframePlacer!: ElementRef;
  @ViewChild("castList") castList!: ElementRef;
  @ViewChild("info") info!: ElementRef;
  @ViewChildren("playBtn") playBtn!: QueryList<ElementRef>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;
  @ViewChild(SideBarComponent) sideBarComponent!: SideBarComponent;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event);

    // Only handle navigation if playBtn or sideBar is the current active list
    if (!this.smartTv.smartTv || 
        (this.smartTv.smartTv.currentListName !== "playBtn" && 
         this.smartTv.smartTv.currentListName !== "sideBar")) {
      return;
    }

    const ind = this.smartTv.smartTv?.navigate(event);
    console.log("THI IND: ", ind);

    const isEnterKey = event.code === "Enter" || 
    event.code === "NumpadEnter" || 
    event.key === "Enter" ||
    event.keyCode === 13;

    if (isEnterKey) {
      this.playMovie();
    }

    if (
      ind?.borderReached === "right edge" &&
      ind?.currentListName === "playBtn"
    ) {
      this.smartTv.smartTv?.switchList("sideBar", 0);
    }

    if (
      ind?.borderReached === "left edge" &&
      ind?.currentListName === "playBtn"
    ) {
      this.smartTv.smartTv?.switchList("sideBar", 0);
    }

    if (
      ind?.borderReached === "right edge" &&
      ind?.currentListName === "sideBar"
    ) {
      this.smartTv.smartTv?.switchList("playBtn", 0);
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
    // const iframeHtml = `<iframe id="youtubeFrame" style="width: 100%; height: 100%;"
    // src="https://www.youtube.com/embed/${this.trailer}?autoplay=1&controls=0&rel=0&fs=0&modestbranding=1&showinfo=0&fs=0" frameborder="0">
    // </iframe>`;
    // const divElement = this.renderer.createElement("div");
    // divElement.id = "iframeHolder";
    // this.renderer.setProperty(divElement, "innerHTML", iframeHtml);
    // Append the div (with iframe) to the container
    // this.renderer.appendChild(this.iframePlacer.nativeElement, divElement);
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
    this.http
      .post(
        `http://pixable.local:5012/api/mov/transmux`,
        this.infoStore.videoInfo
      )
      .subscribe((res: any) => {
        this.transmuxToPixie = res;
      });
  }

  ngOnInit(): void {
    console.log("INFOO: ", this.infoStore.videoInfo);
    if (this.infoStore.videoInfo.transmuxToPixie === 0) {
      this.transmuxToPixie = false;
    } else {
      this.transmuxToPixie = true;
    }
    this.plot = this.infoStore.videoInfo.overview;
    this.cast = JSON.parse(this.infoStore.videoInfo.cast);
    this.coverArt = this.infoStore.videoInfo.coverArt;
    console.log("PID: ", this.infoStore.videoInfo.pid);
    this.smartTv.changeVisibility(true);

    setTimeout(() => {
      // console.log(
      //   "SIDEBAR: ",
      //   this.sideBarComponent,
      //   this.smartTv.smartTv?.listsArr
      // );

      this.smartTv.smartTv?.addCurrentList({
        startingList: true,
        listName: "playBtn",
        startingIndex: 0,
        listElements: this.playBtn,
      });
      this.smartTv.smartTv?.setCurrentIndex(0);
      // Removed unsafe assignment to an optional property (currentIndex)
    }, 1000);

    if (this.infoStore.videoInfo.pid > 0) {
      console.log("INSIDE PID: ");

      this.http
        .post(`http://pixable.local:5012/api/mov/pidkill`, {
          pid: this.infoStore.videoInfo.pid,
        })
        .subscribe((res) => {
          console.log("RESPONDED: ", res);
        });
    }
  }
}
