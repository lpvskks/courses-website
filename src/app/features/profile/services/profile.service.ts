import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserProfileResponse, UpdateUserProfileRequest } from '../../../core/models/user-profile.model';


@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://111.88.156.199:5196/api/users';

  getMe(): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(`${this.baseUrl}/me`);
  }

  updateMe(payload: UpdateUserProfileRequest): Observable<UserProfileResponse> {
    return this.http.patch<UserProfileResponse>(`${this.baseUrl}/me`, payload);
  }
}
