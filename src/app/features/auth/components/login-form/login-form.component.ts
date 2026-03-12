import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { of, switchMap, tap, finalize } from 'rxjs';

import { LoginRequest } from '../../../../core/models/auth';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../../../core/services/user.service';
import { CoursesService } from '../../../courses/services/courses.service';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatInputModule, MatFormFieldModule],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginFormComponent {
  constructor(private readonly authService: AuthService) {}

  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly coursesService = inject(CoursesService);

  email = signal('');
  password = signal('');

  emailError = signal('');
  passwordError = signal('');
  submitError = signal('');
  isSubmitting = signal(false);

  onEmailChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.email.set(value);

    if (this.emailError()) {
      this.validateAndSetErrors();
    }
  }

  onPasswordChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.password.set(value);

    if (this.passwordError()) {
      this.validateAndSetErrors();
    }
  }

  isFormValid(): boolean {
    const email = this.email();
    const password = this.password();

    if (!email || !password) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) return false;

    if (password.length < 8) return false;

    return true;
  }

  private validateAndSetErrors(): boolean {
    const email = this.email();
    const password = this.password();

    this.emailError.set('');
    this.passwordError.set('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      this.emailError.set('Введите email');
    } else if (!emailRegex.test(email)) {
      this.emailError.set('Введите корректный email');
    }

    if (!password) {
      this.passwordError.set('Введите пароль');
    } else if (password.length < 8) {
      this.passwordError.set('Пароль должен быть не менее 8 символов');
    }

    return this.isFormValid();
  }

  buildRequest(): LoginRequest {
    return {
      email: this.email(),
      password: this.password(),
    };
  }

  onLogin(): void {
    this.submitError.set('');

    if (!this.validateAndSetErrors()) {
      return;
    }

    const request = this.buildRequest();

    this.isSubmitting.set(true);

    this.authService
      .login(request)
      .pipe(
        switchMap(() => this.userService.getMyRole()),
        tap((roleResponse) => {
          localStorage.setItem('user_role', roleResponse.role);
        }),
        switchMap((roleResponse) => {
          if (roleResponse.role === 'Admin') {
            return this.coursesService.getCourses();
          }

          if (roleResponse.role === 'Teacher') {
            return this.coursesService.getMyCourses();
          }

          return of(null);
        }),
        finalize(() => {
          this.isSubmitting.set(false);
        }),
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/users']);
        },
        error: (err) => {
          console.error(err);
          this.submitError.set('Не удалось выполнить вход');
        },
      });
  }
}
