import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http'

import { RouterModule, Routes } from '@angular/router';
import { VideoPlayerComponent } from './video-player/video-player.component';
import { VideoSelectionComponent } from './video-selection/video-selection.component';
import { TvComponent } from './tv/tv.component';
import { ShowComponent } from './tv/show/show.component';

const appRoutes: Routes = [
  {path: 'videoPlayer', component: VideoPlayerComponent},
  {path: 'videoSelection', component: VideoSelectionComponent},
  {path: 'tv', component: TvComponent},
  {path: 'show', component: ShowComponent}
];

@NgModule({
  declarations: [
    AppComponent,
    VideoPlayerComponent,
    VideoSelectionComponent,
    TvComponent,
    ShowComponent
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
