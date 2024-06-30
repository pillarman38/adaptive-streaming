import {
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren,
} from "@angular/core";
import { Router } from "@angular/router";
import { InfoStoreService } from "../info-store.service";
import { SmartTvComponent } from "smart-tv";

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
    private smartTv: SmartTvComponent
  ) {
    // this.smartTv = new SmartTvComponent();
  }

  @ViewChildren("homepageList") homepageList!: QueryList<ElementRef>;

  onHover(e: number) {
    this.infoStore.onSideBarHover(e);
  }

  navigateTo(url: string) {
    this.router.navigateByUrl(url);
  }
  ngOnInit() {
    setTimeout(() => {
      // this.smartTv = new SmartTvComponent();
      // this.smartTv.addCurrentList({
      //   startingList: "sideBar",
      //   startingIndex: 0,
      //   listElements: this.homepageList,
      // });
    }, 1000);
  }
}
