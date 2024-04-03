import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoSelectionComponent } from './video-selection.component';

describe('VideoSelectionComponent', () => {
  let component: VideoSelectionComponent;
  let fixture: ComponentFixture<VideoSelectionComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [VideoSelectionComponent]
    });
    fixture = TestBed.createComponent(VideoSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
