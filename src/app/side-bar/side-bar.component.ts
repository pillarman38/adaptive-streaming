import {
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren,
} from "@angular/core";
import { Router } from "@angular/router";
import { SmartTvComponent } from "smart-tv";
import { InfoStoreService } from "../info-store.service";

@Component({
  selector: "app-side-bar",
  templateUrl: "./side-bar.component.html",
  styleUrls: ["./side-bar.component.css"],
})
export class SideBarComponent {
  smartTv: any;
  constructor(private router: Router, private infoStore: InfoStoreService) {
    this.smartTv = new SmartTvComponent();
  }

  @ViewChildren("homepageList") homepageList!: QueryList<ElementRef>;

  onHover(e: number) {
    this.infoStore.onSideBarHover(e);
  }

  navigateTo(url: string) {
    this.router.navigateByUrl(url);
  }
}
