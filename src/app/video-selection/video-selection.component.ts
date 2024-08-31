import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  QueryList,
  ViewChildren,
  HostListener,
  SecurityContext,
} from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { InfoStoreService, movieInfo } from "../info-store.service";
import { DomSanitizer } from "@angular/platform-browser";
import { SideBarComponent } from "../side-bar/side-bar.component";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";

@Component({
  selector: "app-video-selection",
  templateUrl: "./video-selection.component.html",
  styleUrls: ["./video-selection.component.css"],
})
export class VideoSelectionComponent implements OnInit {
  title = "demoSmartTvLib";
  index = 0;
  movies: Array<movieInfo> = [];
  currentBox: movieInfo = this.infoStore.videoInfo;
  poster: string | undefined = "";

  constructor(
    private http: HttpClient,
    private router: Router,
    private infoStore: InfoStoreService,
    private smartTv: SmartTvLibSingletonService
  ) {}

  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("image") image!: ElementRef;
  @ViewChild("backgroundPlacer") backgroundPlacer!: ElementRef;
  @ViewChildren("boxes") boxes!: QueryList<ElementRef<any>>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;
  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event);

    const ind = this.smartTv.smartTv?.navigate(event);
    console.log("THI IND: ", ind);
    if (ind?.borderReached === "left edge") {
      this.smartTv.smartTv?.switchList("sideBar", 0);
    }
    if (
      ind?.borderReached === "right edge" &&
      ind.currentListName === "sideBar"
    ) {
      this.smartTv.smartTv?.switchList("movies", 0);
    }
    if (
      ind?.borderReached === "right edge" &&
      ind.currentListName === "movies"
    ) {
      this.smartTv.smartTv?.wrapRight();
    }
  }

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    console.log(event.target.innerWidth);
    this.smartTv.smartTv?.windowResize();
  }

  delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  selectMovie() {
    console.log(this.index, this.movies[this.index]);
    this.infoStore.videoInfo = this.movies[this.index];
    this.router.navigateByUrl("/overview");
  }

  onHover(e: number, listName: string) {
    console.log("EVVVENMT: ", e, listName);
    if (listName === "movies") {
      const ind = this.smartTv.smartTv?.findAndSetIndex(e, listName);
      this.index = ind.index;
    }
    // if (listName === "sideBar") {
    //   this.smartTv.findAndSetIndex(e, "sideBar");
    // }
  }

  async onImageLoad() {
    this.image.nativeElement.style.opacity = "1";
  }

  ngOnInit() {
    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });

    this.http
      .post(`http://192.168.0.154:4012/api/mov/movies`, { pid: 0 })
      .subscribe((res: any) => {
        console.log("RES: ", res, this.boxes);

        this.movies = res;
        this.currentBox = res[this.index];
        this.poster = this.currentBox.backgroundPoster;
        setTimeout(() => {
          console.log("SMART TV VIDEO: ", this.smartTv);

          this.smartTv.smartTv?.addCurrentList({
            startingList: true,
            listName: "movies",
            startingIndex: 0,
            listElements: this.boxes,
          });
        }, 1000);
      });
  }
}
