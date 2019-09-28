import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders, HttpEventType } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, NgModel } from '@angular/forms';
import { config } from 'rxjs';
import { SavedVideoInfoService } from '../saved-video-info.service';
import { MediaPlayer } from 'dashjs'
import * as HLS from 'hls.js';

@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.css']
})

export class VideoPlayerComponent implements OnInit {
  private element: HTMLVideoElement;
  hls: any;
  controls;
  video = new Object;
  safari = true;
  stream = ""
  iosReady = false
  constructor(private http: HttpClient, private savedVid: SavedVideoInfoService) { }
  
  users: any = [];
  isPlaying = false;
  imgIcn = '../../assets/images/icons8_Circled_Play_50px.png'

  @ViewChild('iosvideoplayer') iosvideoplayer: HTMLMediaElement;
  currentTime: number;
  duration: string;
  position: number;

  setCurrentTime(data) {
     
  }
  changeVolume() {
    
  }
  
  toggleVideo(event: any) {
    if(this.isPlaying == false) {
 
      this.imgIcn = '../../assets/images/icons8_Pause_Button_50px.png'
      this.isPlaying = true;
      console.log('video playing');
    } else {

      this.imgIcn = '../../assets/images/icons8_Circled_Play_50px.png'
      this.isPlaying = false;
      console.log('video paused');
    }
  }
  
  ngOnInit() {
    
    this.http.post('http://192.168.1.19:4012/api/mov/pullVideo', this.savedVid.savedvideo).subscribe(event => {
      this.video = event['err']
      console.log(event)
      this.stream = this.video['location'];

      if (this.hls) {
        this.hls.destroy();
      }

      this.hls = new HLS({
        startLevel: 2,
        capLevelToPlayerSize: true,
      });

      if (HLS.isSupported()) {
        this.hls.attachMedia(document.getElementById('videoplayer'));
        this.hls.loadSource(this.stream);
          this.hls.on(HLS.Events.MANIFEST_PARSED, (event, data) => {
            console.log(event, data)
            this.iosvideoplayer.play()
          });
      }

// hls.js is not supported on platforms that do not have Media Source Extensions (MSE) enabled.
 // When the browser has built-in HLS support (check using `canPlayType`), we can provide an HLS manifest (i.e. .m3u8 URL) directly to the video element through the `src` property.
 // This is using the built-in support of the plain video element, without using hls.js.
 // Note: it would be more normal to wait on the 'canplay' event below however on Safari (where you are most likely to find built-in HLS support) the video.src URL must be on the user-driven
 // white-list before a 'canplay' event will be emitted; the last video event that can be reliably listened-for when the URL is not on the white-list is 'loadedmetadata'.
  
      else {
        this.video = event['err']
        console.log(this.video, this.stream)

        this.iosReady = true
      }
      
        })
    }
}
