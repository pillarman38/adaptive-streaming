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
    // console.log("EVENT: ", event.code);

    if (!this.smartTv.smartTv) {
      return;
    }

    // Store the current index before navigation to detect wrapping
    const previousIndex = this.index;

    // Only handle navigation if movies is the current active list
    // This prevents double-processing when other components are active
    if (this.smartTv.smartTv.currentListName !== "movies") {
      return;
    }

    // Navigate within the movies list
    const ind = this.smartTv.smartTv?.navigate(event);

    this.index = ind?.currentIndex ?? this.index;
    // console.log("INDEX: ", this.index, this.boxes.length, "borderReached:", ind?.borderReached);
    if (ind?.borderReached === "left edge") {
      this.smartTv.smartTv?.switchList("sideBar", 0);
    }
    if (
      ind?.borderReached === "right edge" &&
      ind.currentListName === "movies"
    ) {
      this.smartTv.smartTv?.wrapRight();
    }
    // Handle bottom edge wrapping - wrap to top row
    if (
      ind?.borderReached === "bottom edge" &&
      ind.currentListName === "movies"
    ) {
      // Wrap to the top row - go to the same column position in the first row
      const boxesPerRow = 5;
      const currentColumn = this.index % boxesPerRow;
      const topRowIndex = currentColumn;
      this.smartTv.smartTv?.setCurrentIndex(topRowIndex);
      this.index = topRowIndex;
      // console.log("Wrapped from bottom to top row, index:", topRowIndex);
    }
    
    // Fallback: manually detect if we're at the last index and down arrow was pressed
    // This handles cases where the library doesn't return "bottom edge"
    if (
      event.code === "ArrowDown" &&
      ind?.currentListName === "movies" &&
      this.smartTv.smartTv?.boxes &&
      previousIndex >= this.smartTv.smartTv.boxes.length - 1 &&
      (ind?.currentIndex === previousIndex || ind?.currentIndex === undefined)
    ) {
      // We're at the last item and pressed down, but didn't move - wrap to top row
      const boxesPerRow = 5;
      const currentColumn = previousIndex % boxesPerRow;
      const topRowIndex = currentColumn;
      this.smartTv.smartTv?.setCurrentIndex(topRowIndex);
      this.index = topRowIndex;
      // console.log("Manually wrapped from bottom to top row, index:", topRowIndex);
    }

    // Load more items when user is 10 indexes away from the last item
    // This works on all devices (keyboard, remote, etc.)
    this.checkAndLoadMore();

    if (ind?.currentListName === "movies") {
      // // console.log("CURRENT LIST: ", ind);
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

    if (isEnterKey && ind?.currentListName === "movies") {
      // console.log("ENTER PRESSED - Selecting movie at index:", ind.currentIndex);
      // Update index to match the current index from navigation
      this.index = ind.currentIndex;
      this.selectMovie();
    }
  }

  async updateCurrentBox() {
    this.currentBox = this.movies[this.index];
    this.image.nativeElement.style.opacity = "0";
    await this.delay(1000);

    this.poster = this.currentBox.posterUrl;
    this.delay(1000);
    this.image.nativeElement.style.opacity = "1";
    // console.log("CURRENT MOVIE: ", this.currentBox);
  }

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    // console.log(event.target.innerWidth);
    this.smartTv.smartTv?.windowResize();
  }

  delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  selectMovie() {
    // console.log("SELECTED MOVIE: ", this.index, this.movies[this.index]);
    this.infoStore.videoInfo = this.movies[this.index];
    this.router.navigateByUrl("/overview");
  }

  async onHover(e: number, listName: string) {
    const ind = this.smartTv.smartTv?.findAndSetIndex(e, listName);
    // console.log("IND MOVIE: ", ind);

    if (ind?.currentListName === "movies") {
      this.index = e;
      // console.log("INDEX MOVIE TWO: ", this.index);

      // Check if we need to load more items when hovering near the end
      this.checkAndLoadMore();
      
      await this.updateCurrentBox();
    }
  }

  async onImageLoad() {
    this.image.nativeElement.style.opacity = "1";
  }

  checkAndLoadMore() {
    // Load more items when user is 10 indexes away from the last item
    // This works on all devices (keyboard, remote, mouse, etc.)
    const lastIndex = this.boxes.length - 1;
    const threshold = 10;
    
    // Load more if we're within threshold indexes of the last index
    // console.log("INDEX: ", this.index, "LAST INDEX: ", lastIndex, "THRESHOLD: ", threshold);
    if (this.index >= lastIndex - threshold) {
      
      
      // console.log("Loading more items - index:", this.index, "lastIndex:", lastIndex, "threshold:", threshold);
      this.loadMoreItems();
    }
  }

  loadMoreItems() {
    // if (this.isLoadingMore || !this.hasMoreMovies) {
    //   return;
    // }

    // console.log("LOADING MORE ITEMS");
    // this.isLoadingMore = true;

    this.http
      .post(`${this.apiConfig.getBaseUrl()}/api/mov/movies`, {
        pid: 0,
        offset: this.offset,
      })
      .subscribe((response: any) => {
        // this.isLoadingMore = false;
        // console.log("RESPONSE: ", response);
        // console.log("RESPONSE TYPE: ", typeof response, "IS ARRAY: ", Array.isArray(response));
        
        // Check if response is an array (has movies) or an object with message (no more movies)
        if (Array.isArray(response) && response.length > 0) {
          // console.log("RES: ", response);
          // console.log("CURRENT MOVIES BEFORE: ", this.movies.length);

          // const currentIndex = this.index;
          // Create a new array reference to ensure Angular detects the change
          // Use concat which returns a new array
          const newMovies = this.movies.concat(response);
          this.movies = newMovies;
          // console.log("MOVIES AFTER: ", this.movies.length);
          // console.log("MOVIES ARRAY: ", this.movies);
          // console.log("NEW MOVIES REFERENCE: ", newMovies === this.movies);

          this.offset += response.length;
          // console.log("BOXES LENGTH (immediate): ", this.boxes.length);

          // Wait for Angular to render the new DOM elements
          // QueryList updates asynchronously after DOM changes
          setTimeout(() => {
            // Check multiple times to ensure QueryList has updated
            const checkQueryList = () => {
              // console.log("BOXES QUERY LIST LENGTH: ", this.boxes.length);
              // console.log("MOVIES ARRAY LENGTH: ", this.movies.length);
              
              // If QueryList hasn't caught up yet, wait a bit more
              // if (this.boxes.length < this.movies.length) {
              //   // console.log("QueryList not updated yet, waiting...");
              //   setTimeout(checkQueryList, 100);
              //   return;
              // }
              // console.log("SMART TV BOXES LENGTH: ", this.smartTv.smartTv?.boxes?.length, "BOXES LENGTH: ", this.boxes.length);
              
              if (this.smartTv.smartTv && this.smartTv.smartTv.boxes?.length < this.boxes.length) {
                // console.log("Updating smartTv list with", this.boxes.length, "items");
                // console.log("Current smartTv boxes length:", this.smartTv.smartTv.boxes?.length);
                
                // Re-register the list with all items (including new ones)
                // Keep it as the current list so navigation continues to work
                this.smartTv.smartTv.addCurrentList({
                  // startingList: this.smartTv.smartTv.currentListName === "movies", // Keep as current if it's already the current list
                  listName: "movies",
                  // startingIndex: this.index + 5,
                  listElements: this.boxes,
                });
                this.smartTv.smartTv.updateRowLength()
                
                // console.log("After update - smartTv boxes length:", this.smartTv.smartTv.boxes?.length, 
                  // "INDEX:", this.index, "CURRENT INDEX:", this.smartTv.smartTv?.currentIndex);
                
                // Restore the current index after updating the list
                // setTimeout(() => {
                  this.smartTv.smartTv?.setCurrentIndex(this.index);
                  // console.log("Restored index to:", this.index, "Current index:", this.smartTv.smartTv?.currentIndex);
                //   // console.log("SmartTv boxes length after restore:", this.smartTv.smartTv?.boxes?.length);
                // }, 200);
              } else {
                console.warn("SmartTv or boxes not ready - boxes length:", this.boxes.length);
              }
            };
            
            checkQueryList();
          }, 200);

          // console.log("BOXES AFTER: ", this.boxes.length);
        } else {
          // console.log("NO MORE MOVIES");
          // this.hasMoreMovies = false;
        }
      }, (error) => {
        // this.isLoadingMore = false;
        console.error("Error loading more items:", error);
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
      // console.log("Created smartTv instance");
    }
    
    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });
    // console.log("BASE URL: ", this.apiConfig.getBaseUrl());

    this.http
      .post(`${this.apiConfig.getBaseUrl()}/api/mov/movies`, {
        pid: 0,
        offset: this.offset,
      })
      .subscribe((res: any) => {
        // console.log("RES: ", res, this.boxes);

        // Check if there are more movies available
        // If response has a message property, there are no more movies
        if (res.message) {
          // this.hasMoreMovies = false;
          this.movies = [];
        } else {
          // this.hasMoreMovies = true;
          this.movies = res;
          this.offset += res.length;
          this.currentBox = res[this.index];
          this.poster = this.currentBox.posterUrl;
          
          setTimeout(() => {
            // // console.log("SMART TV VIDEO: ", this.smartTv);
            // // console.log("BOXES QUERY LIST: ", this.boxes);
            // // console.log("BOXES LENGTH: ", this.boxes.length);

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
              // console.log("CURRENT INDEX AFTER SET: ", this.smartTv.smartTv?.currentIndex);
              // console.log("SMART TV STATE: ", {
              //   currentIndex: this.smartTv.smartTv?.currentIndex,
              //   currentListName: this.smartTv.smartTv?.currentListName,
              //   boxesLength: this.smartTv.smartTv?.boxes?.length
              // });
            }, 100);
          } else {
            console.warn("SmartTv or boxes not ready:", {
              smartTv: !!this.smartTv.smartTv,
              boxesLength: this.boxes.length
            });
          }
          
          }, 1000);
        }
        
      });
  }
}
