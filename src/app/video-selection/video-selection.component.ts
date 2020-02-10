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
import { NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-video-selection',
  templateUrl: './video-selection.component.html',
  styleUrls: ['./video-selection.component.scss']
})
export class VideoSelectionComponent {

  selection;
  browserName = ""
  retain = "value"
  nAgt = navigator.appCodeName;
  getRetainedData = localStorage.getItem("movielist")
  carouselArr = []
  @ViewChild('carousel') carousel;
  
  constructor(private http: HttpClient, private router: Router, private saveVid: SavedVideoInfoService, private activatedRoute: ActivatedRoute) { 

    this.router.events.pipe(filter((rs): rs is NavigationEnd => rs instanceof NavigationEnd)).subscribe(event => {
      
    })
    var N = navigator.appName, ua= navigator.userAgent, tem;
    var M = ua.match(/(opera|chrome|safari|firefox|msie|trident)\/?\s*(\.?\d+(\.\d+)*)/i);
    if(M && (tem= ua.match(/version\/([\.\d]+)/i))!= null) {M[2]=tem[1];}
    M= M? [M[1], M[2]]: [N, navigator.appVersion,'-?'];
    
    this.browserName = M[0]

    console.log(this.browserName)
   
    console.log(JSON.parse(this.getRetainedData));

    if(this.getRetainedData == null) {
      this.http.get('http://192.168.1.86:4012/api/mov/movies').subscribe((res: any[]) => {
      this.selection = res
      var retain = localStorage.setItem("movielist", JSON.stringify(res))
      console.log(this.selection)

      this.carouselArr = this.selection.slice(-5)
      console.log(this.carouselArr, this.selection);
      })
      
    } 
    if(this.getRetainedData != null) {
      if(this.getRetainedData != this.selection){
      this.http.get('http://192.168.1.86:4012/api/mov/movies').subscribe((res: any[]) => {
      this.selection = res
      var retain = localStorage.setItem("movielist", JSON.stringify(res))
      console.log(this.selection)
      
      
      this.carouselArr = this.selection.slice(-5)
      console.log(this.carouselArr, this.selection);
    })
    
    } 
    }
     
console.log(JSON.parse(this.getRetainedData));
    this.selection = JSON.parse(this.getRetainedData)
    

    }
    
  saveSelected(e) {
    console.log(e);
    
    if (this.browserName == "Chrome") {
      e['browser'] = "Chrome"
      e['fileformat'] = ".m3u8"
      this.saveVid.savedvideo = e
      console.log("heheheheheheh",e)
      console.log('chrome')
  }
    if (this.browserName == "Safari") {
        e['browser'] = "Safari"
        e['fileformat'] = ".m3u8"
        this.saveVid.savedvideo = e
  }
    this.router.navigateByUrl('/videoPlayer')
  }
  mouseover(e) {
    console.log(e);
    // e['srcElement']['parentElement']['parentElement']['previousSibling'].style.transform = "translate(-100px)"
    // e['srcElement']['parentElement']['parentElement']['previousSibling'].style.transition = "transform 0.5s"
    // e['srcElement']['parentElement']['parentElement']['nextSibling'].style.transform = "translate(100px)"
    // e['srcElement']['parentElement']['parentElement']['nextSibling'].style.transition = "transform 0.5s"
    // var container = document.getElementById ("tempDiv");
    // var message = "The width of the contents with padding: " + container.scrollWidth + "px.\n";
    // message += "The height of the contents with padding: " + container.scrollHeight + "px.\n";
    // console.log(message);
    
  }
  mouseout(e) {
    // e['srcElement']['parentElement']['parentElement']['previousSibling'].style.transform = "translate(0px)"
    // e['srcElement']['parentElement']['parentElement']['previousSibling'].style.transition = "transform 0.5s"
    // e['srcElement']['parentElement']['parentElement']['nextSibling'].style.transform = "translate(0px)"
    // e['srcElement']['parentElement']['parentElement']['previousSibling'].style.transition = "transform 0.5s"
  }


}