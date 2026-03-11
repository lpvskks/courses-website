import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserProfileResponse, UpdateUserProfileRequest } from '../../../../core/models/user-profile.model';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './profile-dialog.component.html',
  styleUrl: './profile-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly dialogRef = inject(MatDialogRef<ProfileDialogComponent>);

  isLoading = signal(true);
  isSaving = signal(false);
  isEditMode = signal(false);
  loadError = signal('');
  submitError = signal('');
  successMessage = signal('');
  profileId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    middleName: ['', [Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
  });

  constructor() {
    this.form.disable();
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    this.loadError.set('');
    this.successMessage.set('');

    this.profileService.getMe().subscribe({
      next: (profile) => {
        this.applyProfile(profile);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Ошибка загрузки профиля', error);
        this.loadError.set('Не удалось загрузить профиль');
        this.isLoading.set(false);
      },
    });
  }

  applyProfile(profile: UserProfileResponse): void {
    this.profileId.set(profile.id);

    this.form.patchValue({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      middleName: profile.middleName ?? '',
      email: profile.email ?? '',
    });

    this.form.markAsPristine();
  }

  enableEdit(): void {
    this.isEditMode.set(true);
    this.submitError.set('');
    this.successMessage.set('');
    this.form.enable();
  }

  cancelEdit(): void {
    this.isEditMode.set(false);
    this.submitError.set('');
    this.successMessage.set('');
    this.form.disable();
    this.loadProfile();
  }

  save(): void {
    this.form.markAllAsTouched();
    this.submitError.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      return;
    }

    const payload: UpdateUserProfileRequest = {
      firstName: this.form.controls.firstName.getRawValue().trim(),
      lastName: this.form.controls.lastName.getRawValue().trim(),
      middleName: this.form.controls.middleName.getRawValue().trim(),
      email: this.form.controls.email.getRawValue().trim(),
    };

    this.isSaving.set(true);

    this.profileService.updateMe(payload).subscribe({
      next: (response) => {
        this.applyProfile(response);
        this.form.disable();
        this.isEditMode.set(false);
        this.isSaving.set(false);
        this.successMessage.set('Профиль успешно обновлён');
      },
      error: (error) => {
        console.error('Ошибка обновления профиля', error);
        this.submitError.set('Не удалось сохранить изменения');
        this.isSaving.set(false);
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  get firstNameError(): string {
    const control = this.form.controls.firstName;

    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите имя';
    if (control.errors['minlength']) return 'Имя должно быть не менее 2 символов';
    if (control.errors['maxlength']) return 'Имя должно быть не более 50 символов';

    return '';
  }

  get lastNameError(): string {
    const control = this.form.controls.lastName;

    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите фамилию';
    if (control.errors['minlength']) return 'Фамилия должна быть не менее 2 символов';
    if (control.errors['maxlength']) return 'Фамилия должна быть не более 50 символов';

    return '';
  }

  get middleNameError(): string {
    const control = this.form.controls.middleName;

    if (!control.touched || !control.errors) return '';
    if (control.errors['maxlength']) return 'Отчество должно быть не более 50 символов';

    return '';
  }

  get emailError(): string {
    const control = this.form.controls.email;

    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите email';
    if (control.errors['email']) return 'Введите корректный email';
    if (control.errors['maxlength']) return 'Email должен быть не более 100 символов';

    return '';
  }
}