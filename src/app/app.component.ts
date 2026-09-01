import { Component, OnInit, OnDestroy } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { ApiConfigService } from "./services/api-config.service";
import { LoggerService } from "./services/logger.service";
import { SmartTvLibSingletonService } from "./smart-tv-lib-singleton.service";
import { ControllerBridgeService } from "./services/controller-bridge.service";
import { WebSocketService } from "./services/websocket.service";
import { LayoutService } from "./services/layout.service";
import { CompactScrollService } from "./services/compact-scroll.service";
import { VoteSessionService } from "./services/vote-session.service";
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
  private layoutSubscription?: Subscription;
  private isOnControllerRoute = false;
  
  constructor(
    private router: Router,
    private apiConfig: ApiConfigService,
    private logger: LoggerService,
    private smartTv: SmartTvLibSingletonService,
    private controllerBridge: ControllerBridgeService,
    private websocketService: WebSocketService,
    private layout: LayoutService,
    private compactScroll: CompactScrollService,
    private voteSession: VoteSessionService
  ) {
    // Initialize logger early - this will override console methods on native platforms
    // smartTv.create();

    // ControllerBridge subscribes to WebSocket messages; connect after config loads (ngOnInit).
  }

  async ngOnInit(): Promise<void> {
    this.compactScroll.initTopTapToScroll();
    this.applyLayoutClasses(this.layout.isCompactLayout);
    this.layoutSubscription = this.layout.compact$.subscribe((compact) => {
      this.applyLayoutClasses(compact);
    });

    // Ensure server config is loaded before WebSocket relay or navigating
    await this.apiConfig.ensureConfigLoaded();
    const initialPath = window.location.pathname;
    const initialRole = initialPath.startsWith('/controller') ? 'controller' : 'display';
    await this.websocketService.connect(initialRole);
    this.voteSession.syncParticipationOnConnect();
    console.log("BASE URL: ", this.apiConfig.getBaseUrl());
    
    // Subscribe to sidebar visibility changes, but only apply if not on controller route
    this.sidebarVisibilitySubscription = this.smartTv.sideBarVisibility.subscribe((visibility) => {
      if (!this.isOnControllerRoute) {
        this.visibility = visibility;
        this.updatePlayerRouteClass();
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
          this.websocketService.setRole('controller');
        } else {
          // Show sidebar for other routes
          this.isOnControllerRoute = false;
          this.visibility = true;
          this.websocketService.setRole('display');
          this.voteSession.syncParticipationOnConnect();
        }
        this.updatePlayerRouteClass(url);
      });
    
    // Check initial route from window location to avoid router timing issues
    console.log("INITIAL PATH: ", initialPath);
    this.updatePlayerRouteClass(initialPath);
    if (initialPath === '/controller' || initialPath.startsWith('/controller')) {
      this.isOnControllerRoute = true;
      this.visibility = false;
    } else if (initialPath === '/' || initialPath === '') {
      this.router.navigateByUrl("/videoSelection");
    }
  }

  private applyLayoutClasses(compact: boolean): void {
    document.body.classList.toggle('compact-layout', compact);
    this.compactScroll.syncDocumentScrollClass();
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute(
        'content',
        compact
          ? 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
          : 'width=device-width, initial-scale=0.5, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    }
    this.updatePlayerRouteClass();
  }

  private updatePlayerRouteClass(url?: string): void {
    const path = url ?? this.router.url ?? window.location.pathname;
    const onPlayer = path.includes('/player');
    document.body.classList.toggle('player-route', onPlayer);
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.sidebarVisibilitySubscription) {
      this.sidebarVisibilitySubscription.unsubscribe();
    }
    if (this.layoutSubscription) {
      this.layoutSubscription.unsubscribe();
    }
  }
}
