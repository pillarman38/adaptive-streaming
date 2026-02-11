import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebSocketService, WebSocketMessage } from '../services/websocket.service';
import { HttpClient } from '@angular/common/http';
import { ApiConfigService } from '../services/api-config.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-controller',
  templateUrl: './controller.component.html',
  styleUrls: ['./controller.component.css']
})
export class ControllerComponent implements OnInit, OnDestroy {
  private messageSubscription?: Subscription;
  private statusSubscription?: Subscription;
  isConnected = false;

  constructor(
    private websocketService: WebSocketService,
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  ngOnInit(): void {
    // Connect to websocket
    this.websocketService.connect();

    // Subscribe to connection status
    this.statusSubscription = this.websocketService.connectionStatus$.subscribe(
      (connected) => {
        this.isConnected = connected;
      }
    );

    // Subscribe to incoming messages
    this.messageSubscription = this.websocketService.messages$.subscribe(
      (message) => {
        console.log('[Controller] Received message:', message);
        // Handle incoming messages here if needed
      }
    );
  }

  ngOnDestroy(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }
  }

  sendKeyPress(action: string): void {
    const message: WebSocketMessage = {
      type: 'controller',
      action: action,
      timestamp: Date.now()
    };
    this.websocketService.send(message);
  }

  onArrowUp(): void {
    this.sendKeyPress('arrowUp');
  }

  onArrowDown(): void {
    this.sendKeyPress('arrowDown');
  }

  onArrowLeft(): void {
    this.sendKeyPress('arrowLeft');
  }

  onArrowRight(): void {
    this.sendKeyPress('arrowRight');
  }

  onEnter(): void {
    this.sendKeyPress('enter');
  }

  onBack(): void {
    this.sendKeyPress('back');
  }

  onPlayPause(): void {
    this.sendKeyPress('playPause');
  }

  onSkipBackward(): void {
    this.sendKeyPress('skipBackward');
  }

  onSkipForward(): void {
    this.sendKeyPress('skipForward');
  }

  async onVolumeUp(): Promise<void> {
    await this.apiConfig.ensureConfigLoaded();
    const baseUrl = this.apiConfig.getBaseUrl();
    const url = `${baseUrl}/api/mov/volume`;
    const body = {
      type: "http_set",
      packet: [
        {
          id: 275,
          feature: "gui.volupmain",
          value: "pulse",
        }
      ]
    }
    
    this.http.post(url, body).subscribe({
      next: (response) => {
        console.log('[Controller] Volume up request successful:', response);
      },
      error: (error) => {
        console.error('[Controller] Volume up request failed:', error);
      }
    });
  }

  async onVolumeDown(): Promise<void> {
    await this.apiConfig.ensureConfigLoaded();
    const baseUrl = this.apiConfig.getBaseUrl();
    const url = `${baseUrl}/api/mov/volume`;
    const body = {
      type: 'http_set',
      packet: [
        {
          id: 274,
          feature: 'gui.voldownmain',
          value: 'pulse'
        }
      ]
    };
    
    this.http.post(url, body).subscribe({
      next: (response) => {
        console.log('[Controller] Volume down request successful:', response);
      },
      error: (error) => {
        console.error('[Controller] Volume down request failed:', error);
      }
    });
  }
}
