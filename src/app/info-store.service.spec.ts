import { TestBed } from '@angular/core/testing';

import { InfoStoreService } from './info-store.service';

describe('InfoStoreService', () => {
  let service: InfoStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InfoStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
