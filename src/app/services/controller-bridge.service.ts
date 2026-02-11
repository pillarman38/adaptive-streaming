import { Injectable, OnDestroy } from '@angular/core';
import { WebSocketService, WebSocketMessage } from './websocket.service';
import { Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ControllerBridgeService implements OnDestroy {
  private messageSubscription?: Subscription;

  constructor(private websocketService: WebSocketService) {
    this.initialize();
  }

  private initialize(): void {
    // Subscribe to websocket messages
    this.messageSubscription = this.websocketService.messages$.subscribe(
      (message: WebSocketMessage) => {
        if (message.type === 'controller' && message.action) {
          this.handleControllerAction(message.action);
        }
      }
    );
  }

  private handleControllerAction(action: string): void {
    let keyCode: string;
    let code: string;
    let key: string;

    switch (action) {
      case 'arrowUp':
        keyCode = 'ArrowUp';
        code = 'ArrowUp';
        key = 'ArrowUp';
        break;
      case 'arrowDown':
        keyCode = 'ArrowDown';
        code = 'ArrowDown';
        key = 'ArrowDown';
        break;
      case 'arrowLeft':
        keyCode = 'ArrowLeft';
        code = 'ArrowLeft';
        key = 'ArrowLeft';
        break;
      case 'arrowRight':
        keyCode = 'ArrowRight';
        code = 'ArrowRight';
        key = 'ArrowRight';
        break;
      case 'enter':
        keyCode = 'Enter';
        code = 'Enter';
        key = 'Enter';
        break;
      case 'back':
        keyCode = 'Escape';
        code = 'Escape';
        key = 'Escape';
        break;
      case 'playPause':
        keyCode = 'Space';
        code = 'Space';
        key = ' ';
        break;
      case 'skipForward':
      case 'skipBackward':
        // Dispatch custom event for skip actions
        const skipEvent = new CustomEvent('skipAction', {
          detail: { action: action },
          bubbles: true,
          cancelable: true,
        });
        console.log('[ControllerBridge] Dispatching skip action:', action);
        window.dispatchEvent(skipEvent);
        return;
      default:
        console.warn('[ControllerBridge] Unknown action:', action);
        return;
    }

    // Create and dispatch a keyboard event
    const keyboardEvent = new KeyboardEvent('keydown', {
      key: key,
      code: code,
      keyCode: this.getKeyCode(keyCode),
      which: this.getKeyCode(keyCode),
      bubbles: true,
      cancelable: true,
    });

    console.log('[ControllerBridge] Dispatching keyboard event:', keyCode);
    window.dispatchEvent(keyboardEvent);
  }

  private getKeyCode(key: string): number {
    const keyCodeMap: { [key: string]: number } = {
      'ArrowUp': 38,
      'ArrowDown': 40,
      'ArrowLeft': 37,
      'ArrowRight': 39,
      'Enter': 13,
      'Escape': 27,
      'Space': 32,
    };
    return keyCodeMap[key] || 0;
  }

  ngOnDestroy(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
  }
}
