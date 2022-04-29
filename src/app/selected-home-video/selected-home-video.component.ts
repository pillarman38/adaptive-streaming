import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SavedVideoInfoService } from '../saved-video-info.service';

@Component({
  selector: 'app-selected-home-video',
  templateUrl: './selected-home-video.component.html',
  styleUrls: ['./selected-home-video.component.css']
})
export class SelectedHomeVideoComponent implements OnInit {
  selection = {}
  fileInformation = {}
  constructor(private saveVid: SavedVideoInfoService, private router: Router) { }

  saveSelected(e) {
  console.log("here is e ", e);
    e.browser = "Safari"
    e.filePath = e.path


    this.saveVid.savedvideo = e
    this.router.navigateByUrl('/videoPlayer')
  }

  ngOnInit() {
    console.log("Hello World!", this.saveVid.savedvideo)
    this.selection = this.saveVid.savedvideo
    this.fileInformation = JSON.parse(this.saveVid.savedvideo['filePaths'])
    console.log(this.selection, this.fileInformation);
  }
}
