import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { SmartTvComponent } from "smart-tv";

@Injectable({
  providedIn: "root",
})
export class SmartTvLibSingletonService {
  smartTv: SmartTvComponent | undefined;
  sideBarVisibility = new Subject<any>();

  constructor() {}

  changeVisibility(visibility: boolean) {
    this.sideBarVisibility.next(visibility);
  }

  create() {
    this.smartTv = new SmartTvComponent();
  }

  getSmartTv() {
    return this.smartTv;
  }
}
