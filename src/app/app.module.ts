import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http'

import { RouterModule, Routes } from '@angular/router';
import { VideoPlayerComponent } from './video-player/video-player.component';
import { VideoSelectionComponent } from './video-selection/video-selection.component';
import { TvComponent } from './tv/tv.component';
import { SelectedShowComponent } from './selected-show/selected-show.component';
import { HomeVideosComponent } from './home-videos/home-videos.component';
import { SelectedHomeVideoComponent } from './selected-home-video/selected-home-video.component';

const appRoutes: Routes = [
  {path: 'videoPlayer', component: VideoPlayerComponent},
  {path: 'videoSelection', component: VideoSelectionComponent},
  {path: 'tv', component: TvComponent},
  {path: 'selectedShow', component: SelectedShowComponent },
  {path: 'homeVideos', component: HomeVideosComponent},
  {path: 'selectedHomeVideo', component: SelectedHomeVideoComponent}
];

@NgModule({
  declarations: [
    AppComponent,
    VideoPlayerComponent,
    VideoSelectionComponent,
    TvComponent,
    SelectedShowComponent,
    HomeVideosComponent,
    SelectedHomeVideoComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forRoot(appRoutes)
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
