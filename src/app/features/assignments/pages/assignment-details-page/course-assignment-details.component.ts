import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
import { forkJoin } from 'rxjs';

import { Assignment } from '../../../../core/models/assigment.model';
import { AssignmentComment } from '../../../../core/models/assignment-comment.model';
import {
  AssignmentCaptainInfo,
  AssignmentsService,
} from '../../../assignments/services/assignments.service';

@Component({
  selector: 'app-course-assignment-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './course-assignment-details.component.html',
  styleUrl: './course-assignment-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseAssignmentDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly assignmentsService = inject(AssignmentsService);

  readonly role = signal(localStorage.getItem('user_role'));
  readonly isAdmin = computed(() => this.role() === 'Admin');
  readonly isTeacher = computed(() => this.role() === 'Teacher');
  readonly isStudent = computed(() => this.role() === 'Student');

  courseId = signal<string | null>(null);
  assignmentId = signal<string | null>(null);

  assignment = signal<Assignment | null>(null);
  comments = signal<AssignmentComment[]>([]);
  captainInfo = signal<AssignmentCaptainInfo | null>(null);

  isLoading = signal(true);
  isCommentsLoading = signal(true);
  isSendingComment = signal(false);
  isCaptainInfoLoading = signal(false);
  isCaptainActionLoading = signal(false);

  loadError = signal('');
  commentsError = signal('');
  submitError = signal('');
  submitSuccess = signal('');
  captainActionError = signal('');
  captainActionSuccess = signal('');
  unavailableAssignmentNotice = signal('');

  readonly commentForm = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(1000)]],
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe({
      next: (params) => {
        const courseId = params.get('courseId');
        const assignmentId = params.get('assignmentId');

        if (!courseId || !assignmentId) {
          this.router.navigate(['/courses']);
          return;
        }

        this.courseId.set(courseId);
        this.assignmentId.set(assignmentId);
        this.loadPageData(assignmentId);
      },
    });
  }

  loadPageData(assignmentId: string): void {
    this.isLoading.set(true);
    this.isCommentsLoading.set(true);
    this.loadError.set('');
    this.commentsError.set('');
    this.submitError.set('');
    this.submitSuccess.set('');
    this.captainInfo.set(null);
    this.captainActionError.set('');
    this.captainActionSuccess.set('');
    this.unavailableAssignmentNotice.set('');

    forkJoin({
      assignment: this.assignmentsService.getAssignmentById(assignmentId),
      comments: this.assignmentsService.getAssignmentComments(assignmentId),
    }).subscribe({
      next: ({ assignment, comments }) => {
        this.assignment.set(assignment);
        this.comments.set(comments);
        this.isLoading.set(false);
        this.isCommentsLoading.set(false);
        this.loadCaptainInfoIfAvailable(assignment);
      },
      error: (err) => {
        console.error(err);

        if (this.handleUnavailableAssignment(err)) {
          return;
        }

        this.loadError.set('Не удалось загрузить задание');
        this.isLoading.set(false);
        this.isCommentsLoading.set(false);
      },
    });
  }

  handleUnavailableAssignment(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse) || err.status !== 403) {
      return false;
    }

    const fallbackAssignment = history.state?.assignment as Assignment | undefined;

    if (!fallbackAssignment) {
      this.unavailableAssignmentNotice.set('Задание пока недоступно');
      this.isLoading.set(false);
      this.isCommentsLoading.set(false);
      return true;
    }

    this.assignment.set(fallbackAssignment);
    this.comments.set([]);
    this.isLoading.set(false);
    this.isCommentsLoading.set(false);
    this.unavailableAssignmentNotice.set(
      'Задание пока недоступно. Сейчас идет выбор капитанов, и вы можете подать заявку.',
    );
    this.loadCaptainInfoIfAvailable(fallbackAssignment);

    return true;
  }

  loadCaptainInfoIfAvailable(assignment: Assignment): void {
    if (!this.shouldShowCaptainControls(assignment)) {
      this.captainInfo.set(null);
      return;
    }

    this.loadCaptainInfo(assignment.id);
  }

  loadCaptainInfo(assignmentId: string): void {
    this.isCaptainInfoLoading.set(true);
    this.captainActionError.set('');

    this.assignmentsService.getMyCaptainInfo(assignmentId).subscribe({
      next: (captainInfo) => {
        this.captainInfo.set(captainInfo);
        this.isCaptainInfoLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.captainInfo.set(null);
        this.isCaptainInfoLoading.set(false);
        this.captainActionError.set('Не удалось загрузить статус капитана');
      },
    });
  }

  shouldShowCaptainControls(assignment: Assignment): boolean {
    return this.isStudent() && this.isTeamFormationOpen(assignment);
  }

  isTeamFormationOpen(assignment: Assignment): boolean {
    if (!assignment.teamFormationEndsAtUtc) {
      return false;
    }

    return new Date().getTime() < new Date(assignment.teamFormationEndsAtUtc).getTime();
  }

  toggleCaptainRole(): void {
    const assignment = this.assignment();
    const captainInfo = this.captainInfo();

    if (!assignment || !captainInfo || this.isCaptainActionLoading()) {
      return;
    }

    this.captainActionError.set('');
    this.captainActionSuccess.set('');
    this.isCaptainActionLoading.set(true);

    const request$ = captainInfo.isCaptain
      ? this.assignmentsService.removeMyselfCaptain(assignment.id)
      : this.assignmentsService.assignMyselfCaptain(assignment.id);

    request$.subscribe({
      next: () => {
        this.captainActionSuccess.set(
          captainInfo.isCaptain
            ? 'Вы сняли себя с роли капитана'
            : 'Вы назначили себя капитаном',
        );
        this.isCaptainActionLoading.set(false);
        this.loadCaptainInfo(assignment.id);
      },
      error: (err) => {
        console.error(err);
        this.captainActionError.set(
          captainInfo.isCaptain
            ? 'Не удалось снять себя с роли капитана'
            : 'Не удалось назначить себя капитаном',
        );
        this.isCaptainActionLoading.set(false);
      },
    });
  }

  refreshCommentsAfterSubmit(assignmentId: string): void {
    this.commentsError.set('');

    this.assignmentsService.getAssignmentComments(assignmentId).subscribe({
      next: (comments) => {
        this.comments.set(comments);
        this.isSendingComment.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isSendingComment.set(false);
        this.submitError.set(
          'Комментарий отправлен, но не удалось обновить комментарии',
        );
      },
    });
  }

  sendComment(): void {
    this.commentForm.markAllAsTouched();
    this.submitError.set('');
    this.submitSuccess.set('');

    if (this.commentForm.invalid) {
      return;
    }

    const assignmentId = this.assignmentId();
    if (!assignmentId) {
      return;
    }

    const text = this.commentForm.controls.text.getRawValue().trim();

    if (!text) {
      this.commentForm.controls.text.setErrors({ required: true });
      return;
    }

    this.isSendingComment.set(true);

    this.assignmentsService.createComment(assignmentId, { text }).subscribe({
      next: () => {
        this.commentForm.reset();
        this.submitSuccess.set('Комментарий отправлен');
        this.refreshCommentsAfterSubmit(assignmentId);
      },
      error: (err) => {
        console.error(err);
        this.isSendingComment.set(false);
        this.submitError.set('Не удалось отправить комментарий');
      },
    });
  }

  openSolutions(): void {
    const courseId = this.courseId();
    const assignmentId = this.assignmentId();

    if (!courseId || !assignmentId) {
      return;
    }

    this.router.navigate(['/courses', courseId, 'assignments', assignmentId, 'solutions']);
  }

  back(): void {
    const courseId = this.courseId();
    if (!courseId) {
      this.router.navigate(['/courses']);
      return;
    }

    this.router.navigate(['/courses', courseId]);
  }

  formatFileSize(size: number): string {
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
    return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
  }

  trackByCommentId(_: number, comment: AssignmentComment): string {
    return comment.id;
  }

  trackByFileId(_: number, file: Assignment['files'][number]): string {
    return file.id;
  }
}
