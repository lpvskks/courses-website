import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CourseDetailsComponent } from './course-details.component';
import { Course, CoursesService } from '../../services/courses.service';

describe('CourseDetailsComponent', () => {
  let component: CourseDetailsComponent;
  let fixture: ComponentFixture<CourseDetailsComponent>;

  let coursesServiceMock: {
    getCourseById: (courseId: string) => any;
    getCourseAssignments: (courseId: string, page: number, pageSize: number) => any;
    updateCourse: (courseId: string, payload: { name: string; description: string }) => any;

    lastGetCourseByIdArg: string | null;
    lastGetAssignmentsArgs: { courseId: string; page: number; pageSize: number } | null;
  };

  let routerMock: {
    navigate: (commands: any[]) => void;
    lastNavigateArgs: any[] | null;
  };

  const courseResponse: Course = {
    id: 'course-1',
    name: 'Angular',
    description: 'Frontend framework',
    code: 'ANG-001',
    isActive: true,
  };

  const assignmentsResponse: Assignment[] = [
    {
      id: 'a1',
      title: 'Задание 1',
      text: 'Описание задания 1',
      requiresSubmission: true,
      deadline: '2026-03-20T10:00:00Z',
      created: '2026-03-10T10:00:00Z',
    },
    {
      id: 'a2',
      title: 'Задание 2',
      text: 'Описание задания 2',
      requiresSubmission: false,
      deadline: '2026-03-21T12:00:00Z',
      created: '2026-03-11T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    localStorage.setItem('user_role', 'Admin');

    coursesServiceMock = {
      lastGetCourseByIdArg: null,
      lastGetAssignmentsArgs: null,

      getCourseById: (courseId: string) => {
        coursesServiceMock.lastGetCourseByIdArg = courseId;
        return of(courseResponse);
      },

      getCourseAssignments: (courseId: string, page: number, pageSize: number) => {
        coursesServiceMock.lastGetAssignmentsArgs = { courseId, page, pageSize };
        return of({
          items: assignmentsResponse,
          totalCount: 8,
        });
      },

      updateCourse: () => of(null),
    };

    routerMock = {
      lastNavigateArgs: null,
      navigate: (commands: any[]) => {
        routerMock.lastNavigateArgs = commands;
      },
    };

    await TestBed.configureTestingModule({
      imports: [CourseDetailsComponent],
      providers: [
        { provide: CoursesService, useValue: coursesServiceMock },
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

  it('при ошибке загрузки курса должен устанавливаться текст баннера ошибки', () => {
    coursesServiceMock.getCourseById = () =>
      throwError(() => new Error('load course error'));

    fixture = TestBed.createComponent(CourseDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loadError()).toBe('Не удалось загрузить курс');
    expect(component.isCourseLoading()).toBe(false);
  });

  it('при ошибке загрузки курса в шаблоне должен отображаться error-banner', () => {
    coursesServiceMock.getCourseById = () =>
      throwError(() => new Error('load course error'));

    fixture = TestBed.createComponent(CourseDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const htmlElement = fixture.nativeElement as HTMLElement;
    const banner = htmlElement.querySelector('.error-banner');

    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Не удалось загрузить курс');
  });

  it('при успешной загрузке заданий должны сохраняться список, номер страницы и totalPages', () => {
    fixture = TestBed.createComponent(CourseDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.loadAssignments('course-1', 2);

    expect(component.assignments()).toEqual(assignmentsResponse);
    expect(component.currentPage()).toBe(2);
    expect(component.totalCount()).toBe(8);
    expect(component.totalPages()).toBe(2);
    expect(component.isAssignmentsLoading()).toBe(false);
  });

  it('при ошибке загрузки заданий список должен очищаться и пагинация должна сбрасываться', () => {
    coursesServiceMock.getCourseAssignments = () =>
      throwError(() => new Error('assignments error'));

    fixture = TestBed.createComponent(CourseDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.assignments.set(assignmentsResponse);
    component.totalCount.set(10);
    component.totalPages.set(5);

    component.loadAssignments('course-1', 1);

    expect(component.assignments()).toEqual([]);
    expect(component.totalCount()).toBe(0);
    expect(component.totalPages()).toBe(1);
    expect(component.isAssignmentsLoading()).toBe(false);
  });

  it('goToNextPage должен запрашивать следующую страницу заданий', () => {
    fixture = TestBed.createComponent(CourseDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.course.set(courseResponse);
    component.currentPage.set(1);
    component.totalPages.set(3);
    coursesServiceMock.lastGetAssignmentsArgs = null;

    component.goToNextPage();

    expect(coursesServiceMock.lastGetAssignmentsArgs).toEqual({
      courseId: 'course-1',
      page: 2,
      pageSize: 6,
    });
  });

  it('goToNextPage не должен запрашивать следующую страницу, если текущая страница последняя', () => {
    fixture = TestBed.createComponent(CourseDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.course.set(courseResponse);
    component.currentPage.set(3);
    component.totalPages.set(3);
    coursesServiceMock.lastGetAssignmentsArgs = null;

    component.goToNextPage();

    expect(coursesServiceMock.lastGetAssignmentsArgs).toBe(null);
  });

  it('openCourseUsers должен переводить на страницу пользователей курса', () => {
    fixture = TestBed.createComponent(CourseDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.course.set(courseResponse);

    component.openCourseUsers();

    expect(routerMock.lastNavigateArgs).toEqual(['/courses', 'course-1', 'users']);
  });
});