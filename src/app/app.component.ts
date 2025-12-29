import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { ApiConfigService } from "./services/api-config.service";
import { LoggerService } from "./services/logger.service";
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
    private apiConfig: ApiConfigService,
    private logger: LoggerService,
    private smartTv: SmartTvLibSingletonService
  ) {
    // Initialize logger early - this will override console methods on native platforms
    // smartTv.create();
  }

  async ngOnInit(): Promise<void> {
    // Ensure server config is loaded before navigating
    await this.apiConfig.ensureConfigLoaded();
    
    this.smartTv.sideBarVisibility.subscribe((visibility) => {
      this.visibility = visibility;
    });
    this.router.navigateByUrl("/videoSelection");
  }
}
