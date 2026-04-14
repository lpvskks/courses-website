import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CourseUser } from '../../../../core/models/course-user.model';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-course-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './course-users-page.component.html',
  styleUrl: './course-users-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseUsersPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);
  private readonly fb = inject(FormBuilder);

  readonly role = signal(localStorage.getItem('user_role'));
  readonly isAdmin = computed(() => this.role() === 'Admin');
  readonly isTeacher = computed(() => this.role() === 'Teacher');
  readonly canManageStudents = computed(() => this.isAdmin() || this.isTeacher());

  courseId = signal<string | null>(null);

  teachers = signal<CourseUser[]>([]);
  students = signal<CourseUser[]>([]);
  allStudents = signal<CourseUser[]>([]);

  sortedStudents = computed(() =>
    [...this.students()].sort((a, b) => Number(a.isBlocked) - Number(b.isBlocked)),
  );

  studentsOnCourseIds = computed(() => new Set(this.students().map((student) => student.id)));
  availableStudents = computed(() =>
    this.allStudents().filter((student) => !this.studentsOnCourseIds().has(student.id)),
  );

  isLoading = signal(true);
  isAddStudentModalOpen = signal(false);
  isAllStudentsLoading = signal(false);
  loadError = signal('');
  allStudentsError = signal('');

  processingTeacherId = signal<string | null>(null);
  processingStudentId = signal<string | null>(null);
  addingStudentId = signal<string | null>(null);
  actionError = signal('');
  successMessage = signal('');

  allStudentsPage = signal(1);
  allStudentsPageSize = signal(8);
  allStudentsTotalCount = signal(0);
  allStudentsTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.allStudentsTotalCount() / this.allStudentsPageSize())),
  );

  readonly studentSearchForm = this.fb.nonNullable.group({
    search: [''],
  });

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

  openAddStudentModal(): void {
    if (!this.canManageStudents()) {
      return;
    }

    this.isAddStudentModalOpen.set(true);
    this.allStudentsError.set('');
    this.studentSearchForm.reset();
    this.loadAllStudents(1);
  }

  closeAddStudentModal(): void {
    if (this.addingStudentId()) {
      return;
    }

    this.isAddStudentModalOpen.set(false);
    this.allStudentsError.set('');
  }

  loadAllStudents(page = 1): void {
    this.isAllStudentsLoading.set(true);
    this.allStudentsError.set('');
    this.allStudentsPage.set(page);

    const search = this.studentSearchForm.controls.search.getRawValue().trim();

    this.usersService.getUsers({
      Search: search || undefined,
      Role: 'Student',
      Desc: true,
      Page: page,
      PageSize: this.allStudentsPageSize(),
    }).subscribe({
      next: (response) => {
        this.allStudents.set(response.items);
        this.allStudentsTotalCount.set(response.totalCount);
        this.isAllStudentsLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.allStudents.set([]);
        this.allStudentsTotalCount.set(0);
        this.allStudentsError.set('Не удалось загрузить список студентов');
        this.isAllStudentsLoading.set(false);
      },
    });
  }

  searchStudents(): void {
    this.loadAllStudents(1);
  }

  goToPreviousStudentsPage(): void {
    if (this.allStudentsPage() <= 1) {
      return;
    }

    this.loadAllStudents(this.allStudentsPage() - 1);
  }

  goToNextStudentsPage(): void {
    if (this.allStudentsPage() >= this.allStudentsTotalPages()) {
      return;
    }

    this.loadAllStudents(this.allStudentsPage() + 1);
  }

  addStudentToCourse(student: CourseUser): void {
    const courseId = this.courseId();

    if (!courseId || !this.canManageStudents() || this.addingStudentId()) {
      return;
    }

    this.addingStudentId.set(student.id);
    this.actionError.set('');
    this.successMessage.set('');
    this.allStudentsError.set('');

    this.usersService.addStudent(courseId, student.id).subscribe({
      next: () => {
        this.students.set([
          ...this.students(),
          {
            ...student,
            isBlocked: false,
          },
        ]);
        this.addingStudentId.set(null);
        this.successMessage.set('Студент добавлен на курс');
      },
      error: (err) => {
        console.error(err);
        this.addingStudentId.set(null);
        this.allStudentsError.set('Не удалось добавить студента на курс');
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
    if (!courseId || !this.canManageStudents()) {
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
          student.isBlocked ? 'Студент разблокирован' : 'Студент удален из курса',
        );
      },
      error: (err) => {
        console.error(err);
        this.processingStudentId.set(null);
        this.actionError.set(
          student.isBlocked
            ? 'Не удалось разблокировать студента'
            : 'Не удалось удалить студента из курса',
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
