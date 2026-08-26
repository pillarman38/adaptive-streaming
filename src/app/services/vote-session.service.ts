import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import { movieInfo } from "../info-store.service";
import { WebSocketService } from "./websocket.service";

export type VotePhase = "idle" | "collecting" | "revealed";

export interface VoteState {
  active: boolean;
  phase: VotePhase;
  hostClientId: string | null;
  connectedCount: number;
  finishedCount: number;
  pendingCount: number;
  finishedClientIds: string[];
  votedMovieKeys: string[];
}

const INITIAL_VOTE_STATE: VoteState = {
  active: false,
  phase: "idle",
  hostClientId: null,
  connectedCount: 0,
  finishedCount: 0,
  pendingCount: 0,
  finishedClientIds: [],
  votedMovieKeys: [],
};

@Injectable({
  providedIn: "root",
})
export class VoteSessionService implements OnDestroy {
  private readonly stateSubject = new BehaviorSubject<VoteState>(
    INITIAL_VOTE_STATE
  );
  readonly state$ = this.stateSubject.asObservable();

  private draftVotes = new Set<string>();
  private hasFinished = false;
  private messageSubscription?: Subscription;

  constructor(private websocket: WebSocketService) {
    this.messageSubscription = this.websocket.messages$.subscribe(
      (message) => {
        if (message.type !== "voteState") {
          return;
        }

        const previousPhase = this.stateSubject.value.phase;
        const nextState: VoteState = {
          active: !!message["active"],
          phase: (message["phase"] as VotePhase) || "idle",
          hostClientId: message["hostClientId"] ?? null,
          connectedCount: message["connectedCount"] ?? 0,
          finishedCount: message["finishedCount"] ?? 0,
          pendingCount: message["pendingCount"] ?? 0,
          finishedClientIds: message["finishedClientIds"] ?? [],
          votedMovieKeys: (message["votedMovieKeys"] ?? []).map(String),
        };

        if (nextState.phase === "idle") {
          this.resetLocalDraft();
        } else if (
          previousPhase === "collecting" &&
          nextState.phase === "revealed"
        ) {
          this.hasFinished = true;
        }

        this.stateSubject.next(nextState);
      }
    );
  }

  ngOnDestroy(): void {
    this.messageSubscription?.unsubscribe();
  }

  get state(): VoteState {
    return this.stateSubject.value;
  }

  isCollecting(): boolean {
    return this.state.phase === "collecting";
  }

  isRevealed(): boolean {
    return this.state.phase === "revealed";
  }

  isHost(): boolean {
    return this.state.hostClientId === this.websocket.getClientId();
  }

  canDisableVoting(): boolean {
    return this.state.active && this.isHost();
  }

  canEndVotingEarly(): boolean {
    return this.canDisableVoting() && this.isCollecting();
  }

  canDismissVotingComplete(): boolean {
    return this.canDisableVoting() && this.isRevealed();
  }

  canStartVoting(): boolean {
    return this.state.phase === "idle" && this.websocket.isDisplayClient();
  }

  hasUserFinished(): boolean {
    return this.hasFinished;
  }

  getVoteKey(movie: movieInfo): string {
    if (movie.tmdbId) {
      return String(movie.tmdbId);
    }
    return String(movie.id);
  }

  isDraftVoted(voteKey: string): boolean {
    return this.draftVotes.has(String(voteKey));
  }

  toggleDraftVote(voteKey: string): void {
    if (!this.isCollecting() || this.hasFinished) {
      return;
    }

    const key = String(voteKey);
    if (this.draftVotes.has(key)) {
      this.draftVotes.delete(key);
    } else {
      this.draftVotes.add(key);
    }
    this.stateSubject.next({ ...this.state });
  }

  enableVoting(): void {
    if (!this.canStartVoting()) {
      return;
    }

    this.resetLocalDraft();
    this.websocket.send({
      type: "voteEnable",
      clientId: this.websocket.getClientId(),
    });
  }

  disableVoting(): void {
    if (!this.canDisableVoting()) {
      return;
    }

    this.websocket.send({
      type: "voteDisable",
      clientId: this.websocket.getClientId(),
    });
  }

  finishSelection(): void {
    if (!this.isCollecting() || this.hasFinished) {
      return;
    }

    this.hasFinished = true;
    this.websocket.send({
      type: "voteFinish",
      clientId: this.websocket.getClientId(),
      movieKeys: [...this.draftVotes],
    });
  }

  shouldFilterMovies(): boolean {
    return this.state.phase === "revealed";
  }

  movieIsInResults(voteKey: string): boolean {
    return this.state.votedMovieKeys.includes(String(voteKey));
  }

  getStatusText(): string {
    const { finishedCount, connectedCount, pendingCount } = this.state;

    if (this.state.phase === "collecting") {
      if (connectedCount === 0) {
        return "Waiting for voters to connect...";
      }

      const progress = `${finishedCount} of ${connectedCount} voters finished`;
      if (this.hasFinished && pendingCount > 0) {
        return `${progress} — waiting for others`;
      }
      return progress;
    }

    if (this.state.phase === "revealed") {
      if (connectedCount > 0) {
        return `Voting complete · ${finishedCount} of ${connectedCount} voters finished`;
      }
      return "Voting complete";
    }

    return "";
  }

  shouldShowVoteStatus(): boolean {
    return this.state.phase === "collecting" || this.state.phase === "revealed";
  }

  private resetLocalDraft(): void {
    this.draftVotes = new Set<string>();
    this.hasFinished = false;
  }
}
