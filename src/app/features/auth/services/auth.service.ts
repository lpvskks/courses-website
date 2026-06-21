import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse, RegistrationRequest } from '../../../core/models/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
<<<<<<< Updated upstream
  private readonly loginUrl = 'http://111.88.155.34:5196/api/auth/login';
  private readonly usersUrl = 'http://111.88.155.34:5196/api/users';
=======
  private readonly loginUrl = 'http://111.88.156.199:5196/api/auth/login';
  private readonly usersUrl = 'http://111.88.156.199:5196/api/users';
>>>>>>> Stashed changes

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
