import {
  Component,
  ElementRef,
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
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
import { SideBarComponent } from "../side-bar/side-bar.component";

@Component({
  selector: "app-tv",
  templateUrl: "./tv.component.html",
  styleUrls: ["./tv.component.css"],
})
export class TvComponent implements OnInit {
  shows: Array<showInfo> = [];
  index: number = 0;
  movies: Array<showInfo> = [];
  currentBox: showInfo = this.infoStore.showInfo;
  poster: string | undefined = "";

  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("image") image!: ElementRef;
  @ViewChild("backgroundPlacer") backgroundPlacer!: ElementRef;
  @ViewChildren("boxes") boxes!: QueryList<ElementRef>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    const ind = this.smartTv.smartTv?.navigate(event);
    console.log("THI IND: ", ind);
    this.index = ind?.currentIndex || 0;

    if (ind?.borderReached === "left edge") {
      this.smartTv.smartTv?.switchList("sideBar", 0);
    }
    if (
      ind?.borderReached === "right edge" &&
      ind?.currentListName === "sideBar"
    ) {
      this.smartTv.smartTv?.switchList("tv", 0);
    }
    if (ind?.borderReached === "right edge" && ind?.currentListName === "tv") {
      this.smartTv.smartTv?.wrapRight();
    }
  }

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    console.log(event.target.innerWidth);
    this.smartTv.smartTv?.windowResize();
  }
  constructor(
    private http: HttpClient,
    private router: Router,
    private infoStore: InfoStoreService,
    private smartTv: SmartTvLibSingletonService
  ) {}
  onHover(e: number, listName: string) {
    if (listName === "tv") {
      // const ind = this.smartTv.findAndSetIndex(e, "tv");
      // this.index = ind.index;
    }
    if (listName === "sideBar") {
      // this.smartTv.findAndSetIndex(e, "sideBar");
    }
  }

  selectShow() {
    console.log(this.index, this.shows[this.index]);
    this.infoStore.showInfo = this.shows[this.index];
    console.log("SELECTED SHOW: ", this.shows[this.index], this.index);

    this.router.navigateByUrl("/seasons");
  }

  delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onImageLoad() {
    this.image.nativeElement.style.opacity = "1";
  }

  // ngAfterViewInit() {
  //   this.smartTv.currentBox = 0;
  // }

  ngOnInit(): void {
    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });

    this.http
      .post(`http://192.168.0.154:4012/api/mov/tv`, { pid: 0 })
      .subscribe((res: any) => {
        console.log("RES: ", res, this.boxes);

        this.shows = res;
        this.currentBox = res[this.index];
        this.poster = this.currentBox.backgroundPoster;
        setTimeout(() => {
          this.smartTv.smartTv?.addCurrentList({
            startingList: true,
            listName: "tv",
            startingIndex: 0,
            listElements: this.boxes,
          });
        }, 1000);
      });
  }
}
