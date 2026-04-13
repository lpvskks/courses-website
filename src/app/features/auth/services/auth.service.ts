import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse, RegistrationRequest } from '../../../core/models/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly loginUrl = 'https://localhost:7226/api/auth/login';
  private readonly usersUrl = 'https://localhost:7226/api/users';

  constructor(private http: HttpClient) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.loginUrl, request).pipe(
      tap((response: LoginResponse) => {
        localStorage.setItem('token', response.token);
      }),
    );
  }

  register(request: RegistrationRequest): Observable<string> {
    return this.http.post<string>(this.usersUrl, request);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
  }
}
