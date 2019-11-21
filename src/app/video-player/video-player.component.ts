import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders, HttpEventType } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, NgModel } from '@angular/forms';
import { config } from 'rxjs';
import { SavedVideoInfoService } from '../saved-video-info.service';
import { MediaPlayer } from 'dashjs'
import * as Hls from 'hls.js';

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
  firstPlayPress = true
  
  @ViewChild('videoTwo') videoTwo;
  @ViewChild('playPauseBtn') playPauseBtn;
  @ViewChild('playbtntriangle') playBtnTriangle
  @ViewChild('muteBtn') muteBtn
  @ViewChild('pauseBtn') pauseBtn
  @ViewChild('muteBtnLines') muteBtnLines
  currentTimeDisp;
  constructor(private http: HttpClient, private savedVid: SavedVideoInfoService) { }
  
  users: any = [];
  isPlaying = false;
  imgIcn = '../../assets/images/icons8_Circled_Play_50px.png'


  duration: string;
  position: number;
  playPause(e) {  
    if(this.firstPlayPress == true) {
      this.playPauseBtn.nativeElement.style.marginTop = "60%"
      this.playPauseBtn.nativeElement.style.width = "30px"
      this.playPauseBtn.nativeElement.style.height = "30px"
      this.playBtnTriangle.nativeElement.style.borderLeft = "10px solid #fff"
      this.playBtnTriangle.nativeElement.style.borderTop = "5px solid transparent"
      this.playBtnTriangle.nativeElement.style.borderBottom = "5px solid transparent"
      this.playPauseBtn.nativeElement.classList.add('pulse-wave')
      this.playBtnTriangle.nativeElement.style.transition = "border-top 0.5s, border-bottom 0.s, border-left 0.5s"
      this.playPauseBtn.nativeElement.style.transition = "margin-top 0.5s, width 0.5s, height 0.5s"
      this.muteBtn.nativeElement.style.opacity = 1
      this.muteBtn.nativeElement.style.transition = "opacity 0.5s"
      this.pauseBtn.nativeElement.style.opacity = "1"
      this.pauseBtn.nativeElement.style.transition= "opacity 0.5s"
      this.firstPlayPress = false
    }
    
    if(this.videoTwo.nativeElement.paused) {
      console.log("paused");
      this.videoTwo.nativeElement.play()
      this.playBtnTriangle.nativeElement.style.opacity = "1"
      this.playBtnTriangle.nativeElement.style.transition = "opacity 0.5s"
      this.pauseBtn.nativeElement.style.opacity = "0"
      this.pauseBtn.nativeElement.style.transition = "opacity 0.5s"
    } else {
      console.log("playing");
      this.videoTwo.nativeElement.pause()
      this.playBtnTriangle.nativeElement.style.opacity = "0"
      this.playBtnTriangle.nativeElement.style.transition = "opacity 0.5s"
      this.pauseBtn.nativeElement.style.opacity = "1"
      this.pauseBtn.nativeElement.style.transition = "opacity 0.5s"
    }
  }

  mute($event) {
    if(this.videoTwo.nativeElement.muted) {
      this.videoTwo.nativeElement.muted = false
      this.muteBtnLines.nativeElement.style.left = "18px"
      
    } else {
      this.videoTwo.nativeElement.muted = true
      this.muteBtnLines.nativeElement.style.left = "8px"
    }  
  }

  convertTime(seconds) {
    var d = Number(seconds);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    console.log(hDisplay + mDisplay + sDisplay);
    this.duration = hDisplay + mDisplay + sDisplay
  }

  setCurrentTime(e) {
    var d = Number(e.target.currentTime);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    console.log(hDisplay + mDisplay + sDisplay);
    this.currentTimeDisp = hDisplay + mDisplay + sDisplay
  }
  changeVolume() {
    
  }
  
  ngOnInit() {
    this.http.post('http://192.168.1.19:4012/api/mov/pullVideo', this.savedVid.savedvideo).subscribe(event => {
      this.video = event['err']
      console.log(this.savedVid.savedvideo);
      
      this.stream = this.video['location'];
          
      if (Hls.isSupported()) {
        
        var hls = new Hls();
        // bind them together
        this.convertTime(this.video['duration'])

        hls.loadSource(this.stream);
        hls.attachMedia(this.videoTwo.nativeElement);
        hls.on(Hls.Events.MEDIA_ATTACHED, function (event, data) {
          console.log("video and hls.js are now bound together !", event['media'], data);
          hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
            console.log(this.videoTwo);
            
            console.log("manifest loaded, found " + data.levels.length + " quality level");
          });
        })
        
      } else {
        addSourceToVideo(this.videoTwo, this.stream, 'application/x-mpegURL"');
    }

    function addSourceToVideo(element, src, type) {
      var source = document.createElement('source');
      source.src = src;
      source.type = type;
      element.appendChild(source);
    }
    hls.on(Hls.Events.ERROR, function (event, data) {
        var errorType = data.type;
        var errorDetails = data.details;
        var errorFatal = data.fatal;
    console.log(errorFatal, errorDetails, errorType, event, data);
    
      });
      
      
     
// hls.js is not supported on platforms that do not have Media Source Extensions (MSE) enabled.
 // When the browser has built-in HLS support (check using `canPlayType`), we can provide an HLS manifest (i.e. .m3u8 URL) directly to the video element through the `src` property.
 // This is using the built-in support of the plain video element, without using hls.js.
 // Note: it would be more normal to wait on the 'canplay' event below however on Safari (where you are most likely to find built-in HLS support) the video.src URL must be on the user-driven
 // white-list before a 'canplay' event will be emitted; the last video event that can be reliably listened-for when the URL is not on the white-list is 'loadedmetadata'.
  
     
      
      
        })
    }
  
}