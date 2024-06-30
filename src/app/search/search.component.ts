import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { results } from "../info-store.service";

@Component({
  selector: "app-search",
  templateUrl: "./search.component.html",
  styleUrls: ["./search.component.css"],
})
export class SearchComponent {
  results: Array<results> = [];
  constructor(private http: HttpClient) {}

  onKeyPress(e: any) {
    this.http
      .post(`http://192.168.0.154:4012/api/mov/search`, {
        searchVal: e.target.value,
      })
      .subscribe((res: any) => {
        console.log("RES: ", res);
        this.results = res;
      });
  }
}
