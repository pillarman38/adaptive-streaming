import { Component, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SavedVideoInfoService } from '../../saved-video-info.service';
import { Router } from '@angular/router'

@Component({
  selector: 'app-show',
  templateUrl: './show.component.html',
  styleUrls: ['./show.component.css']
})
export class ShowComponent {
  browserName = ""
  selection;
  constructor(private http: HttpClient, private saveVid: SavedVideoInfoService, private router: Router) {
    console.log(this.saveVid.savedPid)
    
    var N = navigator.appName, ua= navigator.userAgent, tem;
    var M = ua.match(/(opera|chrome|safari|firefox|msie|trident)\/?\s*(\.?\d+(\.\d+)*)/i);
    if(M && (tem= ua.match(/version\/([\.\d]+)/i))!= null) {M[2]=tem[1];}
    M= M? [M[1], M[2]]: [N, navigator.appVersion,'-?'];
    
    this.browserName = M[0]

    console.log(this.browserName)

    console.log(this.saveVid.savedvideo)
    this.saveVid.savedvideo['pid'] = this.saveVid.savedPid
    this.http.post('http://192.168.0.153:4012/api/mov/show', this.saveVid.savedvideo).subscribe((res: any[])=>{
      console.log(res)
      this.selection = res
    })
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
}
