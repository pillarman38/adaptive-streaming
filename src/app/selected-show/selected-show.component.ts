import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { SavedVideoInfoService } from '../saved-video-info.service';

@Component({
  selector: 'app-selected-show',
  templateUrl: './selected-show.component.html',
  styleUrls: ['./selected-show.component.css']
})
export class SelectedShowComponent implements OnInit {

  constructor(private saveVid: SavedVideoInfoService, private http: HttpClient) { }
  
  seasons = []
  selectedSeason = []
  selectedShow = ''

  seasonSelect(e) {
    this.selectedSeason = e
  }

  saveSelected(e) {

  }

  ngOnInit() {
    console.log(this.saveVid.savedvideo);

    this.http.post(`http://192.168.0.153:4012/api/mov/selectedShow`, this.saveVid.savedvideo).subscribe((res: any) => {
      console.log(res);
      
      this.selectedShow = this.saveVid.savedvideo['title']
      this.seasons = res['seasons']
      this.selectedSeason = res['seasons'][0]
    })
  }
}
