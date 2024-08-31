import { Injectable } from "@angular/core";
import { SmartTvComponent } from "smart-tv";

@Injectable({
  providedIn: "root",
})
export class SmartTvLibSingletonService {
  smartTv: SmartTvComponent | undefined;
  constructor() {}
  create() {
    this.smartTv = new SmartTvComponent();
  }
  getSmartTv() {
    return this.smartTv;
  }
}
