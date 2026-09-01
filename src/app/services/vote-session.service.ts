import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, Subscription } from "rxjs";
import { movieInfo } from "../info-store.service";
import { WebSocketService } from "./websocket.service";

export type VotePhase = "idle" | "collecting" | "revealed";
export type ParticipationChoice = "pending" | "yes" | "no";

export interface VoteState {
  active: boolean;
  phase: VotePhase;
  hostClientId: string | null;
  connectedCount: number;
  finishedCount: number;
  pendingCount: number;
  finishedClientIds: string[];
  votedMovieKeys: string[];
  voteCounts: Record<string, number>;
  eligibleMovieKeys: string[];
  round: number;
  participatingClientIds: string[];
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
  voteCounts: {},
  eligibleMovieKeys: [],
  round: 0,
  participatingClientIds: [],
};

const HOST_CODE = "4548";
const MAX_HOST_CODE_ATTEMPTS = 3;
const PARTICIPATION_STORAGE_KEY = "voteParticipationChoice";

@Injectable({
  providedIn: "root",
})
export class VoteSessionService implements OnDestroy {
  private readonly stateSubject = new BehaviorSubject<VoteState>(
    INITIAL_VOTE_STATE
  );
  readonly state$ = this.stateSubject.asObservable();

  private readonly participationPromptSubject = new BehaviorSubject<boolean>(
    false
  );
  readonly participationPrompt$ = this.participationPromptSubject.asObservable();

  private readonly hostCodePromptSubject = new BehaviorSubject<boolean>(false);
  readonly hostCodePrompt$ = this.hostCodePromptSubject.asObservable();

  private readonly hostCodeErrorSubject = new BehaviorSubject<string>("");
  readonly hostCodeError$ = this.hostCodeErrorSubject.asObservable();

  private draftVotes = new Set<string>();
  private hasFinished = false;
  private hostCodeAttempts = 0;
  private hostCodeLockedOut = false;
  private hostStartPending = false;
  private messageSubscription?: Subscription;
  private participationChoice: ParticipationChoice = "pending";

  constructor(private websocket: WebSocketService) {
    this.restoreParticipationChoice();
    this.messageSubscription = this.websocket.messages$.subscribe(
      (message) => {
        if (message.type === "voteHostRejected") {
          this.handleHostRejected(message["reason"] as string);
          return;
        }

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
          voteCounts: message["voteCounts"] ?? {},
          eligibleMovieKeys: (message["eligibleMovieKeys"] ?? []).map(String),
          round: message["round"] ?? 0,
          participatingClientIds: message["participatingClientIds"] ?? [],
        };

        if (nextState.phase === "idle") {
          this.resetLocalDraft();
          this.websocket.clearPendingMessages("voteFinish");
          this.hostStartPending = false;
          this.participationPromptSubject.next(false);
          this.hostCodePromptSubject.next(false);
        } else if (
          previousPhase === "revealed" &&
          nextState.phase === "collecting"
        ) {
          this.resetLocalDraft();
          this.websocket.clearPendingMessages("voteFinish");
        } else if (
          previousPhase === "collecting" &&
          nextState.phase === "revealed"
        ) {
          this.hasFinished = true;
        }

        if (
          nextState.phase === "collecting" ||
          nextState.phase === "revealed"
        ) {
          this.hostStartPending = false;
          this.hostCodePromptSubject.next(false);
          this.hostCodeErrorSubject.next("");
        }

        // Other devices: when a host starts voting, prompt non-participants to join.
        // Otherwise Start Voting disappears and the toolbar goes blank.
        const shouldShowJoinPrompt =
          nextState.phase === "collecting" &&
          previousPhase !== "collecting" &&
          this.websocket.isDisplayClient() &&
          this.participationChoice !== "yes";
        if (shouldShowJoinPrompt) {
          this.participationPromptSubject.next(true);
        }

        this.stateSubject.next(nextState);
      }
    );
  }

  ngOnDestroy(): void {
    this.messageSubscription?.unsubscribe();
  }

  syncParticipationOnConnect(): void {
    if (!this.websocket.isDisplayClient()) {
      return;
    }
    this.syncParticipationWithServer();
  }

  get state(): VoteState {
    return this.stateSubject.value;
  }

  isParticipating(): boolean {
    return this.participationChoice === "yes";
  }

  isParticipationPromptVisible(): boolean {
    return this.participationPromptSubject.value;
  }

  isHostCodePromptVisible(): boolean {
    return this.hostCodePromptSubject.value;
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

  /** Play is allowed for everyone when voting is idle; only the host may play during an active session. */
  canPlayMovie(): boolean {
    if (!this.state.active) {
      return true;
    }
    return this.isHost();
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

  canStartNextRound(): boolean {
    return (
      this.canDisableVoting() &&
      this.isRevealed() &&
      this.state.votedMovieKeys.length > 1
    );
  }

  canKnockOffMovies(): boolean {
    return (
      this.canDisableVoting() &&
      this.isRevealed() &&
      this.state.votedMovieKeys.length > 1
    );
  }

  canKnockOffMovie(voteKey: string): boolean {
    return (
      this.canKnockOffMovies() &&
      this.state.votedMovieKeys.includes(String(voteKey))
    );
  }

  knockOffMovie(voteKey: string): void {
    if (!this.canKnockOffMovie(voteKey)) {
      return;
    }

    this.websocket.send({
      type: "voteKnockOff",
      clientId: this.websocket.getClientId(),
      movieKey: String(voteKey),
    });
  }

  startNextRound(): void {
    if (!this.canStartNextRound()) {
      return;
    }

    this.websocket.send({
      type: "voteNextRound",
      clientId: this.websocket.getClientId(),
    });
  }

  canShowStartVotingButton(): boolean {
    return (
      this.state.phase === "idle" &&
      this.websocket.isDisplayClient() &&
      !this.hostCodeLockedOut &&
      !this.hostStartPending &&
      !this.isParticipationPromptVisible() &&
      !this.isHostCodePromptVisible()
    );
  }

  canShowJoinVotingButton(): boolean {
    return (
      this.isCollecting() &&
      this.websocket.isDisplayClient() &&
      !this.isParticipating() &&
      !this.isParticipationPromptVisible()
    );
  }

  shouldShowVoteToolbar(): boolean {
    return (
      this.websocket.isDisplayClient() &&
      (this.canShowStartVotingButton() ||
        this.canShowJoinVotingButton() ||
        this.canStartNextRound() ||
        this.isParticipationPromptVisible() ||
        this.isHostCodePromptVisible() ||
        this.shouldShowVotingControls())
    );
  }

  shouldShowVotingControls(): boolean {
    return (
      this.isParticipating() &&
      this.websocket.isDisplayClient() &&
      (this.state.active || this.isCollecting() || this.isRevealed())
    );
  }

  hasUserFinished(): boolean {
    return this.hasFinished;
  }

  getVoteKey(movie: movieInfo): string {
    if (movie.tmdbId) {
      return String(movie.tmdbId);
    }

    const grouped = movie as movieInfo & { versions?: movieInfo[] };
    if (grouped.versions?.length) {
      for (const version of grouped.versions) {
        if (version.tmdbId) {
          return String(version.tmdbId);
        }
      }
    }

    return String(movie.id);
  }

  getMovieVoteAliases(movie: movieInfo): string[] {
    const keys = new Set<string>();
    const add = (entry?: movieInfo): void => {
      if (!entry) {
        return;
      }
      if (entry.tmdbId) {
        keys.add(String(entry.tmdbId));
      }
      if (entry.id != null) {
        keys.add(String(entry.id));
      }
    };

    add(movie);
    const grouped = movie as movieInfo & { versions?: movieInfo[] };
    (grouped.versions || []).forEach((version) => add(version));
    return [...keys];
  }

  isDraftVoted(voteKey: string): boolean {
    return this.draftVotes.has(String(voteKey));
  }

  isDraftVotedForMovie(movie: movieInfo): boolean {
    return this.getMovieVoteAliases(movie).some((key) =>
      this.draftVotes.has(key)
    );
  }

  requestStartVoting(): void {
    if (this.state.phase !== "idle" || !this.websocket.isDisplayClient()) {
      return;
    }

    if (this.participationChoice !== "yes") {
      this.participationPromptSubject.next(true);
      this.hostCodePromptSubject.next(false);
      this.hostCodeErrorSubject.next("");
      return;
    }

    this.openHostCodePrompt();
  }

  requestJoinVoting(): void {
    if (!this.isCollecting() || !this.websocket.isDisplayClient()) {
      return;
    }
    this.participationPromptSubject.next(true);
    this.stateSubject.next({ ...this.state });
  }

  chooseParticipation(participating: boolean): void {
    this.participationChoice = participating ? "yes" : "no";
    sessionStorage.setItem(
      PARTICIPATION_STORAGE_KEY,
      this.participationChoice
    );
    this.participationPromptSubject.next(false);
    this.syncParticipationWithServer();

    if (participating) {
      // Only ask for host code when starting a new session.
      // If voting is already collecting, join as a regular voter.
      if (this.state.phase === "idle") {
        this.openHostCodePrompt();
      }
    } else {
      this.hostCodePromptSubject.next(false);
      this.hostCodeErrorSubject.next("");
    }

    this.stateSubject.next({ ...this.state });
  }

  cancelParticipationPrompt(): void {
    this.participationPromptSubject.next(false);
  }

  submitHostCode(code: string): void {
    const trimmed = (code || "").trim();
    const codeMatches = trimmed === HOST_CODE;
    if (codeMatches) {
      // Keep the host prompt open until voteState confirms collecting,
      // otherwise mobile immediately falls back to "Start Voting".
      this.hostCodeErrorSubject.next("");
      this.hostStartPending = true;
      this.resetLocalDraft();
      this.syncParticipationWithServer();
      this.websocket.send({
        type: "voteEnable",
        clientId: this.websocket.getClientId(),
        hostCode: trimmed,
      });
      this.stateSubject.next({ ...this.state });
      return;
    }

    this.hostCodeAttempts += 1;
    this.hostStartPending = false;
    if (this.hostCodeAttempts >= MAX_HOST_CODE_ATTEMPTS) {
      this.hostCodeLockedOut = true;
      this.hostCodePromptSubject.next(false);
      this.hostCodeErrorSubject.next("");
      this.stateSubject.next({ ...this.state });
      return;
    }

    this.hostCodeErrorSubject.next("Incorrect code. Try again.");
  }

  optOutOfHost(): void {
    this.hostCodePromptSubject.next(false);
    this.hostCodeErrorSubject.next("");
    this.hostCodeAttempts = 0;
    this.hostStartPending = false;
    this.stateSubject.next({ ...this.state });
  }

  toggleDraftVote(voteKey: string, movie?: movieInfo): void {
    if (!this.isParticipating() || !this.isCollecting() || this.hasFinished) {
      return;
    }

    const key = movie ? this.getVoteKey(movie) : String(voteKey);
    if (
      this.state.eligibleMovieKeys.length > 0 &&
      !this.state.eligibleMovieKeys.includes(key) &&
      !(movie && this.getMovieVoteAliases(movie).some((alias) =>
        this.state.eligibleMovieKeys.includes(alias)
      ))
    ) {
      return;
    }

    const aliases = movie ? this.getMovieVoteAliases(movie) : [key];
    const isCurrentlyVoted = aliases.some((alias) => this.draftVotes.has(alias));
    if (isCurrentlyVoted) {
      aliases.forEach((alias) => this.draftVotes.delete(alias));
    } else {
      this.draftVotes.add(key);
    }
    this.stateSubject.next({ ...this.state });
  }

  toggleDraftVoteForMovie(movie: movieInfo): void {
    this.toggleDraftVote(this.getVoteKey(movie), movie);
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
    if (
      !this.isParticipating() ||
      !this.isCollecting() ||
      this.hasFinished
    ) {
      return;
    }

    const movieKeys = [...this.draftVotes];
    this.hasFinished = true;
    this.websocket.clearPendingMessages("voteFinish");
    this.websocket.send({
      type: "voteFinish",
      clientId: this.websocket.getClientId(),
      movieKeys,
    });
  }

  shouldFilterMovies(): boolean {
    if (!this.isParticipating()) {
      return false;
    }

    if (this.state.phase === "revealed") {
      return true;
    }

    return (
      this.state.phase === "collecting" &&
      this.state.eligibleMovieKeys.length > 0
    );
  }

  movieIsInResults(voteKeyOrMovie: string | movieInfo): boolean {
    const filterKeys = this.getActiveFilterKeys();
    if (filterKeys.length === 0) {
      return true;
    }

    if (typeof voteKeyOrMovie !== "string") {
      return this.getMovieVoteAliases(voteKeyOrMovie).some((alias) =>
        filterKeys.includes(alias)
      );
    }

    return filterKeys.includes(String(voteKeyOrMovie));
  }

  private getActiveFilterKeys(): string[] {
    if (this.state.phase === "revealed") {
      return this.state.votedMovieKeys;
    }

    if (
      this.state.phase === "collecting" &&
      this.state.eligibleMovieKeys.length > 0
    ) {
      return this.state.eligibleMovieKeys;
    }

    return [];
  }

  getVoteCount(voteKey: string): number {
    return this.state.voteCounts[String(voteKey)] ?? 0;
  }

  getVoteCountForMovie(movie: movieInfo): number {
    return this.getMovieVoteAliases(movie).reduce(
      (max, alias) => Math.max(max, this.getVoteCount(alias)),
      0
    );
  }

  getVoteCountLabel(voteKey: string): string {
    const count = this.getVoteCount(voteKey);
    if (count <= 0) {
      return "";
    }
    return count === 1 ? "1 vote" : `${count} votes`;
  }

  getVoteCountLabelForMovie(movie: movieInfo): string {
    const count = this.getVoteCountForMovie(movie);
    if (count <= 0) {
      return "";
    }
    return count === 1 ? "1 vote" : `${count} votes`;
  }

  shouldShowVoteCounts(): boolean {
    return this.isParticipating() && this.isRevealed();
  }

  getStatusText(): string {
    if (!this.isParticipating()) {
      return "";
    }

    const { finishedCount, connectedCount, pendingCount } = this.state;

    if (this.state.phase === "collecting") {
      if (connectedCount === 0) {
        return this.state.round > 1
          ? `Round ${this.state.round} · Waiting for voters to connect...`
          : "Waiting for voters to connect...";
      }

      const roundPrefix =
        this.state.round > 1 ? `Round ${this.state.round} · ` : "";
      const progress = `${finishedCount} of ${connectedCount} voters finished`;
      if (this.hasFinished && pendingCount > 0) {
        return `${roundPrefix}${progress} — waiting for others`;
      }
      return `${roundPrefix}${progress}`;
    }

    if (this.state.phase === "revealed") {
      const { finishedCount, connectedCount } = this.state;
      const round = this.state.round;
      const remaining = this.state.votedMovieKeys.length;

      if (remaining === 1) {
        return `Round ${round} complete · Winner selected`;
      }

      if (remaining > 1 && this.canKnockOffMovies()) {
        return `Round ${round} complete · ${remaining} movies remain · tap ✕ to knock off`;
      }

      if (remaining > 1) {
        const progress =
          connectedCount > 0
            ? `${finishedCount} of ${connectedCount} voters finished · `
            : "";
        return `${progress}Round ${round} complete · ${remaining} movies remain`;
      }

      if (connectedCount > 0) {
        return `Voting complete · ${finishedCount} of ${connectedCount} voters finished`;
      }
      return "Voting complete";
    }

    return "";
  }

  shouldShowVoteStatus(): boolean {
    return (
      this.isParticipating() &&
      (this.state.phase === "collecting" || this.state.phase === "revealed")
    );
  }

  getHostLockoutMessage(): string {
    if (!this.isParticipating() || !this.hostCodeLockedOut) {
      return "";
    }
    return "You can still vote, but you cannot start voting as host.";
  }

  private openHostCodePrompt(): void {
    if (this.hostCodeLockedOut) {
      this.stateSubject.next({ ...this.state });
      return;
    }

    this.hostCodeAttempts = 0;
    this.hostCodeErrorSubject.next("");
    this.hostCodePromptSubject.next(true);
  }

  private restoreParticipationChoice(): void {
    const stored = sessionStorage.getItem(PARTICIPATION_STORAGE_KEY);
    if (stored === "yes" || stored === "no") {
      this.participationChoice = stored;
    }
  }

  private syncParticipationWithServer(): void {
    if (
      this.participationChoice !== "yes" &&
      this.participationChoice !== "no"
    ) {
      return;
    }

    this.websocket.send({
      type: "voteParticipation",
      clientId: this.websocket.getClientId(),
      participating: this.participationChoice === "yes",
    });
  }

  private handleHostRejected(reason: string): void {
    this.hostStartPending = false;

    if (reason === "invalid_code") {
      this.hostCodeAttempts += 1;
      if (this.hostCodeAttempts >= MAX_HOST_CODE_ATTEMPTS) {
        this.hostCodeLockedOut = true;
        this.hostCodePromptSubject.next(false);
        this.hostCodeErrorSubject.next("");
      } else {
        this.hostCodePromptSubject.next(true);
        this.hostCodeErrorSubject.next("Incorrect code. Try again.");
      }
      this.stateSubject.next({ ...this.state });
      return;
    }

    this.hostCodePromptSubject.next(true);
    if (reason === "not_participating") {
      this.syncParticipationWithServer();
      this.hostCodeErrorSubject.next("Unable to start voting. Try Go again.");
    } else {
      this.hostCodeErrorSubject.next("Unable to start voting as host.");
    }
    this.stateSubject.next({ ...this.state });
  }

  private resetLocalDraft(): void {
    this.draftVotes = new Set<string>();
    this.hasFinished = false;
  }
}
