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
  // showControls(): Promise<void>;
  // hideControls(): Promise<void>;
  setPaused(options: { paused: boolean }): Promise<void>;
  setShowSkipIntro(options: { show: boolean }): Promise<void>;
  setShowNextEpisode(options: { show: boolean }): Promise<void>;
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
    console.log("Initialize cap");
    
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      const result = await ExoPlayer.initialize({ containerId });
      // Note: ExoPlayer container is initialized, but ExoPlayer itself is created in loadVideo()
      // So we don't set isInitialized = true here
      // isInitialized will be set to true after loadVideo() succeeds
      return result.success;
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
    // Note: We allow loadVideo to proceed even if isInitialized is false
    // because ExoPlayer is actually created in loadVideo(), not in initialize()
    // The initialize() method only sets up the container and PlayerView

    try {
      const result = await ExoPlayer.loadVideo({ url, subtitleUrl });
      // Set isInitialized to true after ExoPlayer is successfully created and media is loaded
      if (result.success) {
        this.isInitialized = true;
      }
      return result.success;
    } catch (error: any) {
      // Capacitor errors often have a message property
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      console.error('Error loading video:', errorMessage);
      console.error('Full error object:', error);
      this.isInitialized = false;
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
      // this.timeUpdateListener = listener;
    } catch (error) {
      console.error('Error adding time update listener:', error);
    }
  }

  async addListener(eventName: string, callback: (data?: any) => void) {
    if (!this.isInitialized) {
      // console.warn(`[ExoPlayerService] Cannot add listener for ${eventName} — ExoPlayer not initialized`);
      return null;
    }
  
    if (!Capacitor.isNativePlatform()) {
      // console.warn(`[ExoPlayerService] Ignoring listener for ${eventName} — not running on native platform`);
      return null;
    }
  
    try {
      // console.log(`[ExoPlayerService] Registering listener for event: ${eventName}`);
  
      const listener = await ExoPlayer.addListener(eventName, data => {
        // console.log(`[ExoPlayerService] Event received: ${eventName}`, data);
        callback(data);
      });
  
      return listener;
    } catch (err) {
      console.error(`[ExoPlayerService] Failed to register listener for ${eventName}`, err);
      return null;
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

  // async showControls(): Promise<void> {
  //   if (!this.isInitialized || !Capacitor.isNativePlatform()) {
  //     return;
  //   }
  //   try {
  //     await ExoPlayer.showControls();
  //   } catch (error) {
  //     console.error('Error showing controls:', error);
  //   }
  // }

  // async hideControls(): Promise<void> {
  //   if (!this.isInitialized || !Capacitor.isNativePlatform()) {
  //     return;
  //   }
  //   try {
  //     await ExoPlayer.hideControls();
  //   } catch (error) {
  //     console.error('Error hiding controls:', error);
  //   }
  // }

  async setPaused(paused: boolean): Promise<void> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await ExoPlayer.setPaused({ paused });
    } catch (error) {
      console.error('Error setting paused state:', error);
    }
  }

  async setShowSkipIntro(show: boolean): Promise<void> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await ExoPlayer.setShowSkipIntro({ show });
    } catch (error) {
      console.error('Error setting skip intro visibility:', error);
    }
  }

  async setShowNextEpisode(show: boolean): Promise<void> {
    if (!this.isInitialized || !Capacitor.isNativePlatform()) {
      return;
    }
    try {
      await ExoPlayer.setShowNextEpisode({ show });
    } catch (error) {
      console.error('Error setting next episode visibility:', error);
    }
  }
}

