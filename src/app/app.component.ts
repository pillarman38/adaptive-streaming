import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { SmartTvLibSingletonService } from "./smart-tv-lib-singleton.service";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
})
export class AppComponent implements OnInit {
  visibility = true;
  constructor(
    private router: Router,
    private smartTv: SmartTvLibSingletonService
  ) {
    smartTv.create();
  }

  ngOnInit(): void {
    this.smartTv.sideBarVisibility.subscribe((visibility) => {
      this.visibility = visibility;
    });
    this.router.navigateByUrl("/videoSelection");
  }
}
