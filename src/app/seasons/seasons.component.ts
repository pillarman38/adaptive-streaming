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
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
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

  @ViewChildren("boxes") boxes!: QueryList<ElementRef>;
  @ViewChildren("seasons") seasonsElements!: QueryList<ElementRef>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    console.log(event.target.innerWidth);
    this.smartTv.smartTv?.windowResize();
  }

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    console.log("EVENT: ", event);

    const ind = this.smartTv.smartTv?.navigate(event);
    console.log("THI IND: ", ind);
    if (
      ind?.borderReached === "left edge" &&
      ind?.currentListName === "seasons"
    ) {
      this.smartTv.smartTv?.switchList("sideBar", 0);
    }

    if (
      ind?.borderReached === "right edge" &&
      ind?.currentListName === "sideBar"
    ) {
      this.smartTv.smartTv?.switchList("seasons", 0);
    }

    if (
      ind?.borderReached === "right edge" &&
      ind?.currentListName === "seasons"
    ) {
      this.smartTv.smartTv?.switchList("episodes", 0);
    }

    if (
      ind?.borderReached === "left edge" &&
      ind?.currentListName === "episodes"
    ) {
      this.smartTv.smartTv?.switchList("seasons", 0);
    }
  }

  constructor(
    private infoStore: InfoStoreService,
    private http: HttpClient,
    private router: Router,
    private seasonService: SeaseonChangesService,
    private smartTv: SmartTvLibSingletonService
  ) {
    // this.smartTv = new SmartTvComponent();
  }

  onHover(e: number, listName: string) {
    if (listName === "episodes") {
      // const ind = this.smartTv.findAndSetIndex(e, "episodes");
      // this.index = ind.index;
      console.log("EPISODE: ", this.index, this.eps[this.index]);
      this.infoStore.videoInfo = this.eps[this.index];
    }
    if (listName === "seasons") {
      // this.smartTv.findAndSetIndex(e, "seasons");
    }
    if (listName === "sideBar") {
      // this.smartTv.findAndSetIndex(e, "sideBar");
    }
  }

  playEp() {
    this.router.navigateByUrl("/player");
  }

  selectSeason(i: number) {
    this.selectedSeason = i;
    this.seasonService.newSelectedseason(this.selectedSeason);
  }

  ngOnInit(): void {
    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });

    this.seasonService.getNewSelectedSeason().subscribe((res) => {
      console.log("NEW SEASON: ", res);

      this.selectedSeason = res;

      this.smartTv.smartTv?.removeList("episodes");
      setTimeout(() => {
        this.smartTv.smartTv?.addCurrentList({
          listName: "episodes",
          startingIndex: 0,
          listElements: this.boxes,
        });
      }, 1000);

      this.eps = this.seasons[res].episodes;
      this.index = 0;
      this.currentBox = res[this.index];
      // this.smartTv.currentBox = 0;
    });

    if (this.infoStore.videoInfo.pid > 0) {
      console.log("INSIDE PID: ");

      this.http
        .post(`http://192.168.0.154:4012/api/mov/pidkill`, {
          pid: this.infoStore.videoInfo.pid,
        })
        .subscribe((res) => {
          console.log("RESPONDED: ", res);
        });
    }

    this.http
      .post(`http://192.168.0.154:4012/api/mov/seasons`, {
        show: this.infoStore.showInfo.title,
      })
      .subscribe((res: any) => {
        console.log("SEASONS: ", res);

        this.seasons = res;
        this.eps = this.seasons[0].episodes;
        this.currentBox = res[this.index];

        setTimeout(() => {
          this.smartTv.smartTv?.addCurrentList({
            startingList: true,
            listName: "seasons",
            startingIndex: 0,
            listElements: this.seasonsElements,
          });

          this.smartTv.smartTv?.addCurrentList({
            listName: "episodes",
            startingIndex: 0,
            listElements: this.boxes,
          });
        }, 1000);
      });
  }
}
