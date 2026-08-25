import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  QueryList,
  ViewChildren,
  HostListener,
} from "@angular/core";
// import { SmartTvComponent } from "smart-tv";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { InfoStoreService, showInfo } from "../info-store.service";
// import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
import { SideBarComponent } from "../side-bar/side-bar.component";
import { LayoutService } from "../services/layout.service";
import { ApiConfigService } from "../services/api-config.service";
import { LibrarySearchService } from "../services/library-search.service";
import { Subscription } from "rxjs";

@Component({
  selector: "app-tv",
  templateUrl: "./tv.component.html",
  styleUrls: ["./tv.component.css"],
})
export class TvComponent implements OnInit, OnDestroy {
  shows: Array<showInfo> = [];
  index: number = 0;
  movies: Array<showInfo> = [];
  currentBox: showInfo = this.infoStore.showInfo;
  poster: string | undefined = "";
  searchQuery = "";
  searchResults: showInfo[] = [];
  isSearching = false;
  private searchRequest?: Subscription;
  private searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

  get displayShows(): Array<showInfo> {
    if (!this.searchQuery.trim()) {
      return this.shows;
    }
    return this.searchResults;
  }

  get isSearchActive(): boolean {
    return !!this.searchQuery.trim();
  }

  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("image") image!: ElementRef;
  @ViewChild("backgroundPlacer") backgroundPlacer!: ElementRef;
  @ViewChildren("boxes") boxes!: QueryList<ElementRef>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {

    // const ind = this.smartTv.smartTv?.navigate(event);
    // console.log("THI IND: ", ind);
    // this.index = ind?.currentIndex || 0;

    // if (ind?.borderReached === "left edge") {
      // this.smartTv.smartTv?.switchList("sideBar", 0);
    // }

    // if (
    //   ind?.borderReached === "right edge" &&
    //   ind?.currentListName === "sideBar"
    // ) {
    //   this.smartTv.smartTv?.switchList("tv", 0);
    // }

    // if (ind?.borderReached === "right edge" && ind?.currentListName === "tv") {
    //   this.smartTv.smartTv?.wrapRight();
    // }

    // if (ind?.currentListName === "tv") {
    //   this.infoStore.checkBorderOverflow(ind);
    //   await this.updateCurrentBox();
    // }

    // if (event.code === "Enter" && ind?.currentListName === "tv") {
    //   this.selectShow();
    // }

    // if (event.code === "Enter" && ind?.currentListName === "sideBar") {
    //   switch (ind?.currentIndex) {
    //     case 0:
    //       this.router.navigateByUrl("/search");
    //       break;
    //     case 1:
    //       this.router.navigateByUrl("/videoSelection");
    //       break;
    //     case 2:
    //       this.router.navigateByUrl("/tv");
    //       break;
    //   }
    // }
  }

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    console.log(event.target.innerWidth);
    // this.smartTv.smartTv?.windowResize();
  }
  constructor(
    private http: HttpClient,
    private router: Router,
    private infoStore: InfoStoreService,
    public layout: LayoutService,
    private apiConfig: ApiConfigService,
    private librarySearch: LibrarySearchService
  ) {}

  async updateCurrentBox() {
    this.currentBox = this.shows[this.index];
    this.image.nativeElement.style.opacity = "0";
    await this.delay(1000);

    this.poster = this.currentBox.backdropPhotoUrl;
    this.delay(1000);
    this.image.nativeElement.style.opacity = "1";
  }

  async onHover(e: number, listName: string) {
    // const ind = this.smartTv.smartTv?.findAndSetIndex(e, listName);
    // console.log("IND TV: ", ind);

    // if (ind?.currentListName === "tv") {
    //   this.index = e;
    //   await this.updateCurrentBox();
    // }
  }

  selectShow(showOrIndex?: showInfo | number) {
    const selected =
      typeof showOrIndex === "number"
        ? this.displayShows[showOrIndex]
        : showOrIndex ?? this.displayShows[this.index];
    if (!selected) {
      return;
    }

    const index = this.shows.indexOf(selected);
    if (index >= 0) {
      this.index = index;
    }

    this.infoStore.showInfo = selected;
    this.router.navigateByUrl("/seasons");
  }

  onSearchQueryChange(query: string): void {
    this.searchQuery = query;

    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
    }

    if (!query.trim()) {
      this.searchRequest?.unsubscribe();
      this.searchResults = [];
      this.isSearching = false;
      return;
    }

    this.searchDebounceTimeout = setTimeout(() => {
      this.runTvSearch(query.trim());
    }, 300);
  }

  private runTvSearch(query: string): void {
    this.searchRequest?.unsubscribe();
    this.isSearching = true;

    this.searchRequest = this.librarySearch.searchTvShows(query).subscribe({
      next: (results) => {
        this.searchResults = Array.isArray(results) ? results : [];
        this.isSearching = false;
      },
      error: (err) => {
        console.error("TV search failed:", err);
        this.searchResults = [];
        this.isSearching = false;
      },
    });
  }

  ngOnDestroy(): void {
    this.searchRequest?.unsubscribe();
    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
    }
  }

  delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onImageLoad() {
    this.image.nativeElement.style.opacity = "1";
  }

  ngOnInit(): void {
    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });

    this.apiConfig.ensureConfigLoaded().then(() => {
      this.http
        .post(`${this.apiConfig.getBaseUrl()}/api/mov/tv`, { pid: 0 })
        .subscribe((res: any) => {
          console.log("RES: ", res, this.boxes);

          this.shows = res;
          this.currentBox = res[this.index];
          console.log("CURRENT BOX: ", this.currentBox);

          this.poster = this.currentBox.backdropPhotoUrl;
        });
    }).catch((error) => {
      console.error("Error loading config before TV API call:", error);
      this.http
        .post(`${this.apiConfig.getBaseUrl()}/api/mov/tv`, { pid: 0 })
        .subscribe((res: any) => {
          this.shows = res;
          this.currentBox = res[this.index];
          this.poster = this.currentBox.backdropPhotoUrl;
        });
    });
  }
}
