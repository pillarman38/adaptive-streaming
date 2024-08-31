import { TestBed } from '@angular/core/testing';

import { SmartTvLibSingletonService } from './smart-tv-lib-singleton.service';

describe('SmartTvLibSingletonService', () => {
  let service: SmartTvLibSingletonService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SmartTvLibSingletonService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
