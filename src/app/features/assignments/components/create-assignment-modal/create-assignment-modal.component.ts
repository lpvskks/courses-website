import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AssignmentsService } from '../../services/assignments.service';

@Component({
  selector: 'app-create-assignment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-assignment-modal.component.html',
  styleUrl: './create-assignment-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAssignmentModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly assignmentsService = inject(AssignmentsService);

  @Input({ required: true }) courseId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  readonly role = signal(localStorage.getItem('user_role'));
  readonly isAdmin = computed(() => this.role() === 'Admin');

  readonly isSaving = signal(false);
  readonly submitError = signal('');
  readonly selectedFiles = signal<File[]>([]);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    text: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5000)]],
    startsAtUtc: ['', [Validators.required]],
    minTeamSize: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
    maxTeamSize: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
    teamFormationMode: ['teacher_managed', [Validators.required]],
    captainSelectionEndsAtUtc: [''],
    teamFormationEndsAtUtc: ['', [Validators.required]],
    isVisible: [true],
    requiresSubmission: [true],
    deadline: ['', [Validators.required]],
  });

  showCaptainSelectionEndsAt(): boolean {
    return this.form.controls.teamFormationMode.getRawValue() !== 'teacher_managed';
  }

  close(): void {
    if (this.isSaving()) {
      return;
    }

    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onEsc(): void {
    this.close();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newFiles = Array.from(input.files ?? []);

    if (!newFiles.length) {
      return;
    }

    this.selectedFiles.update((currentFiles) => {
      const existingKeys = new Set(
        currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
      );

      const uniqueNewFiles = newFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        return !existingKeys.has(key);
      });

      return [...currentFiles, ...uniqueNewFiles];
    });

    input.value = '';
  }

  removeFile(index: number): void {
    this.selectedFiles.update((files) => files.filter((_, i) => i !== index));
  }

  save(): void {
    this.form.markAllAsTouched();
    this.submitError.set('');

    if (
      !this.isAdmin() ||
      this.form.invalid ||
      !this.courseId ||
      !this.isCaptainSelectionDateFilled() ||
      !this.areDatesValid() ||
      !this.areTeamSizesValid()
    ) {
      return;
    }

    this.isSaving.set(true);

    this.assignmentsService
      .createAssignment({
        courseId: this.courseId,
        title: this.form.controls.title.getRawValue().trim(),
        text: this.form.controls.text.getRawValue().trim(),
        startsAtUtc: this.toUtcIso(this.form.controls.startsAtUtc.getRawValue()),
        minTeamSize: this.form.controls.minTeamSize.getRawValue(),
        maxTeamSize: this.form.controls.maxTeamSize.getRawValue(),
        teamFormationMode: this.form.controls.teamFormationMode.getRawValue(),
        captainSelectionEndsAtUtc: this.toUtcIso(this.getCaptainSelectionEndsAtValue()),
        teamFormationEndsAtUtc: this.toUtcIso(
          this.form.controls.teamFormationEndsAtUtc.getRawValue(),
        ),
        isVisible: this.form.controls.isVisible.getRawValue(),
        requiresSubmission: this.form.controls.requiresSubmission.getRawValue(),
        deadline: this.toUtcIso(this.form.controls.deadline.getRawValue()),
      })
      .subscribe({
        next: (createdAssignment) => {
          const files = this.selectedFiles();

          if (!files.length) {
            this.isSaving.set(false);
            this.created.emit();
            return;
          }

          this.assignmentsService.uploadAssignmentFiles(createdAssignment.id, files).subscribe({
            next: () => {
              this.isSaving.set(false);
              this.created.emit();
            },
            error: (err) => {
              console.error(err);
              this.isSaving.set(false);
              this.submitError.set('Задание создано, но не удалось загрузить прикрепленные файлы');
            },
          });
        },
        error: (err) => {
          console.error(err);
          this.isSaving.set(false);
          this.submitError.set('Не удалось создать задание');
        },
      });
  }

  formatFileSize(size: number): string {
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
    return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
  }

  trackByFile(_: number, file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  get titleError(): string {
    const control = this.form.controls.title;
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите название задания';
    if (control.errors['minlength']) return 'Название должно быть не менее 2 символов';
    if (control.errors['maxlength']) return 'Название должно быть не более 150 символов';
    return '';
  }

  get textError(): string {
    const control = this.form.controls.text;
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите описание задания';
    if (control.errors['minlength']) return 'Описание должно быть не менее 5 символов';
    if (control.errors['maxlength']) return 'Описание должно быть не более 5000 символов';
    return '';
  }

  get startsAtError(): string {
    const requiredError = this.getRequiredDateError('startsAtUtc', 'Выберите дату начала задания');

    if (requiredError) return requiredError;

    if (!this.isStartsAtValid()) {
      return 'Начало задания должно быть раньше срока формирования команды';
    }

    return '';
  }

  get captainSelectionEndsAtError(): string {
    if (!this.showCaptainSelectionEndsAt()) {
      return '';
    }

    const control = this.form.controls.captainSelectionEndsAtUtc;

    if (control.touched && !control.getRawValue()) {
      return 'Выберите срок выбора капитана';
    }

    if (!this.isCaptainSelectionDateValid()) {
      return 'Срок выбора капитана должен быть не позже начала формирования команды';
    }

    return '';
  }

  get teamFormationEndsAtError(): string {
    const requiredError = this.getRequiredDateError(
      'teamFormationEndsAtUtc',
      'Выберите срок формирования команды',
    );

    if (requiredError) return requiredError;

    if (!this.isTeamFormationDateValid()) {
      return this.showCaptainSelectionEndsAt()
        ? 'Срок формирования команды должен быть позже срока выбора капитана'
        : 'Срок формирования команды должен быть позже начала задания';
    }

    return '';
  }

  get deadlineError(): string {
    const requiredError = this.getRequiredDateError('deadline', 'Выберите дедлайн');

    if (requiredError) return requiredError;

    if (!this.isDeadlineValid()) {
      return 'Дедлайн должен быть позже срока формирования команды';
    }

    return '';
  }

  get minTeamSizeError(): string {
    const control = this.form.controls.minTeamSize;
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Укажите минимальный размер команды';
    if (control.errors['min']) return 'Минимум 1 участник';
    if (control.errors['max']) return 'Не больше 100 участников';
    return '';
  }

  get maxTeamSizeError(): string {
    const control = this.form.controls.maxTeamSize;
    if (!control.touched && this.areTeamSizesValid()) return '';

    if (control.errors?.['required']) return 'Укажите максимальный размер команды';
    if (control.errors?.['min']) return 'Минимум 1 участник';
    if (control.errors?.['max']) return 'Не больше 100 участников';
    if (!this.areTeamSizesValid()) return 'Максимум должен быть не меньше минимума';
    return '';
  }

  private getRequiredDateError(
    controlName: 'startsAtUtc' | 'teamFormationEndsAtUtc' | 'deadline',
    message: string,
  ): string {
    const control = this.form.controls[controlName];
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return message;
    return '';
  }

  private areTeamSizesValid(): boolean {
    return (
      this.form.controls.maxTeamSize.getRawValue() >= this.form.controls.minTeamSize.getRawValue()
    );
  }

  private areDatesValid(): boolean {
    return (
      this.isCaptainSelectionDateValid() &&
      this.isTeamFormationDateValid() &&
      this.isStartsAtValid() &&
      this.isDeadlineValid()
    );
  }

  private isCaptainSelectionDateValid(): boolean {
    if (!this.showCaptainSelectionEndsAt()) {
      return true;
    }

    return (
      this.isBeforeOrEqual('captainSelectionEndsAtUtc', 'startsAtUtc') &&
      this.isBefore('captainSelectionEndsAtUtc', 'teamFormationEndsAtUtc')
    );
  }

  private isTeamFormationDateValid(): boolean {
    const isAfterStart = this.isAfter('teamFormationEndsAtUtc', 'startsAtUtc');

    if (!this.showCaptainSelectionEndsAt()) {
      return isAfterStart;
    }

    return isAfterStart && this.isAfter('teamFormationEndsAtUtc', 'captainSelectionEndsAtUtc');
  }

  private isStartsAtValid(): boolean {
    return this.isBefore('startsAtUtc', 'teamFormationEndsAtUtc');
  }

  private isDeadlineValid(): boolean {
    return this.isAfter('deadline', 'teamFormationEndsAtUtc');
  }

  private isBefore(earlierControlName: DateControlName, laterControlName: DateControlName): boolean {
    const earlier = this.form.controls[earlierControlName].getRawValue();
    const later = this.form.controls[laterControlName].getRawValue();

    if (!earlier || !later) {
      return true;
    }

    return new Date(earlier).getTime() < new Date(later).getTime();
  }

  private isBeforeOrEqual(
    earlierControlName: DateControlName,
    laterControlName: DateControlName,
  ): boolean {
    const earlier = this.form.controls[earlierControlName].getRawValue();
    const later = this.form.controls[laterControlName].getRawValue();

    if (!earlier || !later) {
      return true;
    }

    return new Date(earlier).getTime() <= new Date(later).getTime();
  }

  private isAfter(laterControlName: DateControlName, earlierControlName: DateControlName): boolean {
    const later = this.form.controls[laterControlName].getRawValue();
    const earlier = this.form.controls[earlierControlName].getRawValue();

    if (!later || !earlier) {
      return true;
    }

    return new Date(later).getTime() > new Date(earlier).getTime();
  }

  private toUtcIso(value: string): string {
    return new Date(value).toISOString();
  }

  private isCaptainSelectionDateFilled(): boolean {
    return (
      !this.showCaptainSelectionEndsAt() ||
      !!this.form.controls.captainSelectionEndsAtUtc.getRawValue()
    );
  }

  private getCaptainSelectionEndsAtValue(): string {
    if (this.showCaptainSelectionEndsAt()) {
      return this.form.controls.captainSelectionEndsAtUtc.getRawValue();
    }

    return this.form.controls.startsAtUtc.getRawValue();
  }
}

type DateControlName =
  | 'captainSelectionEndsAtUtc'
  | 'teamFormationEndsAtUtc'
  | 'startsAtUtc'
  | 'deadline';
