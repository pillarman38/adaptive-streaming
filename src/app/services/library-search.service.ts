import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, from } from "rxjs";
import { switchMap } from "rxjs/operators";
import { ApiConfigService } from "./api-config.service";
import { movieInfo, showInfo } from "../info-store.service";

@Injectable({
  providedIn: "root",
})
export class LibrarySearchService {
  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  searchMovies(searchVal: string): Observable<movieInfo[]> {
    return from(this.apiConfig.ensureConfigLoaded()).pipe(
      switchMap(() =>
        this.http.post<movieInfo[]>(
          `${this.apiConfig.getBaseUrl()}/api/mov/search/movies`,
          { searchVal }
        )
      )
    );
  }

  searchTvShows(searchVal: string): Observable<showInfo[]> {
    return from(this.apiConfig.ensureConfigLoaded()).pipe(
      switchMap(() =>
        this.http.post<showInfo[]>(
          `${this.apiConfig.getBaseUrl()}/api/mov/search/tv`,
          { searchVal }
        )
      )
    );
  }
}
