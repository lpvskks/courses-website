import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Course, CoursesService } from '../../services/courses.service';
import { Assignment } from '../../../../core/models/assigment.model';
import { AssignmentCardComponent } from '../../../assignments/components/assignment-card/assignment-card.component';
import { CourseBannerComponent } from '../../components/course-banner/course-banner.component';

@Component({
  selector: 'app-course-details',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CourseBannerComponent,
    AssignmentCardComponent,
  ],
  templateUrl: './course-details.component.html',
  styleUrl: './course-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly coursesService = inject(CoursesService);

  course = signal<Course | null>(null);
  assignments = signal<Assignment[]>([]);
  isCourseLoading = signal(true);
  isAssignmentsLoading = signal(true);
  isSaving = signal(false);

  currentPage = signal(1);
  pageSize = signal(6);
  totalPages = signal(1);
  totalCount = signal(0);

  isEditMode = signal(false);
  submitError = signal('');
  loadError = signal('');

  readonly role = signal(localStorage.getItem('user_role'));
  readonly isAdmin = computed(() => this.role() === 'Admin');

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.form.disable();

    this.route.paramMap.subscribe({
      next: (params) => {
        const courseId = params.get('courseId');

        if (!courseId) {
          this.router.navigate(['/courses']);
          return;
        }

        this.loadCourse(courseId);
        this.loadAssignments(courseId, 1);
      },
    });
  }

  loadCourse(courseId: string): void {
    this.isCourseLoading.set(true);
    this.loadError.set('');

    this.coursesService.getCourseById(courseId).subscribe({
      next: (course) => {
        this.course.set(course);
        this.form.patchValue({
          name: course.name,
          description: course.description,
        });
        this.form.markAsPristine();
        this.isCourseLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loadError.set('Не удалось загрузить курс');
        this.isCourseLoading.set(false);
      },
    });
  }

  loadAssignments(courseId: string, page: number): void {
    this.isAssignmentsLoading.set(true);

    this.coursesService.getCourseAssignments(courseId, page, this.pageSize()).subscribe({
      next: (response) => {
        this.assignments.set(response.items);
        this.currentPage.set(page);
        this.totalCount.set(response.totalCount);
        this.totalPages.set(Math.max(1, Math.ceil(response.totalCount / this.pageSize())));
        this.isAssignmentsLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.assignments.set([]);
        this.totalCount.set(0);
        this.totalPages.set(1);
        this.isAssignmentsLoading.set(false);
      },
    });
  }

  enableEdit(): void {
    if (!this.isAdmin()) return;

    this.isEditMode.set(true);
    this.submitError.set('');
    this.form.enable();
  }

  cancelEdit(): void {
    this.isEditMode.set(false);
    this.submitError.set('');
    this.form.disable();

    const course = this.course();
    if (!course) return;

    this.form.patchValue({
      name: course.name,
      description: course.description,
    });
  }

 save(): void {
  this.form.markAllAsTouched();
  this.submitError.set('');

  if (!this.isAdmin() || this.form.invalid) {
    return;
  }

  const currentCourse = this.course();
  if (!currentCourse) {
    return;
  }

  const updatedName = this.form.controls.name.getRawValue().trim();
  const updatedDescription = this.form.controls.description.getRawValue().trim();

  this.isSaving.set(true);

  this.coursesService.updateCourse(currentCourse.id, {
    name: updatedName,
    description: updatedDescription,
  }).subscribe({
    next: () => {
      this.course.set({
        ...currentCourse,
        name: updatedName,
        description: updatedDescription,
      });

      this.form.patchValue({
        name: updatedName,
        description: updatedDescription,
      });

      this.form.disable();
      this.isEditMode.set(false);
      this.isSaving.set(false);
    },
    error: (err) => {
      console.error(err);
      this.submitError.set('Не удалось сохранить изменения');
      this.isSaving.set(false);
    },
  });
}

  goToPreviousPage(): void {
    const course = this.course();
    if (!course || this.currentPage() <= 1) return;

    this.loadAssignments(course.id, this.currentPage() - 1);
  }

  goToNextPage(): void {
    const course = this.course();
    if (!course || this.currentPage() >= this.totalPages()) return;

    this.loadAssignments(course.id, this.currentPage() + 1);
  }

  openCourseUsers(): void {
    const course = this.course();
    if (!course) return;

    this.router.navigate(['/courses', course.id, 'users']);
  }

  get nameError(): string {
    const control = this.form.controls.name;

    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите название курса';
    if (control.errors['minlength']) return 'Название должно быть не менее 2 символов';
    if (control.errors['maxlength']) return 'Название должно быть не более 100 символов';

    return '';
  }

  get descriptionError(): string {
    const control = this.form.controls.description;

    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите описание курса';
    if (control.errors['minlength']) return 'Описание должно быть не менее 5 символов';
    if (control.errors['maxlength']) return 'Описание должно быть не более 500 символов';

    return '';
  }
}