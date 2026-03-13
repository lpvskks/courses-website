import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CourseUser } from '../../../../core/models/course-user.model';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-course-users-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './course-users-page.component.html',
  styleUrl: './course-users-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseUsersPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);

  readonly role = signal(localStorage.getItem('user_role'));
  readonly isAdmin = computed(() => this.role() === 'Admin');
  readonly isTeacher = computed(() => this.role() === 'Teacher');

  courseId = signal<string | null>(null);

  teachers = signal<CourseUser[]>([]);
  students = signal<CourseUser[]>([]);
  
  sortedStudents = computed(() =>
    [...this.students()].sort((a, b) => Number(a.isBlocked) - Number(b.isBlocked)),
  );

  isLoading = signal(true);
  loadError = signal('');

  processingTeacherId = signal<string | null>(null);
  processingStudentId = signal<string | null>(null);
  actionError = signal('');
  successMessage = signal('');

  ngOnInit(): void {
    this.route.paramMap.subscribe({
      next: (params) => {
        const courseId = params.get('courseId');

        if (!courseId) {
          this.router.navigate(['/courses']);
          return;
        }

        this.courseId.set(courseId);
        this.loadUsers(courseId);
      },
    });
  }

  loadUsers(courseId: string): void {
    this.isLoading.set(true);
    this.loadError.set('');
    this.actionError.set('');
    this.successMessage.set('');

    forkJoin({
      teachers: this.usersService.getCourseTeachers(courseId),
      students: this.usersService.getCourseStudents(courseId),
    }).subscribe({
      next: ({ teachers, students }) => {
        this.teachers.set(teachers);
        this.students.set(students);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loadError.set('Не удалось загрузить пользователей курса');
        this.isLoading.set(false);
      },
    });
  }

  assignTeacher(student: CourseUser): void {
    const courseId = this.courseId();
    if (!courseId || !this.isAdmin()) {
      return;
    }

    this.processingTeacherId.set(student.id);
    this.actionError.set('');
    this.successMessage.set('');

    this.usersService.assignTeacher(courseId, student.id).subscribe({
      next: () => {
        this.students.set(this.students().filter((item) => item.id !== student.id));
        this.teachers.set([...this.teachers(), student]);
        this.processingTeacherId.set(null);
        this.successMessage.set('Пользователь назначен преподавателем');
      },
      error: (err) => {
        console.error(err);
        this.processingTeacherId.set(null);
        this.actionError.set('Не удалось назначить преподавателя');
      },
    });
  }

  removeTeacher(teacher: CourseUser): void {
    const courseId = this.courseId();
    if (!courseId || !this.isAdmin()) {
      return;
    }

    this.processingTeacherId.set(teacher.id);
    this.actionError.set('');
    this.successMessage.set('');

    this.usersService.removeTeacher(courseId, teacher.id).subscribe({
      next: () => {
        this.teachers.set(this.teachers().filter((item) => item.id !== teacher.id));
        this.students.set([
          ...this.students(),
          {
            ...teacher,
            isBlocked: false,
          },
        ]);
        this.processingTeacherId.set(null);
        this.successMessage.set('Преподаватель снят с должности');
      },
      error: (err) => {
        console.error(err);
        this.processingTeacherId.set(null);
        this.actionError.set('Не удалось снять преподавателя с должности');
      },
    });
  }

  toggleStudentBlock(student: CourseUser): void {
    const courseId = this.courseId();
    if (!courseId || (!this.isAdmin() && !this.isTeacher())) {
      return;
    }

    this.processingStudentId.set(student.id);
    this.actionError.set('');
    this.successMessage.set('');

    const request$ = student.isBlocked
      ? this.usersService.unblockStudent(courseId, student.id)
      : this.usersService.blockStudent(courseId, student.id);

    request$.subscribe({
      next: () => {
        this.students.set(
          this.students().map((item) =>
            item.id === student.id ? { ...item, isBlocked: !item.isBlocked } : item,
          ),
        );

        this.processingStudentId.set(null);
        this.successMessage.set(
          student.isBlocked ? 'Студент разблокирован' : 'Студент заблокирован',
        );
      },
      error: (err) => {
        console.error(err);
        this.processingStudentId.set(null);
        this.actionError.set(
          student.isBlocked
            ? 'Не удалось разблокировать студента'
            : 'Не удалось заблокировать студента',
        );
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

  trackByUserId(_: number, user: CourseUser): string {
    return user.id;
  }
}
