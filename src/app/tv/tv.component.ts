import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  QueryList,
  ViewChildren,
  HostListener,
} from "@angular/core";
import { SmartTvComponent } from "smart-tv";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { InfoStoreService, showInfo } from "../info-store.service";
import { SideBarComponent } from "../side-bar/side-bar.component";

@Component({
  selector: "app-tv",
  templateUrl: "./tv.component.html",
  styleUrls: ["./tv.component.css"],
})
export class TvComponent implements OnInit {
  shows: Array<showInfo> = [];
  smartTv: any;
  index = 0;
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
    console.log("EVENT: ", event);

    this.smartTv.shifter(event);
    const ind = this.smartTv.getCurrentIndex();
    console.log("THI IND: ", ind);

    if (ind.list.name === "tv") {
      this.index = ind.index;
      console.log("THE INDEX: ", this.index);

      this.currentBox = this.shows[this.index];
      console.log("CURRENT BOX: ", this.currentBox, this.shows);

      this.image.nativeElement.style.opacity = "0";
      await this.delay(1000);

      console.log("NEW POSTER: ", this.currentBox.backgroundPoster);

      this.poster = this.currentBox.backgroundPoster;
      this.delay(1000);
      this.image.nativeElement.style.opacity = "1";

      if (event.key === "Enter") {
        console.log(this.index, this.shows[this.index]);
        this.infoStore.showInfo = this.shows[this.index];
        console.log("SELECTED SHOW: ", this.shows[this.index], this.index);

        this.router.navigateByUrl("/seasons");
      }
    }

    if (ind.list.name === "sideBar") {
      this.index = ind.index;
      console.log("SIDE BAR: ", event);

      if (event.key === "Enter") {
        console.log(this.index, this.shows[this.index]);
        // this.infoStore.videoInfo = this.shows[this.index];
        if (this.index === 1) {
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
    private infoStore: InfoStoreService
  ) {
    // this.smartTv = new SmartTvComponent();
  }

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

  ngAfterViewInit() {
    this.smartTv.currentBox = 0;
  }

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
        this.smartTv.addOrChangeElems(
          [
            {
              name: "tv",
              elements: this.boxes,
              listDirections: [
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
                  newFocusList: "tv",
                },
              ],
            },
          ],
          {
            listToStartWith: "tv",
            indexOfStart: 0,
            delay: 500,
          }
        );
      });
  }
}
