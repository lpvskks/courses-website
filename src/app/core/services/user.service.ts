import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserRoleResponse {
  role: 'Student' | 'Teacher' | 'Admin';
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);

  getMyRole(): Observable<UserRoleResponse> {
    return this.http.get<UserRoleResponse>(
      'https://localhost:7226/api/users/me/role'
    );
  }
}