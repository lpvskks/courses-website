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
import {
  ChoiceCriterionSettings,
  Criterion,
  CriterionOption,
  CriterionType,
  GradePenaltyInput,
  SaveSubmissionAssessmentRequest,
  ScoreCriterionSettings,
  SubmissionAssessment,
  SubmissionAssessmentForm,
} from '../../../../core/models/grading.model';

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
  isAssessmentFormLoading = signal(false);
  isSavingAssessment = signal(false);
  loadError = signal('');
  gradeError = signal('');
  gradeSuccess = signal('');
  assessmentError = signal('');
  assessmentSuccess = signal('');
  assessmentForm = signal<SubmissionAssessmentForm | null>(null);
  savedAssessment = signal<SubmissionAssessment | null>(null);
  criterionValues = signal<Record<string, unknown>>({});
  assessmentPenalties = signal<GradePenaltyInput>({
    deadline: false,
    progress: false,
    requiredCriteria: false,
  });

  readonly gradeForm = this.fb.nonNullable.group({
    value: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    comment: ['', [Validators.maxLength(1000)]],
  });
  readonly assessmentCommentForm = this.fb.nonNullable.group({
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
    this.loadAssessmentForm(submission.id);
  }

  loadAssessmentForm(submissionId: string): void {
    this.isAssessmentFormLoading.set(true);
    this.assessmentError.set('');
    this.assessmentSuccess.set('');

    this.assignmentsService.getSubmissionAssessmentForm(submissionId).subscribe({
      next: (form) => {
        this.assessmentForm.set(form);
        this.savedAssessment.set(form.savedAssessment ?? null);
        this.initializeAssessmentState(form);
        this.isAssessmentFormLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.assessmentError.set('Не удалось загрузить форму проверки по критериям');
        this.isAssessmentFormLoading.set(false);
      },
    });
  }

  initializeAssessmentState(form: SubmissionAssessmentForm): void {
    const values: Record<string, unknown> = {};

    form.groups.forEach((group) => {
      group.criteria.forEach((criterion) => {
        values[criterion.id] = this.getDefaultCriterionValue(criterion);
      });
    });

    this.extractSavedCriterionValues(form.savedAssessment).forEach((value) => {
      values[value.criterionId] = value.value;
    });

    this.criterionValues.set(values);
    this.assessmentPenalties.set(this.extractSavedPenalties(form.savedAssessment));
    this.assessmentCommentForm.patchValue({
      comment: form.savedAssessment?.comment ?? this.submission()?.teacherComment ?? '',
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

  hasAssessmentCriteria(): boolean {
    const form = this.assessmentForm();
    return Boolean(form?.groups.some((group) => group.criteria.length > 0));
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

  saveAssessment(): void {
    const submission = this.submission();
    const form = this.assessmentForm();

    this.assessmentError.set('');
    this.assessmentSuccess.set('');
    this.assessmentCommentForm.markAllAsTouched();

    if (!submission || !form || this.assessmentCommentForm.invalid) {
      return;
    }

    const values = form.groups.flatMap((group) =>
      group.criteria.map((criterion) => ({
        criterionId: criterion.id,
        value: this.criterionValues()[criterion.id] ?? this.getDefaultCriterionValue(criterion),
      })),
    );
    const payload: SaveSubmissionAssessmentRequest = {
      values,
      penalties: this.assessmentPenalties(),
      comment: this.assessmentCommentForm.controls.comment.getRawValue().trim() || null,
    };

    this.isSavingAssessment.set(true);

    this.assignmentsService.saveSubmissionAssessment(submission.id, payload).subscribe({
      next: (assessment) => {
        this.savedAssessment.set(assessment);
        this.submission.set({
          ...submission,
          grade: assessment.finalGrade,
          teacherComment: assessment.comment ?? null,
          gradedByTeacherId: assessment.checkedByUserId,
          gradedAtUtc: assessment.checkedAtUtc,
          status: submission.status === 'Submitted' || submission.status === 1 ? 'Reviewed' : submission.status,
        });
        this.isSavingAssessment.set(false);
        this.assessmentSuccess.set('Проверка сохранена');
      },
      error: (err) => {
        console.error(err);
        this.isSavingAssessment.set(false);
        this.assessmentError.set('Не удалось сохранить проверку');
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

  trackByAssessmentGroupId(_: number, group: SubmissionAssessmentForm['groups'][number]): string {
    return group.id;
  }

  trackByCriterionId(_: number, criterion: Criterion): string {
    return criterion.id;
  }

  trackByCriterionOptionValue(_: number, option: CriterionOption): string {
    return option.value;
  }

  getGradeError(): string {
    const control = this.gradeForm.controls.value;

    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите оценку';
    if (control.errors['min']) return 'Оценка не может быть меньше 0';
    if (control.errors['max']) return 'Оценка не может быть больше 100';
    return '';
  }

  getAssessmentCommentError(): string {
    const control = this.assessmentCommentForm.controls.comment;

    if (!control.touched || !control.errors) return '';
    if (control.errors['maxlength']) return 'Комментарий не должен быть длиннее 1000 символов';
    return '';
  }

  getCriterionTypeLabel(type: Criterion['type']): string {
    switch (type) {
      case 'score':
        return 'Диапазон';
      case 'pass_fail':
        return 'Чекбокс';
      case 'option':
        return 'Выбор';
      case 'multiplier':
        return 'Множитель';
      default:
        return String(type);
    }
  }

  getCriterionCategoryLabel(category: Criterion['category']): string {
    switch (category) {
      case 'main':
        return 'Основной';
      case 'bonus':
        return 'Бонус';
      case 'penalty':
        return 'Штраф';
      case 'multiplier':
        return 'Множитель';
      default:
        return String(category);
    }
  }

  getCriterionValue(criterionId: string): unknown {
    return this.criterionValues()[criterionId];
  }

  getNumberCriterionValue(criterionId: string): number {
    const value = this.getCriterionValue(criterionId);
    return typeof value === 'number' ? value : Number(value) || 0;
  }

  getStringCriterionValue(criterionId: string): string {
    const value = this.getCriterionValue(criterionId);
    return typeof value === 'string' ? value : '';
  }

  getBooleanCriterionValue(criterionId: string): boolean {
    return this.getCriterionValue(criterionId) === true;
  }

  setNumberCriterionValue(criterionId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value === '' ? 0 : Number(input.value);
    this.setCriterionValue(criterionId, Number.isFinite(value) ? value : 0);
  }

  setStringCriterionValue(criterionId: string, event: Event): void {
    const input = event.target as HTMLSelectElement;
    this.setCriterionValue(criterionId, input.value);
  }

  setBooleanCriterionValue(criterionId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setCriterionValue(criterionId, input.checked);
  }

  setPenaltyValue(key: keyof GradePenaltyInput, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.assessmentPenalties.update((penalties) => ({
      ...penalties,
      [key]: input.checked,
    }));
  }

  getScoreMin(criterion: Criterion): number {
    return this.asScoreSettings(criterion.settings).minValue ?? 0;
  }

  getScoreMax(criterion: Criterion): number {
    return this.asScoreSettings(criterion.settings).maxValue ?? criterion.maxScore ?? 100;
  }

  getCriterionOptions(criterion: Criterion): CriterionOption[] {
    return this.asChoiceSettings(criterion.settings).options ?? [];
  }

  getAssessmentFinalGrade(): number | null {
    return this.savedAssessment()?.finalGrade ?? this.submission()?.grade ?? null;
  }

  private setCriterionValue(criterionId: string, value: unknown): void {
    this.criterionValues.update((values) => ({
      ...values,
      [criterionId]: value,
    }));
    this.assessmentError.set('');
    this.assessmentSuccess.set('');
  }

  private getDefaultCriterionValue(criterion: Criterion): unknown {
    switch (criterion.type as CriterionType) {
      case 'score':
        return this.getScoreMin(criterion);
      case 'pass_fail':
      case 'option':
        return this.getCriterionOptions(criterion)[0]?.value ?? '';
      case 'multiplier':
        return false;
      default:
        return null;
    }
  }

  private extractSavedCriterionValues(
    assessment: SubmissionAssessment | null | undefined,
  ): Array<{ criterionId: string; value: unknown }> {
    if (!assessment || !Array.isArray(assessment.criterionValues)) {
      return [];
    }

    return assessment.criterionValues.filter(
      (value): value is { criterionId: string; value: unknown } =>
        Boolean(value) &&
        typeof value === 'object' &&
        'criterionId' in value &&
        typeof value.criterionId === 'string',
    );
  }

  private extractSavedPenalties(
    assessment: SubmissionAssessment | null | undefined,
  ): GradePenaltyInput {
    const penalties: GradePenaltyInput = {
      deadline: false,
      progress: false,
      requiredCriteria: false,
    };

    const appliedPenalties = assessment?.calculationDetails?.appliedPenalties;
    if (!Array.isArray(appliedPenalties)) {
      return penalties;
    }

    appliedPenalties.forEach((penalty) => {
      if (penalty.source === 'deadline') penalties.deadline = true;
      if (penalty.source === 'progress') penalties.progress = true;
      if (penalty.source === 'required_criteria') penalties.requiredCriteria = true;
    });

    return penalties;
  }

  private asScoreSettings(settings: unknown): Partial<ScoreCriterionSettings> {
    if (!settings || typeof settings !== 'object') {
      return {};
    }

    return settings as Partial<ScoreCriterionSettings>;
  }

  private asChoiceSettings(settings: unknown): Partial<ChoiceCriterionSettings> {
    if (!settings || typeof settings !== 'object') {
      return {};
    }

    return settings as Partial<ChoiceCriterionSettings>;
  }
}

