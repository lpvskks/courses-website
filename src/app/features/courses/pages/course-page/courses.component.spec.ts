import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';

import { CoursesComponent } from './courses.component';
import { Course, CoursesService } from '../../services/courses.service';

describe('CoursesComponent', () => {
  let component: CoursesComponent;
  let fixture: ComponentFixture<CoursesComponent>;

  let coursesServiceMock: {
    getCourses: () => any;
    getMyCourses: () => any;
    getCoursesCalled: boolean;
    getMyCoursesCalled: boolean;
  };

  const coursesResponse: Course[] = [
    {
      id: '1',
      name: 'Angular',
      description: 'Frontend framework',
      code: 'ANG-001',
      isActive: true,
    },
    {
      id: '2',
      name: 'ASP.NET Core',
      description: 'Backend framework',
      code: 'ASP-001',
      isActive: false,
    },
    {
      id: '3',
      name: 'TypeScript',
      description: 'Programming language',
      code: 'TS-001',
      isActive: true,
    },
  ];

  beforeEach(async () => {
    coursesServiceMock = {
      getCoursesCalled: false,
      getMyCoursesCalled: false,

      getCourses: () => {
        coursesServiceMock.getCoursesCalled = true;
        return of(coursesResponse);
      },

      getMyCourses: () => {
        coursesServiceMock.getMyCoursesCalled = true;
        return of(coursesResponse);
      },
    };

    await TestBed.configureTestingModule({
      imports: [CoursesComponent],
      providers: [
        provideRouter([]),
        { provide: CoursesService, useValue: coursesServiceMock },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem('user_role');
  });

  it('если роль Admin, должен вызываться запрос на получение всех курсов', () => {
    localStorage.setItem('user_role', 'Admin');

    fixture = TestBed.createComponent(CoursesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(coursesServiceMock.getCoursesCalled).toBe(true);
    expect(coursesServiceMock.getMyCoursesCalled).toBe(false);
  });

  it('если роль Teacher, должен вызываться запрос на получение своих курсов', () => {
    localStorage.setItem('user_role', 'Teacher');

    fixture = TestBed.createComponent(CoursesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(coursesServiceMock.getCoursesCalled).toBe(false);
    expect(coursesServiceMock.getMyCoursesCalled).toBe(true);
  });

  it('если роль Student, запросы на получение курсов не должны вызываться', () => {
    localStorage.setItem('user_role', 'Student');

    fixture = TestBed.createComponent(CoursesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(coursesServiceMock.getCoursesCalled).toBe(false);
    expect(coursesServiceMock.getMyCoursesCalled).toBe(false);
    expect(component.courses()).toEqual([]);
    expect(component.isLoading()).toBe(false);
  });

  it('если роль Admin, после загрузки должны сохраниться полученные курсы', () => {
    localStorage.setItem('user_role', 'Admin');

    fixture = TestBed.createComponent(CoursesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.courses()).toEqual(coursesResponse);
    expect(component.isLoading()).toBe(false);
  });

  it('должен корректно вычислять activeCourses', () => {
    localStorage.setItem('user_role', 'Admin');

    fixture = TestBed.createComponent(CoursesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.activeCourses()).toEqual([
      {
        id: '1',
        name: 'Angular',
        description: 'Frontend framework',
        code: 'ANG-001',
        isActive: true,
      },
      {
        id: '3',
        name: 'TypeScript',
        description: 'Programming language',
        code: 'TS-001',
        isActive: true,
      },
    ]);
  });

  it('должен корректно вычислять inactiveCourses', () => {
    localStorage.setItem('user_role', 'Admin');

    fixture = TestBed.createComponent(CoursesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.inactiveCourses()).toEqual([
      {
        id: '2',
        name: 'ASP.NET Core',
        description: 'Backend framework',
        code: 'ASP-001',
        isActive: false,
      },
    ]);
  });

  it('если роль отсутствует, запросы на получение курсов не должны вызываться', () => {
    localStorage.removeItem('user_role');

    fixture = TestBed.createComponent(CoursesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(coursesServiceMock.getCoursesCalled).toBe(false);
    expect(coursesServiceMock.getMyCoursesCalled).toBe(false);
    expect(component.courses()).toEqual([]);
    expect(component.isLoading()).toBe(false);
  });
});