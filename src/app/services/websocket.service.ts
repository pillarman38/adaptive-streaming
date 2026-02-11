import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

export interface WebSocketMessage {
  type: string;
  action?: string;
  data?: any;
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

  private messageSubject = new Subject<WebSocketMessage>();
  public messages$: Observable<WebSocketMessage> = this.messageSubject.asObservable();

  private connectionStatusSubject = new Subject<boolean>();
  public connectionStatus$: Observable<boolean> = this.connectionStatusSubject.asObservable();

  constructor(private apiConfig: ApiConfigService) {}

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      // Ensure config is loaded to get the correct server IP
      await this.apiConfig.ensureConfigLoaded();
      
      // Get base URL and extract host
      const baseUrl = this.apiConfig.getBaseUrl();
      // baseUrl is like "http://10.0.0.13:5012" or "http://pixable.local:5012"
      // Extract hostname (remove http:// and port)
      const hostMatch = baseUrl.match(/https?:\/\/([^:]+)/);
      const host = hostMatch ? hostMatch[1] : 'pixable.local';
      
      // WebSocket server runs on port 4444
      const wsUrl = `ws://${host}:4444`;
      
      console.log('[WebSocket] Connecting to:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.connectionStatusSubject.next(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
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
          setTimeout(() => this.connect(), this.reconnectDelay);
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

  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Sending message:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message - connection not open');
      // Try to reconnect if not already connecting
      if (!this.isConnecting) {
        this.connect();
      }
    }
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
