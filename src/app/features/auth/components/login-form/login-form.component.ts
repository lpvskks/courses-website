import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { switchMap, tap, finalize, catchError, EMPTY } from 'rxjs';

import { LoginRequest, RegistrationRequest } from '../../../../core/models/auth';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatInputModule, MatFormFieldModule],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginFormComponent {
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);
  private readonly nameRegex = /^[A-ZА-ЯЁ][a-zа-яё]+$/;

  constructor(private readonly authService: AuthService) {}

  email = signal('');
  password = signal('');
  firstName = signal('');
  lastName = signal('');
  middleName = signal('');

  emailError = signal('');
  passwordError = signal('');
  firstNameError = signal('');
  lastNameError = signal('');
  middleNameError = signal('');
  submitError = signal('');
  submitSuccess = signal('');
  isSubmitting = signal(false);
  isRegisterMode = signal(false);

  onEmailChange(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.clearSubmitMessages();

    if (this.emailError()) {
      this.validateAndSetErrors();
    }
  }

  onPasswordChange(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.clearSubmitMessages();

    if (this.passwordError()) {
      this.validateAndSetErrors();
    }
  }

  onFirstNameChange(event: Event): void {
    this.firstName.set((event.target as HTMLInputElement).value);
    this.clearSubmitMessages();

    if (this.firstNameError()) {
      this.validateAndSetErrors();
    }
  }

  onLastNameChange(event: Event): void {
    this.lastName.set((event.target as HTMLInputElement).value);
    this.clearSubmitMessages();

    if (this.lastNameError()) {
      this.validateAndSetErrors();
    }
  }

  onMiddleNameChange(event: Event): void {
    this.middleName.set((event.target as HTMLInputElement).value);
    this.clearSubmitMessages();

    if (this.middleNameError()) {
      this.validateAndSetErrors();
    }
  }

  showRegisterForm(): void {
    this.isRegisterMode.set(true);
    this.clearMessagesAndErrors();
  }

  showLoginForm(): void {
    this.isRegisterMode.set(false);
    this.clearMessagesAndErrors();
  }

  isFormValid(): boolean {
    if (this.isRegisterMode()) {
      return this.isRegisterFormValid();
    }

    return this.isLoginFormValid();
  }

  buildRequest(): LoginRequest {
    return {
      email: this.email().trim(),
      password: this.password(),
    };
  }

  buildRegistrationRequest(): RegistrationRequest {
    return {
      firstName: this.firstName().trim(),
      lastName: this.lastName().trim(),
      middleName: this.middleName().trim(),
      email: this.email().trim(),
      password: this.password(),
    };
  }

  onLogin(): void {
    this.submitError.set('');
    this.submitSuccess.set('');

    if (!this.validateAndSetErrors()) {
      return;
    }

    this.isSubmitting.set(true);

    this.authService
      .login(this.buildRequest())
      .pipe(
        switchMap(() => this.userService.getMyRole()),
        tap((roleResponse) => {
          if (roleResponse.role === 'Student') {
            this.authService.logout();
            throw new Error('STUDENT_FORBIDDEN');
          }

          localStorage.setItem('user_role', roleResponse.role);
        }),
        finalize(() => {
          this.isSubmitting.set(false);
        }),
        catchError((err) => {
          if (err.message === 'STUDENT_FORBIDDEN') {
            this.submitError.set('Вход для студентов запрещен');
            return EMPTY;
          }

          console.error(err);
          this.submitError.set('Не удалось выполнить вход');
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.router.navigate(['/courses']);
      });
  }

  onRegister(): void {
    this.submitError.set('');
    this.submitSuccess.set('');

    if (!this.validateAndSetErrors()) {
      return;
    }

    this.isSubmitting.set(true);

    this.authService
      .register(this.buildRegistrationRequest())
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
        }),
        catchError((err) => {
          console.error(err);
          this.submitError.set(this.getRegistrationErrorMessage(err));
          return EMPTY;
        }),
      )
      .subscribe((_userId) => {
        this.submitSuccess.set('Регистрация прошла успешно. Теперь можно войти');
        this.isRegisterMode.set(false);
        this.password.set('');
        this.clearErrors();
      });
  }

  private validateAndSetErrors(): boolean {
    this.clearErrors();

    if (this.isRegisterMode()) {
      this.firstNameError.set(this.getNameError(this.firstName(), 'имя'));
      this.lastNameError.set(this.getNameError(this.lastName(), 'фамилию'));
      this.middleNameError.set(this.getNameError(this.middleName(), 'отчество'));
    }

    const email = this.email().trim();
    const password = this.password();
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

  private isLoginFormValid(): boolean {
    const email = this.email().trim();
    const password = this.password();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailRegex.test(email) && password.length >= 8;
  }

  private isRegisterFormValid(): boolean {
    return (
      this.isNameValid(this.firstName()) &&
      this.isNameValid(this.lastName()) &&
      this.isNameValid(this.middleName()) &&
      this.isLoginFormValid()
    );
  }

  private isNameValid(value: string): boolean {
    const trimmedValue = value.trim();
    return trimmedValue.length <= 50 && this.nameRegex.test(trimmedValue);
  }

  private getNameError(value: string, fieldName: string): string {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return `Введите ${fieldName}`;
    }

    if (trimmedValue.length > 50) {
      return 'Максимум 50 символов';
    }

    if (!this.nameRegex.test(trimmedValue)) {
      return 'Только буквы, первая буква заглавная';
    }

    return '';
  }

  private clearMessagesAndErrors(): void {
    this.clearSubmitMessages();
    this.clearErrors();
  }

  private clearSubmitMessages(): void {
    this.submitError.set('');
    this.submitSuccess.set('');
  }

  private clearErrors(): void {
    this.emailError.set('');
    this.passwordError.set('');
    this.firstNameError.set('');
    this.lastNameError.set('');
    this.middleNameError.set('');
  }

  private getRegistrationErrorMessage(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return 'Не удалось зарегистрироваться';
    }

    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error;
    }

    if (err.error?.title) {
      return err.error.title;
    }

    if (err.error?.errors) {
      const validationErrors = Object.values(err.error.errors).flat();
      const firstError = validationErrors.find((error) => typeof error === 'string');

      if (firstError) {
        return firstError;
      }
    }

    return 'Не удалось зарегистрироваться. Проверьте данные или попробуйте позже';
  }
}
