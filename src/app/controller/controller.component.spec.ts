import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ControllerComponent } from './controller.component';
import { WebSocketService } from '../services/websocket.service';
import { ApiConfigService } from '../services/api-config.service';
import { HttpClientModule } from '@angular/common/http';
import { PlatformService } from '../services/platform.service';

describe('ControllerComponent', () => {
  let component: ControllerComponent;
  let fixture: ComponentFixture<ControllerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ControllerComponent ],
      imports: [ HttpClientModule ],
      providers: [
        WebSocketService,
        ApiConfigService,
        PlatformService
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ControllerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
