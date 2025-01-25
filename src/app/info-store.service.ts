import { Injectable, QueryList, ElementRef } from "@angular/core";
import { Observable, Subject } from "rxjs";

export interface movieInfo {
  id: number;
  coverArt: string;
  title: string;
  overview: string;
  epTitle?: string;
  epNumber?: number;
  season?: number;
  channels: number;
  duration: number;
  fileName: string;
  filePath: string;
  fileformat: string;
  originalLang: string;
  posterUrl: string;
  pid: number;
  resolution: string;
  seekTime: number;
  subtitleSelect: 0;
  subtitles: string;
  tmdbId: string;
  srtLocation: string;
  audio: string;
  cast: string;
  location: string;
  trailerUrl: string;
  srtUrl: string;
  bonusFeatures: number;
  browser?: string;
  backgroundPoster?: string;
  backdropPhotoUrl?: string;
  type: string;
  nextEp?: movieInfo;
  transmuxToPixie: number;
}

export interface showInfo {
  id: number;
  title: string;
  backdropPhotoUrl: string;
  numberOfSeasons: number;
  overview: string;
  coverArt: string;
  cast: string;
  audio: string;
  resolution: string;
  language: string;
  epTotal: string;
  backgroundPoster?: string;
}

export interface searchRes {
  title: string;
  posterUrl: string;
}
// export interface episodes {
//   id: number;
//   epTitle: string;
//   location: string;
//   filePath: string;
//   overview: string;
//   backdropPhotoUrl: string;
//   epNumber: number;
//   title: string;
//   season: number;
//   resolution: string;
//   seekTime: number;
//   duration: number;
// }

export interface seasonInfo {
  id: number;
  numOfEpsInseason: number;
  poster: string;
  season_number: number;
  title: string;
  episodes: Array<movieInfo>;
}

@Injectable({
  providedIn: "root",
})
export class InfoStoreService {
  private sideBarHover = new Subject<any>();

  constructor() {}

  onSideBarHover(e: number) {
    this.sideBarHover.next(e);
  }

  catchSideBarHover() {
    return this.sideBarHover.asObservable();
  }

  checkBorderOverflow(ind: any) {
    ind.item.element.nativeElement.scrollIntoView({ behavior: "smooth" });
  }

  videoInfo: movieInfo = {
    id: 0,
    title: "",
    epTitle: "",
    overview: "",
    coverArt: "",
    channels: 0,
    duration: 0,
    fileName: "",
    filePath: "",
    fileformat: "",
    originalLang: "",
    posterUrl: "",
    pid: 0,
    resolution: "",
    seekTime: 0,
    subtitleSelect: 0,
    subtitles: "",
    tmdbId: "",
    srtLocation: "",
    audio: "",
    cast: "",
    location: "",
    trailerUrl: "",
    srtUrl: "",
    bonusFeatures: 0,
    browser: "",
    backgroundPoster: "",
    backdropPhotoUrl: "",
    type: "movie",
    transmuxToPixie: 0,
  };

  showInfo: showInfo = {
    id: 0,
    title: "",
    backdropPhotoUrl: "",
    numberOfSeasons: 0,
    overview: "",
    coverArt: "",
    cast: "",
    audio: "",
    resolution: "",
    language: "",
    epTotal: "",
    backgroundPoster: "",
  };

  seasonInfo: seasonInfo = {
    id: 0,
    numOfEpsInseason: 0,
    poster: "",
    season_number: 0,
    title: "",
    episodes: [],
  };
}
