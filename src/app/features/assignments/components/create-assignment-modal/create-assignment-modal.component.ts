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
    requiresSubmission: [true],
    deadline: ['', [Validators.required]],
  });

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

    if (!this.isAdmin() || this.form.invalid || !this.courseId) {
      return;
    }

    const title = this.form.controls.title.getRawValue().trim();
    const text = this.form.controls.text.getRawValue().trim();
    const deadlineRaw = this.form.controls.deadline.getRawValue();

    if (!title || !text || !deadlineRaw) {
      return;
    }

    this.isSaving.set(true);

    this.assignmentsService
      .createAssignment({
        courseId: this.courseId,
        title,
        text,
        requiresSubmission: this.form.controls.requiresSubmission.getRawValue(),
        deadline: new Date(deadlineRaw).toISOString(),
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
    if (control.errors['minlength']) return 'Описание должно быть не менее 2 символов';
    if (control.errors['maxlength']) return 'Описание должно быть не более 1000 символов';
    return '';
  }

  get deadlineError(): string {
    const control = this.form.controls.deadline;
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Выберите дедлайн';
    return '';
  }
}
