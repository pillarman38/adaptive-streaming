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
import { ApiConfigService } from "../services/api-config.service";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
import { PlatformService } from "../services/platform.service";

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
  deviceName: string = "";
  isAndroid: boolean = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private infoStore: InfoStoreService,
    private apiConfig: ApiConfigService,
    private smartTv: SmartTvLibSingletonService,
    private platformService: PlatformService
  ) {}

  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("image") image!: ElementRef;
  @ViewChild("backgroundPlacer") backgroundPlacer!: ElementRef;
  @ViewChildren("boxes") boxes!: QueryList<ElementRef<any>>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;
  @ViewChild("list") list!: ElementRef;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event.code);

    // Only handle navigation if movies is the current active list
    // This prevents double-processing when other components are active
    if (!this.smartTv.smartTv || this.smartTv.smartTv.currentListName !== "movies") {
      return;
    }

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
      // Scroll the current item into view
      if (this.smartTv.smartTv?.boxes && ind.currentIndex !== undefined) {
        this.infoStore.checkBorderOverflow(this.smartTv.smartTv.boxes, ind.currentIndex);
      }
      await this.updateCurrentBox();
    }

    // Handle Enter/Select button on remote
    // Android TV remotes may send "Enter", "NumpadEnter", or keyCode 13
    const isEnterKey = event.code === "Enter" || 
                       event.code === "NumpadEnter" || 
                       event.key === "Enter" ||
                       event.keyCode === 13;

    if (isEnterKey) {
      console.log("ENTER PRESSED - currentListName:", ind?.currentListName, "currentIndex:", ind?.currentIndex);
      
      if (ind?.currentListName === "movies") {
        // Update index to match the current index from navigation
        this.index = ind.currentIndex;
        console.log("Selecting movie at index:", this.index);
        this.selectMovie();
        return; // Prevent further processing
      }
      
      if (ind?.currentListName === "sideBar") {
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
        return; // Prevent further processing
      }
    }
  }

  async updateCurrentBox() {
    this.currentBox = this.movies[this.index];
    this.image.nativeElement.style.opacity = "0";
    await this.delay(1000);

    this.poster = this.currentBox.posterUrl;
    this.delay(1000);
    this.image.nativeElement.style.opacity = "1";
    console.log("CURRENT MOVIE: ", this.currentBox);
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
    console.log("IND MOVIE: ", ind);

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
      .post(`${this.apiConfig.getBaseUrl()}/api/mov/movies`, {
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

          setTimeout(() => {
          // this.smartTv.smartTv?.updateList({
          //   listName: "movies",
          //   startingIndex: 0,
          //   listElements: this.boxes,
          // });
          }, 1000);

          console.log("BOXES AFTER: ", this.boxes.length);

          // console.log("SMART TV VIDEO: ", this.smartTv.smartTv);
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
    this.deviceName = this.platformService.getDeviceName();
    this.isAndroid = this.platformService.isAndroid();
    // Ensure smartTv is initialized
    if (!this.smartTv.smartTv) {
      this.smartTv.create();
      console.log("Created smartTv instance");
    }
    
    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });
    console.log("BASE URL: ", this.apiConfig.getBaseUrl());

    this.http
      .post(`${this.apiConfig.getBaseUrl()}/api/mov/movies`, {
        pid: 0,
        offset: this.offset,
      })
      .subscribe((res: any) => {
        console.log("RES: ", res, this.boxes);

        this.movies = res;
        this.offset += res.length;
        this.currentBox = res[this.index];
        this.poster = this.currentBox.posterUrl;
        setTimeout(() => {
          // console.log("SMART TV VIDEO: ", this.smartTv);
          // console.log("BOXES QUERY LIST: ", this.boxes);
          // console.log("BOXES LENGTH: ", this.boxes.length);

          if (this.smartTv.smartTv && this.boxes.length > 0) {
            this.smartTv.smartTv.setInitialScale(0.5);
            this.smartTv.smartTv.addCurrentList({
              startingList: true,
              listName: "movies",
              startingIndex: 0,
              listElements: this.boxes,
            });
            
            // Wait a bit for addCurrentList to complete (it's async but doesn't return a promise)
            setTimeout(() => {
              this.smartTv.smartTv?.setCurrentIndex(0);
              console.log("CURRENT INDEX AFTER SET: ", this.smartTv.smartTv?.currentIndex);
              console.log("SMART TV STATE: ", {
                currentIndex: this.smartTv.smartTv?.currentIndex,
                currentListName: this.smartTv.smartTv?.currentListName,
                boxesLength: this.smartTv.smartTv?.boxes?.length
              });
            }, 100);
          } else {
            console.warn("SmartTv or boxes not ready:", {
              smartTv: !!this.smartTv.smartTv,
              boxesLength: this.boxes.length
            });
          }
          
        }, 1000);
        
      });
  }
}
