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

  onEmailChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.email.set(value);
  }

  onPasswordChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.password.set(value);
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

  buildRequest(): LoginRequest {
    return {
      email: this.email(),
      password: this.password(),
    };
  }

  onLogin(): void {
    if (!this.isFormValid()) {
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
