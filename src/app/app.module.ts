import { NgModule, isDevMode } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { HttpClientModule } from "@angular/common/http";
import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { OverviewComponent } from "./overview/overview.component";
import { VideoSelectionComponent } from "./video-selection/video-selection.component";
import { ServiceWorkerModule } from "@angular/service-worker";
import { PlayerComponent, SafeHtmlPipe } from "./player/player.component";
import { SearchComponent } from "./search/search.component";
import { SideBarComponent } from "./side-bar/side-bar.component";
import { TvComponent } from "./tv/tv.component";
import { SeasonsComponent } from "./seasons/seasons.component";
import { SmartTvComponent, SmartTvModule } from "smart-tv";
import { FormsModule } from "@angular/forms";

@NgModule({
  declarations: [
    AppComponent,
    OverviewComponent,
    VideoSelectionComponent,
    PlayerComponent,
    SafeHtmlPipe,
    SearchComponent,
    SideBarComponent,
    TvComponent,
    SeasonsComponent,
  ],
  imports: [
    FormsModule,
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    SmartTvModule,
    ServiceWorkerModule.register("ngsw-worker.js", {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: "registerWhenStable:30000",
    }),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
