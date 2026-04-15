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

import {
  Course,
  CourseStudentGrade,
  CoursesService,
  MyCourseGrade,
} from '../../services/courses.service';

@Component({
  selector: 'app-course-grades-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './course-grades-page.component.html',
  styleUrl: './course-grades-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseGradesPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly coursesService = inject(CoursesService);

  courseId = signal<string | null>(null);
  course = signal<Course | null>(null);
  courseGrades = signal<CourseStudentGrade[]>([]);
  myGrades = signal<MyCourseGrade[]>([]);
  isCourseLoading = signal(true);
  isGradesLoading = signal(true);
  loadError = signal('');
  gradesError = signal('');

  readonly role = signal(localStorage.getItem('user_role'));
  readonly isAdmin = computed(() => this.role() === 'Admin');
  readonly isTeacher = computed(() => this.role() === 'Teacher');
  readonly isStudent = computed(() => this.role() === 'Student');

  ngOnInit(): void {
    this.route.paramMap.subscribe({
      next: (params) => {
        const courseId = params.get('courseId');

        if (!courseId) {
          this.router.navigate(['/courses']);
          return;
        }

        this.courseId.set(courseId);
        this.loadCourse(courseId);
        this.loadGrades(courseId);
      },
    });
  }

  loadCourse(courseId: string): void {
    this.isCourseLoading.set(true);
    this.loadError.set('');

    this.coursesService.getCourseById(courseId).subscribe({
      next: (course) => {
        this.course.set(course);
        this.isCourseLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loadError.set('Не удалось загрузить курс');
        this.isCourseLoading.set(false);
      },
    });
  }

  loadGrades(courseId: string): void {
    this.isGradesLoading.set(true);
    this.gradesError.set('');
    this.courseGrades.set([]);
    this.myGrades.set([]);

    const request$ = this.isStudent()
      ? this.coursesService.getMyCourseGrades(courseId)
      : this.coursesService.getCourseGrades(courseId);

    request$.subscribe({
      next: (grades) => {
        if (this.isStudent()) {
          this.myGrades.set(grades as MyCourseGrade[]);
        } else {
          this.courseGrades.set(grades as CourseStudentGrade[]);
        }

        this.isGradesLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.gradesError.set('Не удалось загрузить журнал оценок');
        this.isGradesLoading.set(false);
      },
    });
  }

  back(): void {
    const courseId = this.courseId();

    if (!courseId) {
      this.router.navigate(['/courses']);
      return;
    }

    this.router.navigate(['/courses', courseId]);
  }

  getGradeLabel(grade: number | null): string {
    return grade === null ? 'Преподаватель еще не оценил' : String(grade);
  }

  trackByCourseGrade(_: number, grade: CourseStudentGrade): string {
    return `${grade.studentId}:${grade.assignmentId}`;
  }

  trackByMyGrade(_: number, grade: MyCourseGrade): string {
    return grade.assignmentId;
  }
}
