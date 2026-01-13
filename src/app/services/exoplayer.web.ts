import { WebPlugin, PluginListenerHandle } from '@capacitor/core';
import type { ExoPlayerPlugin } from './exoplayer.service';

export class ExoPlayerWeb extends WebPlugin implements ExoPlayerPlugin {
  async initialize(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async loadVideo(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async play(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async pause(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async seekTo(): Promise<{ success: boolean }> {
    return { success: false };
  }

  async getCurrentPosition(): Promise<{ position: number }> {
    return { position: 0 };
  }

  async getDuration(): Promise<{ duration: number }> {
    return { duration: 0 };
  }

  async release(): Promise<{ success: boolean }> {
    return { success: false };
  }

  override async addListener(
    eventName: string,
    listenerFunc: (data?: any) => void
  ): Promise<PluginListenerHandle> {
    // Return a no-op listener handle for web
    console.log("ADDED LISTENERS: ", eventName);
    
    return {
      remove: async () => {
        // No-op for web
      }
    };
  }

  // async showControls(): Promise<void> {
  //   // No-op for web - controls are handled by HTML
  // }

  // async hideControls(): Promise<void> {
  //   // No-op for web - controls are handled by HTML
  // }

  async setPaused(options: { paused: boolean }): Promise<void> {
    // No-op for web - state is managed by HTML video element
  }

  async setShowSkipIntro(options: { show: boolean }): Promise<void> {
    // No-op for web - visibility is managed by Angular
  }

  async setShowNextEpisode(options: { show: boolean }): Promise<void> {
    // No-op for web - visibility is managed by Angular
  }

  async launchZidooPlayer(options: { url: string; title?: string; position?: number }): Promise<{ success: boolean }> {
    // Web implementation - not supported, return false
    console.warn('launchZidooPlayer is not supported on web platform');
    return { success: false };
  }
}

