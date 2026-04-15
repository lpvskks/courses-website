import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AssignmentsService } from '../../../assignments/services/assignments.service';
import { AssignmentSubmission } from '../../../../core/models/assigment.model';

@Component({
  selector: 'app-assignment-submission-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './assignment-submission-details.component.html',
  styleUrl: './assignment-submission-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentSubmissionDetailsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly assignmentsService = inject(AssignmentsService);
  private readonly fb = inject(FormBuilder);

  courseId = signal<string | null>(null);
  assignmentId = signal<string | null>(null);
  submission = signal<AssignmentSubmission | null>(null);

  isLoading = signal(false);
  isSavingGrade = signal(false);
  isDeletingGrade = signal(false);
  loadError = signal('');
  gradeError = signal('');
  gradeSuccess = signal('');

  readonly gradeForm = this.fb.nonNullable.group({
    value: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    comment: ['', [Validators.maxLength(1000)]],
  });
  readonly grades = [0, 1, 2, 3, 4, 5];

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
      const submissionId = this.route.snapshot.paramMap.get('submissionId');

      if (!submissionId) {
        this.router.navigate(['/courses', courseId, 'assignments', assignmentId, 'solutions']);
        return;
      }

      this.loadSubmission(assignmentId, submissionId);
      return;
    }

    this.setSubmission(submission);
  }

  loadSubmission(assignmentId: string, submissionId: string): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.assignmentsService.getAssignmentSubmissionById(assignmentId, submissionId).subscribe({
      next: (submission) => {
        this.setSubmission(submission);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loadError.set('Не удалось загрузить решение');
        this.isLoading.set(false);
      },
    });
  }

  setSubmission(submission: AssignmentSubmission): void {
    this.submission.set(submission);
    this.gradeForm.patchValue({
      value: submission.grade ?? 0,
      comment: submission.teacherComment ?? '',
    });
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
    return true;
  }

  getStudentFullName(): string {
    const submission = this.submission();
    if (!submission) return '';

    return [submission.lastName, submission.firstName, submission.middleName]
      .filter(Boolean)
      .join(' ');
  }

  getStatusLabel(status: AssignmentSubmission['status']): string {
    switch (status) {
      case 'Submitted':
      case 1:
        return 'Отправлено';
      case 'Reviewed':
      case 2:
        return 'Проверено';
      case 'Returned':
      case 3:
        return 'Возвращено';
      default:
        return String(status);
    }
  }

  saveGrade(): void {
    const submission = this.submission();

    this.gradeError.set('');
    this.gradeSuccess.set('');
    this.gradeForm.markAllAsTouched();

    if (!submission || this.gradeForm.invalid) {
      return;
    }

    const value = this.gradeForm.controls.value.getRawValue();
    const comment = this.gradeForm.controls.comment.getRawValue().trim() || null;

    this.isSavingGrade.set(true);

    this.assignmentsService
      .updateSubmissionGrade(submission.id, { value, comment })
      .subscribe({
        next: (grade) => {
          this.submission.set({
            ...submission,
            grade: grade.grade,
            teacherComment: grade.teacherComment,
            gradedByTeacherId: grade.gradedByTeacherId,
            gradedAtUtc: grade.gradedAtUtc,
            status: submission.status === 'Submitted' || submission.status === 1 ? 'Reviewed' : submission.status,
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

  selectGrade(grade: number): void {
    this.gradeForm.controls.value.setValue(grade);
    this.gradeForm.controls.value.markAsTouched();
    this.gradeError.set('');
    this.gradeSuccess.set('');
  }

  deleteGrade(): void {
    const submission = this.submission();

    this.gradeError.set('');
    this.gradeSuccess.set('');

    if (!submission || submission.grade === null || this.isDeletingGrade()) {
      return;
    }

    this.isDeletingGrade.set(true);

    this.assignmentsService.deleteSubmissionGrade(submission.id).subscribe({
      next: () => {
        this.submission.set({
          ...submission,
          grade: null,
          teacherComment: null,
          gradedByTeacherId: null,
          gradedAtUtc: null,
        });
        this.gradeForm.patchValue({ value: 0, comment: '' });
        this.isDeletingGrade.set(false);
        this.gradeSuccess.set('Оценка удалена');
      },
      error: (err) => {
        console.error(err);
        this.isDeletingGrade.set(false);
        this.gradeError.set('Не удалось удалить оценку');
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

  getGradeError(): string {
    const control = this.gradeForm.controls.value;

    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите оценку';
    if (control.errors['min']) return 'Оценка не может быть меньше 0';
    if (control.errors['max']) return 'Оценка не может быть больше 100';
    return '';
  }
}

