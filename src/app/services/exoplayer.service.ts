import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

export interface ExoPlayerPlugin {
  initialize(options: { containerId: string }): Promise<{ success: boolean }>;
  loadVideo(options: { url: string; subtitleUrl?: string }): Promise<{ success: boolean }>;
  play(): Promise<{ success: boolean }>;
  pause(): Promise<{ success: boolean }>;
  seekTo(options: { position: number }): Promise<{ success: boolean }>;
  getCurrentPosition(): Promise<{ position: number }>;
  getDuration(): Promise<{ duration: number }>;
  release(): Promise<{ success: boolean }>;
  addListener(eventName: string, listenerFunc: (data?: any) => void): Promise<any>;
  removeAllListeners(): Promise<void>;
}

const ExoPlayer = registerPlugin<ExoPlayerPlugin>('ExoPlayer', {
  web: () => import('./exoplayer.web').then(m => new m.ExoPlayerWeb()),
});

@Injectable({
  providedIn: 'root'
})
export class ExoPlayerService {
  private isInitialized = false;
  private timeUpdateListener: any = null;

  constructor() {}

  async initialize(containerId: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      const result = await ExoPlayer.initialize({ containerId });
      this.isInitialized = result.success;
      return this.isInitialized;
    } catch (error) {
      console.error('Error initializing ExoPlayer:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      } else {
        console.error('Error details:', JSON.stringify(error, null, 2));
      }
      return false;
    }
  }

  async loadVideo(url: string, subtitleUrl?: string): Promise<boolean> {
    if (!this.isInitialized) {
      console.warn('ExoPlayer not initialized');
      return false;
    }

    try {
      const result = await ExoPlayer.loadVideo({ url, subtitleUrl });
      return result.success;
    } catch (error) {
      console.error('Error loading video:', error);
      return false;
    }
  }

  async play(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const result = await ExoPlayer.play();
      return result.success;
    } catch (error) {
      console.error('Error playing video:', error);
      return false;
    }
  }

  async pause(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const result = await ExoPlayer.pause();
      return result.success;
    } catch (error) {
      console.error('Error pausing video:', error);
      return false;
    }
  }

  async seekTo(position: number): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const result = await ExoPlayer.seekTo({ position });
      return result.success;
    } catch (error) {
      console.error('Error seeking video:', error);
      return false;
    }
  }

  async getCurrentPosition(): Promise<number> {
    if (!this.isInitialized) {
      return 0;
    }

    try {
      const result = await ExoPlayer.getCurrentPosition();
      return result.position;
    } catch (error) {
      console.error('Error getting current position:', error);
      return 0;
    }
  }

  async getDuration(): Promise<number> {
    if (!this.isInitialized) {
      return 0;
    }

    try {
      const result = await ExoPlayer.getDuration();
      return result.duration;
    } catch (error) {
      console.error('Error getting duration:', error);
      return 0;
    }
  }

  async release(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      await this.removeTimeUpdateListener();
      const result = await ExoPlayer.release();
      this.isInitialized = !result.success;
      return result.success;
    } catch (error) {
      console.error('Error releasing ExoPlayer:', error);
      return false;
    }
  }

  async addTimeUpdateListener(callback: (currentTime: number) => void): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // The plugin's addListener method expects eventName as first parameter
      const listener = await ExoPlayer.addListener('timeupdate', (data: any) => {
        if (data && data.currentTime !== undefined) {
          callback(data.currentTime);
        }
      });
      this.timeUpdateListener = listener;
    } catch (error) {
      console.error('Error adding time update listener:', error);
    }
  }

  async removeTimeUpdateListener(): Promise<void> {
    if (this.timeUpdateListener) {
      try {
        await this.timeUpdateListener.remove();
        this.timeUpdateListener = null;
      } catch (error) {
        console.error('Error removing time update listener:', error);
      }
    }
  }
}

