import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SavedVideoInfoService } from '../saved-video-info.service';

@Component({
  selector: 'app-home-videos',
  templateUrl: './home-videos.component.html',
  styleUrls: ['./home-videos.component.css']
})
export class HomeVideosComponent implements OnInit {
  selection = []
  constructor(private http: HttpClient, private saveVid: SavedVideoInfoService, private router: Router) { }

  saveSelected(e) {
    this.saveVid.savedvideo = e
    this.router.navigateByUrl('/selectedHomeVideo')
  }

  ngOnInit() {
    this.http.post('http://192.168.0.153:4012/api/mov/homevideos', this.saveVid.savedPid).subscribe((res: any[]) => {
        console.log(res)
        this.selection = res
    }) 
  }
}
