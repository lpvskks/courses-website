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

import { AssignmentsService } from '../../../assignments/services/assignments.service';
import { AssignmentSubmission } from '../../../../core/models/assigment.model';

@Component({
  selector: 'app-assignment-submission-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assignment-submission-details.component.html',
  styleUrl: './assignment-submission-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentSubmissionDetailsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly assignmentsService = inject(AssignmentsService);

  courseId = signal<string | null>(null);
  assignmentId = signal<string | null>(null);
  submission = signal<AssignmentSubmission | null>(null);

  selectedGrade = signal<number | null>(null);
  isSavingGrade = signal(false);
  gradeError = signal('');
  gradeSuccess = signal('');

  readonly grades = computed(() => [0, 1, 2, 3, 4, 5]);

  ngOnInit(): void {
    const courseId = this.route.snapshot.paramMap.get('courseId');
    const assignmentId = this.route.snapshot.paramMap.get('assignmentId');

    if (!courseId || !assignmentId) {
      this.router.navigate(['/courses']);
      return;
    }

    this.courseId.set(courseId);
    this.assignmentId.set(assignmentId);

    const submission = history.state?.submission as AssignmentSubmission | undefined;

    if (!submission) {
      this.router.navigate(['/courses', courseId, 'assignments', assignmentId, 'solutions']);
      return;
    }

    this.submission.set(submission);
    this.selectedGrade.set(submission.grade);
  }

  back(): void {
    const courseId = this.courseId();
    const assignmentId = this.assignmentId();

    if (!courseId || !assignmentId) {
      this.router.navigate(['/courses']);
      return;
    }

    this.router.navigate(['/courses', courseId, 'assignments', assignmentId, 'solutions']);
  }

  canGradeSubmission(): boolean {
    return this.submission()?.status === 'Submitted';
  }

  getStudentFullName(): string {
    const submission = this.submission();
    if (!submission) return '';

    return [submission.lastName, submission.firstName, submission.middleName]
      .filter(Boolean)
      .join(' ');
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'Submitted':
        return 'Отправлено';
      case 'Reviewed':
        return 'Проверено';
      case 'Returned':
        return 'Возвращено';
      default:
        return status;
    }
  }

  selectGrade(grade: number): void {
    this.selectedGrade.set(grade);
    this.gradeError.set('');
    this.gradeSuccess.set('');
  }

  saveGrade(): void {
    const submission = this.submission();
    const selectedGrade = this.selectedGrade();

    this.gradeError.set('');
    this.gradeSuccess.set('');

    if (!submission || selectedGrade === null) {
      return;
    }

    this.isSavingGrade.set(true);

    this.assignmentsService
      .updateSubmissionGrade(submission.id, { value: selectedGrade })
      .subscribe({
        next: () => {
          this.submission.set({
            ...submission,
            grade: selectedGrade,
            status: submission.status === 'Submitted' ? 'Reviewed' : submission.status,
          });

          this.isSavingGrade.set(false);
          this.gradeSuccess.set('Оценка сохранена');
        },
        error: (err) => {
          console.error(err);
          this.isSavingGrade.set(false);
          this.gradeError.set('Не удалось сохранить оценку');
        },
      });
  }

  formatFileSize(size: number): string {
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
    return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
  }

  trackByFileId(_: number, file: AssignmentSubmission['files'][number]): string {
    return file.id;
  }

  trackByGrade(_: number, grade: number): number {
    return grade;
  }
}
