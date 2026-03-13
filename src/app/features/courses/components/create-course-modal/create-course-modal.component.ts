import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
  computed,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

import {
  Course,
  CoursesService,
  UpdateCourseRequest,
} from '../../services/courses.service';

@Component({
  selector: 'app-create-course-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-course-modal.component.html',
  styleUrl: './create-course-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateCourseModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly coursesService = inject(CoursesService);

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<Course>();

  isSaving = signal(false);
  submitError = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
  });

  readonly nameError = computed(() => {
    const control = this.form.controls.name;

    if (!control.touched && !control.dirty) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Введите название курса';
    }

    if (control.hasError('minlength')) {
      return 'Название курса должно содержать минимум 3 символа';
    }

    if (control.hasError('maxlength')) {
      return 'Название курса не должно превышать 120 символов';
    }

    return '';
  });

  readonly descriptionError = computed(() => {
    const control = this.form.controls.description;

    if (!control.touched && !control.dirty) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Введите описание курса';
    }

    if (control.hasError('minlength')) {
      return 'Описание курса должно содержать минимум 10 символов';
    }

    if (control.hasError('maxlength')) {
      return 'Описание курса не должно превышать 1000 символов';
    }

    return '';
  });

  close(): void {
    if (this.isSaving()) {
      return;
    }

    this.closed.emit();
  }

  onEsc(): void {
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  save(): void {
    this.submitError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request: UpdateCourseRequest = {
      name: this.form.controls.name.value.trim(),
      description: this.form.controls.description.value.trim(),
    };

    this.isSaving.set(true);

    this.coursesService
      .createCourse(request)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: (course) => {
          this.created.emit(course);
        },
        error: (error) => {
          console.error('Ошибка при создании курса', error);
          this.submitError.set('Не удалось создать курс. Попробуйте еще раз.');
        },
      });
  }
}