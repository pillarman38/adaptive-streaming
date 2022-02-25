import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectedShowComponent } from './selected-show.component';

describe('SelectedShowComponent', () => {
  let component: SelectedShowComponent;
  let fixture: ComponentFixture<SelectedShowComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SelectedShowComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectedShowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
