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
  selector: 'app-assignment-solutions-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assignment-solutions-page.component.html',
  styleUrl: './assignment-solutions-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentSolutionsPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly assignmentsService = inject(AssignmentsService);

  courseId = signal<string | null>(null);
  assignmentId = signal<string | null>(null);

  submissions = signal<AssignmentSubmission[]>([]);
  isLoading = signal(true);
  loadError = signal('');

  readonly sortedSubmissions = computed(() =>
    [...this.submissions()].sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
    ),
  );

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
        this.loadSubmissions(assignmentId);
      },
    });
  }

  loadSubmissions(assignmentId: string): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.assignmentsService.getAssignmentSubmissions(assignmentId).subscribe({
      next: (submissions) => {
        this.submissions.set(submissions);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loadError.set('Не удалось загрузить решения студентов');
        this.isLoading.set(false);
      },
    });
  }

  openSubmission(submission: AssignmentSubmission): void {
    const courseId = this.courseId();
    const assignmentId = this.assignmentId();

    if (!courseId || !assignmentId) {
      return;
    }

    this.router.navigate(
      ['/courses', courseId, 'assignments', assignmentId, 'solutions', submission.id],
      {
        state: { submission },
      },
    );
  }

  back(): void {
    const courseId = this.courseId();
    const assignmentId = this.assignmentId();

    if (!courseId || !assignmentId) {
      this.router.navigate(['/courses']);
      return;
    }

    this.router.navigate(['/courses', courseId, 'assignments', assignmentId]);
  }

  getStudentFullName(submission: AssignmentSubmission): string {
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

  getInitials(submission: AssignmentSubmission): string {
    return `${submission.firstName?.[0] ?? ''}${submission.lastName?.[0] ?? ''}` || '?';
  }

  trackBySubmissionId(_: number, submission: AssignmentSubmission): string {
    return submission.id;
  }
}
