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
import { SmartTvComponent } from "smart-tv";
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
  smartTv: any;
  index: number = 0;
  currentBox: movieInfo = this.infoStore.videoInfo;

  @ViewChildren("boxes") boxes!: QueryList<ElementRef>;
  @ViewChildren("seasons") seasonsElements!: QueryList<ElementRef>;
  @ViewChild(SideBarComponent) sideBar!: SideBarComponent;

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    console.log(event.target.innerWidth);
    this.smartTv.windowResize();
  }

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    this.smartTv.shifter(event);

    const ind = this.smartTv.getCurrentIndex();
    console.log("IND: ", ind);

    if (ind.list.name === "episodes") {
      this.index = ind.index;
      this.currentBox = this.eps[ind.index];
      console.log("THI IND: ", ind, this.currentBox);

      if (event.key === "Enter") {
        // const ind = this.smartTv.findAndSetIndex(event, "episodes");

        console.log("EPISODE: ", this.index, this.eps[this.index]);
        this.infoStore.videoInfo = this.eps[this.index];
        this.router.navigateByUrl("/player");
      }
    }

    if (ind.list.name === "seasons") {
      this.selectSeason(ind.index);
    }

    if (ind.list.name === "sideBar") {
      this.index = ind.index;

      console.log("SIDE BAR: ", this.index);

      if (event.key === "Enter") {
        if (this.index === 1) {
          this.router.navigateByUrl("/videoSelection");
        }
        if (this.index === 2) {
          this.router.navigateByUrl("/tv");
        }
      }
    }
  }

  constructor(
    private infoStore: InfoStoreService,
    private http: HttpClient,
    private router: Router,
    private seasonService: SeaseonChangesService
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

  ngAfterViewInit() {
    this.smartTv.currentBox = 0;
    console.log("GET ELEMS: ", this.seasonsElements, this.boxes);
  }

  ngOnInit(): void {
    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });

    this.seasonService.getNewSelectedSeason().subscribe((res) => {
      console.log("NEW SEASON: ", res);

      this.selectedSeason = res;
      this.eps = this.seasons[res].episodes;
      this.index = 0;
      this.currentBox = res[this.index];
      this.smartTv.currentBox = 0;
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

        this.smartTv.addOrChangeElems(
          [
            {
              name: "episodes",
              elements: this.boxes,
              listDirections: [
                {
                  moveToNewListOn: {
                    direction: "left",
                  },
                  newFocusList: "seasons",
                },
              ],
            },
            {
              name: "seasons",
              elements: this.seasonsElements,
              listDirections: [
                {
                  moveToNewListOn: {
                    direction: "left",
                  },
                  newFocusList: "sideBar",
                },
                {
                  moveToNewListOn: {
                    direction: "right",
                  },
                  newFocusList: "episodes",
                },
              ],
            },
            {
              name: "sideBar",
              elements: this.sideBar.homepageList,
              listDirections: [
                {
                  moveToNewListOn: {
                    direction: "right",
                  },
                  newFocusList: "seasons",
                },
              ],
            },
          ],
          {
            listToStartWith: "episodes",
            indexOfStart: 0,
            delay: 500,
          }
        );
      });
  }
}
