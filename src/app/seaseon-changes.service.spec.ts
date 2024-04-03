import { TestBed } from '@angular/core/testing';

import { SeaseonChangesService } from './seaseon-changes.service';

describe('SeaseonChangesService', () => {
  let service: SeaseonChangesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeaseonChangesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
