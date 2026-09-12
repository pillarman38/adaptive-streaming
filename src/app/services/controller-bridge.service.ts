import { Injectable, OnDestroy } from '@angular/core';
import { WebSocketService, WebSocketMessage } from './websocket.service';
import { PlatformService } from './platform.service';
import { Subscription } from 'rxjs';

/** Actions an external device can send to control Ugoos playback / UI. */
export type PlayerControlAction =
  | 'arrowUp'
  | 'arrowDown'
  | 'arrowLeft'
  | 'arrowRight'
  | 'enter'
  | 'back'
  | 'playPause'
  | 'skipForward'
  | 'skipBackward';

@Injectable({
  providedIn: 'root'
})
export class ControllerBridgeService implements OnDestroy {
  private messageSubscription?: Subscription;

  constructor(
    private websocketService: WebSocketService,
    private platformService: PlatformService
  ) {
    this.initialize();
  }

  private initialize(): void {
    this.messageSubscription = this.websocketService.messages$.subscribe(
      (message: WebSocketMessage) => {
        if (!this.websocketService.isDisplayClient()) {
          return;
        }
        // Prefer Ugoos for remote player control; other displays ignore these.
        if (!this.platformService.isUgoos()) {
          return;
        }
        if (
          (message.type === 'controller' || message.type === 'playerControl') &&
          message.action
        ) {
          this.handleControllerAction(message);
        }
      }
    );
  }

  private handleControllerAction(message: WebSocketMessage): void {
    const action = String(message.action || '');
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
        // Stop playback entirely (PlayerComponent listens for this).
        window.dispatchEvent(
          new CustomEvent('stopPlayback', {
            detail: { action: 'back', source: 'remote' },
            bubbles: true,
            cancelable: true,
          })
        );
        return;
      case 'playPause':
        keyCode = 'Space';
        code = 'Space';
        key = ' ';
        break;
      case 'skipForward':
      case 'skipBackward': {
        const seconds =
          typeof message.seconds === 'number' && message.seconds > 0
            ? message.seconds
            : 15;
        const skipEvent = new CustomEvent('skipAction', {
          detail: { action, seconds },
          bubbles: true,
          cancelable: true,
        });
        console.log('[ControllerBridge] Dispatching skip action:', action, seconds);
        window.dispatchEvent(skipEvent);
        return;
      }
      default:
        console.warn('[ControllerBridge] Unknown action:', action);
        return;
    }

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
