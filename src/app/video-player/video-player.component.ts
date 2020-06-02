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
  controls;
  video = new Object;
  safari = true;
  stream = ""
  iosReady = false
  firstPlayPress = true
  amtBuffered;
  config = {
    maxBufferSize: 1000
  }
  hls = new Hls(config);
  @ViewChild('videoTwo') videoTwo;
  @ViewChild('playPauseBtn') playPauseBtn;
  @ViewChild('playbtntriangle') playBtnTriangle
  @ViewChild('muteBtn') muteBtn
  @ViewChild('pauseBtn') pauseBtn
  @ViewChild('muteBtnLines') muteBtnLines
  @ViewChild('fill') fill
  @ViewChild('fullScreen') fullScreenBtn
  @ViewChild('customSeekBar') customSeekBar
  @ViewChild('spans') spans
  @ViewChild('spansBuffered') spansBuffered
  selectedTime = 0;
  percentage = 0;
  currentTimeDisp;

  constructor(private http: HttpClient, private savedVid: SavedVideoInfoService) { }
  
  users: any = [];
  isPlaying = false;
  imgIcn = '../../assets/images/icons8_Circled_Play_50px.png'


  duration: string;
  videoLngth: number;
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

    var hDisplay = h > 0 ? h + (h == 1 ? " : " : " :") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " : " : " : ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " :" : " :") : "";

    this.duration = hDisplay + mDisplay + sDisplay
  }

  setCurrentTime(e) {
    var d = Number(e.target.currentTime);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + (h == 1 ? " : " : " : ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " : " : " : ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " :" : " :") : "";
   
    this.currentTimeDisp = hDisplay + mDisplay + sDisplay

    var p = e.target.currentTime + this.selectedTime
    var d = this.videoLngth
    var c = p/d*100

    this.percentage = (p / this.videoLngth) * 100
    var percentBuffered = (this.amtBuffered['levels'][0]['details']['totalduration'] + this.selectedTime) / this.videoLngth * 100

    console.log(this.percentage, this.amtBuffered['levels'][0]['details']['totalduration'], percentBuffered, this.videoLngth, this.selectedTime)

    this.spans.nativeElement.style.width = this.percentage + '%'
    this.customSeekBar.nativeElement.style.width = 100
    // $( '#custom-seekbar span' ).css( 'width', percentage + '%' );
    this.spansBuffered.nativeElement.style.width = percentBuffered + "%"
    // console.log(this.amtBuffered['levels'][0]['details']['totalduration'])
  }
  changeVolume() {
    
  }
  screentoggle(e) {
    if(this.videoTwo.nativeElement.requestFullScreen){
      this.videoTwo.nativeElement.requestFullScreen();
    } else if(this.videoTwo.nativeElement.webkitRequestFullScreen){
      this.videoTwo.nativeElement.webkitRequestFullScreen();
    } else if(this.videoTwo.nativeElement.mozRequestFullScreen){
      this.videoTwo.nativeElement.mozRequestFullScreen();
    }
  }
  
  seekBarClick(e) {
    var rec = this.customSeekBar.nativeElement.getBoundingClientRect();

    var offset = this.customSeekBar.nativeElement.getBoundingClientRect(),
    left = e.pageX - offset.left,
    totalWidth = this.customSeekBar.nativeElement.getBoundingClientRect()['width'],
    percentage = left / totalWidth;
    var pxtoSec = (totalWidth - left) / totalWidth
    this.selectedTime = Math.abs(this.videoLngth * pxtoSec - this.videoLngth)
    this.videoTwo.nativeElement.currentTime = this.videoLngth * percentage
    
    console.log(pxtoSec, this.videoLngth, this.selectedTime)
    
    this.savedVid.savedvideo['screenRes'] = `${screen['width']}x${screen['height']}` 
    this.savedVid.savedvideo['seekTime'] = this.selectedTime
    this.savedVid.savedvideo['pid'] = this.savedVid.savedPid['pid']
    this.hls.detachMedia(this.videoTwo.nativeElement)
    this.http.post('http://192.168.1.86:4012/api/mov/pullVideo', this.savedVid.savedvideo).subscribe(event => {
      this.video = event['err']
      this.savedVid.savedPid['pid'] = String(event['err']['pid'])
      console.log(this.savedVid.savedPid['pid'])
      console.log(event, this.videoTwo.nativeElement.src);
      
      this.stream = this.video['location'];
      console.log("Here is the stream", this.stream)
      if (Hls.isSupported()) {
       
        this.videoLngth = parseFloat(this.video['duration'])
        console.log("video lengthin seconds: " + this.videoLngth);
        
        this.convertTime(this.video['duration'])
        
        this.hls.loadSource(this.stream);
        this.hls.attachMedia(this.videoTwo.nativeElement);
        this.hls.on(Hls.Events.MEDIA_ATTACHED, function (event, data) {
          console.log("video and hls.js are now bound together !", event['media'], data);
          this.hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
            console.log(this.videoTwo);
            
            console.log("manifest loaded, found " + data.levels.length + " quality level");
          });
        })

        this.amtBuffered = this.hls.on(Hls.Events.LEVEL_LOADED, function(eve, data) {
          //console.log(eve, data['details'], this.videoLngth, this.stream)

          
          return data
        })

        this.hls.on(Hls.Events.MANIFEST_LOADED, function(event, data) {
          // console.log(event['details'], data)
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
    this.hls.on(Hls.Events.LEVEL_LOAD_ERROR, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.BUFFER_APPENDED, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.MANIFEST_LOAD_ERROR, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.INTERNAL_EXCEPTION, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.BUFFER_APPEND_ERROR, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.FRAG_DECRYPT_ERROR, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.FRAG_PARSING_ERROR, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.FRAG_LOAD_TIMEOUT, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.FRAG_CHANGED, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.LEVEL_UPDATED, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.BUFFER_FLUSHING, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.BUFFER_FLUSHED, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.BUFFER_RESET, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.ERROR, function (event, data) {
        var errorType = data.type;
        var errorDetails = data.details;
        var errorFatal = data.fatal;
        console.log(errorFatal, errorDetails, errorType, event, data);
      });
    })

  }

  ngOnInit() {
    var screen = {
      width: window.screen.width,
      height: window.screen.height
  }
  this.savedVid.savedvideo['screenRes'] = `${screen['width']}x${screen['height']}`
  this.savedVid.savedvideo['seekTime'] = 0
  this.savedVid.savedvideo['pid'] = 0
  console.log("Screen info", this.savedVid.savedvideo)
    this.http.post('http://192.168.1.86:4012/api/mov/pullVideo', this.savedVid.savedvideo).subscribe(event => {
      this.video = event['err']
      this.savedVid.savedPid = {pid: event['err']['pid']}
      console.log(event, this.savedVid.savedPid);
      
      this.stream = this.video['location'];
      
      if (Hls.isSupported()) {
       
       
        this.videoLngth = parseFloat(this.video['duration'])
        console.log("video lengthin seconds: " + this.videoLngth);
        
        this.convertTime(this.video['duration'])

        this.hls.loadSource(this.stream);
        this.hls.attachMedia(this.videoTwo.nativeElement);
        this.hls.on(Hls.Events.MEDIA_ATTACHED, function (event, data) {
          // console.log("video and hls.js are now bound together !", event['media'], data);
          this.hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
            console.log(this.videoTwo);
            
            console.log("manifest loaded, found " + data.levels.length + " quality level");
          });
        })

        this.amtBuffered = this.hls.on(Hls.Events.LEVEL_LOADED, function(eve, data) {
          //console.log(eve, data['details'], this.videoLngth, this.stream)

          
          return data
        })

        this.hls.on(Hls.Events.MANIFEST_LOADED, function(event, data) {
          // console.log(event['details'], data)
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
    this.hls.on(Hls.Events.LEVEL_LOAD_ERROR, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.BUFFER_APPENDED, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.MANIFEST_LOAD_ERROR, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.INTERNAL_EXCEPTION, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.BUFFER_APPEND_ERROR, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.FRAG_DECRYPT_ERROR, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.FRAG_PARSING_ERROR, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.FRAG_LOAD_TIMEOUT, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.FRAG_CHANGED, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.LEVEL_UPDATED, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.BUFFER_FLUSHING, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.BUFFER_FLUSHED, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.BUFFER_RESET, function(event, data) {
      // console.log(event, data);
    })
    this.hls.on(Hls.Events.ERROR, function (event, data) {
        var errorType = data.type;
        var errorDetails = data.details;
        var errorFatal = data.fatal;
        // console.log(errorFatal, errorDetails, errorType, event, data);
      });
    })
  }
}