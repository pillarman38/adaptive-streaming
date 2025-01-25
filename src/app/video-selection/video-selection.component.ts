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
  offset: number = 0;

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
  @ViewChild("list") list!: ElementRef;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    // console.log("EVENT: ", event);

    const ind = this.smartTv.smartTv?.navigate(event);

    this.index = ind?.currentIndex || 0;
    console.log("INDEX: ", this.index, this.boxes.length);
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

    if (this.index === this.boxes.length - 1) {
      console.log("INDEX GREATER THAN: ", this.index, this.boxes.length);

      this.loadMoreItems();
    }

    if (ind?.currentListName === "movies") {
      // console.log("CURRENT LIST: ", ind);
      this.infoStore.checkBorderOverflow(ind);
      await this.updateCurrentBox();
    }

    if (event.code === "Enter" && ind?.currentListName === "movies") {
      this.selectMovie();
    }
    if (event.code === "Enter" && ind?.currentListName === "sideBar") {
      switch (ind?.currentIndex) {
        case 0:
          this.router.navigateByUrl("/search");
          break;
        case 1:
          this.router.navigateByUrl("/videoSelection");
          break;
        case 2:
          this.router.navigateByUrl("/tv");
          break;
      }
    }
  }

  async updateCurrentBox() {
    this.currentBox = this.movies[this.index];
    this.image.nativeElement.style.opacity = "0";
    await this.delay(1000);

    this.poster = this.currentBox.backgroundPoster;
    this.delay(1000);
    this.image.nativeElement.style.opacity = "1";
    // console.log("CURRENT MOVIE: ", this.currentBox);
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
    console.log("SELECTED MOVIE: ", this.index, this.movies[this.index]);
    this.infoStore.videoInfo = this.movies[this.index];
    this.router.navigateByUrl("/overview");
  }

  async onHover(e: number, listName: string) {
    const ind = this.smartTv.smartTv?.findAndSetIndex(e, listName);
    // console.log("IND MOVIE: ", ind);

    if (ind?.currentListName === "movies") {
      this.index = e;
      console.log("INDEX MOVIE TWO: ", this.index);

      await this.updateCurrentBox();
    }
  }

  async onImageLoad() {
    this.image.nativeElement.style.opacity = "1";
  }

  loadMoreItems() {
    console.log("LOADING MORE ITEMS");

    this.http
      .post(`http://192.168.1.6:5012/api/mov/movies`, {
        pid: 0,
        offset: this.offset,
      })
      .subscribe((response: any) => {
        if (!response.message) {
          console.log("RES: ", response);

          this.movies = this.movies.concat(response);
          console.log("MOVIES: ", this.movies.length);

          this.offset += response.length;
          console.log("BOXES LENGTH: ", this.boxes.length);

          // setTimeout(() => {
          this.smartTv.smartTv?.updateList({
            listName: "movies",
            startingIndex: 0,
            listElements: this.boxes,
          });
          // }, 1000);

          console.log("BOXES AFTER: ", this.boxes.length);

          console.log("SMART TV VIDEO: ", this.smartTv.smartTv);
        } else {
          console.log("NO MORE MOVIES");
        }
      });
  }

  ngAfterViewInit() {
    this.list.nativeElement.addEventListener("scroll", () => {
      if (
        this.list.nativeElement.scrollTop +
          this.list.nativeElement.offsetHeight >=
        this.list.nativeElement.scrollHeight
      ) {
        this.loadMoreItems();
      }
    });
  }

  ngOnInit() {
    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });

    this.http
      .post(`http://192.168.1.6:5012/api/mov/movies`, {
        pid: 0,
        offset: this.offset,
      })
      .subscribe((res: any) => {
        console.log("RES: ", res, this.boxes);

        this.movies = res;
        this.offset += res.length;
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
