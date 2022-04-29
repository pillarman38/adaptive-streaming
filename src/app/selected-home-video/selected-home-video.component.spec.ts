import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectedHomeVideoComponent } from './selected-home-video.component';

describe('SelectedHomeVideoComponent', () => {
  let component: SelectedHomeVideoComponent;
  let fixture: ComponentFixture<SelectedHomeVideoComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SelectedHomeVideoComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectedHomeVideoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
