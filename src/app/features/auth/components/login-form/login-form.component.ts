import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { LoginRequest } from '../../../../core/models/auth';
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
  constructor(private readonly authService: AuthService) {}

  email = signal('');
  password = signal('');

  emailError = signal('');
  passwordError = signal('');

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
    if (!this.validateAndSetErrors()) {
      console.warn('Форма невалидна');
      return;
    }

    const request = this.buildRequest();

    this.authService.login(request).subscribe({
      next: (response) => {
        console.log('Успешный вход', response);
      },
      error: (err) => {
        console.error('Ошибка входа', err);
      },
    });
  }
}