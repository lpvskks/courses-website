import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CourseAssignmentDetailsComponent } from './course-assignment-details.component';
import { Assignment } from '../../../../core/models/assigment.model';
import { AssignmentComment } from '../../../../core/models/assignment-comment.model';

describe('CourseAssignmentDetailsComponent', () => {
  let component: CourseAssignmentDetailsComponent;
  let fixture: ComponentFixture<CourseAssignmentDetailsComponent>;

  let assignmentsServiceMock: {
    getAssignmentById: (assignmentId: string) => any;
    getAssignmentComments: (assignmentId: string) => any;
    createComment: (assignmentId: string, payload: { text: string }) => any;

    lastGetAssignmentByIdArg: string | null;
    lastGetAssignmentCommentsArg: string | null;
    lastCreateCommentArgs: { assignmentId: string; payload: { text: string } } | null;
  };

  let routerMock: {
    navigate: (commands: any[]) => void;
    lastNavigateArgs: any[] | null;
  };

  const assignmentResponse: Assignment = {
    id: 'assignment-1',
    courseId: 'course-1',
    title: 'Задание по Angular',
    text: 'Реализовать страницу деталей задания и комментарии.',
    requiresSubmission: true,
    deadline: '2026-03-20T10:00:00Z',
    created: '2026-03-10T09:00:00Z',
    files: [
      {
        id: 'file-1',
        fileName: 'requirements.pdf',
        url: 'https://example.com/requirements.pdf',
        mimeType: 'application/pdf',
        size: 2048,
      },
    ],
  };

  const commentsResponse: AssignmentComment[] = [
    {
      id: 'comment-1',
      assignmentId: 'assignment-1',
      userId: 'user-1',
      userName: 'Иван Иванов',
      text: 'Подскажите, нужен ли отдельный сервис?',
      created: '2026-03-13T17:38:19.414Z',
    },
    {
      id: 'comment-2',
      assignmentId: 'assignment-1',
      userId: 'user-2',
      userName: 'Анна Петрова',
      text: 'Да, лучше вынести API в сервис.',
      created: '2026-03-13T18:00:00.000Z',
    },
  ];

  beforeEach(async () => {
    localStorage.setItem('user_role', 'Admin');

    assignmentsServiceMock = {
      lastGetAssignmentByIdArg: null,
      lastGetAssignmentCommentsArg: null,
      lastCreateCommentArgs: null,

      getAssignmentById: (assignmentId: string) => {
        assignmentsServiceMock.lastGetAssignmentByIdArg = assignmentId;
        return of(assignmentResponse);
      },

      getAssignmentComments: (assignmentId: string) => {
        assignmentsServiceMock.lastGetAssignmentCommentsArg = assignmentId;
        return of(commentsResponse);
      },

      createComment: (assignmentId: string, payload: { text: string }) => {
        assignmentsServiceMock.lastCreateCommentArgs = { assignmentId, payload };
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
      imports: [CourseAssignmentDetailsComponent],
      providers: [
        { provide: AssignmentsService, useValue: assignmentsServiceMock },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(
              convertToParamMap({
                courseId: 'course-1',
                assignmentId: 'assignment-1',
              }),
            ),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem('user_role');
  });

  it('если в route есть courseId и assignmentId, то компонент должен загрузить данные задания и комментарии', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.courseId()).toBe('course-1');
    expect(component.assignmentId()).toBe('assignment-1');
    expect(assignmentsServiceMock.lastGetAssignmentByIdArg).toBe('assignment-1');
    expect(assignmentsServiceMock.lastGetAssignmentCommentsArg).toBe('assignment-1');
    expect(component.assignment()).toEqual(assignmentResponse);
    expect(component.comments()).toEqual(commentsResponse);
    expect(component.isLoading()).toBe(false);
    expect(component.isCommentsLoading()).toBe(false);
  });

  it('если loadPageData выполняется успешно, то должны установиться задание, комментарии и флаги завершения загрузки', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.assignment.set(null);
    component.comments.set([]);

    component.loadPageData('assignment-55');

    expect(assignmentsServiceMock.lastGetAssignmentByIdArg).toBe('assignment-55');
    expect(assignmentsServiceMock.lastGetAssignmentCommentsArg).toBe('assignment-55');
    expect(component.assignment()).toEqual(assignmentResponse);
    expect(component.comments()).toEqual(commentsResponse);
    expect(component.loadError()).toBe('');
    expect(component.commentsError()).toBe('');
    expect(component.submitError()).toBe('');
    expect(component.submitSuccess()).toBe('');
    expect(component.isLoading()).toBe(false);
    expect(component.isCommentsLoading()).toBe(false);
  });

  it('если при loadPageData происходит ошибка, то должен устанавливаться текст ошибки загрузки задания', () => {
    assignmentsServiceMock.getAssignmentById = () =>
      throwError(() => new Error('assignment load error'));

    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.loadPageData('assignment-1');

    expect(component.loadError()).toBe('Не удалось загрузить задание');
    expect(component.isLoading()).toBe(false);
    expect(component.isCommentsLoading()).toBe(false);
  });

  it('если refreshCommentsAfterSubmit выполняется успешно, то список комментариев должен обновиться', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const updatedComments: AssignmentComment[] = [
      ...commentsResponse,
      {
        id: 'comment-3',
        assignmentId: 'assignment-1',
        userId: 'user-3',
        userName: 'Петр Сидоров',
        text: 'Новый комментарий',
        created: '2026-03-14T10:00:00.000Z',
      },
    ];

    assignmentsServiceMock.getAssignmentComments = (assignmentId: string) => {
      assignmentsServiceMock.lastGetAssignmentCommentsArg = assignmentId;
      return of(updatedComments);
    };

    component.isSendingComment.set(true);
    component.comments.set(commentsResponse);

    component.refreshCommentsAfterSubmit('assignment-1');

    expect(assignmentsServiceMock.lastGetAssignmentCommentsArg).toBe('assignment-1');
    expect(component.comments()).toEqual(updatedComments);
    expect(component.isSendingComment()).toBe(false);
  });

  it('если форма комментария невалидна, то sendComment не должен отправлять запрос на создание комментария', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.assignmentId.set('assignment-1');
    component.commentForm.controls.text.setValue('');

    assignmentsServiceMock.lastCreateCommentArgs = null;

    component.sendComment();

    expect(assignmentsServiceMock.lastCreateCommentArgs).toBe(null);
  });

  it('если assignmentId отсутствует, то sendComment не должен отправлять запрос на создание комментария', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.assignmentId.set(null);
    component.commentForm.controls.text.setValue('Новый комментарий');
    assignmentsServiceMock.lastCreateCommentArgs = null;

    component.sendComment();

    expect(assignmentsServiceMock.lastCreateCommentArgs).toBe(null);
  });

  it('если sendComment выполняется успешно, то комментарий должен отправляться и список комментариев должен обновляться повторным запросом', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const refreshedComments: AssignmentComment[] = [
      {
        id: 'comment-3',
        assignmentId: 'assignment-1',
        userId: 'user-3',
        userName: 'Мария',
        text: 'Свежий комментарий',
        created: '2026-03-14T12:00:00.000Z',
      },
      ...commentsResponse,
    ];

    assignmentsServiceMock.getAssignmentComments = (assignmentId: string) => {
      assignmentsServiceMock.lastGetAssignmentCommentsArg = assignmentId;
      return of(refreshedComments);
    };

    component.assignmentId.set('assignment-1');
    component.commentForm.controls.text.setValue('  Свежий комментарий  ');

    component.sendComment();

    expect(assignmentsServiceMock.lastCreateCommentArgs).toEqual({
      assignmentId: 'assignment-1',
      payload: { text: 'Свежий комментарий' },
    });
    expect(assignmentsServiceMock.lastGetAssignmentCommentsArg).toBe('assignment-1');
    expect(component.comments()).toEqual(refreshedComments);
    expect(component.commentForm.controls.text.value).toBe('');
    expect(component.isSendingComment()).toBe(false);
    expect(component.submitSuccess()).toBe('Комментарий отправлен');
  });

  it('если при sendComment происходит ошибка, то должен устанавливаться текст ошибки отправки комментария', () => {
    assignmentsServiceMock.createComment = () =>
      throwError(() => new Error('create comment error'));

    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.assignmentId.set('assignment-1');
    component.commentForm.controls.text.setValue('Текст комментария');

    component.sendComment();

    expect(component.isSendingComment()).toBe(false);
    expect(component.submitError()).toBe('Не удалось отправить комментарий');
  });


  it('если вызывается formatFileSize для байтов, килобайтов и мегабайтов, то размер должен форматироваться корректно', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.formatFileSize(500)).toBe('500 Б');
    expect(component.formatFileSize(2048)).toBe('2.0 КБ');
    expect(component.formatFileSize(3 * 1024 * 1024)).toBe('3.0 МБ');
  });

  it('если вызывается trackByCommentId, то должен возвращаться id комментария', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.trackByCommentId(0, commentsResponse[0])).toBe('comment-1');
  });

  it('если вызывается trackByFileId, то должен возвращаться id файла', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.trackByFileId(0, assignmentResponse.files[0])).toBe('file-1');
  });

  it('если задание и комментарии успешно загружены, то в шаблоне должны отображаться заголовок задания и список комментариев', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const htmlElement = fixture.nativeElement as HTMLElement;

    expect(htmlElement.textContent).toContain('Задание по Angular');
    expect(htmlElement.textContent).toContain('Комментарии');
    expect(htmlElement.textContent).toContain('Иван Иванов');
    expect(htmlElement.textContent).toContain('Подскажите, нужен ли отдельный сервис?');
  });

  it('если у задания есть файлы, то в шаблоне должен отображаться блок файлов', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const htmlElement = fixture.nativeElement as HTMLElement;
    const fileCard = htmlElement.querySelector('.file-card');

    expect(htmlElement.textContent).toContain('Файлы задания');
    expect(fileCard).not.toBeNull();
    expect(htmlElement.textContent).toContain('requirements.pdf');
  });

  it('если у задания нет файлов, то блок файлов в шаблоне отображаться не должен', () => {
    fixture = TestBed.createComponent(CourseAssignmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.assignment.set({
      ...assignmentResponse,
      files: [],
    });
    fixture.detectChanges();

    const htmlElement = fixture.nativeElement as HTMLElement;
    const filesSection = htmlElement.querySelector('.assignment-files');

    expect(filesSection).toBeNull();
    expect(htmlElement.textContent).not.toContain('Файлы задания');
  });
});