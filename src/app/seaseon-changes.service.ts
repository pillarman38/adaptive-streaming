import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class SeaseonChangesService {
  constructor() {}
  private season = new Subject<any>();

  newSelectedseason(season: number) {
    this.season.next(season);
  }

  getNewSelectedSeason() {
    return this.season.asObservable();
  }
}
