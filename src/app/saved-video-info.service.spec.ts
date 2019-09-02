import { TestBed } from '@angular/core/testing';

import { SavedVideoInfoService } from './saved-video-info.service';

describe('SavedVideoInfoService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: SavedVideoInfoService = TestBed.get(SavedVideoInfoService);
    expect(service).toBeTruthy();
  });
});
