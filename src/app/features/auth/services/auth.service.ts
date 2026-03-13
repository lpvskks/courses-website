import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse } from '../../../core/models/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'https://localhost:7226/api/auth/login';

  constructor(private http: HttpClient) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.apiUrl, request).pipe(
      tap((response: LoginResponse) => {
        localStorage.setItem('token', response.token);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
  }
}
