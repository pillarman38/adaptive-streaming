import { Component, OnInit, OnDestroy } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { ApiConfigService } from "./services/api-config.service";
import { LoggerService } from "./services/logger.service";
import { SmartTvLibSingletonService } from "./smart-tv-lib-singleton.service";
import { ControllerBridgeService } from "./services/controller-bridge.service";
import { WebSocketService } from "./services/websocket.service";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
})
export class AppComponent implements OnInit, OnDestroy {
  visibility = true;
  private routerSubscription?: Subscription;
  private sidebarVisibilitySubscription?: Subscription;
  private isOnControllerRoute = false;
  
  constructor(
    private router: Router,
    private apiConfig: ApiConfigService,
    private logger: LoggerService,
    private smartTv: SmartTvLibSingletonService,
    private controllerBridge: ControllerBridgeService,
    private websocketService: WebSocketService
  ) {
    // Initialize logger early - this will override console methods on native platforms
    // smartTv.create();
    
    // Initialize websocket connection and controller bridge
    // The controller bridge will listen to websocket messages and dispatch keyboard events
    this.websocketService.connect();
  }

  async ngOnInit(): Promise<void> {
    // Ensure server config is loaded before navigating
    await this.apiConfig.ensureConfigLoaded();
    console.log("BASE URL: ", this.apiConfig.getBaseUrl());
    
    // Subscribe to sidebar visibility changes, but only apply if not on controller route
    this.sidebarVisibilitySubscription = this.smartTv.sideBarVisibility.subscribe((visibility) => {
      if (!this.isOnControllerRoute) {
        this.visibility = visibility;
      }
    });
    
    // Subscribe to router events to hide sidebar when on controller route
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.urlAfterRedirects || event.url;
        // Hide sidebar if we're on the controller route
        if (url === '/controller' || url.startsWith('/controller')) {
          this.isOnControllerRoute = true;
          this.visibility = false;
        } else {
          // Show sidebar for other routes
          this.isOnControllerRoute = false;
          this.visibility = true;
        }
      });
    
    // Check initial route from window location to avoid router timing issues
    const initialPath = window.location.pathname;
    console.log("INITIAL PATH: ", initialPath);
    if (initialPath === '/controller' || initialPath.startsWith('/controller')) {
      this.isOnControllerRoute = true;
      this.visibility = false;
    } else {
      // Only navigate to videoSelection if we're on the root path
      if (initialPath === '/' || initialPath === '') {
        this.router.navigateByUrl("/videoSelection");
      }
    }
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.sidebarVisibilitySubscription) {
      this.sidebarVisibilitySubscription.unsubscribe();
    }
  }
}
