import { Injectable, NgZone, OnDestroy } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject, Subject, Subscription } from "rxjs";
import { InfoStoreService, movieInfo } from "../info-store.service";
import { ApiConfigService } from "./api-config.service";
import { PlatformService } from "./platform.service";
import { WebSocketMessage, WebSocketService } from "./websocket.service";

export type RemotePlayStatus =
  | { state: "idle" }
  | { state: "sending"; title: string }
  | { state: "playing"; title: string }
  | { state: "error"; message: string };

@Injectable({
  providedIn: "root",
})
export class RemotePlaybackService implements OnDestroy {
  private readonly statusSubject = new BehaviorSubject<RemotePlayStatus>({
    state: "idle",
  });
  readonly status$ = this.statusSubject.asObservable();

  private readonly playCommand = new Subject<movieInfo>();
  readonly playCommands$ = this.playCommand.asObservable();

  private messageSubscription?: Subscription;
  private statusTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private websocket: WebSocketService,
    private platform: PlatformService,
    private infoStore: InfoStoreService,
    private apiConfig: ApiConfigService,
    private router: Router,
    private ngZone: NgZone
  ) {
    this.messageSubscription = this.websocket.messages$.subscribe((message) => {
      this.handleMessage(message);
    });
  }

  play(movie: movieInfo): void {
    if (!movie) {
      return;
    }

    const payload = this.cloneMovie(movie);
    payload.atmosIntroEnabled =
      typeof movie.atmosIntroEnabled === "boolean"
        ? movie.atmosIntroEnabled
        : this.apiConfig.isAtmosIntroEnabled();
    this.infoStore.videoInfo = payload;

    if (this.platform.isUgoos()) {
      this.startOnThisDevice(payload);
      return;
    }

    this.setStatus({ state: "sending", title: payload.title || "this title" });
    this.websocket.send({
      type: "playRequest",
      clientId: this.websocket.getClientId(),
      movie: payload,
    });
  }

  ngOnDestroy(): void {
    this.messageSubscription?.unsubscribe();
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    if (message.type === "playRequest") {
      if (!this.shouldPlayOnThisDevice()) {
        return;
      }
      const movie = message.movie as movieInfo;
      if (!movie) {
        return;
      }
      this.startOnThisDevice(movie);
      return;
    }

    if (message.type === "playRequestResult") {
      if (message.ok) {
        this.setStatus({
          state: "playing",
          title: message.title || "Ugoos",
        });
      } else {
        const reason =
          message.reason === "no_ugoos"
            ? "Ugoos is not connected."
            : "Could not play on Ugoos.";
        this.setStatus({ state: "error", message: reason });
      }
    }
  }

  private shouldPlayOnThisDevice(): boolean {
    return this.websocket.isDisplayClient() && this.platform.isUgoos();
  }

  private startOnThisDevice(movie: movieInfo): void {
    this.ngZone.run(() => {
      this.infoStore.videoInfo = this.cloneMovie(movie);
      if (this.router.url.includes("/player")) {
        this.playCommand.next(this.infoStore.videoInfo);
        return;
      }
      this.router.navigateByUrl("/player");
    });
  }

  private cloneMovie(movie: movieInfo): movieInfo {
    const cloned = JSON.parse(JSON.stringify(movie || {})) as movieInfo;
    cloned.versions = [];
    return cloned;
  }

  private setStatus(status: RemotePlayStatus): void {
    this.statusSubject.next(status);
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }
    if (status.state === "idle") {
      return;
    }
    this.statusTimeout = setTimeout(() => {
      this.statusSubject.next({ state: "idle" });
      this.statusTimeout = null;
    }, 4000);
  }
}
