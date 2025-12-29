import {
  Component,
  OnInit,
  ViewChild,
  ViewChildren,
  QueryList,
  ElementRef,
  HostListener,
} from "@angular/core";
import {
  InfoStoreService,
  movieInfo,
  seasonInfo,
  showInfo,
} from "../info-store.service";
import { HttpClient } from "@angular/common/http";
// import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
import { Router } from "@angular/router";
import { SeaseonChangesService } from "../seaseon-changes.service";
import { SideBarComponent } from "../side-bar/side-bar.component";

@Component({
  selector: "app-seasons",
  templateUrl: "./seasons.component.html",
  styleUrls: ["./seasons.component.css"],
})
export class SeasonsComponent implements OnInit {
  seasons: Array<seasonInfo> = [];
  selectedSeason: number = 0;
  eps: Array<movieInfo> = [];
  index: number = 0;
  currentBox: movieInfo = this.infoStore.videoInfo;
  @ViewChildren("boxes") boxes!: QueryList<ElementRef<any>>;
  @ViewChildren("seasons") seasonsElements!: QueryList<ElementRef>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    console.log(event.target.innerWidth);
    // this.smartTv.smartTv?.windowResize();
  }

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event);

    // const ind = this.smartTv.smartTv?.navigate(event);
    // console.log("THI IND: ", ind);
    // if (
    //   ind?.borderReached === "left edge" &&
    //   ind?.currentListName === "seasons"
    // ) {
    //   this.smartTv.smartTv?.switchList("sideBar", 0);
    // }

    // if (
    //   ind?.borderReached === "right edge" &&
    //   ind?.currentListName === "sideBar"
    // ) {
    //   this.smartTv.smartTv?.switchList("seasons", 0);
    // }

    // if (
    //   ind?.borderReached === "right edge" &&
    //   ind?.currentListName === "seasons"
    // ) {
    //   this.smartTv.smartTv?.switchList("episodes", 0);
    // }

    // if (
    //   ind?.borderReached === "left edge" &&
    //   ind?.currentListName === "episodes"
    // ) {
    //   this.smartTv.smartTv?.switchList("seasons", 0);
    // }

    // if (ind?.currentListName === "episodes" && ind?.borderReached === "") {
    //   this.infoStore.checkBorderOverflow(ind);
    // }

    // if (ind?.currentListName === "seasons" && ind?.borderReached === "") {
    //   this.infoStore.checkBorderOverflow(ind);
    // }

    // if (ind && ind.currentListName === "seasons") {
    //   console.log("SELECTED SEASON: ", ind);

    //   this.selectedSeason = ind.currentIndex;
    //   this.updateEpisodes();
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

  constructor(
    private infoStore: InfoStoreService,
    private http: HttpClient,
    private router: Router,
    private seasonService: SeaseonChangesService,
    // private smartTv: SmartTvLibSingletonService
  ) {}

  onHover(e: number, listName: string) {
    // const ind = this.smartTv.smartTv?.findAndSetIndex(e, listName);
    // if (ind?.currentListName === "episodes") {
    //   console.log("EPISODE: ", this.index, this.eps[this.index]);
    //   this.infoStore.videoInfo = this.eps[this.index];
    // }
    // if (ind?.currentListName === "seasons") {
    //   this.smartTv.smartTv?.findAndSetIndex(e, "seasons");
    // }
  }

  playEp() {
    this.router.navigateByUrl("/player");
  }

  trackBySeasons = (index: number, season: any) => {
    this.updateEpisodes();
    return index;
  };

  updateEpisodes() {
    this.eps = this.seasons[this.selectedSeason].episodes;

    // this.smartTv.smartTv?.updateList({
    //   listName: "episodes",
    //   startingIndex: 0,
    //   listElements: this.boxes,
    // });
  }

  ngOnInit(): void {
    console.log("INFOO: ", this.infoStore.showInfo);

    // this.smartTv.changeVisibility(true);
    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });

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

    this.http
      .post(`http://pixable.local:5012/api/mov/seasons`, {
        show: this.infoStore.showInfo.title,
      })
      .subscribe((res: any) => {
        this.seasons = res;
        this.eps = this.seasons[0].episodes;
        this.currentBox = res[this.index];

        // setTimeout(() => {
        //   this.smartTv.smartTv?.addCurrentList({
        //     startingList: true,
        //     listName: "seasons",
        //     startingIndex: 0,
        //     listElements: this.seasonsElements,
        //   });

        //   this.smartTv.smartTv?.addCurrentList({
        //     listName: "episodes",
        //     startingIndex: 0,
        //     listElements: this.boxes,
        //   });
        // }, 1000);
      });
  }
}
