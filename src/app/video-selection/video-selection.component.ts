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
  isLoadingMore: boolean = false;

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

    // Prevent navigation while loading more items to avoid race conditions
    if (this.isLoadingMore) {
      return;
    }

    // Store the current index before navigation to detect wrapping
    const previousIndex = this.index;

    // Only handle navigation if movies is the current active list
    // This prevents double-processing when other components are active
    if (this.smartTv.smartTv.currentListName !== "movies") {
      return;
    }

    // Ensure the smart-tv library's boxes array is in sync before navigating
    // This prevents errors when trying to access boxes that don't exist yet
    if (this.smartTv.smartTv.boxes && this.index >= this.smartTv.smartTv.boxes.length) {
      console.warn("Index out of bounds - waiting for list to update. Index:", this.index, "Boxes length:", this.smartTv.smartTv.boxes.length);
      // Try to update the list if boxes are out of sync
      if (this.boxes.length > this.smartTv.smartTv.boxes.length) {
        this.smartTv.smartTv.addCurrentList({
          listName: "movies",
          listElements: this.boxes,
        });
        this.smartTv.smartTv.updateRowLength();
        // Wait a bit for the update to complete
        await this.delay(100);
      }
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
      console.log("Wrapped from bottom to top row, index:", topRowIndex);
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
    // Store the current index before navigating to overview
    this.infoStore.videoSelectionIndex = this.index;
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
    // Don't trigger multiple loads at once
    if (this.isLoadingMore) {
      return;
    }

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

  async loadMoreItems() {
    // Prevent multiple simultaneous loads
    if (this.isLoadingMore) {
      return;
    }

    this.isLoadingMore = true;
    console.log("LOADING MORE ITEMS");

    // Ensure config is loaded before making API call
    try {
      await this.apiConfig.ensureConfigLoaded();
      this.http
        .post(`${this.apiConfig.getBaseUrl()}/api/mov/movies`, {
          pid: 0,
          offset: this.offset,
        })
        .subscribe((response: any) => {
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
          this.infoStore.movies = newMovies;
          
          // Store in service for persistence
          this.infoStore.videoSelectionMovies = newMovies;
          this.infoStore.videoSelectionOffset += response.length;
          this.offset = this.infoStore.videoSelectionOffset;
          
          // console.log("MOVIES AFTER: ", this.movies.length);
          // console.log("MOVIES ARRAY: ", this.movies);
          // console.log("NEW MOVIES REFERENCE: ", newMovies === this.movies);
          // console.log("BOXES LENGTH (immediate): ", this.boxes.length);

          // Wait for Angular to render the new DOM elements
          // QueryList updates asynchronously after DOM changes
          setTimeout(() => {
            // Check multiple times to ensure QueryList has updated
            const checkQueryList = () => {
              // console.log("BOXES QUERY LIST LENGTH: ", this.boxes.length);
              // console.log("MOVIES ARRAY LENGTH: ", this.movies.length);
              
              // Ensure QueryList has caught up with the movies array
              if (this.boxes.length < this.movies.length) {
                // console.log("QueryList not updated yet, waiting...");
                setTimeout(checkQueryList, 100);
                return;
              }
              console.log("SMART TV BOXES LENGTH: ", this.smartTv.smartTv?.boxes?.length, "BOXES LENGTH: ", this.boxes.length);
              
              if (this.smartTv.smartTv && this.smartTv.smartTv.boxes?.length < this.boxes.length) {
                console.log("Updating smartTv list with", this.boxes.length, "items");
                console.log("Current smartTv boxes length:", this.smartTv.smartTv.boxes?.length);
                
                // Re-register the list with all items (including new ones)
                // Keep it as the current list so navigation continues to work
                this.smartTv.smartTv.addCurrentList({
                  listName: "movies",
                  listElements: this.boxes,
                });
                
                this.smartTv.smartTv.updateRowLength();
                console.log("Current smartTv boxes length:", this.smartTv.smartTv.boxes?.length);
                // Wait a bit for addCurrentList to complete before restoring index
                setTimeout(() => {
                  // Restore the current index after updating the list
                  this.smartTv.smartTv?.setCurrentIndex(this.index);
                  // console.log("Restored index to:", this.index, "Current index:", this.smartTv.smartTv?.currentIndex);
                  // console.log("SmartTv boxes length after restore:", this.smartTv.smartTv?.boxes?.length);
                  
                  // Mark loading as complete
                  this.isLoadingMore = false;
                }, 100);
              } else {
                // If boxes are already in sync, just mark loading as complete
                this.isLoadingMore = false;
              }
            };
            
            checkQueryList();
          }, 200);

          // console.log("BOXES AFTER: ", this.boxes.length);
        } else {
          // console.log("NO MORE MOVIES");
          // this.hasMoreMovies = false;
          this.isLoadingMore = false;
        }
      }, (error) => {
        this.isLoadingMore = false;
        console.error("Error loading more items:", error);
      });
    } catch (error) {
      this.isLoadingMore = false;
      console.error('Error loading config before loading more items:', error);
      // Fallback: try with current getBaseUrl (might work)
      this.http
        .post(`${this.apiConfig.getBaseUrl()}/api/mov/movies`, {
          pid: 0,
          offset: this.offset,
        })
        .subscribe((response: any) => {
          if (Array.isArray(response) && response.length > 0) {
            const newMovies = this.movies.concat(response);
            this.movies = newMovies;
            this.infoStore.movies = newMovies;
            this.offset += response.length;
          }
          this.isLoadingMore = false;
        }, (error) => {
          this.isLoadingMore = false;
          console.error("Error loading more items:", error);
        });
    }
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

  async ngOnInit() {
    this.deviceName = this.platformService.getDeviceName();
    console.log("========================================");
    console.log("DEVICE NAME:", this.deviceName);
    console.log("IS ZIDOO:", this.platformService.isZidoo());
    console.log("IS ANDROID:", this.platformService.isAndroid());
    console.log("USER AGENT:", navigator.userAgent);
    console.log("========================================");
    
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

    // Check if we have stored movies - if so, restore them instead of making a new API call
    if (this.infoStore.videoSelectionMovies.length > 0) {
      console.log(`[VideoSelection] Restoring ${this.infoStore.videoSelectionMovies.length} movies from service`);
      this.movies = this.infoStore.videoSelectionMovies;
      this.offset = this.infoStore.videoSelectionOffset;
      
      // Store flat list of all movie versions for version filtering in overview
      const flatMovies: movieInfo[] = [];
      this.movies.forEach((groupedMovie: any) => {
        if (groupedMovie.versions && groupedMovie.versions.length > 0) {
          flatMovies.push(...groupedMovie.versions);
        } else {
          flatMovies.push(groupedMovie);
        }
      });
      this.infoStore.movies = flatMovies;
      
      // Restore the previous index if available, otherwise use 0
      const restoredIndex = this.infoStore.videoSelectionIndex || 0;
      this.index = restoredIndex;
      
      // currentBox should use the grouped movie (which has all properties from first version)
      // Make sure index is within bounds
      const safeIndex = Math.min(restoredIndex, this.movies.length - 1);
      const currentMovie: any = this.movies[safeIndex];
      this.currentBox = currentMovie;
      this.poster = currentMovie?.posterUrl || "";
      
      // Wait for Angular to render the boxes
      setTimeout(async () => {
        if (this.smartTv.smartTv && this.boxes.length > 0) {
          const startingIndex = this.infoStore.videoSelectionIndex || 0;
          this.index = startingIndex;
          
          await this.smartTv.smartTv.addCurrentList({
            startingList: true,
            listName: "movies",
            startingIndex: startingIndex,
            listElements: this.boxes,
          });
          
          // Wait a bit for addCurrentList to complete
          // setTimeout(() => {
            const safeIndex = Math.min(startingIndex, this.boxes.length - 1);
            this.index = safeIndex;
            
            if (this.smartTv.smartTv) {
              this.smartTv.smartTv.createChunks();
              this.smartTv.smartTv.updateRowLength();
              
              // Calculate chunk and row indices
              if (this.smartTv.smartTv.boxesPerRow > 0 && this.smartTv.smartTv.chunks.length > 0) {
                let foundChunkIndex = -1;
                let foundRowIndex = -1;
                
                for (let chunkIdx = 0; chunkIdx < this.smartTv.smartTv.chunks.length; chunkIdx++) {
                  const chunk = this.smartTv.smartTv.chunks[chunkIdx];
                  for (let rowIdx = 0; rowIdx < chunk.length; rowIdx++) {
                    if (chunk[rowIdx].index === safeIndex) {
                      foundChunkIndex = chunkIdx;
                      foundRowIndex = rowIdx;
                      break;
                    }
                  }
                  if (foundChunkIndex >= 0) break;
                }
                
                if (foundChunkIndex >= 0 && foundRowIndex >= 0) {
                  (this.smartTv.smartTv as any).chunkIndex = foundChunkIndex;
                  (this.smartTv.smartTv as any).rowIndex = foundRowIndex;
                }
              }
              
              this.smartTv.smartTv.setCurrentIndex(safeIndex);
              
              if (this.movies[safeIndex]) {
                this.currentBox = this.movies[safeIndex];
                this.poster = this.currentBox.posterUrl;
              }
              
              if (this.smartTv.smartTv.boxes && this.smartTv.smartTv.boxes[safeIndex]) {
                this.infoStore.checkBorderOverflow(this.smartTv.smartTv.boxes, safeIndex);
              }
            }
          // }, 150);
        }
      }, 1000);
      
      return; // Don't make API call if we restored from service
    }

    // Ensure config is loaded before making API call
    try {
      await this.apiConfig.ensureConfigLoaded();
      const baseUrl = this.apiConfig.getBaseUrl();
      const fullUrl = `${baseUrl}/api/mov/movies`;
      console.log(`[VideoSelection] Making request to: ${fullUrl}`);
      this.http
        .post(fullUrl, {
          pid: 0,
          offset: 0, // Always start from 0 on fresh load
        })
        .subscribe((res: any) => {
        console.log("RES: ", res);
        // Check if there are more movies available
        // If response has a message property, there are no more movies
        if (res.message) {
          // this.hasMoreMovies = false;
          this.movies = [];
        } else {
          // Check if we have stored movies from a previous visit
          if (this.infoStore.videoSelectionMovies.length > 0) {
            // Restore all previously loaded movies
            this.movies = this.infoStore.videoSelectionMovies;
            this.offset = this.infoStore.videoSelectionOffset;
            console.log(`[VideoSelection] Restored ${this.movies.length} movies from previous session, offset: ${this.offset}`);
          } else {
            // First load - use the response
            this.movies = res;
            this.offset = res.length;
            // Store in service
            this.infoStore.videoSelectionMovies = res;
            this.infoStore.videoSelectionOffset = res.length;
          }
          
          // Store flat list of all movie versions for version filtering in overview
          const flatMovies: movieInfo[] = [];
          this.movies.forEach((groupedMovie: any) => {
            if (groupedMovie.versions && groupedMovie.versions.length > 0) {
              flatMovies.push(...groupedMovie.versions);
            } else {
              // If no versions array, it's a single movie (backward compatibility)
              flatMovies.push(groupedMovie);
            }
          });
          this.infoStore.movies = flatMovies;
          
          // Restore the previous index if available, otherwise use 0
          const restoredIndex = this.infoStore.videoSelectionIndex || 0;
          this.index = restoredIndex;
          
          // currentBox should use the grouped movie (which has all properties from first version)
          // Make sure index is within bounds
          const safeIndex = Math.min(restoredIndex, res.length - 1);
          const currentMovie: any = res[safeIndex];
          this.currentBox = currentMovie;
          this.poster = currentMovie?.posterUrl || "";
          
          setTimeout(() => {
            // // console.log("SMART TV VIDEO: ", this.smartTv);
            // // console.log("BOXES QUERY LIST: ", this.boxes);
            // // console.log("BOXES LENGTH: ", this.boxes.length);
            if (this.smartTv.smartTv && this.boxes.length > 0) {
            // this.smartTv.smartTv.setInitialScale(0.5);
            
            // Restore the previous index if available, otherwise use 0
            const startingIndex = this.infoStore.videoSelectionIndex || 0;
            this.index = startingIndex;
            
            this.smartTv.smartTv.addCurrentList({
              startingList: true,
              listName: "movies",
              startingIndex: startingIndex,
              listElements: this.boxes,
            });
            
            // Wait a bit for addCurrentList to complete (it's async but doesn't return a promise)
            setTimeout(() => {
              // Ensure the index is within bounds
              const safeIndex = Math.min(startingIndex, this.boxes.length - 1);
              this.index = safeIndex;
              
              // Make sure chunks are created before setting index
              if (this.smartTv.smartTv) {
                // Ensure chunks are created
                this.smartTv.smartTv.createChunks();
                
                // Update row length to ensure chunks are properly set up
                this.smartTv.smartTv.updateRowLength();
                
                // Calculate chunk and row indices from the current index
                // This ensures proper navigation state
                if (this.smartTv.smartTv.boxesPerRow > 0 && this.smartTv.smartTv.chunks.length > 0) {
                  // Find which chunk contains this index
                  let foundChunkIndex = -1;
                  let foundRowIndex = -1;
                  
                  for (let chunkIdx = 0; chunkIdx < this.smartTv.smartTv.chunks.length; chunkIdx++) {
                    const chunk = this.smartTv.smartTv.chunks[chunkIdx];
                    for (let rowIdx = 0; rowIdx < chunk.length; rowIdx++) {
                      if (chunk[rowIdx].index === safeIndex) {
                        foundChunkIndex = chunkIdx;
                        foundRowIndex = rowIdx;
                        break;
                      }
                    }
                    if (foundChunkIndex >= 0) break;
                  }
                  
                  // Set the internal state if we found the indices
                  if (foundChunkIndex >= 0 && foundRowIndex >= 0) {
                    (this.smartTv.smartTv as any).chunkIndex = foundChunkIndex;
                    (this.smartTv.smartTv as any).rowIndex = foundRowIndex;
                  }
                }
                
                // Set the current index in smart-tv library (this will place the green border)
                this.smartTv.smartTv.setCurrentIndex(safeIndex);
                console.log("CURRENT INDEX AFTER SET: ", this.smartTv.smartTv?.currentIndex);
                
                // Update current box to match the restored index
                if (this.movies[safeIndex]) {
                  this.currentBox = this.movies[safeIndex];
                  this.poster = this.currentBox.posterUrl;
                }
                
                // Scroll the element into view to ensure the border is visible
                if (this.smartTv.smartTv.boxes && this.smartTv.smartTv.boxes[safeIndex]) {
                  this.infoStore.checkBorderOverflow(this.smartTv.smartTv.boxes, safeIndex);
                }
              }
              
              // console.log("CURRENT INDEX AFTER SET: ", this.smartTv.smartTv?.currentIndex);
              // console.log("SMART TV STATE: ", {
              //   currentIndex: this.smartTv.smartTv?.currentIndex,
              //   currentListName: this.smartTv.smartTv?.currentListName,
              //   boxesLength: this.smartTv.smartTv?.boxes?.length
              // });
            }, 150);
          } else {
            console.warn("SmartTv or boxes not ready:", {
              smartTv: !!this.smartTv.smartTv,
              boxesLength: this.boxes.length
            });
          }
          
          }, 1000);
        }
      });
    } catch (error) {
      console.error('Error loading config before API call:', error);
      // Fallback: try with pixable.local (might work on some networks)
      this.http
        .post(`${this.apiConfig.getBaseUrl()}/api/mov/movies`, {
          pid: 0,
          offset: this.offset,
        })
        .subscribe((res: any) => {
          if (res.message) {
            this.movies = [];
          } else {
            this.movies = res;
            const flatMovies: movieInfo[] = [];
            res.forEach((groupedMovie: any) => {
              if (groupedMovie.versions && groupedMovie.versions.length > 0) {
                flatMovies.push(...groupedMovie.versions);
              } else {
                flatMovies.push(groupedMovie);
              }
            });
            this.infoStore.movies = flatMovies;
            this.offset += res.length;
            const currentMovie: any = res[this.index];
            this.currentBox = currentMovie;
            this.poster = currentMovie.posterUrl;
          }
        });
    }
  }
}
