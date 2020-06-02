import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SavedVideoInfoService {

  constructor() { }
  savedvideo: Object;
  savedPid: Object = {pid: 0};
}
