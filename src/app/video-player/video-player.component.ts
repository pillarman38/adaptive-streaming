import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders, HttpEventType } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, NgModel } from '@angular/forms';
import { config } from 'rxjs';
import { SavedVideoInfoService } from '../saved-video-info.service';

@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.css']
})

export class VideoPlayerComponent implements OnInit {
  controls;
  video = new Object;
  playerReady = false

  constructor(private http: HttpClient, private savedVid: SavedVideoInfoService) { }
  
  users: any = [];
  isPlaying = false;
  imgIcn = '../../assets/images/icons8_Circled_Play_50px.png'

  @ViewChild('videoPlayer') videoplayer: HTMLMediaElement;

  currentTime: number;
  duration: string;
  position: number;

  setCurrentTime(data) {
     
  }
  changeVolume() {
    
  }
  
  toggleVideo(event: any) {
    if(this.isPlaying == false) {
      this.videoplayer.play();
      this.imgIcn = '../../assets/images/icons8_Pause_Button_50px.png'
      this.isPlaying = true;
      console.log('video playing');
    } else {
      this.videoplayer.pause()
      this.imgIcn = '../../assets/images/icons8_Circled_Play_50px.png'
      this.isPlaying = false;
      console.log('video paused');
    }
  }
  
  ngOnInit() {
  
          this.http.get('http://192.168.1.19:4012/api/mov/transcodedmovie').subscribe((res: any[]) => {
            if(res) {
            this.video = res[0]
            this.playerReady = true
            console.log(res[0],this.videoplayer.readyState)
          }
        })
    };
}
