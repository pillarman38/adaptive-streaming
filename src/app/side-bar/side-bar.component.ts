import {
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren,
  HostListener,
} from "@angular/core";
import { Router } from "@angular/router";
import { InfoStoreService } from "../info-store.service";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";

@Component({
  selector: "app-side-bar",
  templateUrl: "./side-bar.component.html",
  styleUrls: ["./side-bar.component.css"],
})
export class SideBarComponent implements OnInit {
  // smartTv: any;
  constructor(
    private router: Router,
    private infoStore: InfoStoreService, // private smarTvCompenent: SmartTvComponent
    private smartTv: SmartTvLibSingletonService
  ) {}

  @ViewChildren("homepageList") homepageList!: QueryList<ElementRef>;
  // @HostListener("window:keydown", ["$event"])
  // async onKeyDown(event: KeyboardEvent) {
  //   console.log("EVENT: ", event);

  //   // const ind = this.smartTv.smartTv?.navigate(event);
  //   console.log("THI IND SIDE BAAR: ");
  // }

  onHover(e: number) {
    this.infoStore.onSideBarHover(e);
  }

  updateBorder(element: any): void {
    console.log("ELEMENT: ", element);
  }

  navigateTo(url: string) {
    this.router.navigateByUrl(url);
  }

  ngOnInit() {
    setTimeout(() => {
      console.log("SIDEBAR: ", this.homepageList, this.smartTv);
      this.smartTv.smartTv?.addCurrentList({
        startingIndex: 0,
        listName: "sideBar",
        listElements: this.homepageList,
      });
    }, 1000);
  }
}
