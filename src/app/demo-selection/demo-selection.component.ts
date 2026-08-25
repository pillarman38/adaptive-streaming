import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  QueryList,
  ViewChildren,
  HostListener,
} from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { InfoStoreService, movieInfo } from "../info-store.service";
import { ApiConfigService } from "../services/api-config.service";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";
import { PlatformService } from "../services/platform.service";
import { LayoutService } from "../services/layout.service";

@Component({
  selector: "app-demo-selection",
  templateUrl: "./demo-selection.component.html",
  styleUrls: ["./demo-selection.component.css"],
})
export class DemoSelectionComponent implements OnInit {
  index = 0;
  demos: Array<movieInfo> = [];
  currentBox: movieInfo = this.infoStore.videoInfo;
  poster: string | undefined = "";
  isAndroid = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private infoStore: InfoStoreService,
    private apiConfig: ApiConfigService,
    private smartTv: SmartTvLibSingletonService,
    private platformService: PlatformService,
    public layout: LayoutService
  ) {}

  @ViewChild("wrapper") wrapper!: ElementRef;
  @ViewChild("image") image!: ElementRef;
  @ViewChild("backgroundPlacer") backgroundPlacer!: ElementRef;
  @ViewChildren("boxes") boxes!: QueryList<ElementRef<any>>;
  @ViewChild("list") list!: ElementRef;

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    if (!this.smartTv.smartTv || this.smartTv.smartTv.currentListName !== "demos") {
      return;
    }

    const previousIndex = this.index;
    const ind = this.smartTv.smartTv?.navigate(event);
    this.index = ind?.currentIndex ?? this.index;

    if (ind?.borderReached === "left edge") {
      this.smartTv.smartTv?.switchList("sideBar", 0);
      this.infoStore.onSideBarHover(0);
    }
    if (ind?.borderReached === "right edge" && ind.currentListName === "demos") {
      this.smartTv.smartTv?.wrapRight();
    }
    if (ind?.borderReached === "bottom edge" && ind.currentListName === "demos") {
      const boxesPerRow = 5;
      const topRowIndex = this.index % boxesPerRow;
      this.smartTv.smartTv?.setCurrentIndex(topRowIndex);
      this.index = topRowIndex;
    }
    if (
      event.code === "ArrowDown" &&
      ind?.currentListName === "demos" &&
      this.smartTv.smartTv?.boxes &&
      previousIndex >= this.smartTv.smartTv.boxes.length - 1 &&
      (ind?.currentIndex === previousIndex || ind?.currentIndex === undefined)
    ) {
      const boxesPerRow = 5;
      const topRowIndex = previousIndex % boxesPerRow;
      this.smartTv.smartTv?.setCurrentIndex(topRowIndex);
      this.index = topRowIndex;
      this.updateBorderStyling(topRowIndex);
    }

    if (ind?.currentListName === "demos") {
      if (this.smartTv.smartTv?.boxes && ind.currentIndex !== undefined) {
        this.infoStore.checkBorderOverflow(this.smartTv.smartTv.boxes, ind.currentIndex);
        this.updateBorderStyling(ind.currentIndex);
      }
      await this.updateCurrentBox();
    }

    const isEnterKey =
      event.code === "Enter" ||
      event.code === "NumpadEnter" ||
      event.key === "Enter" ||
      event.keyCode === 13;

    if (isEnterKey && ind?.currentListName === "demos") {
      this.index = ind.currentIndex;
      this.selectDemo(this.index);
    }
  }

  @HostListener("window:resize")
  onResize() {
    this.smartTv.smartTv?.windowResize();
  }

  delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  selectDemo(demoIndex?: number) {
    const index = demoIndex ?? this.index;
    const demo = this.demos[index];
    if (!demo) {
      return;
    }
    this.index = index;
    this.infoStore.demoSelectionIndex = index;
    this.infoStore.videoInfo = this.mapDemoToVideoInfo(demo);
    this.router.navigateByUrl("/player");
  }

  mapDemoToVideoInfo(demo: movieInfo): movieInfo {
    return {
      ...this.infoStore.videoInfo,
      id: demo.id,
      title: demo.title,
      fileName: demo.fileName,
      filePath: demo.filePath,
      fileformat: demo.fileformat || "mkv",
      dolbyVision: demo.dolbyVision ? 1 : 0,
      duration: demo.duration,
      audio: demo.audio || "",
      resolution: demo.resolution || "",
      channels: demo.channels || 0,
      seekTime: 0,
      pid: 0,
      type: "demo",
      overview: "",
      posterUrl: (demo as any).thumbnailPath || "",
    };
  }

  async updateCurrentBox() {
    this.currentBox = this.demos[this.index];
    if (!this.image?.nativeElement) {
      return;
    }
    this.image.nativeElement.style.opacity = "0";
    await this.delay(300);
    this.poster = (this.currentBox as any).thumbnailPath || this.currentBox.posterUrl;
    await this.delay(300);
    this.image.nativeElement.style.opacity = "1";
  }

  async onHover(e: number, listName: string) {
    const ind = this.smartTv.smartTv?.findAndSetIndex(e, listName);
    if (ind?.currentListName === "demos") {
      this.index = e;
      await this.updateCurrentBox();
    }
  }

  onImageLoad() {
    if (this.image?.nativeElement) {
      this.image.nativeElement.style.opacity = "1";
    }
  }

  private clearInlineBorderStyles(clearElementBorderClass = false): void {
    if (this.smartTv.smartTv?.boxes) {
      this.smartTv.smartTv.boxes.forEach((box: any) => {
        if (box?.element?.nativeElement) {
          const element = box.element.nativeElement;
          if (element.style.border) {
            element.style.border = "";
            if (clearElementBorderClass) {
              element.classList.remove("elementBorder");
            }
          }
        }
      });
    }
  }

  updateBorderStyling(currentIndex: number) {
    this.clearInlineBorderStyles();
    if (this.boxes) {
      this.boxes.forEach((box) => {
        if (box.nativeElement?.style.border) {
          box.nativeElement.style.border = "";
        }
      });
    }
    if (!this.smartTv.smartTv?.boxes || currentIndex < 0) {
      return;
    }
    this.smartTv.smartTv.boxes.forEach((box: any, index: number) => {
      if (box?.element?.nativeElement) {
        const element = box.element.nativeElement;
        if (element.style.border) {
          element.style.border = "";
        }
        if (index === currentIndex) {
          element.classList.add("elementBorder");
        } else {
          element.classList.remove("elementBorder");
        }
      }
    });
  }

  private initSmartTvList(startingIndex: number) {
    if (!this.smartTv.smartTv || this.boxes.length === 0) {
      return;
    }
    this.smartTv.smartTv.addCurrentList({
      startingList: true,
      listName: "demos",
      startingIndex,
      listElements: this.boxes,
    });
    this.clearInlineBorderStyles(true);
    const safeIndex = Math.min(startingIndex, this.boxes.length - 1);
    this.index = safeIndex;
    this.smartTv.smartTv.createChunks();
    this.smartTv.smartTv.updateRowLength();
    this.smartTv.smartTv.setCurrentIndex(safeIndex);
    this.updateBorderStyling(safeIndex);
    if (this.demos[safeIndex]) {
      this.currentBox = this.demos[safeIndex];
      this.poster =
        (this.demos[safeIndex] as any).thumbnailPath ||
        this.demos[safeIndex].posterUrl;
    }
    if (this.smartTv.smartTv.boxes?.[safeIndex]) {
      this.infoStore.checkBorderOverflow(this.smartTv.smartTv.boxes, safeIndex);
    }
  }

  private applyDemos(demos: movieInfo[]) {
    this.demos = demos;
    this.infoStore.demoSelectionDemos = demos;
    const restoredIndex = Math.min(
      this.infoStore.demoSelectionIndex || 0,
      Math.max(demos.length - 1, 0)
    );
    this.index = restoredIndex;
    const currentDemo = demos[restoredIndex];
    if (currentDemo) {
      this.currentBox = currentDemo;
      this.poster = (currentDemo as any).thumbnailPath || currentDemo.posterUrl;
    }
    setTimeout(() => this.initSmartTvList(restoredIndex), 500);
  }

  async ngOnInit() {
    this.isAndroid = this.platformService.isAndroid();
    if (!this.smartTv.smartTv) {
      this.smartTv.create();
    }

    this.infoStore.catchSideBarHover().subscribe((e: number) => {
      this.onHover(e, "sideBar");
    });

    if (this.infoStore.demoSelectionDemos.length > 0) {
      this.applyDemos(this.infoStore.demoSelectionDemos);
      return;
    }

    try {
      await this.apiConfig.ensureConfigLoaded();
      this.http
        .post(`${this.apiConfig.getBaseUrl()}/api/mov/demos`, {})
        .subscribe({
          next: (res: any) => {
            this.applyDemos(Array.isArray(res) ? res : []);
          },
          error: (err) => {
            console.error("Error loading demos:", err);
          },
        });
    } catch (error) {
      console.error("Error loading config before demos API call:", error);
    }
  }
}
