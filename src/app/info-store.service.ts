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
  posterUrl?: string;
  backdropPhotoUrl?: string;
  type: string;
  nextEp?: movieInfo;
  transmuxToPixie: number;
  dolbyVision: number;
  threeD: number;
  versions: movieInfo[];
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
  posterUrl?: string;
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

  checkBorderOverflow(boxes: any[], currentIndex: number) {
    if (boxes && boxes[currentIndex] && boxes[currentIndex].element && boxes[currentIndex].element.nativeElement) {
      boxes[currentIndex].element.nativeElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  movies: movieInfo[] = []

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
    backdropPhotoUrl: "",
    type: "movie",
    transmuxToPixie: 0,
    dolbyVision: 0,
    threeD: 0,
    versions: [],
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
    posterUrl: "",
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
