import {
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  HostListener,
} from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { searchRes } from "../info-store.service";
import { SmartTvLibSingletonService } from "../smart-tv-lib-singleton.service";

@Component({
  selector: "app-search",
  templateUrl: "./search.component.html",
  styleUrls: ["./search.component.css"],
})
export class SearchComponent implements OnInit {
  results: Array<searchRes> = [];
  // @ViewChild("inputField") inputField!: ElementRef;
  inputField: string = "";
  index = 0;
  shiftKeyPressed: boolean = false;
  // @ViewChild("image") image!: ElementRef;
  @ViewChildren("boxes") boxes!: QueryList<ElementRef<any>>;
  @ViewChildren("keyboardKey") keyboardKeys!: QueryList<ElementRef<any>>;
  constructor(
    private http: HttpClient,
    private smartTv: SmartTvLibSingletonService
  ) {}

  @HostListener("window:keydown", ["$event"])
  async onKeyDown(event: KeyboardEvent) {
    if (!this.smartTv.smartTv) {
      return;
    }

    // Only handle navigation if keyboard or search results are the current active list
    const currentListName = this.smartTv.smartTv.currentListName;
    if (currentListName !== "keyboard" && currentListName !== "search") {
      return;
    }

    const ind = this.smartTv.smartTv?.navigate(event);

    // Handle Enter key
    const isEnterKey = event.code === "Enter" || 
                       event.code === "NumpadEnter" || 
                       event.key === "Enter" ||
                       event.keyCode === 13;

    if (isEnterKey) {
      if (ind?.currentListName === "keyboard") {
        // Get the selected keyboard key and trigger its action
        const selectedKey = this.keyboardKeys.toArray()[ind.currentIndex ?? 0];
        if (selectedKey?.nativeElement) {
          const buttonText = selectedKey.nativeElement.textContent?.trim();
          this.handleKeyPress(buttonText);
        }
      } else if (ind?.currentListName === "search") {
        // Select a search result
        this.index = ind.currentIndex ?? 0;
        this.selectedMedia();
      }
      return;
    }

    // Handle switching between keyboard and search results
    if (ind?.borderReached === "bottom edge" && currentListName === "keyboard") {
      // Switch to search results when at bottom of keyboard
      if (this.boxes.length > 0) {
        this.smartTv.smartTv?.switchList("search", 0);
      }
    } else if (ind?.borderReached === "top edge" && currentListName === "search") {
      // Switch back to keyboard when at top of search results
      this.smartTv.smartTv?.switchList("keyboard", 0);
    }
  }

  async onHover(e: number) {}

  selectedMedia() {
    console.log("media");
  }

  shiftCheck(event: any) {
    console.log("event: ", event.target.innerText);
    if (this.shiftKeyPressed === true) {
      this.shiftKeyPressed = false;
    } else {
      this.shiftKeyPressed = true;
    }
    // Re-register keyboard list after shift state changes
    this.registerKeyboardList();
  }

  handleKeyPress(buttonText: string) {
    switch (buttonText) {
      case "backspace":
        this.inputField = this.inputField.slice(0, -1);
        break;
      case "space":
        this.inputField += " ";
        break;
      case "shift":
        this.shiftKeyPressed = !this.shiftKeyPressed;
        this.registerKeyboardList();
        break;
      default:
        this.inputField += buttonText;
    }

    console.log(this.inputField);
    this.http
      .post("http://pixable.local:5012/api/mov/search", {
        searchVal: this.inputField,
      })
      .subscribe((res: any) => {
        console.log("RES: ", res);
        this.results = res;
        // Update search results list
        setTimeout(() => {
          if (this.boxes.length > 0) {
            this.smartTv.smartTv?.addCurrentList({
              listName: "search",
              startingIndex: 0,
              listElements: this.boxes,
            });
          }
        }, 100);
      });
  }

  onButtonClick(event: any) {
    const buttonText = event.target.textContent?.trim();
    this.handleKeyPress(buttonText);
  }

  registerKeyboardList() {
    // Wait for DOM to update after shift state change
    setTimeout(() => {
      if (this.keyboardKeys.length > 0) {
        this.smartTv.smartTv?.addCurrentList({
          startingList: true,
          listName: "keyboard",
          startingIndex: 0,
          listElements: this.keyboardKeys,
        });
      }
    }, 100);
  }

  ngOnInit(): void {
    console.log("BOXES: ", this.boxes);

    setTimeout(() => {
      // Register keyboard as the initial list
      if (this.keyboardKeys.length > 0) {
        this.smartTv.smartTv?.addCurrentList({
          startingList: true,
          listName: "keyboard",
          startingIndex: 0,
          listElements: this.keyboardKeys,
        });
      }
      
      // Register search results list if available
      if (this.boxes.length > 0) {
        this.smartTv.smartTv?.addCurrentList({
          listName: "search",
          startingIndex: 0,
          listElements: this.boxes,
        });
      }
    }, 1000);
  }
}
