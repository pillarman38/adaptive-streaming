import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

export type WebSocketClientRole = 'display' | 'controller';

export interface WebSocketMessage {
  type: string;
  action?: string;
  data?: any;
  role?: WebSocketClientRole;
  clientId?: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private isConnecting = false;
  private shouldReconnect = true;
  private readonly clientId = `client_${Math.random().toString(36).slice(2, 10)}`;
  private clientRole: WebSocketClientRole = 'display';

  private messageSubject = new Subject<WebSocketMessage>();
  public messages$: Observable<WebSocketMessage> = this.messageSubject.asObservable();

  private connectionStatusSubject = new Subject<boolean>();
  public connectionStatus$: Observable<boolean> = this.connectionStatusSubject.asObservable();

  constructor(private apiConfig: ApiConfigService) {}

  isDisplayClient(): boolean {
    return this.clientRole === 'display';
  }

  getClientId(): string {
    return this.clientId;
  }

  getClientRole(): WebSocketClientRole {
    return this.clientRole;
  }

  setRole(role: WebSocketClientRole): void {
    this.clientRole = role;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRegister();
    }
  }

  async connect(role: WebSocketClientRole = 'display'): Promise<void> {
    this.clientRole = role;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRegister();
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      await this.apiConfig.ensureConfigLoaded();

      const baseUrl = this.apiConfig.getBaseUrl();
      const hostMatch = baseUrl.match(/https?:\/\/([^:]+)/);
      const host = hostMatch ? hostMatch[1] : '10.0.0.15';
      const wsUrl = `ws://${host}:4444`;

      console.log('[WebSocket] Connecting to:', wsUrl, 'as', this.clientRole);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected as', this.clientRole);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.sendRegister();
        this.flushPendingMessages();
        this.connectionStatusSubject.next(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (message.type === 'register') {
            return;
          }
          console.log('[WebSocket] Message received:', message);
          this.messageSubject.next(message);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.isConnecting = false;
        this.connectionStatusSubject.next(false);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Connection closed');
        this.isConnecting = false;
        this.connectionStatusSubject.next(false);
        this.ws = null;

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`[WebSocket] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.connect(this.clientRole), this.reconnectDelay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('[WebSocket] Max reconnect attempts reached');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.isConnecting = false;
      this.connectionStatusSubject.next(false);
    }
  }

  private sendRegister(): void {
    this.send({
      type: 'register',
      role: this.clientRole,
      clientId: this.clientId,
    });
  }

  private pendingMessages: WebSocketMessage[] = [];

  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.flushPendingMessages();
      console.log('[WebSocket] Sending message:', message);
      this.ws.send(JSON.stringify(message));
      return;
    }

    if (message.type === 'voteFinish') {
      this.clearPendingMessages('voteFinish');
    }

    this.pendingMessages.push(message);
    console.warn('[WebSocket] Queued message - connection not open');
    if (!this.isConnecting) {
      void this.connect(this.clientRole);
    }
  }

  clearPendingMessages(type?: string): void {
    if (!type) {
      this.pendingMessages = [];
      return;
    }

    this.pendingMessages = this.pendingMessages.filter(
      (message) => message.type !== type
    );
  }

  private flushPendingMessages(): void {
    if (this.ws?.readyState !== WebSocket.OPEN || this.pendingMessages.length === 0) {
      return;
    }

    const queued = [...this.pendingMessages];
    this.pendingMessages = [];
    queued.forEach((message) => {
      console.log('[WebSocket] Flushing queued message:', message);
      this.ws?.send(JSON.stringify(message));
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
