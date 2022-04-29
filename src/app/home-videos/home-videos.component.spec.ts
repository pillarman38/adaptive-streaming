import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeVideosComponent } from './home-videos.component';

describe('HomeVideosComponent', () => {
  let component: HomeVideosComponent;
  let fixture: ComponentFixture<HomeVideosComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HomeVideosComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HomeVideosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
