import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CourseUsersPageComponent } from './course-users-page.component';
import { UsersService } from '../../services/users.service';
import { CourseUser } from '../../../../core/models/course-user.model';

describe('CourseUsersPageComponent', () => {
  let component: CourseUsersPageComponent;
  let fixture: ComponentFixture<CourseUsersPageComponent>;

  let usersServiceMock: {
    getCourseTeachers: (courseId: string) => any;
    getCourseStudents: (courseId: string) => any;
    assignTeacher: (courseId: string, userId: string) => any;
    removeTeacher: (courseId: string, userId: string) => any;
    blockStudent: (courseId: string, userId: string) => any;
    unblockStudent: (courseId: string, userId: string) => any;

    lastGetCourseTeachersArg: string | null;
    lastGetCourseStudentsArg: string | null;
    lastAssignTeacherArgs: { courseId: string; userId: string } | null;
    lastRemoveTeacherArgs: { courseId: string; userId: string } | null;
    lastBlockStudentArgs: { courseId: string; userId: string } | null;
    lastUnblockStudentArgs: { courseId: string; userId: string } | null;
  };

  let routerMock: {
    navigate: (commands: any[]) => void;
    lastNavigateArgs: any[] | null;
  };

  const teacherUser: CourseUser = {
    id: 'teacher-1',
    firstName: 'Иван',
    lastName: 'Иванов',
    email: 'teacher@test.com',
    isBlocked: false,
  };

  const activeStudent: CourseUser = {
    id: 'student-1',
    firstName: 'Петр',
    lastName: 'Петров',
    email: 'student1@test.com',
    isBlocked: false,
  };

  const blockedStudent: CourseUser = {
    id: 'student-2',
    firstName: 'Анна',
    lastName: 'Сидорова',
    email: 'student2@test.com',
    isBlocked: true,
  };

  beforeEach(async () => {
    localStorage.setItem('user_role', 'Admin');

    usersServiceMock = {
      lastGetCourseTeachersArg: null,
      lastGetCourseStudentsArg: null,
      lastAssignTeacherArgs: null,
      lastRemoveTeacherArgs: null,
      lastBlockStudentArgs: null,
      lastUnblockStudentArgs: null,

      getCourseTeachers: (courseId: string) => {
        usersServiceMock.lastGetCourseTeachersArg = courseId;
        return of([teacherUser]);
      },

      getCourseStudents: (courseId: string) => {
        usersServiceMock.lastGetCourseStudentsArg = courseId;
        return of([blockedStudent, activeStudent]);
      },

      assignTeacher: (courseId: string, userId: string) => {
        usersServiceMock.lastAssignTeacherArgs = { courseId, userId };
        return of(null);
      },

      removeTeacher: (courseId: string, userId: string) => {
        usersServiceMock.lastRemoveTeacherArgs = { courseId, userId };
        return of(null);
      },

      blockStudent: (courseId: string, userId: string) => {
        usersServiceMock.lastBlockStudentArgs = { courseId, userId };
        return of(null);
      },

      unblockStudent: (courseId: string, userId: string) => {
        usersServiceMock.lastUnblockStudentArgs = { courseId, userId };
        return of(null);
      },
    };

    routerMock = {
      lastNavigateArgs: null,
      navigate: (commands: any[]) => {
        routerMock.lastNavigateArgs = commands;
      },
    };

    await TestBed.configureTestingModule({
      imports: [CourseUsersPageComponent],
      providers: [
        { provide: UsersService, useValue: usersServiceMock },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ courseId: 'course-1' })),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem('user_role');
  });

  it('loadUsers должен успешно загружать преподавателей и студентов', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.teachers.set([]);
    component.students.set([]);
    component.isLoading.set(true);

    component.loadUsers('course-55');

    expect(usersServiceMock.lastGetCourseTeachersArg).toBe('course-55');
    expect(usersServiceMock.lastGetCourseStudentsArg).toBe('course-55');
    expect(component.teachers()).toEqual([teacherUser]);
    expect(component.students()).toEqual([blockedStudent, activeStudent]);
    expect(component.loadError()).toBe('');
    expect(component.actionError()).toBe('');
    expect(component.successMessage()).toBe('');
    expect(component.isLoading()).toBe(false);
  });

  it('при ошибке loadUsers должен устанавливаться loadError', () => {
    usersServiceMock.getCourseTeachers = () =>
      throwError(() => new Error('teachers load error'));

    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.loadUsers('course-1');

    expect(component.loadError()).toBe('Не удалось загрузить пользователей курса');
    expect(component.isLoading()).toBe(false);
  });

  it('sortedStudents должен возвращать сначала активных студентов, потом удаленных', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.students.set([blockedStudent, activeStudent]);

    expect(component.sortedStudents()).toEqual([activeStudent, blockedStudent]);
  });

  it('если роль пользователя не Admin, то он не может назначать преподавателей', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.role.set('Teacher');
    component.courseId.set('course-1');
    usersServiceMock.lastAssignTeacherArgs = null;

    component.assignTeacher(activeStudent);

    expect(usersServiceMock.lastAssignTeacherArgs).toBe(null);
  });

  it('если роль пользователя Admin, то он может назначать преподавателей', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.courseId.set('course-1');
    component.role.set('Admin');
    component.students.set([activeStudent, blockedStudent]);
    component.teachers.set([teacherUser]);

    component.assignTeacher(activeStudent);

    expect(usersServiceMock.lastAssignTeacherArgs).toEqual({
      courseId: 'course-1',
      userId: 'student-1',
    });
    expect(component.students()).toEqual([blockedStudent]);
    expect(component.teachers()).toEqual([teacherUser, activeStudent]);
    expect(component.processingTeacherId()).toBe(null);
    expect(component.successMessage()).toBe('Пользователь назначен преподавателем');
  });

  it('при ошибке assignTeacher должен устанавливаться actionError', () => {
    usersServiceMock.assignTeacher = () =>
      throwError(() => new Error('assign error'));

    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.courseId.set('course-1');
    component.role.set('Admin');

    component.assignTeacher(activeStudent);

    expect(component.processingTeacherId()).toBe(null);
    expect(component.actionError()).toBe('Не удалось назначить преподавателя');
  });

  it('removeTeacher не должен вызываться если пользователь не Admin', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.role.set('Teacher');
    component.courseId.set('course-1');
    usersServiceMock.lastRemoveTeacherArgs = null;

    component.removeTeacher(teacherUser);

    expect(usersServiceMock.lastRemoveTeacherArgs).toBe(null);
  });

  it('removeTeacher должен убирать преподавателя и возвращать его в студенты', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.courseId.set('course-1');
    component.role.set('Admin');
    component.teachers.set([teacherUser]);
    component.students.set([activeStudent]);

    component.removeTeacher(teacherUser);

    expect(usersServiceMock.lastRemoveTeacherArgs).toEqual({
      courseId: 'course-1',
      userId: 'teacher-1',
    });
    expect(component.teachers()).toEqual([]);
    expect(component.students()).toEqual([
      activeStudent,
      {
        ...teacherUser,
        isBlocked: false,
      },
    ]);
    expect(component.processingTeacherId()).toBe(null);
    expect(component.successMessage()).toBe('Преподаватель снят с должности');
  });

  it('при ошибке removeTeacher должен устанавливаться actionError', () => {
    usersServiceMock.removeTeacher = () =>
      throwError(() => new Error('remove error'));

    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.courseId.set('course-1');
    component.role.set('Admin');

    component.removeTeacher(teacherUser);

    expect(component.processingTeacherId()).toBe(null);
    expect(component.actionError()).toBe('Не удалось снять преподавателя с должности');
  });

  it('toggleStudentBlock должен блокировать активного студента', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.courseId.set('course-1');
    component.role.set('Teacher');
    component.students.set([activeStudent, blockedStudent]);

    component.toggleStudentBlock(activeStudent);

    expect(usersServiceMock.lastBlockStudentArgs).toEqual({
      courseId: 'course-1',
      userId: 'student-1',
    });
    expect(component.students()).toEqual([
      { ...activeStudent, isBlocked: true },
      blockedStudent,
    ]);
    expect(component.processingStudentId()).toBe(null);
    expect(component.successMessage()).toBe('Студент заблокирован');
  });

  it('toggleStudentBlock должен разблокировать заблокированного студента', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.courseId.set('course-1');
    component.role.set('Admin');
    component.students.set([blockedStudent, activeStudent]);

    component.toggleStudentBlock(blockedStudent);

    expect(usersServiceMock.lastUnblockStudentArgs).toEqual({
      courseId: 'course-1',
      userId: 'student-2',
    });
    expect(component.students()).toEqual([
      { ...blockedStudent, isBlocked: false },
      activeStudent,
    ]);
    expect(component.processingStudentId()).toBe(null);
    expect(component.successMessage()).toBe('Студент разблокирован');
  });

  it('при ошибке toggleStudentBlock для блокировки должен устанавливаться actionError', () => {
    usersServiceMock.blockStudent = () =>
      throwError(() => new Error('block error'));

    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.courseId.set('course-1');
    component.role.set('Teacher');
    component.students.set([activeStudent]);

    component.toggleStudentBlock(activeStudent);

    expect(component.processingStudentId()).toBe(null);
    expect(component.actionError()).toBe('Не удалось заблокировать студента');
  });


  it('trackByUserId должен возвращать id пользователя', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.trackByUserId(0, activeStudent)).toBe('student-1');
  });

  it('в шаблоне должен отображаться список преподавателей и студентов', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const htmlElement = fixture.nativeElement as HTMLElement;
    const titles = Array.from(htmlElement.querySelectorAll('.users-block__title')).map((el) =>
      el.textContent?.trim(),
    );

    expect(titles).toContain('Преподаватели');
    expect(titles).toContain('Студенты');
    expect(htmlElement.textContent).toContain('Иванов Иван');
    expect(htmlElement.textContent).toContain('Петров Петр');
  });

  it('в шаблоне для Admin должна отображаться кнопка назначения преподавателем у активного студента', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    component.role.set('Admin');
    component.students.set([activeStudent]);
    component.teachers.set([]);
    fixture.detectChanges();

    const htmlElement = fixture.nativeElement as HTMLElement;
    const primaryButton = htmlElement.querySelector('.primary-btn');

    expect(primaryButton).not.toBeNull();
    expect(primaryButton?.textContent).toContain('Назначить преподавателем');
  });

  it('в шаблоне для Teacher должна отображаться кнопка блокировки/разблокировки студента', () => {
    fixture = TestBed.createComponent(CourseUsersPageComponent);
    component = fixture.componentInstance;
    component.role.set('Teacher');
    component.students.set([activeStudent]);
    component.teachers.set([]);
    fixture.detectChanges();

    const htmlElement = fixture.nativeElement as HTMLElement;
    const secondaryButton = htmlElement.querySelector('.secondary-btn');

    expect(secondaryButton).not.toBeNull();
    expect(secondaryButton?.textContent).toContain('Удалить из курса');
  });
});