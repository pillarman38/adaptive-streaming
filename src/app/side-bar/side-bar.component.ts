import {
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren,
  HostListener,
  OnDestroy,
} from "@angular/core";
import { Router } from "@angular/router";
import { InfoStoreService } from "../info-store.service";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
import { HttpClient } from "@angular/common/http";
import { ApiConfigService } from "../services/api-config.service";

@Component({
  selector: "app-side-bar",
  templateUrl: "./side-bar.component.html",
  styleUrls: ["./side-bar.component.css"],
})
export class SideBarComponent implements OnInit, OnDestroy {
  isScanning = false;
  scanProgress = 0;
  scanTotal = 0;
  currentFile = "";
  private progressInterval: any = null;

  // smartTv: any;
  constructor(
    private router: Router,
    private infoStore: InfoStoreService, // private smarTvCompenent: SmartTvComponent
    private smartTv: SmartTvLibSingletonService,
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  @ViewChildren("homepageList") homepageList!: QueryList<ElementRef>;
  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    // Only handle navigation if the sidebar is the current active list
    // This prevents double-processing when other components are active
    if (this.smartTv.smartTv?.currentListName === "sideBar") {
      const ind = this.smartTv.smartTv?.navigate(event);
      console.log("THI IND SIDE BAAR: ", ind);
    }
  }

  onHover(e: number) {
    this.infoStore.onSideBarHover(e);
  }

  updateBorder(element: any): void {
    console.log("ELEMENT: ", element);
  }

  navigateTo(url: string) {
    this.router.navigateByUrl(url);
  }

  scanLibrary() {
    if (this.isScanning) {
      return; // Prevent multiple scans
    }

    this.isScanning = true;
    this.scanProgress = 0;
    this.scanTotal = 0;
    this.currentFile = "";

    // Start the scan
    this.http.get(`${this.apiConfig.getBaseUrl()}/api/mov/scanLibrary`).subscribe({
      next: (res: any) => {
        console.log('Scan completed:', res);
      },
      error: (err) => {
        console.error('Scan error:', err);
        this.isScanning = false;
        this.stopProgressPolling();
      }
    });

    // Start polling for progress
    this.startProgressPolling();
  }

  startProgressPolling() {
    this.progressInterval = setInterval(() => {
      this.http.get(`${this.apiConfig.getBaseUrl()}/api/mov/scanProgress`).subscribe({
        next: (progress: any) => {
          if (progress.isScanning) {
            this.scanProgress = progress.current || 0;
            this.scanTotal = progress.total || 0;
            this.currentFile = progress.currentFile || "";
          } else {
            // Scan completed
            this.isScanning = false;
            this.scanProgress = progress.total || 0;
            this.scanTotal = progress.total || 0;
            this.currentFile = "";
            this.stopProgressPolling();
          }
        },
        error: (err) => {
          console.error('Progress polling error:', err);
        }
      });
    }, 500); // Poll every 500ms
  }

  stopProgressPolling() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  ngOnDestroy() {
    this.stopProgressPolling();
  }

  ngOnInit() {
    setTimeout(() => {
      // console.log("SIDEBAR: ", this.homepageList, this.smartTv);
      this.smartTv.smartTv?.addCurrentList({
        startingIndex: 0,
        listName: "sideBar",
        listElements: this.homepageList,
      });
    }, 1000);
  }
}
