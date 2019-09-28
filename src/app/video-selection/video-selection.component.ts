import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders, HttpEventType } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, NgModel } from '@angular/forms';
import { config } from 'rxjs';
import { routerNgProbeToken } from '@angular/router/src/router_module';
import { registerContentQuery } from '@angular/core/src/render3';
import { Router } from '@angular/router'
import { SavedVideoInfoService } from '../saved-video-info.service';

@Component({
  selector: 'app-video-selection',
  templateUrl: './video-selection.component.html',
  styleUrls: ['./video-selection.component.css']
})
export class VideoSelectionComponent implements OnInit {

  selection;
  browserName = ""
  nAgt = navigator.appCodeName;
  constructor(private http: HttpClient, private router: Router, private saveVid: SavedVideoInfoService) { }

  saveSelected(e) {
    console.log(e);
    
    if (this.browserName == "Chrome") {
      e['browser'] = "Chrome"
      e['fileformat'] = ".m3u8"
      this.saveVid.savedvideo = e
      console.log("heheheheheheh",e)
      console.log('chrome')
    //   this.http.post('http://192.168.1.19:4012/api/mov/pullVideo', e).subscribe(event => {
    //   console.log(event);
    // })
  }
    if (this.browserName == "Safari") {
        e['browser'] = "Safari"
        e['fileformat'] = ".m3u8"
        this.saveVid.savedvideo = e
  }
    this.router.navigateByUrl('/videoPlayer')
  }
  ngOnInit() {
    var N = navigator.appName, ua= navigator.userAgent, tem;
    var M = ua.match(/(opera|chrome|safari|firefox|msie|trident)\/?\s*(\.?\d+(\.\d+)*)/i);
    if(M && (tem= ua.match(/version\/([\.\d]+)/i))!= null) {M[2]=tem[1];}
    M= M? [M[1], M[2]]: [N, navigator.appVersion,'-?'];
    
    this.browserName = M[0]

    console.log(this.browserName)
    this.http.get('http://192.168.1.19:4012/api/mov/movies').subscribe((res: any[]) => {
      console.log(res)
      this.selection = res
      console.log(this.selection)
    });
  }
  
}
