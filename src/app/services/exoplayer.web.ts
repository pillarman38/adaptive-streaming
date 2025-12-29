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
    return {
      remove: async () => {
        // No-op for web
      }
    };
  }

  override async removeAllListeners(): Promise<void> {
    // No-op for web
  }
}

