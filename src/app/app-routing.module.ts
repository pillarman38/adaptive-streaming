import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OverviewComponent } from './overview/overview.component';
import { VideoSelectionComponent } from './video-selection/video-selection.component';
import { PlayerComponent } from './player/player.component';
import { SearchComponent } from './search/search.component';
import { TvComponent } from './tv/tv.component';
import { SeasonsComponent } from './seasons/seasons.component';

const routes: Routes = [
  { path: 'overview', component: OverviewComponent },
  { path: 'videoSelection', component: VideoSelectionComponent },
  { path: 'player', component: PlayerComponent },
  { path: 'search', component: SearchComponent },
  { path: 'tv', component: TvComponent },
  { path: 'seasons', component: SeasonsComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
