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
import { SmartTvComponent } from "smart-tv";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { InfoStoreService, movieInfo } from "../info-store.service";
import { DomSanitizer } from "@angular/platform-browser";
import { SideBarComponent } from "../side-bar/side-bar.component";

@Component({
  selector: "app-video-selection",
  templateUrl: "./video-selection.component.html",
  styleUrls: ["./video-selection.component.css"],
})
export class VideoSelectionComponent implements OnInit {
  title = "demoSmartTvLib";
  smartTv: any;
  index = 0;
  movies: Array<movieInfo> = [];
  currentBox: movieInfo = this.infoStore.videoInfo;
  poster: string | undefined = "";

  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("image") image!: ElementRef;
  @ViewChild("backgroundPlacer") backgroundPlacer!: ElementRef;
  @ViewChildren("boxes") boxes!: QueryList<ElementRef>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event);

    this.smartTv.shifter(event);
    const ind = this.smartTv.getCurrentIndex();
    console.log("THI IND: ", ind);

    if (ind.list.name === "movies") {
      this.index = ind.index;
      console.log("THE INDEX: ", this.index);

      this.currentBox = this.movies[this.index];
      console.log(this.currentBox);

      this.image.nativeElement.style.opacity = "0";
      await this.delay(1000);

      console.log("NEW POSTER: ", this.currentBox.backgroundPoster);

      this.poster = this.currentBox.backgroundPoster;
      this.delay(1000);
      this.image.nativeElement.style.opacity = "1";

      if (event.key === "Enter") {
        console.log(this.index, this.movies[this.index]);
        this.infoStore.videoInfo = this.movies[this.index];

        this.router.navigateByUrl("/overview");
      }
    }

    if (ind.list.name === "sideBar") {
      this.index = ind.index;

      console.log("SIDE BAR: ", event);

      if (event.key === "Enter") {
        console.log(this.index, this.movies[this.index]);
        this.infoStore.videoInfo = this.movies[this.index];
        if (this.index === 0) {
          this.router.navigateByUrl("/videoSelection");
        }
        if (this.index === 2) {
          this.router.navigateByUrl("/tv");
        }
      }
    }
  }

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    console.log(event.target.innerWidth);
    this.smartTv.windowResize();
  }

  constructor(
    private http: HttpClient,
    private router: Router,
    private infoStore: InfoStoreService,
    private sanitizer: DomSanitizer
  ) {
    this.smartTv = new SmartTvComponent();
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
    console.log("EVVVENMT: ", e);
    if (listName === "movies") {
      const ind = this.smartTv.findAndSetIndex(e, "movies");
      this.index = ind.index;
    }
    if (listName === "sideBar") {
      this.smartTv.findAndSetIndex(e, "sideBar");
    }
  }

  async onImageLoad() {
    this.image.nativeElement.style.opacity = "1";
  }

  ngAfterViewInit() {
    console.log("HOMEPAGE LIST: ", this.sideBar);
    this.smartTv.currentBox = 0;
  }

  ngOnInit() {
    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });

    this.http
      .post(`http://192.168.0.153:4012/api/mov/movies`, { pid: 0 })
      .subscribe((res: any) => {
        console.log("RES: ", res, this.boxes);

        this.movies = res;
        this.currentBox = res[this.index];
        this.poster = this.currentBox.backgroundPoster;

        this.smartTv.addOrChangeElems(
          [
            {
              name: "movies",
              elements: this.boxes,
              listDirections: [
                {
                  moveToNewListOn: {
                    direction: "left",
                  },
                  newFocusList: "sideBar",
                },
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
                  newFocusList: "movies",
                },
              ],
            },
          ],
          {
            listToStartWith: "movies",
            indexOfStart: 0,
            delay: 500,
          }
        );
      });
  }
}
