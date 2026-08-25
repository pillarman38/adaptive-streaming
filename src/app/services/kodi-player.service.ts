import { Injectable } from '@angular/core';
import { ApiConfigService } from './api-config.service';

type KodiNotificationHandler = (params: unknown) => void;

@Injectable({
  providedIn: 'root',
})
export class KodiPlayerService {
  private static readonly HTTP_OPEN_TIMEOUT_MS = 120_000;
  private static readonly HTTP_PLAYBACK_WAIT_MS = 180_000;
  private static readonly LOCAL_OPEN_TIMEOUT_MS = 30_000;
  private static readonly LOCAL_PLAYBACK_WAIT_MS = 15_000;

  private ws: WebSocket | null = null;
  private requestId = 0;
  private pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
  >();
  private notificationHandlers = new Map<string, Set<KodiNotificationHandler>>();
  private connectPromise: Promise<boolean> | null = null;
  private isOpen = false;
  private playbackAttemptSeq = 0;
  private openVideoInFlight: Promise<boolean> | null = null;
  private openVideoTargetUrl: string | null = null;

  /** True while openVideo is awaiting Kodi playback outcome. */
  hasOpenInFlight(): boolean {
    return this.openVideoInFlight !== null;
  }

  constructor(private apiConfig: ApiConfigService) {}

  /** Invalidate any in-flight openVideo wait and allow a new attempt. */
  cancelPendingOpen(): void {
    this.playbackAttemptSeq++;
  }

  private buildWsUrl(host: string): string {
    const { port } = this.apiConfig.getKodiWsConfig();
    return `ws://${host}:${port}/jsonrpc`;
  }

  async ensureConnected(): Promise<boolean> {
    if (this.isOpen && this.ws?.readyState === WebSocket.OPEN) {
      return true;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.connectPromise = this.connectWithFallback();
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async connectWithFallback(): Promise<boolean> {
    const candidates = this.apiConfig.getKodiWsHostCandidates();

    for (let index = 0; index < candidates.length; index++) {
      const host = candidates[index];
      const ok = await this.connect(host);
      if (ok) {
        return true;
      }
      await this.disconnect();
      if (index < candidates.length - 1) {
        console.warn('[KodiPlayer] WebSocket failed for', host, '— trying next host');
      }
    }
    return false;
  }

  private connect(host: string): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      let connectTimeout: ReturnType<typeof setTimeout> | undefined;
      const wsUrl = this.buildWsUrl(host);
      console.log('[KodiPlayer] Connecting to', wsUrl);

      const finish = (ok: boolean, reason: string, extra?: Record<string, unknown>) => {
        if (settled) {
          return;
        }
        settled = true;
        if (connectTimeout) {
          clearTimeout(connectTimeout);
        }
        resolve(ok);
      };

      try {
        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        connectTimeout = setTimeout(() => {
          console.error('[KodiPlayer] WebSocket connect timeout');
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          this.isOpen = false;
          finish(false, 'timeout');
        }, 10000);

        ws.onopen = () => {
          this.isOpen = true;
          console.log('[KodiPlayer] WebSocket connected');
          finish(true, 'open');
        };

        ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        ws.onerror = (err) => {
          console.error('[KodiPlayer] WebSocket error:', err);
          this.isOpen = false;
          finish(false, 'error');
        };

        ws.onclose = (event) => {
          this.isOpen = false;
          this.ws = null;
          this.rejectAllPending('Kodi WebSocket closed');
          if (!settled) {
            finish(false, 'closed before open', {
              closeCode: event.code,
              closeReason: event.reason || '',
              wasClean: event.wasClean,
            });
          }
        };
      } catch (err) {
        console.error('[KodiPlayer] Failed to connect:', err);
        finish(false, 'exception');
      }
    });
  }

  private handleMessage(raw: string): void {
    let message: {
      id?: number;
      method?: string;
      params?: unknown;
      result?: unknown;
      error?: { message?: string; code?: number; data?: unknown };
    };
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (message.id !== undefined) {
      const idKey = String(message.id);
      const pending = this.pending.get(idKey);
      if (!pending) {
        return;
      }
      this.pending.delete(idKey);
      if (message.error) {
        const detail =
          message.error.data != null
            ? `${message.error.message || 'Kodi JSON-RPC error'} (${JSON.stringify(message.error.data)})`
            : message.error.message || 'Kodi JSON-RPC error';
        pending.reject(new Error(detail));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method) {
      const handlers = this.notificationHandlers.get(message.method);
      if (handlers) {
        handlers.forEach((handler) => handler(message.params));
      }
    }
  }

  private rejectAllPending(reason: string): void {
    this.pending.forEach(({ reject }) => reject(new Error(reason)));
    this.pending.clear();
  }

  private call<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs = 15000
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const connected = await this.ensureConnected();
      if (!connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to Kodi JSON-RPC'));
        return;
      }

      const id = ++this.requestId;
      const idKey = String(id);
      this.pending.set(idKey, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const payload = JSON.stringify({
        jsonrpc: '2.0',
        method,
        params: params ?? {},
        id,
      });

      console.log('[KodiPlayer] JSON-RPC →', method, payload);

      try {
        this.ws.send(payload);
      } catch (err) {
        this.pending.delete(idKey);
        reject(err);
      }

      setTimeout(() => {
        if (this.pending.has(idKey)) {
          this.pending.delete(idKey);
          reject(new Error(`Kodi JSON-RPC timeout: ${method}`));
        }
      }, timeoutMs);
    });
  }

  onNotification(method: string, handler: KodiNotificationHandler): () => void {
    if (!this.notificationHandlers.has(method)) {
      this.notificationHandlers.set(method, new Set());
    }
    this.notificationHandlers.get(method)!.add(handler);
    return () => {
      this.notificationHandlers.get(method)?.delete(handler);
    };
  }

  async openVideo(
    url: string,
    subtitleUrl?: string,
    fallbackUrl?: string,
    introUrl?: string
  ): Promise<boolean> {
    if (this.openVideoInFlight && this.openVideoTargetUrl === url) {
      return this.openVideoInFlight;
    }

    if (this.openVideoInFlight) {
      console.warn('[KodiPlayer] Superseding in-flight openVideo');
      this.playbackAttemptSeq++;
      try {
        await this.openVideoInFlight;
      } catch {
        /* previous attempt failed or was cancelled */
      }
    }

    this.openVideoTargetUrl = url;
    const current = this.openVideoInternal(url, subtitleUrl, fallbackUrl, introUrl);
    this.openVideoInFlight = current;
    try {
      return await current;
    } finally {
      if (this.openVideoInFlight === current) {
        this.openVideoInFlight = null;
        this.openVideoTargetUrl = null;
      }
    }
  }

  private async openVideoInternal(
    url: string,
    subtitleUrl?: string,
    fallbackUrl?: string,
    introUrl?: string
  ): Promise<boolean> {
    const candidates = this.buildPlaybackCandidates(url, fallbackUrl);
    const introFile = this.toHttpStreamUri(introUrl) || this.toLocalFileUri(introUrl);

    if (!candidates.length) {
      console.error('[KodiPlayer] No valid playback file URL', { url, fallbackUrl });
      return false;
    }

    console.log('[KodiPlayer] Playback candidates:', candidates);
    if (introFile) {
      console.log('[KodiPlayer] DV intro before movie:', introFile);
    }

    // Prefer intro then movie. Playlist failed for static DV intro; try sequential
    // open (intro alone → wait for end → movie) with stream-API intro URL.
    for (let index = 0; index < candidates.length; index++) {
      const file = candidates[index];
      const modes: Array<'with-intro' | 'movie-only'> = introFile
        ? ['with-intro', 'movie-only']
        : ['movie-only'];

      for (const mode of modes) {
        const useIntro = mode === 'with-intro' && !!introFile;

        await this.stopIfPlaying();
        await this.waitUntilPlayerIdle();

        if (useIntro) {
          const introAttemptId = ++this.playbackAttemptSeq;
          const introOpened = await this.tryPlayerOpen({
            item: { file: introFile as string },
          });
          if (introOpened) {
            const introOutcome = await this.waitForPlaybackOutcome(
              introFile as string,
              introAttemptId
            );
            if (introOutcome === 'started') {
              await this.waitForPlaybackEnd(introAttemptId, 90_000);
            } else {
              console.warn(
                '[KodiPlayer] DV intro failed to start AV — continuing with movie'
              );
              await this.stop().catch(() => {});
              await this.waitUntilPlayerIdle();
            }
          }
        }

        const attemptId = ++this.playbackAttemptSeq;
        const opened = await this.tryPlayerOpen({ item: { file } });
        if (!opened) {
          console.warn('[KodiPlayer] Player.Open failed:', { file, mode });
          continue;
        }

        const outcome = await this.waitForPlaybackOutcome(file, attemptId);

        if (outcome === 'started') {
          if (subtitleUrl) {
            void this.attachSubtitle(subtitleUrl);
          }
          return true;
        }

        console.warn('[KodiPlayer] Playback failed:', { file, mode });
        await this.stop().catch(() => {});
        await this.waitUntilPlayerIdle();
      }
    }

    console.error('[KodiPlayer] All playback candidates failed. Last:', candidates[candidates.length - 1]);
    return false;
  }

  /** Video playlist id in Kodi (0=audio, 1=video, 2=picture). */
  private static readonly VIDEO_PLAYLIST_ID = 1;

  private async tryPlayerOpenPlaylist(files: string[]): Promise<boolean> {
    const playlistid = KodiPlayerService.VIDEO_PLAYLIST_ID;
    try {
      await this.call('Playlist.Clear', { playlistid });
      for (const file of files) {
        await this.call('Playlist.Add', {
          playlistid,
          item: { file },
        });
      }
    } catch (err) {
      console.error('[KodiPlayer] Playlist build failed:', err);
      return false;
    }

    const params = {
      item: { playlistid, position: 0 },
    };
    const anyHttp = files.some(
      (f) => f.startsWith('http') || f.includes('.m3u8')
    );
    const openTimeoutMs = anyHttp
      ? KodiPlayerService.HTTP_OPEN_TIMEOUT_MS
      : KodiPlayerService.LOCAL_OPEN_TIMEOUT_MS;
    console.log(
      '[KodiPlayer] Player.Open playlist timeout:',
      openTimeoutMs,
      'ms',
      'items:',
      files.length
    );

    if (anyHttp) {
      void this.call('Player.Open', params, openTimeoutMs)
        .then((result) => {
          console.log('[KodiPlayer] Player.Open playlist RPC resolved:', result);
        })
        .catch((err) => {
          console.warn(
            '[KodiPlayer] Player.Open playlist RPC error (playback may still start):',
            err
          );
        });
      return true;
    }

    try {
      await this.call('Player.Open', params, openTimeoutMs);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('timeout')) {
        const playerId = await this.getActivePlayerId();
        if (playerId !== null) {
          console.warn(
            '[KodiPlayer] Player.Open playlist timed out but player is active'
          );
          return true;
        }
      }
      console.error('[KodiPlayer] Player.Open playlist failed:', err);
      return false;
    }
  }

  private async attachSubtitleWhenFeaturePlaying(
    subtitleUrl: string
  ): Promise<void> {
    // Intro is short; poll until playlist advances past item 0, then attach.
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const playerId = await this.getActivePlayerId();
        if (playerId === null) {
          continue;
        }
        const props = await this.getPlayerProperties(
          ['playlistid', 'position'],
          playerId
        );
        const position =
          typeof props?.['position'] === 'number' ? props['position'] : 0;
        if (position >= 1) {
          await this.attachSubtitle(subtitleUrl);
          return;
        }
      } catch {
        /* keep waiting */
      }
    }
    void this.attachSubtitle(subtitleUrl);
  }

  private async tryPlayerOpen(
    params: { item: { file: string } }
  ): Promise<boolean> {
    const isHttp =
      params.item.file.startsWith('http') || params.item.file.includes('.m3u8');
    const openTimeoutMs = isHttp
      ? KodiPlayerService.HTTP_OPEN_TIMEOUT_MS
      : KodiPlayerService.LOCAL_OPEN_TIMEOUT_MS;
    console.log('[KodiPlayer] Player.Open timeout:', openTimeoutMs, 'ms');

    if (isHttp) {
      // Kodi often blocks the JSON-RPC response until HTTP buffering finishes.
      // Fire-and-forget; playback success is detected via Player.On* notifications.
      void this.call('Player.Open', params, openTimeoutMs)
        .then((result) => {
          console.log('[KodiPlayer] Player.Open RPC resolved:', result);
        })
        .catch((err) => {
          console.warn('[KodiPlayer] Player.Open RPC error (playback may still start):', err);
        });
      return true;
    }

    try {
      await this.call('Player.Open', params, openTimeoutMs);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('timeout')) {
        const playerId = await this.getActivePlayerId();
        if (playerId !== null) {
          console.warn('[KodiPlayer] Player.Open timed out but player is active');
          return true;
        }
      }
      console.error('[KodiPlayer] Player.Open failed:', err, params.item);
      return false;
    }
  }

  private waitForPlaybackOutcome(
    file: string,
    attemptId: number
  ): Promise<'started' | 'failed'> {
    const isHttp = file.startsWith('http') || file.includes('.m3u8');
    const timeoutMs = isHttp
      ? KodiPlayerService.HTTP_PLAYBACK_WAIT_MS
      : KodiPlayerService.LOCAL_PLAYBACK_WAIT_MS;
    /** Ignore OnStop shortly after open if we never saw OnPlay (stale stop from prior candidate). */
    const staleStopGraceMs = 750;

    console.log('[KodiPlayer] Waiting for OnAVStart up to', timeoutMs, 'ms');

    return new Promise((resolve) => {
      let settled = false;
      let avStarted = false;
      let sawOnPlay = false;
      const waitStartedAt = Date.now();

      const isStaleAttempt = () => attemptId !== this.playbackAttemptSeq;

      const finish = (result: 'started' | 'failed', reason?: string) => {
        if (settled) {
          return;
        }
        settled = true;
        unsubPlay();
        unsubAvStart();
        unsubStop();
        clearTimeout(giveUpTimer);
        clearProgressTimers();
        if (reason) {
          console.log('[KodiPlayer] Playback wait:', result, reason);
        }
        resolve(result);
      };

      const unsubPlay = this.onNotification('Player.OnPlay', () => {
        if (isStaleAttempt()) {
          finish('failed', 'superseded');
          return;
        }
        sawOnPlay = true;
      });

      const unsubAvStart = this.onNotification('Player.OnAVStart', () => {
        if (isStaleAttempt()) {
          finish('failed', 'superseded');
          return;
        }
        avStarted = true;
        finish('started', 'OnAVStart');
      });

      const unsubStop = this.onNotification('Player.OnStop', (params) => {
        if (isStaleAttempt()) {
          finish('failed', 'superseded');
          return;
        }
        if (avStarted) {
          return;
        }
        const elapsed = Date.now() - waitStartedAt;
        if (!sawOnPlay && elapsed < staleStopGraceMs) {
          console.log('[KodiPlayer] Ignoring stale OnStop (no OnPlay yet)', elapsed, 'ms');
          return;
        }
        console.warn('[KodiPlayer] OnStop before OnAVStart — playback failed', params);
        finish('failed', 'OnStop before OnAVStart');
      });

      const progressCheckMs = [15000, 30000, 45000, 60000];
      const progressTimers: ReturnType<typeof setTimeout>[] = [];

      const clearProgressTimers = () => {
        for (const timer of progressTimers) {
          clearTimeout(timer);
        }
        progressTimers.length = 0;
      };

      const checkPlaybackProgress = async (
        reason: string,
        allowStuckFail: boolean
      ) => {
        if (settled || isStaleAttempt()) {
          return;
        }
        try {
          const snap = await this.getPlaybackSnapshot();
          if (
            sawOnPlay &&
            !avStarted &&
            snap.playerId === null
          ) {
            console.warn('[KodiPlayer] Player lost after OnPlay — trying next candidate');
            finish('failed', 'player lost');
            return;
          }
          if (
            snap?.playerId !== null &&
            snap?.playerId !== undefined &&
            snap.playing &&
            sawOnPlay &&
            this.hasRealPlaybackProgress(snap, avStarted)
          ) {
            finish(
              'started',
              avStarted ? `${reason} av started` : `${reason} time progress`
            );
            return;
          }
          if (
            allowStuckFail &&
            sawOnPlay &&
            snap.duration > 0 &&
            snap.position === 0 &&
            !avStarted
          ) {
            console.warn(
              '[KodiPlayer] Stuck buffering — duration known but no AV progress'
            );
            finish('failed', 'stuck buffering');
          }
        } catch {
          /* ignore check errors */
        }
      };

      for (const delayMs of progressCheckMs) {
        progressTimers.push(
          setTimeout(() => {
            void checkPlaybackProgress(
              `check@${delayMs}ms`,
              delayMs >= 45000
            );
          }, delayMs)
        );
      }

      const giveUpTimer = setTimeout(async () => {
        if (settled) {
          return;
        }
        if (isStaleAttempt()) {
          finish('failed', 'superseded');
          return;
        }
        if (avStarted) {
          return;
        }
        await checkPlaybackProgress('final timeout', false);
        if (!settled) {
          finish('failed', 'timeout');
        }
      }, timeoutMs);
    });
  }

  /** After intro OnAVStart, wait until Kodi stops (intro finished) or timeout. */
  private waitForPlaybackEnd(
    attemptId: number,
    timeoutMs: number
  ): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (reason: string) => {
        if (settled) {
          return;
        }
        settled = true;
        unsubStop();
        clearTimeout(timer);
        console.log('[KodiPlayer] Intro/end wait done:', reason);
        resolve();
      };

      const unsubStop = this.onNotification('Player.OnStop', () => {
        if (attemptId !== this.playbackAttemptSeq) {
          finish('superseded');
          return;
        }
        finish('OnStop');
      });

      const timer = setTimeout(() => finish('timeout'), timeoutMs);
    });
  }

  /** Wait until Kodi has no active player (avoids stale OnStop on the next candidate). */
  private async waitUntilPlayerIdle(timeoutMs = 3000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const playerId = await this.getActivePlayerId();
      if (playerId === null) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private async attachSubtitle(subtitleUrl: string): Promise<void> {
    const playerId = await this.getActivePlayerId();
    if (playerId === null) {
      return;
    }
    try {
      await this.call('Player.AddSubtitle', {
        playerid: playerId,
        subtitle: subtitleUrl,
      });
      console.log('[KodiPlayer] Subtitle attached');
    } catch (err) {
      console.warn('[KodiPlayer] AddSubtitle failed:', err);
    }
  }

  private async stopIfPlaying(): Promise<void> {
    try {
      const playerId = await this.getActivePlayerId();
      if (playerId !== null) {
        await this.stop();
      }
    } catch {
      /* no active player */
    }
  }

  private buildPlaybackCandidates(url: string, fallbackUrl?: string): string[] {
    const localFromUrl = this.toLocalFileUri(url);
    const httpFromUrl = this.toHttpStreamUri(url);
    const localFromFallback = this.toLocalFileUri(fallbackUrl);
    const httpFromFallback = this.toHttpStreamUri(fallbackUrl);

    if (localFromUrl) {
      return [localFromUrl, httpFromFallback, httpFromUrl].filter(
        (value, index, arr): value is string => !!value && arr.indexOf(value) === index
      );
    }
    if (httpFromUrl) {
      return [httpFromUrl, localFromFallback, httpFromFallback].filter(
        (value, index, arr): value is string => !!value && arr.indexOf(value) === index
      );
    }
    return [httpFromFallback, localFromFallback].filter(
      (value, index, arr): value is string => !!value && arr.indexOf(value) === index
    );
  }

  private toLocalFileUri(url: string | undefined): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }
    const raw = url.trim();
    if (/^[A-Za-z]:[\\/]/.test(raw)) {
      return null;
    }
    if (raw.startsWith('file://')) {
      return raw;
    }
    if (raw.startsWith('/') && !raw.startsWith('//')) {
      return `file://${raw}`;
    }
    return null;
  }

  private toHttpStreamUri(url: string | undefined): string | null {
    if (!url || typeof url !== 'string') {
      return null;
    }
    const raw = url.trim();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      return null;
    }
    // Preserve original encoding (%20). Re-parsing via URLSearchParams turns spaces into '+'.
    return raw;
  }

  async playPause(): Promise<void> {
    const playerId = await this.getActivePlayerId();
    if (playerId === null) {
      return;
    }
    await this.call('Player.PlayPause', { playerid: playerId });
  }

  async seek(seconds: number): Promise<void> {
    const playerId = await this.getActivePlayerId();
    if (playerId === null) {
      return;
    }
    const time = this.secondsToKodiTimeObject(seconds);
    await this.call('Player.Seek', {
      playerid: playerId,
      value: { time },
    });
  }

  /** Relative jump — Kodi 21+ requires value: { seconds: N }, not a bare number. */
  async seekRelative(deltaSeconds: number): Promise<void> {
    const playerId = await this.getActivePlayerId();
    if (playerId === null) {
      return;
    }
    await this.call('Player.Seek', {
      playerid: playerId,
      value: { seconds: deltaSeconds },
    });
  }

  async stop(): Promise<void> {
    const playerId = await this.getActivePlayerId();
    if (playerId === null) {
      return;
    }
    await this.call('Player.Stop', { playerid: playerId });
  }

  /** One GetActivePlayers + one GetProperties round-trip for UI polling. */
  async getPlaybackSnapshot(): Promise<{
    playerId: number | null;
    position: number;
    duration: number;
    playing: boolean;
  }> {
    const playerId = await this.getActivePlayerId();
    if (playerId === null) {
      return { playerId: null, position: 0, duration: 0, playing: false };
    }
    const props = await this.getPlayerProperties(
      ['time', 'totaltime', 'speed'],
      playerId
    );
    const time = props?.['time'] as
      | { hours?: number; minutes?: number; seconds?: number }
      | undefined;
    const totaltime = props?.['totaltime'] as
      | { hours?: number; minutes?: number; seconds?: number }
      | undefined;
    const speed = props?.['speed'];
    return {
      playerId,
      position: this.timeObjectToSeconds(time),
      duration: this.timeObjectToSeconds(totaltime),
      playing: typeof speed === 'number' && speed !== 0,
    };
  }

  async getCurrentPosition(): Promise<number> {
    const snap = await this.getPlaybackSnapshot();
    return snap.position;
  }

  async getDuration(): Promise<number> {
    const snap = await this.getPlaybackSnapshot();
    return snap.duration;
  }

  async isPlaying(): Promise<boolean> {
    const snap = await this.getPlaybackSnapshot();
    return snap.playing;
  }

  /** Speed alone is true while Kodi buffers HTTP MP4; require AV or timeline progress. */
  private hasRealPlaybackProgress(
    snap: { position: number; duration: number },
    avStarted: boolean
  ): boolean {
    return avStarted || snap.position > 0;
  }

  private async getActivePlayerId(): Promise<number | null> {
    try {
      const players = (await this.call<Array<{ playerid: number }>>(
        'Player.GetActivePlayers'
      )) as Array<{ playerid: number }>;
      if (!players?.length) {
        return null;
      }
      const videoPlayer =
        players.find((p) => (p as { type?: string }).type === 'video') || players[0];
      return videoPlayer.playerid;
    } catch {
      return null;
    }
  }

  private async getPlayerProperties(
    properties: string[],
    playerId?: number | null
  ): Promise<Record<string, unknown> | null> {
    const id = playerId ?? (await this.getActivePlayerId());
    if (id === null || id === undefined) {
      return null;
    }
    try {
      return (await this.call<{ time?: unknown; totaltime?: unknown; speed?: number }>(
        'Player.GetProperties',
        {
          playerid: id,
          properties,
        }
      )) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private secondsToKodiTimeObject(totalSeconds: number): {
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
  } {
    const s = Math.max(0, Math.floor(totalSeconds));
    return {
      hours: Math.floor(s / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60,
      milliseconds: 0,
    };
  }

  private timeObjectToSeconds(
    time?: { hours?: number; minutes?: number; seconds?: number }
  ): number {
    if (!time) {
      return 0;
    }
    const hours = time.hours || 0;
    const minutes = time.minutes || 0;
    const seconds = time.seconds || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isOpen = false;
  }
}
