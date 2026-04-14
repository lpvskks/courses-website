import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Course, CoursesService } from '../../services/courses.service';
import { CreateCourseModalComponent } from '../../components/create-course-modal/create-course-modal.component';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, CreateCourseModalComponent],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesComponent implements OnInit {
  private readonly coursesService = inject(CoursesService);
  private readonly fb = inject(FormBuilder);

  courses = signal<Course[]>([]);
  isLoading = signal(true);
  isCreateModalOpen = signal(false);
  isJoinModalOpen = signal(false);
  isJoiningCourse = signal(false);
  joinCourseError = signal('');
  joinCourseSuccess = signal('');
  userRole = signal<string | null>(null);

  readonly joinCourseForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
  });

  activeCourses = computed(() =>
    this.courses().filter((course) => course.isActive),
  );

  inactiveCourses = computed(() =>
    this.courses().filter((course) => !course.isActive),
  );

  isAdmin = computed(() => this.userRole() === 'Admin');
  isStudent = computed(() => this.userRole() === 'Student');

  ngOnInit(): void {
    const role = localStorage.getItem('user_role');
    this.userRole.set(role);
    this.loadCourses(role);
  }

  loadCourses(role = this.userRole()): void {
    this.isLoading.set(true);

    const request$ =
      role === 'Admin'
        ? this.coursesService.getCourses()
        : role === 'Teacher' || role === 'Student'
          ? this.coursesService.getMyCourses(role)
          : this.coursesService.getMyCourses();

    request$.subscribe({
      next: (courses) => {
        this.courses.set(courses);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки курсов', err);
        this.isLoading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  openJoinModal(): void {
    this.joinCourseError.set('');
    this.joinCourseSuccess.set('');
    this.joinCourseForm.reset();
    this.isJoinModalOpen.set(true);
  }

  closeJoinModal(): void {
    if (this.isJoiningCourse()) {
      return;
    }

    this.isJoinModalOpen.set(false);
    this.joinCourseError.set('');
  }

  onCourseCreated(course: Course): void {
    this.courses.update((current) => [course, ...current]);
    this.isCreateModalOpen.set(false);
  }

  joinCourse(): void {
    this.joinCourseForm.markAllAsTouched();
    this.joinCourseError.set('');
    this.joinCourseSuccess.set('');

    if (this.joinCourseForm.invalid || this.isJoiningCourse()) {
      return;
    }

    const code = this.joinCourseForm.controls.code.getRawValue().trim();
    if (!code) {
      this.joinCourseForm.controls.code.setErrors({ required: true });
      return;
    }

    this.isJoiningCourse.set(true);

    this.coursesService.joinCourse({ code }).subscribe({
      next: () => this.refreshCoursesAfterJoin(),
      error: (err) => {
        console.error('Ошибка присоединения к курсу', err);
        this.isJoiningCourse.set(false);
        this.joinCourseError.set(this.getJoinCourseError(err));
      },
    });
  }

  private refreshCoursesAfterJoin(): void {
    this.coursesService.getMyCourses('Student').subscribe({
      next: (courses) => {
        this.courses.set(courses);
        this.finishSuccessfulJoin();
      },
      error: (err) => {
        console.error('Ошибка обновления курсов после присоединения', err);
        this.finishSuccessfulJoin();
      },
    });
  }

  private finishSuccessfulJoin(): void {
    this.isJoiningCourse.set(false);
    this.isJoinModalOpen.set(false);
    this.joinCourseForm.reset();
    this.joinCourseSuccess.set('Вы присоединились к курсу');
  }

  private getJoinCourseError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const errorBody = err.error as { title?: string; detail?: string; message?: string } | string | null;

      if (typeof errorBody === 'string' && errorBody.trim()) {
        return errorBody;
      }

      if (errorBody && typeof errorBody === 'object') {
        if (errorBody.title) {
          return errorBody.title;
        }

        if (errorBody.detail) {
          return errorBody.detail;
        }

        if (errorBody.message) {
          return errorBody.message;
        }
      }
    }

    return 'Не удалось присоединиться к курсу';
  }
}
