import {
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
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
  constructor(
    private http: HttpClient,
    private smartTv: SmartTvLibSingletonService
  ) {}

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
  }

  onButtonClick(event: any) {
    const buttonText = event.target.textContent;
    switch (buttonText) {
      case "backspace":
        this.inputField = this.inputField.slice(0, -1);
        break;
      case "space":
        this.inputField += " ";
        break;
      case "shift":
        this.shiftCheck(event);
        break;
      default:
        this.inputField += buttonText;
    }

    console.log(this.inputField);
    this.http
      .post("http://192.168.1.6:5012/api/mov/search", {
        searchVal: this.inputField,
      })
      .subscribe((res: any) => {
        console.log("RES: ", res);
        this.results = res;
      });
  }

  ngOnInit(): void {
    console.log("BOXES: ", this.boxes);

    setTimeout(() => {
      this.smartTv.smartTv?.addCurrentList({
        startingList: true,
        listName: "search",
        startingIndex: 0,
        listElements: this.boxes,
      });
    }, 1000);
  }
}
