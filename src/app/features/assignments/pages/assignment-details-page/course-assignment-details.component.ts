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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, timer } from 'rxjs';

import { Assignment, AssignmentSubmission, SubmissionFile } from '../../../../core/models/assigment.model';
import { AssignmentComment } from '../../../../core/models/assignment-comment.model';
import {
  AssignmentGradingMode,
  AssignmentGradingRules,
  ChoiceCriterionSettings,
  Criterion,
  CriterionCategory,
  CriterionGroupWithCriteria,
  CriterionSettings,
  CriterionType,
  MainCriteriaThresholdBehavior,
  MultiplierCriterionSettings,
  ScoreCriterionSettings,
} from '../../../../core/models/grading.model';
import {
  AssignmentCaptainInfo,
  CaptainTeam,
  CaptainTeamMemberSubmissions,
  AssignmentDraftState,
  AssignmentTeam,
  AssignmentTeamMember,
  AssignmentTeamStudent,
  AssignmentsService,
  UpdateAssignmentPeerReviewRequest,
} from '../../../assignments/services/assignments.service';
import { ProfileService } from '../../../profile/services/profile.service';
import { UsersService } from '../../../users/services/users.service';

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
  private readonly profileService = inject(ProfileService);
  private readonly usersService = inject(UsersService);

  readonly role = signal(localStorage.getItem('user_role'));
  readonly isAdmin = computed(() => this.role() === 'Admin');
  readonly isTeacher = computed(() => this.role() === 'Teacher');
  readonly isStudent = computed(() => this.role() === 'Student');
  currentUserId = signal<string | null>(null);

  courseId = signal<string | null>(null);
  assignmentId = signal<string | null>(null);

  assignment = signal<Assignment | null>(null);
  comments = signal<AssignmentComment[]>([]);
  captainInfo = signal<AssignmentCaptainInfo | null>(null);
  captainTeam = signal<CaptainTeam | null>(null);
  mySubmission = signal<AssignmentSubmission | null>(null);
  teams = signal<AssignmentTeam[]>([]);
  availableStudents = signal<AssignmentTeamStudent[]>([]);
  selectedSubmissionFiles = signal<File[]>([]);
  draftState = signal<AssignmentDraftState | null>(null);
  draftCaptains = signal<AssignmentTeamMember[]>([]);
  draftCourseStudents = signal<AssignmentTeamStudent[]>([]);
  draftTab = signal<'captains' | 'draft' | 'teams'>('captains');
  criterionGroups = signal<CriterionGroupWithCriteria[]>([]);

  isLoading = signal(true);
  isCommentsLoading = signal(true);
  isSendingComment = signal(false);
  isCaptainInfoLoading = signal(false);
  isCaptainActionLoading = signal(false);
  isTeamsLoading = signal(false);
  isCreatingTeam = signal(false);
  isCreateTeamModalOpen = signal(false);
  isAddMembersModalOpen = signal(false);
  isRunningRandomDistribution = signal(false);
  isUploadingSubmission = signal(false);
  isMySubmissionLoading = signal(false);
  isCaptainTeamLoading = signal(false);
  isLockingTeams = signal(false);
  processingSelfTeamId = signal<string | null>(null);
  finalSubmissionActionId = signal<string | null>(null);
  isDraftLoading = signal(false);
  draftActionKey = signal<string | null>(null);
  isGradingRulesLoading = signal(false);
  isSavingGradingRules = signal(false);
  isCriteriaSettingsLoading = signal(false);
  isCreatingCriterionGroup = signal(false);
  isSavingCriterionGroup = signal(false);
  deletingCriterionGroupId = signal<string | null>(null);

  loadError = signal('');
  commentsError = signal('');
  submitError = signal('');
  submitSuccess = signal('');
  captainActionError = signal('');
  captainActionSuccess = signal('');
  unavailableAssignmentNotice = signal('');
  teamsError = signal('');
  teamsSuccess = signal('');
  solutionError = signal('');
  solutionSuccess = signal('');
  mySubmissionError = signal('');
  captainTeamError = signal('');
  captainTeamSuccess = signal('');
  draftError = signal('');
  draftSuccess = signal('');
  gradingRulesError = signal('');
  gradingRulesSuccess = signal('');
  peerReviewSettingsError = signal('');
  peerReviewSettingsSuccess = signal('');
  criteriaSettingsError = signal('');
  criteriaSettingsSuccess = signal('');
  processingMemberKey = signal<string | null>(null);
  selectedTeamStudentIds = signal<string[]>([]);
  teamPickerMode = signal<'captain' | 'members' | null>(null);
  teamModalError = signal('');
  selectedTeamForMembersId = signal<string | null>(null);
  editingCriterionGroupId = signal<string | null>(null);
  criterionFormGroupId = signal<string | null>(null);
  editingCriterionId = signal<string | null>(null);
  isSavingCriterion = signal(false);
  deletingCriterionId = signal<string | null>(null);
  optionRows = signal<CriterionOptionRow[]>([
    { value: 'option_1', label: 'Вариант 1', score: 0 },
    { value: 'option_2', label: 'Вариант 2', score: 0 },
  ]);

  readonly commentForm = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(1000)]],
  });

  readonly createTeamForm = this.fb.nonNullable.group({
    name: [''],
    captainId: ['', [Validators.required]],
  });

  readonly criterionGroupForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(2000)]],
    sortOrder: [0, [Validators.required, Validators.min(0)]],
  });

  readonly editCriterionGroupForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(2000)]],
    sortOrder: [0, [Validators.required, Validators.min(0)]],
  });

  readonly criterionForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(2000)]],
    type: ['pass_fail' as CriterionType, [Validators.required]],
    category: ['main' as CriterionCategory, [Validators.required]],
    maxScore: [10, [Validators.required, Validators.min(1)]],
    sortOrder: [0, [Validators.required, Validators.min(0)]],
    scoreMinValue: [0, [Validators.required, Validators.min(0)]],
    scoreMaxValue: [10, [Validators.required, Validators.min(1)]],
    passScore: [10, [Validators.required, Validators.min(0)]],
    failScore: [0, [Validators.required, Validators.min(0)]],
    multiplier: [1, [Validators.required, Validators.min(0)]],
  });

  readonly gradingRulesForm = this.fb.nonNullable.group({
    mode: ['sum_points' as AssignmentGradingMode, [Validators.required]],
    baseGrade: [100, [Validators.min(0)]],
    thresholdEnabled: [false],
    threshold: [60, [Validators.min(0), Validators.max(100)]],
    thresholdBehavior: ['set_to_zero' as MainCriteriaThresholdBehavior],
    deadlinePenaltyEnabled: [false],
    deadlinePenaltyPercentage: [10, [Validators.min(0), Validators.max(100)]],
    progressPenaltyEnabled: [false],
    progressPenaltyPercentage: [10, [Validators.min(0), Validators.max(100)]],
    requiredCriteriaPenaltyEnabled: [false],
    requiredCriteriaPenaltyPercentage: [10, [Validators.min(0), Validators.max(100)]],
  });

  readonly peerReviewSettingsForm = this.fb.nonNullable.group({
    peerReviewEnabled: [false],
    peerReviewStartsAtUtc: [''],
    peerReviewEndsAtUtc: [''],
    peerReviewRequiredReviewsCount: [1, [Validators.min(1), Validators.max(100)]],
    peerReviewPenaltyPercent: [20, [Validators.min(0), Validators.max(100)]],
  });

  isSavingPeerReviewSettings = signal(false);
  isGeneratingPeerReviewAssignments = signal(false);

  readonly selectedTeamStudents = computed(() => {
    const selectedIds = new Set(this.selectedTeamStudentIds());
    const captainId = this.createTeamForm.controls.captainId.getRawValue();
    return this.availableStudents().filter((student) => selectedIds.has(student.id) && student.id !== captainId);
  });

  readonly selectedCaptain = computed(() => {
    const captainId = this.createTeamForm.controls.captainId.getRawValue();
    return this.availableStudents().find((student) => student.id === captainId) ?? null;
  });

  readonly selectedTeamForMembers = computed(() => {
    const teamId = this.selectedTeamForMembersId();
    return this.teams().find((team) => team.id === teamId) ?? null;
  });

  ngOnInit(): void {
    this.loadCurrentProfile();

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

  loadCurrentProfile(): void {
    if (!localStorage.getItem('token')) {
      return;
    }

    this.profileService.getMe().subscribe({
      next: (profile) => this.currentUserId.set(profile.id),
      error: (err) => console.error(err),
    });
  }

  loadPageData(assignmentId: string): void {
    this.isLoading.set(true);
    this.isCommentsLoading.set(true);
    this.loadError.set('');
    this.commentsError.set('');
    this.submitError.set('');
    this.submitSuccess.set('');
    this.solutionError.set('');
    this.solutionSuccess.set('');
    this.mySubmissionError.set('');
    this.captainTeamError.set('');
    this.captainTeamSuccess.set('');
    this.selectedSubmissionFiles.set([]);
    this.mySubmission.set(null);
    this.captainTeam.set(null);
    this.captainInfo.set(null);
    this.captainTeam.set(null);
    this.captainActionError.set('');
    this.captainActionSuccess.set('');
    this.unavailableAssignmentNotice.set('');
    this.resetTeamsState();
    this.resetDraftState();
    this.resetGradingRulesState();
    this.resetPeerReviewSettingsState();
    this.resetCriteriaSettingsState();

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
        this.loadTeamsIfAvailable(assignment);
        this.loadMySubmissionIfAvailable(assignment);
        this.applyPeerReviewSettingsIfAvailable(assignment);
        this.loadGradingRulesIfAvailable(assignment);
        this.loadCriteriaSettingsIfAvailable(assignment);
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
    this.loadTeamsIfAvailable(fallbackAssignment);
    this.loadMySubmissionIfAvailable(fallbackAssignment);

    return true;
  }

  resetTeamsState(): void {
    this.teams.set([]);
    this.availableStudents.set([]);
    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.processingMemberKey.set(null);
    this.processingSelfTeamId.set(null);
    this.selectedTeamStudentIds.set([]);
    this.teamPickerMode.set(null);
    this.teamModalError.set('');
    this.selectedTeamForMembersId.set(null);
    this.isAddMembersModalOpen.set(false);
    this.createTeamForm.reset();
    this.isCreateTeamModalOpen.set(false);
  }

  resetDraftState(): void {
    this.draftState.set(null);
    this.draftCaptains.set([]);
    this.draftCourseStudents.set([]);
    this.draftTab.set('captains');
    this.draftError.set('');
    this.draftSuccess.set('');
    this.draftActionKey.set(null);
  }

  resetGradingRulesState(): void {
    this.gradingRulesError.set('');
    this.gradingRulesSuccess.set('');
    this.isGradingRulesLoading.set(false);
    this.isSavingGradingRules.set(false);
    this.gradingRulesForm.reset({
      mode: 'sum_points',
      baseGrade: 100,
      thresholdEnabled: false,
      threshold: 60,
      thresholdBehavior: 'set_to_zero',
      deadlinePenaltyEnabled: false,
      deadlinePenaltyPercentage: 10,
      progressPenaltyEnabled: false,
      progressPenaltyPercentage: 10,
      requiredCriteriaPenaltyEnabled: false,
      requiredCriteriaPenaltyPercentage: 10,
    });
  }

  resetCriteriaSettingsState(): void {
    this.criterionGroups.set([]);
    this.criteriaSettingsError.set('');
    this.criteriaSettingsSuccess.set('');
    this.editingCriterionGroupId.set(null);
    this.deletingCriterionGroupId.set(null);
    this.isCriteriaSettingsLoading.set(false);
    this.isCreatingCriterionGroup.set(false);
    this.isSavingCriterionGroup.set(false);
    this.isSavingCriterion.set(false);
    this.criterionFormGroupId.set(null);
    this.editingCriterionId.set(null);
    this.deletingCriterionId.set(null);
    this.criterionGroupForm.reset({ name: '', description: '', sortOrder: 0 });
    this.editCriterionGroupForm.reset({ name: '', description: '', sortOrder: 0 });
    this.resetCriterionForm();
  }

  resetPeerReviewSettingsState(): void {
    this.peerReviewSettingsError.set('');
    this.peerReviewSettingsSuccess.set('');
    this.isSavingPeerReviewSettings.set(false);
    this.isGeneratingPeerReviewAssignments.set(false);
    this.peerReviewSettingsForm.reset({
      peerReviewEnabled: false,
      peerReviewStartsAtUtc: '',
      peerReviewEndsAtUtc: '',
      peerReviewRequiredReviewsCount: 1,
      peerReviewPenaltyPercent: 20,
    });
  }

  applyPeerReviewSettingsIfAvailable(assignment: Assignment): void {
    if (!this.canManageCriteriaSettings()) {
      return;
    }

    this.applyPeerReviewSettingsToForm(assignment);
  }

  applyPeerReviewSettingsToForm(assignment: Assignment): void {
    this.peerReviewSettingsForm.reset({
      peerReviewEnabled: assignment.peerReviewEnabled ?? false,
      peerReviewStartsAtUtc: this.toDateTimeLocalInput(assignment.peerReviewStartsAtUtc),
      peerReviewEndsAtUtc: this.toDateTimeLocalInput(assignment.peerReviewEndsAtUtc),
      peerReviewRequiredReviewsCount: assignment.peerReviewRequiredReviewsCount ?? 1,
      peerReviewPenaltyPercent: assignment.peerReviewPenaltyPercent ?? 20,
    });
  }

  savePeerReviewSettings(): void {
    const assignment = this.assignment();
    this.peerReviewSettingsError.set('');
    this.peerReviewSettingsSuccess.set('');
    this.peerReviewSettingsForm.markAllAsTouched();

    if (
      !assignment ||
      !this.canManageCriteriaSettings() ||
      this.peerReviewSettingsForm.invalid ||
      !this.isPeerReviewSettingsValid() ||
      this.isSavingPeerReviewSettings()
    ) {
      return;
    }

    const payload = this.buildPeerReviewSettingsPayload();
    if (!payload) {
      return;
    }

    this.isSavingPeerReviewSettings.set(true);

    this.assignmentsService.updatePeerReviewSettings(assignment.id, payload).subscribe({
      next: (updatedAssignment) => {
        this.assignment.set(updatedAssignment);
        this.applyPeerReviewSettingsToForm(updatedAssignment);
        this.isSavingPeerReviewSettings.set(false);
        this.peerReviewSettingsSuccess.set('Настройки peer-review сохранены');
      },
      error: (err) => {
        console.error(err);
        this.isSavingPeerReviewSettings.set(false);
        this.peerReviewSettingsError.set(
          this.getApiErrorMessage(err, 'Не удалось сохранить настройки peer-review'),
        );
      },
    });
  }

  generatePeerReviewAssignments(): void {
    const assignment = this.assignment();
    this.peerReviewSettingsError.set('');
    this.peerReviewSettingsSuccess.set('');

    if (!assignment || !assignment.peerReviewEnabled || this.isGeneratingPeerReviewAssignments()) {
      return;
    }

    this.isGeneratingPeerReviewAssignments.set(true);

    this.assignmentsService.generatePeerReviewAssignments(assignment.id).subscribe({
      next: (result) => {
        this.isGeneratingPeerReviewAssignments.set(false);
        this.peerReviewSettingsSuccess.set(
          `Назначения peer-review сформированы: ${result.assignments.length}`,
        );
      },
      error: (err) => {
        console.error(err);
        this.isGeneratingPeerReviewAssignments.set(false);
        this.peerReviewSettingsError.set(
          this.getApiErrorMessage(err, 'Не удалось сформировать назначения peer-review'),
        );
      },
    });
  }

  buildPeerReviewSettingsPayload(): UpdateAssignmentPeerReviewRequest | null {
    const enabled = this.peerReviewSettingsForm.controls.peerReviewEnabled.getRawValue();

    if (!enabled) {
      return {
        peerReviewEnabled: false,
        peerReviewStartsAtUtc: null,
        peerReviewEndsAtUtc: null,
        peerReviewRequiredReviewsCount: null,
        peerReviewPenaltyPercent: this.peerReviewSettingsForm.controls.peerReviewPenaltyPercent.getRawValue(),
      };
    }

    const startsAt = this.peerReviewSettingsForm.controls.peerReviewStartsAtUtc.getRawValue();
    const endsAt = this.peerReviewSettingsForm.controls.peerReviewEndsAtUtc.getRawValue();

    if (!startsAt || !endsAt) {
      this.peerReviewSettingsError.set('Укажите начало и дедлайн peer-review');
      return null;
    }

    return {
      peerReviewEnabled: true,
      peerReviewStartsAtUtc: this.toUtcIso(startsAt),
      peerReviewEndsAtUtc: this.toUtcIso(endsAt),
      peerReviewRequiredReviewsCount:
        this.peerReviewSettingsForm.controls.peerReviewRequiredReviewsCount.getRawValue(),
      peerReviewPenaltyPercent: this.peerReviewSettingsForm.controls.peerReviewPenaltyPercent.getRawValue(),
    };
  }

  isPeerReviewSettingsValid(): boolean {
    if (!this.peerReviewSettingsForm.controls.peerReviewEnabled.getRawValue()) {
      return this.peerReviewSettingsForm.controls.peerReviewPenaltyPercent.valid;
    }

    const startsAt = this.peerReviewSettingsForm.controls.peerReviewStartsAtUtc.getRawValue();
    const endsAt = this.peerReviewSettingsForm.controls.peerReviewEndsAtUtc.getRawValue();

    if (!startsAt || !endsAt) {
      return false;
    }

    return (
      new Date(startsAt).getTime() < new Date(endsAt).getTime() &&
      this.peerReviewSettingsForm.controls.peerReviewRequiredReviewsCount.valid &&
      this.peerReviewSettingsForm.controls.peerReviewPenaltyPercent.valid
    );
  }

  getPeerReviewStartsAtError(): string {
    if (!this.peerReviewSettingsForm.controls.peerReviewEnabled.getRawValue()) return '';
    const control = this.peerReviewSettingsForm.controls.peerReviewStartsAtUtc;
    if (control.touched && !control.getRawValue()) return 'Выберите начало peer-review';
    if (!this.isPeerReviewWindowValid()) return 'Начало должно быть раньше дедлайна';
    return '';
  }

  getPeerReviewEndsAtError(): string {
    if (!this.peerReviewSettingsForm.controls.peerReviewEnabled.getRawValue()) return '';
    const control = this.peerReviewSettingsForm.controls.peerReviewEndsAtUtc;
    if (control.touched && !control.getRawValue()) return 'Выберите дедлайн peer-review';
    if (!this.isPeerReviewWindowValid()) return 'Дедлайн должен быть позже начала';
    return '';
  }

  getPeerReviewRequiredCountError(): string {
    if (!this.peerReviewSettingsForm.controls.peerReviewEnabled.getRawValue()) return '';
    const control = this.peerReviewSettingsForm.controls.peerReviewRequiredReviewsCount;
    if (!control.touched && !control.errors) return '';
    if (control.errors?.['min']) return 'Минимум 1 команда';
    if (control.errors?.['max']) return 'Не больше 100 команд';
    return '';
  }

  getPeerReviewPenaltyError(): string {
    const control = this.peerReviewSettingsForm.controls.peerReviewPenaltyPercent;
    if (!control.touched && !control.errors) return '';
    if (control.errors?.['min']) return 'Штраф не может быть меньше 0';
    if (control.errors?.['max']) return 'Штраф не может быть больше 100';
    return '';
  }

  isPeerReviewWindowValid(): boolean {
    const startsAt = this.peerReviewSettingsForm.controls.peerReviewStartsAtUtc.getRawValue();
    const endsAt = this.peerReviewSettingsForm.controls.peerReviewEndsAtUtc.getRawValue();

    if (!startsAt || !endsAt) {
      return true;
    }

    return new Date(startsAt).getTime() < new Date(endsAt).getTime();
  }

  loadGradingRulesIfAvailable(assignment: Assignment): void {
    if (!this.canManageCriteriaSettings()) {
      return;
    }

    this.loadGradingRules(assignment.id);
  }

  loadGradingRules(assignmentId: string): void {
    this.isGradingRulesLoading.set(true);
    this.gradingRulesError.set('');

    this.assignmentsService.getGradingRules(assignmentId).subscribe({
      next: (rules) => {
        this.applyGradingRulesToForm(rules);
        this.isGradingRulesLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.gradingRulesError.set(this.getApiErrorMessage(err, 'Не удалось загрузить правила расчета оценки'));
        this.isGradingRulesLoading.set(false);
      },
    });
  }

  applyGradingRulesToForm(rules: AssignmentGradingRules): void {
    this.gradingRulesForm.reset({
      mode: rules.mode ?? 'sum_points',
      baseGrade: rules.baseGrade ?? 100,
      thresholdEnabled: rules.mainCriteriaThreshold?.enabled ?? false,
      threshold: rules.mainCriteriaThreshold?.threshold ?? 60,
      thresholdBehavior: rules.mainCriteriaThreshold?.behavior ?? 'set_to_zero',
      deadlinePenaltyEnabled: rules.penalties?.deadline?.enabled ?? false,
      deadlinePenaltyPercentage: rules.penalties?.deadline?.percentage ?? 10,
      progressPenaltyEnabled: rules.penalties?.progress?.enabled ?? false,
      progressPenaltyPercentage: rules.penalties?.progress?.percentage ?? 10,
      requiredCriteriaPenaltyEnabled: rules.penalties?.requiredCriteria?.enabled ?? false,
      requiredCriteriaPenaltyPercentage: rules.penalties?.requiredCriteria?.percentage ?? 10,
    });
  }

  saveGradingRules(): void {
    const assignment = this.assignment();
    this.gradingRulesError.set('');
    this.gradingRulesSuccess.set('');
    this.gradingRulesForm.markAllAsTouched();

    if (!assignment || this.gradingRulesForm.invalid || this.isSavingGradingRules()) {
      return;
    }

    const payload = this.buildGradingRulesPayload();
    if (!payload) {
      return;
    }

    this.isSavingGradingRules.set(true);

    this.assignmentsService.updateGradingRules(assignment.id, payload).subscribe({
      next: (rules) => {
        this.applyGradingRulesToForm(rules);
        this.isSavingGradingRules.set(false);
        this.gradingRulesSuccess.set('Правила расчета оценки сохранены');
      },
      error: (err) => {
        console.error(err);
        this.isSavingGradingRules.set(false);
        this.gradingRulesError.set(this.getApiErrorMessage(err, 'Не удалось сохранить правила расчета оценки'));
      },
    });
  }

  buildGradingRulesPayload(): AssignmentGradingRules | null {
    const mode = this.gradingRulesForm.controls.mode.getRawValue();
    const thresholdEnabled = this.gradingRulesForm.controls.thresholdEnabled.getRawValue();

    if (mode === 'base_with_multipliers' && this.gradingRulesForm.controls.baseGrade.getRawValue() <= 0) {
      this.gradingRulesError.set('Для расчета через множители нужна базовая оценка больше 0');
      return null;
    }

    return {
      mode,
      baseGrade:
        mode === 'base_with_multipliers'
          ? this.gradingRulesForm.controls.baseGrade.getRawValue()
          : null,
      mainCriteriaThreshold: {
        enabled: thresholdEnabled,
        threshold: thresholdEnabled
          ? this.gradingRulesForm.controls.threshold.getRawValue()
          : null,
        behavior: thresholdEnabled
          ? this.gradingRulesForm.controls.thresholdBehavior.getRawValue()
          : null,
      },
      penalties: {
        deadline: this.buildPenaltyRule(
          this.gradingRulesForm.controls.deadlinePenaltyEnabled.getRawValue(),
          this.gradingRulesForm.controls.deadlinePenaltyPercentage.getRawValue(),
        ),
        progress: this.buildPenaltyRule(
          this.gradingRulesForm.controls.progressPenaltyEnabled.getRawValue(),
          this.gradingRulesForm.controls.progressPenaltyPercentage.getRawValue(),
        ),
        requiredCriteria: this.buildPenaltyRule(
          this.gradingRulesForm.controls.requiredCriteriaPenaltyEnabled.getRawValue(),
          this.gradingRulesForm.controls.requiredCriteriaPenaltyPercentage.getRawValue(),
        ),
      },
    };
  }

  private buildPenaltyRule(enabled: boolean, percentage: number) {
    return {
      enabled,
      percentage: enabled ? percentage : null,
    };
  }

  loadCriteriaSettingsIfAvailable(assignment: Assignment): void {
    if (!this.canManageCriteriaSettings()) {
      return;
    }

    this.loadCriteriaSettings(assignment.id);
  }

  canManageCriteriaSettings(): boolean {
    return this.isAdmin() || this.isTeacher();
  }

  loadCriteriaSettings(assignmentId: string): void {
    this.isCriteriaSettingsLoading.set(true);
    this.criteriaSettingsError.set('');

    this.assignmentsService.getCriterionGroups(assignmentId).subscribe({
      next: (groups) => {
        if (!groups.length) {
          this.criterionGroups.set([]);
          this.isCriteriaSettingsLoading.set(false);
          return;
        }

        forkJoin(groups.map((group) => this.assignmentsService.getCriteria(group.id))).subscribe({
          next: (criteriaByGroup) => {
            this.criterionGroups.set(
              groups
                .map((group, index) => ({
                  ...group,
                  criteria: criteriaByGroup[index] ?? [],
                }))
                .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
            );
            this.isCriteriaSettingsLoading.set(false);
          },
          error: (err) => {
            console.error(err);
            this.criteriaSettingsError.set('Не удалось загрузить критерии задания');
            this.isCriteriaSettingsLoading.set(false);
          },
        });
      },
      error: (err) => {
        console.error(err);
        this.criteriaSettingsError.set('Не удалось загрузить группы критериев');
        this.isCriteriaSettingsLoading.set(false);
      },
    });
  }

  createCriterionGroup(): void {
    const assignment = this.assignment();
    this.criteriaSettingsError.set('');
    this.criteriaSettingsSuccess.set('');
    this.criterionGroupForm.markAllAsTouched();

    if (!assignment || this.criterionGroupForm.invalid || this.isCreatingCriterionGroup()) {
      return;
    }

    this.isCreatingCriterionGroup.set(true);

    this.assignmentsService
      .createCriterionGroup(assignment.id, {
        name: this.criterionGroupForm.controls.name.getRawValue().trim(),
        description: this.criterionGroupForm.controls.description.getRawValue().trim() || null,
        sortOrder: this.criterionGroupForm.controls.sortOrder.getRawValue(),
      })
      .subscribe({
        next: () => {
          this.criterionGroupForm.reset({
            name: '',
            description: '',
            sortOrder: this.criterionGroups().length + 1,
          });
          this.isCreatingCriterionGroup.set(false);
          this.criteriaSettingsSuccess.set('Группа критериев добавлена');
          this.loadCriteriaSettings(assignment.id);
        },
        error: (err) => {
          console.error(err);
          this.isCreatingCriterionGroup.set(false);
          this.criteriaSettingsError.set(this.getApiErrorMessage(err, 'Не удалось добавить группу критериев'));
        },
      });
  }

  startEditCriterionGroup(group: CriterionGroupWithCriteria): void {
    this.criteriaSettingsError.set('');
    this.criteriaSettingsSuccess.set('');
    this.editingCriterionGroupId.set(group.id);
    this.editCriterionGroupForm.reset({
      name: group.name,
      description: group.description ?? '',
      sortOrder: group.sortOrder,
    });
  }

  cancelEditCriterionGroup(): void {
    if (this.isSavingCriterionGroup()) {
      return;
    }

    this.editingCriterionGroupId.set(null);
    this.editCriterionGroupForm.reset({ name: '', description: '', sortOrder: 0 });
  }

  saveCriterionGroup(group: CriterionGroupWithCriteria): void {
    const assignment = this.assignment();
    this.criteriaSettingsError.set('');
    this.criteriaSettingsSuccess.set('');
    this.editCriterionGroupForm.markAllAsTouched();

    if (!assignment || this.editCriterionGroupForm.invalid || this.isSavingCriterionGroup()) {
      return;
    }

    this.isSavingCriterionGroup.set(true);

    this.assignmentsService
      .updateCriterionGroup(group.id, {
        name: this.editCriterionGroupForm.controls.name.getRawValue().trim(),
        description: this.editCriterionGroupForm.controls.description.getRawValue().trim() || null,
        sortOrder: this.editCriterionGroupForm.controls.sortOrder.getRawValue(),
      })
      .subscribe({
        next: () => {
          this.isSavingCriterionGroup.set(false);
          this.editingCriterionGroupId.set(null);
          this.criteriaSettingsSuccess.set('Группа критериев обновлена');
          this.loadCriteriaSettings(assignment.id);
        },
        error: (err) => {
          console.error(err);
          this.isSavingCriterionGroup.set(false);
          this.criteriaSettingsError.set(this.getApiErrorMessage(err, 'Не удалось обновить группу критериев'));
        },
      });
  }

  deleteCriterionGroup(group: CriterionGroupWithCriteria): void {
    const assignment = this.assignment();

    if (!assignment || this.deletingCriterionGroupId()) {
      return;
    }

    this.criteriaSettingsError.set('');
    this.criteriaSettingsSuccess.set('');
    this.deletingCriterionGroupId.set(group.id);

    this.assignmentsService.deleteCriterionGroup(group.id).subscribe({
      next: () => {
        this.deletingCriterionGroupId.set(null);
        this.criteriaSettingsSuccess.set('Группа критериев удалена');
        this.loadCriteriaSettings(assignment.id);
      },
      error: (err) => {
        console.error(err);
        this.deletingCriterionGroupId.set(null);
        this.criteriaSettingsError.set(this.getApiErrorMessage(err, 'Не удалось удалить группу критериев'));
      },
    });
  }

  openCreateCriterionForm(group: CriterionGroupWithCriteria): void {
    this.criteriaSettingsError.set('');
    this.criteriaSettingsSuccess.set('');
    this.editingCriterionId.set(null);
    this.criterionFormGroupId.set(group.id);
    this.resetCriterionForm(group.criteria.length);
  }

  startEditCriterion(group: CriterionGroupWithCriteria, criterion: Criterion): void {
    this.criteriaSettingsError.set('');
    this.criteriaSettingsSuccess.set('');
    this.criterionFormGroupId.set(group.id);
    this.editingCriterionId.set(criterion.id);
    this.fillCriterionForm(criterion);
  }

  cancelCriterionForm(): void {
    if (this.isSavingCriterion()) {
      return;
    }

    this.criterionFormGroupId.set(null);
    this.editingCriterionId.set(null);
    this.resetCriterionForm();
  }

  saveCriterion(group: CriterionGroupWithCriteria): void {
    const assignment = this.assignment();
    this.criteriaSettingsError.set('');
    this.criteriaSettingsSuccess.set('');
    this.criterionForm.markAllAsTouched();

    if (!assignment || this.criterionForm.invalid || this.isSavingCriterion()) {
      return;
    }

    const settings = this.buildCriterionSettings();
    if (!settings) {
      return;
    }

    const type = this.getCriterionFormType();
    const maxScore = this.resolveCriterionMaxScore(type);
    const payload = {
      name: this.criterionForm.controls.name.getRawValue().trim(),
      description: this.criterionForm.controls.description.getRawValue().trim() || null,
      type,
      category: this.resolveCriterionCategory(type),
      settings,
      maxScore,
      sortOrder: this.criterionForm.controls.sortOrder.getRawValue(),
    };
    const editingCriterionId = this.editingCriterionId();
    const request$ = editingCriterionId
      ? this.assignmentsService.updateCriterion(editingCriterionId, payload)
      : this.assignmentsService.createCriterion(group.id, payload);

    this.isSavingCriterion.set(true);

    request$.subscribe({
      next: () => {
        this.isSavingCriterion.set(false);
        this.criterionFormGroupId.set(null);
        this.editingCriterionId.set(null);
        this.criteriaSettingsSuccess.set(
          editingCriterionId ? 'Критерий обновлен' : 'Критерий добавлен',
        );
        this.loadCriteriaSettings(assignment.id);
      },
      error: (err) => {
        console.error(err);
        this.isSavingCriterion.set(false);
        this.criteriaSettingsError.set(this.getApiErrorMessage(err, 'Не удалось сохранить критерий'));
      },
    });
  }

  deleteCriterion(criterion: Criterion): void {
    const assignment = this.assignment();

    if (!assignment || this.deletingCriterionId()) {
      return;
    }

    this.criteriaSettingsError.set('');
    this.criteriaSettingsSuccess.set('');
    this.deletingCriterionId.set(criterion.id);

    this.assignmentsService.deleteCriterion(criterion.id).subscribe({
      next: () => {
        this.deletingCriterionId.set(null);
        this.criteriaSettingsSuccess.set('Критерий удален');
        this.loadCriteriaSettings(assignment.id);
      },
      error: (err) => {
        console.error(err);
        this.deletingCriterionId.set(null);
        this.criteriaSettingsError.set(this.getApiErrorMessage(err, 'Не удалось удалить критерий'));
      },
    });
  }

  onCriterionTypeChanged(): void {
    const type = this.getCriterionFormType();

    if (type === 'multiplier') {
      this.criterionForm.controls.category.setValue('multiplier');
      this.criterionForm.controls.maxScore.setValue(1);
      return;
    }

    if (this.criterionForm.controls.category.getRawValue() === 'multiplier') {
      this.criterionForm.controls.category.setValue('main');
    }

    if (type === 'score') {
      this.criterionForm.controls.scoreMaxValue.setValue(
        this.criterionForm.controls.maxScore.getRawValue(),
      );
    }
  }

  addOptionRow(): void {
    const nextIndex = this.optionRows().length + 1;
    this.optionRows.update((rows) => [
      ...rows,
      { value: `option_${nextIndex}`, label: `Вариант ${nextIndex}`, score: 0 },
    ]);
  }

  removeOptionRow(index: number): void {
    if (this.optionRows().length <= 1) {
      return;
    }

    this.optionRows.update((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  }

  updateOptionRow(
    index: number,
    field: keyof CriterionOptionRow,
    event: Event,
  ): void {
    const target = event.target as HTMLInputElement;
    const value = field === 'score' ? Number(target.value) : target.value;

    this.optionRows.update((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  resetCriterionForm(nextSortOrder = 0): void {
    this.criterionForm.reset({
      name: '',
      description: '',
      type: 'pass_fail',
      category: 'main',
      maxScore: 10,
      sortOrder: nextSortOrder,
      scoreMinValue: 0,
      scoreMaxValue: 10,
      passScore: 10,
      failScore: 0,
      multiplier: 1,
    });
    this.optionRows.set([
      { value: 'option_1', label: 'Вариант 1', score: 0 },
      { value: 'option_2', label: 'Вариант 2', score: 0 },
    ]);
  }

  fillCriterionForm(criterion: Criterion): void {
    const type = this.normalizeCriterionType(criterion.type);
    const settings = criterion.settings as Partial<
      ScoreCriterionSettings & ChoiceCriterionSettings & MultiplierCriterionSettings
    >;

    this.criterionForm.reset({
      name: criterion.name,
      description: criterion.description ?? '',
      type,
      category: this.normalizeCriterionCategory(criterion.category),
      maxScore: criterion.maxScore,
      sortOrder: criterion.sortOrder,
      scoreMinValue: settings.minValue ?? 0,
      scoreMaxValue: settings.maxValue ?? criterion.maxScore,
      passScore: settings.scoreMappings?.find((mapping) => mapping.value === 'pass')?.score ?? criterion.maxScore,
      failScore: settings.scoreMappings?.find((mapping) => mapping.value === 'fail')?.score ?? 0,
      multiplier: settings.coefficient ?? settings.multiplier ?? 1,
    });

    if (type === 'option') {
      this.optionRows.set(
        (settings.options ?? []).map((option) => ({
          value: option.value,
          label: option.label ?? option.value,
          score:
            settings.scoreMappings?.find((mapping) => mapping.value === option.value)?.score ?? 0,
        })),
      );
    }
  }

  loadTeamsIfAvailable(assignment: Assignment): void {
    if (this.canManageManualTeams(assignment)) {
      this.loadManualDistribution(assignment.id);
      return;
    }

    if (this.canManageRandomTeams(assignment)) {
      this.loadAssignmentTeams(assignment.id);
      return;
    }

    if (this.canViewSelfSelectionTeams(assignment)) {
      this.loadAssignmentTeams(assignment.id);
      return;
    }

    if (this.canViewCaptainDraft(assignment)) {
      this.loadCaptainDraftBoard(assignment);
    }
  }

  canManageManualTeams(assignment: Assignment): boolean {
    return (this.isAdmin() || this.isTeacher()) && assignment.teamFormationMode === 'teacher_managed';
  }

  canManageRandomTeams(assignment: Assignment): boolean {
    return (this.isAdmin() || this.isTeacher()) && assignment.teamFormationMode === 'random_distribution';
  }

  canViewSelfSelectionTeams(assignment: Assignment): boolean {
    return (
      assignment.teamFormationMode === 'student_self_selection' &&
      (this.isStudent() || this.isAdmin() || this.isTeacher())
    );
  }

  canViewCaptainDraft(assignment: Assignment): boolean {
    return (
      assignment.teamFormationMode === 'captain_draft' &&
      (this.isStudent() || this.isAdmin() || this.isTeacher())
    );
  }

  canManageCaptainDraft(assignment: Assignment): boolean {
    return this.canViewCaptainDraft(assignment) && (this.isAdmin() || this.isTeacher());
  }

  canStudentUseCaptainDraft(assignment: Assignment): boolean {
    return this.canViewCaptainDraft(assignment) && this.isStudent();
  }

  canUseSelfSelectionTeams(assignment: Assignment): boolean {
    return this.isStudent() && this.canViewSelfSelectionTeams(assignment) && this.isTeamFormationStageOpen(assignment);
  }

  canRunRandomDistribution(assignment: Assignment): boolean {
    return (
      this.canManageRandomTeams(assignment) &&
      this.isTeamFormationStageOpen(assignment) &&
      !assignment.isTeamCompositionLocked
    );
  }

  canEditManualTeams(assignment: Assignment): boolean {
    return (
      this.canManageManualTeams(assignment) &&
      !this.hasTeamFormationEnded(assignment) &&
      !assignment.isTeamCompositionLocked
    );
  }

  canEditCaptainDraftTeams(assignment: Assignment): boolean {
    const state = this.draftState();

    return (
      this.canManageCaptainDraft(assignment) &&
      this.isTeamFormationStageOpen(assignment) &&
      !assignment.isTeamCompositionLocked &&
      state?.isCompleted === true
    );
  }

  canEditTeams(assignment: Assignment): boolean {
    return this.canEditManualTeams(assignment) || this.canEditCaptainDraftTeams(assignment);
  }

  canCreateTeams(assignment: Assignment): boolean {
    return this.canEditManualTeams(assignment);
  }

  canLockManualTeams(assignment: Assignment): boolean {
    return this.canEditTeams(assignment) && this.teams().length > 1;
  }

  hasAssignmentStarted(assignment: Assignment): boolean {
    if (!assignment.startsAtUtc) {
      return false;
    }

    return new Date().getTime() >= new Date(assignment.startsAtUtc).getTime();
  }

  isTeamFormationStageOpen(assignment: Assignment): boolean {
    const startsAt = this.getTeamFormationStartsAt(assignment);

    if (!startsAt || !assignment.teamFormationEndsAtUtc) {
      return false;
    }

    const now = new Date().getTime();
    return (
      now >= new Date(startsAt).getTime() &&
      now < new Date(assignment.teamFormationEndsAtUtc).getTime()
    );
  }

  hasTeamFormationEnded(assignment: Assignment): boolean {
    if (!assignment.teamFormationEndsAtUtc) {
      return false;
    }

    return new Date().getTime() >= new Date(assignment.teamFormationEndsAtUtc).getTime();
  }

  isBeforeTeamFormationStart(assignment: Assignment): boolean {
    const startsAt = this.getTeamFormationStartsAt(assignment);

    if (!startsAt) {
      return false;
    }

    return new Date().getTime() < new Date(startsAt).getTime();
  }

  getTeamFormationStartsAt(assignment: Assignment): string {
    return assignment.captainSelectionEndsAtUtc || assignment.teamFormationStartsAtUtc || assignment.startsAtUtc;
  }

  loadAssignmentTeams(assignmentId: string): void {
    this.isTeamsLoading.set(true);
    this.teamsError.set('');

    this.assignmentsService.getAssignmentTeams(assignmentId).subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.availableStudents.set([]);
        this.isTeamsLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.teams.set([]);
        this.teamsError.set('Не удалось загрузить команды задания');
        this.isTeamsLoading.set(false);
      },
    });
  }

  runRandomDistribution(): void {
    const assignment = this.assignment();
    if (!assignment || !this.canRunRandomDistribution(assignment) || this.isRunningRandomDistribution()) {
      return;
    }

    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.isRunningRandomDistribution.set(true);

    forkJoin({
      teams: this.assignmentsService.runRandomDistribution(assignment.id),
      minDelay: timer(3000),
    }).subscribe({
      next: ({ teams }) => {
        this.teams.set(teams);
        this.isRunningRandomDistribution.set(false);
        this.teamsSuccess.set('Студенты распределены по командам');
      },
      error: (err) => {
        console.error(err);
        this.isRunningRandomDistribution.set(false);
        this.teamsError.set(this.getApiErrorMessage(err, 'Не удалось запустить случайное распределение'));
      },
    });
  }

  loadCaptainDraftBoard(assignment: Assignment): void {
    this.isDraftLoading.set(true);
    this.draftError.set('');

    const requests: {
      draftState: ReturnType<AssignmentsService['getDraftState']>;
      captains: ReturnType<AssignmentsService['getAssignmentCaptains']>;
      courseStudents?: ReturnType<UsersService['getCourseStudents']>;
    } = {
      draftState: this.assignmentsService.getDraftState(assignment.id),
      captains: this.assignmentsService.getAssignmentCaptains(assignment.id),
    };

    if (this.canManageCaptainDraft(assignment)) {
      requests.courseStudents = this.usersService.getCourseStudents(assignment.courseId);
    }

    forkJoin(requests).subscribe({
      next: (response) => {
        this.applyDraftState(response.draftState);
        this.draftCaptains.set(response.captains);
        this.draftCourseStudents.set(
          (response.courseStudents ?? []).map((student) => ({
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            isBlocked: student.isBlocked ?? false,
          })),
        );
        this.isDraftLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.draftState.set(null);
        this.draftCaptains.set([]);
        this.draftCourseStudents.set([]);
        this.draftError.set(this.getApiErrorMessage(err, 'Не удалось загрузить драфт капитанов'));
        this.isDraftLoading.set(false);
      },
    });
  }

  applyDraftState(state: AssignmentDraftState): void {
    this.draftState.set(state);
    this.teams.set(state.teams);
    this.availableStudents.set(state.availableStudents);
  }

  refreshTeamManagementData(assignment: Assignment): void {
    if (this.canManageManualTeams(assignment)) {
      this.loadManualDistribution(assignment.id);
      return;
    }

    if (this.canManageCaptainDraft(assignment)) {
      this.loadCaptainDraftBoard(assignment);
    }
  }

  setDraftTab(tab: 'captains' | 'draft' | 'teams'): void {
    this.draftTab.set(tab);
  }

  getAvailableCaptainStudents(): AssignmentTeamStudent[] {
    const captainIds = new Set(this.draftCaptains().map((captain) => captain.userId));
    return this.draftCourseStudents().filter(
      (student) => !student.isBlocked && !captainIds.has(student.id),
    );
  }

  assignDraftCaptain(student: AssignmentTeamStudent): void {
    const assignment = this.assignment();
    if (!assignment || !this.canManageCaptainDraft(assignment) || this.draftActionKey()) {
      return;
    }

    this.draftError.set('');
    this.draftSuccess.set('');
    this.draftActionKey.set(`captain:add:${student.id}`);

    this.assignmentsService.assignCaptain(assignment.id, student.id).subscribe({
      next: () => {
        this.draftActionKey.set(null);
        this.draftSuccess.set('Капитан назначен');
        this.loadCaptainDraftBoard(assignment);
      },
      error: (err) => {
        console.error(err);
        this.draftActionKey.set(null);
        this.draftError.set(this.getApiErrorMessage(err, 'Не удалось назначить капитана'));
      },
    });
  }

  removeDraftCaptain(captain: AssignmentTeamMember): void {
    const assignment = this.assignment();
    if (!assignment || !this.canManageCaptainDraft(assignment) || this.draftActionKey()) {
      return;
    }

    this.draftError.set('');
    this.draftSuccess.set('');
    this.draftActionKey.set(`captain:remove:${captain.userId}`);

    this.assignmentsService.removeCaptain(assignment.id, captain.userId).subscribe({
      next: () => {
        this.draftActionKey.set(null);
        this.draftSuccess.set('Капитан удален');
        this.loadCaptainDraftBoard(assignment);
      },
      error: (err) => {
        console.error(err);
        this.draftActionKey.set(null);
        this.draftError.set(this.getApiErrorMessage(err, 'Не удалось удалить капитана'));
      },
    });
  }

  startCaptainDraft(): void {
    const assignment = this.assignment();
    if (!assignment || !this.canStartCaptainDraft(assignment) || this.draftActionKey()) {
      return;
    }

    this.draftError.set('');
    this.draftSuccess.set('');
    this.draftActionKey.set('draft:start');

    this.assignmentsService.startDraft(assignment.id).subscribe({
      next: (state) => {
        this.draftActionKey.set(null);
        this.draftSuccess.set('Драфт запущен');
        this.applyDraftState(state);
        this.draftTab.set('draft');
      },
      error: (err) => {
        console.error(err);
        this.draftActionKey.set(null);
        this.draftError.set(this.getApiErrorMessage(err, 'Не удалось запустить драфт'));
      },
    });
  }

  pickDraftStudent(student: AssignmentTeamStudent): void {
    const assignment = this.assignment();
    if (!assignment || !this.canPickDraftStudent(student, assignment) || this.draftActionKey()) {
      return;
    }

    this.draftError.set('');
    this.draftSuccess.set('');
    this.draftActionKey.set(`draft:pick:${student.id}`);

    this.assignmentsService.pickDraftStudent(assignment.id, student.id).subscribe({
      next: (state) => {
        this.draftActionKey.set(null);
        this.draftSuccess.set('Участник выбран');
        this.applyDraftState(state);
        this.loadCaptainInfo(assignment.id);
      },
      error: (err) => {
        console.error(err);
        this.draftActionKey.set(null);
        this.draftError.set(this.getApiErrorMessage(err, 'Не удалось выбрать участника'));
      },
    });
  }

  lockDraftTeams(): void {
    const assignment = this.assignment();
    if (!assignment || !this.canLockDraftTeams(assignment) || this.draftActionKey()) {
      return;
    }

    this.draftError.set('');
    this.draftSuccess.set('');
    this.draftActionKey.set('draft:lock');

    this.assignmentsService.lockTeams(assignment.id).subscribe({
      next: () => {
        this.draftActionKey.set(null);
        this.draftSuccess.set('Состав команд зафиксирован');
        this.assignment.update((currentAssignment) =>
          currentAssignment
            ? {
                ...currentAssignment,
                isTeamCompositionLocked: true,
                teamCompositionLockedAtUtc: new Date().toISOString(),
              }
            : currentAssignment,
        );
        this.loadCaptainDraftBoard(assignment);
      },
      error: (err) => {
        console.error(err);
        this.draftActionKey.set(null);
        this.draftError.set(this.getApiErrorMessage(err, 'Не удалось зафиксировать состав команд'));
      },
    });
  }

  canStartCaptainDraft(assignment: Assignment): boolean {
    const state = this.draftState();
    return (
      this.canManageCaptainDraft(assignment) &&
      this.isTeamFormationStageOpen(assignment) &&
      !assignment.isTeamCompositionLocked &&
      !state?.isStarted &&
      !state?.isCompleted
    );
  }

  canLockDraftTeams(assignment: Assignment): boolean {
    return (
      this.canManageCaptainDraft(assignment) &&
      this.isTeamFormationStageOpen(assignment) &&
      !assignment.isTeamCompositionLocked &&
      this.teams().length > 0
    );
  }

  canPickDraftStudent(student: AssignmentTeamStudent, assignment: Assignment): boolean {
    const state = this.draftState();
    return (
      this.canStudentUseCaptainDraft(assignment) &&
      this.isTeamFormationStageOpen(assignment) &&
      !assignment.isTeamCompositionLocked &&
      !!state?.isStarted &&
      !state.isCompleted &&
      state.currentCaptainUserId === this.currentUserId() &&
      state.availableStudents.some((availableStudent) => availableStudent.id === student.id)
    );
  }

  getCurrentDraftCaptain(): AssignmentTeamMember | null {
    const currentCaptainId = this.draftState()?.currentCaptainUserId;
    if (!currentCaptainId) {
      return null;
    }

    return this.draftCaptains().find((captain) => captain.userId === currentCaptainId)
      ?? this.teams().find((team) => team.captain?.userId === currentCaptainId)?.captain
      ?? null;
  }

  getMyDraftTeam(): AssignmentTeam | null {
    const userId = this.currentUserId();
    if (!userId) {
      return null;
    }

    return this.teams().find((team) => team.members.some((member) => member.userId === userId)) ?? null;
  }

  isMyDraftTurn(): boolean {
    return this.draftState()?.currentCaptainUserId === this.currentUserId();
  }

  isDraftCaptain(): boolean {
    return this.isCurrentUserCaptain();
  }

  isCurrentUserCaptain(): boolean {
    const userId = this.currentUserId();

    return (
      this.captainInfo()?.isCaptain === true ||
      (!!userId && this.draftCaptains().some((captain) => captain.userId === userId)) ||
      (!!userId && this.teams().some((team) => team.captain?.userId === userId))
    );
  }

  getDraftStudentStatusText(): string {
    const state = this.draftState();

    if (!state?.isStarted) {
      return this.isDraftCaptain()
        ? 'Вы капитан команды. Ожидайте запуска драфта преподавателем.'
        : 'Можно стать капитаном, пока открыт этап выбора капитанов.';
    }

    if (state.isCompleted) {
      return 'Драфт завершен. Составы команд доступны для просмотра.';
    }

    if (this.isMyDraftTurn()) {
      return 'Ваш ход. Выберите одного участника в команду.';
    }

    if (this.isDraftCaptain()) {
      return 'Ожидайте своей очереди. Сейчас выбирает другой капитан.';
    }

    const myTeam = this.getMyDraftTeam();
    return myTeam
      ? `Вы в команде ${myTeam.name}.`
      : 'Пока вас не выбрали в команду. Можно наблюдать за драфтом.';
  }

  loadManualDistribution(assignmentId: string): void {
    this.isTeamsLoading.set(true);
    this.teamsError.set('');

    this.assignmentsService.getManualDistribution(assignmentId).subscribe({
      next: (response) => {
        this.teams.set(response.teams);
        this.availableStudents.set(response.availableStudents);
        this.isTeamsLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.teams.set([]);
        this.availableStudents.set([]);
        this.teamsError.set('Не удалось загрузить команды для ручного распределения');
        this.isTeamsLoading.set(false);
      },
    });
  }

  openCreateTeamModal(currentAssignment?: Assignment): void {
    const assignment = currentAssignment ?? this.assignment();
    if (!assignment || !this.canCreateTeams(assignment)) {
      this.teamsError.set('Сейчас нельзя создать команду для этого задания');
      return;
    }

    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.selectedTeamStudentIds.set([]);
    this.teamPickerMode.set(null);
    this.teamModalError.set('');
    this.createTeamForm.reset();
    this.isCreateTeamModalOpen.set(true);
  }

  closeCreateTeamModal(): void {
    if (this.isCreatingTeam()) {
      return;
    }

    this.isCreateTeamModalOpen.set(false);
    this.selectedTeamStudentIds.set([]);
    this.teamPickerMode.set(null);
    this.teamModalError.set('');
    this.createTeamForm.reset();
  }

  getNewTeamTitle(): string {
    return `Команда ${this.teams().length + 1}`;
  }

  openAddMembersModal(team: AssignmentTeam, assignment: Assignment): void {
    if (!this.canEditTeams(assignment) || this.isTeamFull(team, assignment)) {
      return;
    }

    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.selectedTeamForMembersId.set(team.id);
    this.isAddMembersModalOpen.set(true);
  }

  closeAddMembersModal(): void {
    if (this.processingMemberKey()) {
      return;
    }

    this.isAddMembersModalOpen.set(false);
    this.selectedTeamForMembersId.set(null);
  }

  openCaptainPicker(): void {
    this.teamPickerMode.set('captain');
  }

  openMembersPicker(): void {
    if (!this.selectedCaptain()) {
      this.teamModalError.set('Сначала выберите капитана команды');
      return;
    }

    this.teamModalError.set('');
    this.teamPickerMode.set('members');
  }

  getTeamPickerStudents(mode: 'captain' | 'members'): AssignmentTeamStudent[] {
    const captainId = this.createTeamForm.controls.captainId.getRawValue();

    if (mode === 'members') {
      return this.availableStudents().filter((student) => student.id !== captainId);
    }

    return this.availableStudents();
  }

  setCaptain(studentId: string): void {
    this.createTeamForm.controls.captainId.setValue(studentId);
    this.selectedTeamStudentIds.update((ids) => ids.filter((id) => id !== studentId));

    this.teamPickerMode.set(null);
  }

  toggleTeamStudent(student: AssignmentTeamStudent, maxTeamSize: number): void {
    this.teamModalError.set('');

    const ids = this.selectedTeamStudentIds();
    const isSelected = ids.includes(student.id);
    const captainId = this.createTeamForm.controls.captainId.getRawValue();

    if (student.id === captainId) {
      this.teamModalError.set('Капитан уже входит в свою команду');
      return;
    }

    if (isSelected) {
      this.selectedTeamStudentIds.set(ids.filter((id) => id !== student.id));

      return;
    }

    if (ids.length + 1 >= maxTeamSize) {
      this.teamModalError.set(`В команде может быть не больше ${maxTeamSize} студентов`);
      return;
    }

    this.selectedTeamStudentIds.set([...ids, student.id]);
  }

  isStudentSelected(studentId: string): boolean {
    return this.selectedTeamStudentIds().includes(studentId);
  }

  isTeamCaptain(team: AssignmentTeam, member: AssignmentTeamMember): boolean {
    return team.captain?.userId === member.userId;
  }

  createTeam(): void {
    this.createTeamForm.markAllAsTouched();
    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.teamModalError.set('');

    const assignment = this.assignment();
    if (!assignment || !this.canCreateTeams(assignment) || this.createTeamForm.invalid) {
      if (this.createTeamForm.controls.captainId.invalid) {
        this.teamModalError.set('Сначала выберите капитана команды');
      }
      return;
    }

    const captainId = this.createTeamForm.controls.captainId.getRawValue();
    this.isCreatingTeam.set(true);

    this.assignmentsService.assignCaptain(assignment.id, captainId).subscribe({
      next: () => this.addMembersToCaptainTeam(assignment.id, captainId),
      error: (err) => {
        console.error(err);
        this.isCreatingTeam.set(false);
        this.teamModalError.set(this.getApiErrorMessage(err, 'Не удалось создать команду капитана'));
      },
    });
  }

  private addMembersToCaptainTeam(assignmentId: string, captainId: string): void {
    const studentIds = Array.from(
      new Set(this.selectedTeamStudentIds().filter((studentId) => studentId && studentId !== captainId)),
    );

    if (!studentIds.length) {
      this.finishTeamCreation(assignmentId, 'Команда капитана создана');
      return;
    }

    this.assignmentsService.getManualDistribution(assignmentId).subscribe({
      next: (response) => {
        const team = response.teams.find((item) => item.captain?.userId === captainId);

        if (!team) {
          this.isCreatingTeam.set(false);
          this.teamsError.set('Команда капитана создана, но не удалось найти ее для добавления участников');
          this.teams.set(response.teams);
          this.availableStudents.set(response.availableStudents);
          return;
        }

        forkJoin(studentIds.map((studentId) => this.assignmentsService.addTeamMember(team.id, studentId))).subscribe({
          next: () => this.finishTeamCreation(assignmentId, 'Команда капитана создана, участники добавлены'),
          error: (err) => {
            console.error(err);
            this.isCreatingTeam.set(false);
            this.teamsError.set('Команда капитана создана, но не удалось добавить всех участников');
            this.loadManualDistribution(assignmentId);
          },
        });
      },
      error: (err) => {
        console.error(err);
        this.isCreatingTeam.set(false);
        this.teamsError.set('Команда капитана создана, но не удалось обновить список команд');
        const assignment = this.assignment();
        if (assignment) {
          this.refreshTeamManagementData(assignment);
        }
      },
    });
  }

  private finishTeamCreation(assignmentId: string, message: string): void {
    this.createTeamForm.reset();
    this.selectedTeamStudentIds.set([]);
    this.teamPickerMode.set(null);
    this.teamModalError.set('');
    this.isCreateTeamModalOpen.set(false);
    this.isCreatingTeam.set(false);
    this.teamsSuccess.set(message);
    const assignment = this.assignment();
    if (assignment) {
      this.refreshTeamManagementData(assignment);
    }
  }

  addStudentToTeam(team: AssignmentTeam, student: AssignmentTeamStudent): void {
    const assignment = this.assignment();
    if (!assignment || !this.canEditTeams(assignment) || this.processingMemberKey()) {
      return;
    }

    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.processingMemberKey.set(`${team.id}:${student.id}:add`);

    this.assignmentsService.addTeamMember(team.id, student.id).subscribe({
      next: () => {
        this.processingMemberKey.set(null);
        this.teamsSuccess.set('Студент добавлен в команду');
        this.refreshTeamManagementData(assignment);
      },
      error: (err) => {
        console.error(err);
        this.processingMemberKey.set(null);
        this.teamsError.set('Не удалось добавить студента в команду');
      },
    });
  }

  removeStudentFromTeam(team: AssignmentTeam, member: AssignmentTeamMember): void {
    const assignment = this.assignment();
    if (!assignment || !this.canEditTeams(assignment) || this.processingMemberKey()) {
      return;
    }

    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.processingMemberKey.set(`${team.id}:${member.userId}:remove`);

    this.assignmentsService.removeTeamMember(team.id, member.userId).subscribe({
      next: () => {
        this.processingMemberKey.set(null);
        this.teamsSuccess.set('Студент удален из команды');
        this.refreshTeamManagementData(assignment);
      },
      error: (err) => {
        console.error(err);
        this.processingMemberKey.set(null);
        this.teamsError.set('Не удалось удалить студента из команды');
      },
    });
  }

  lockManualTeams(): void {
    const assignment = this.assignment();
    if (!assignment || !this.canLockManualTeams(assignment) || this.isLockingTeams()) {
      return;
    }

    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.isLockingTeams.set(true);

    this.assignmentsService.lockTeams(assignment.id).subscribe({
      next: () => {
        this.isLockingTeams.set(false);
        this.teamsSuccess.set('Состав команд зафиксирован');
        this.assignment.set({
          ...assignment,
          isTeamCompositionLocked: true,
          teamCompositionLockedAtUtc: new Date().toISOString(),
        });
        this.loadManualDistribution(assignment.id);
      },
      error: (err) => {
        console.error(err);
        this.isLockingTeams.set(false);
        this.teamsError.set(this.getApiErrorMessage(err, 'Не удалось зафиксировать состав команд'));
      },
    });
  }

  isTeamFull(team: AssignmentTeam, assignment: Assignment): boolean {
    return team.members.length >= assignment.maxTeamSize;
  }

  isMyTeam(team: AssignmentTeam): boolean {
    return this.captainInfo()?.teamId === team.id;
  }

  canJoinSelfSelectionTeam(team: AssignmentTeam, assignment: Assignment): boolean {
    return (
      this.canUseSelfSelectionTeams(assignment) &&
      !this.captainInfo()?.teamId &&
      !this.isTeamFull(team, assignment)
    );
  }

  canLeaveSelfSelectionTeam(team: AssignmentTeam, assignment: Assignment): boolean {
    return (
      this.canUseSelfSelectionTeams(assignment) &&
      this.isMyTeam(team) &&
      !this.captainInfo()?.isCaptain
    );
  }

  getSelfSelectionStageTitle(assignment: Assignment): string {
    if (this.isCaptainSelectionOpen(assignment)) {
      return this.captainInfo()?.isCaptain
        ? 'Вы уже капитан команды'
        : 'Сейчас идет выбор капитанов';
    }

    if (this.isBeforeTeamFormationStart(assignment)) {
      return 'Скоро начнется выбор команд';
    }

    if (this.isTeamFormationStageOpen(assignment)) {
      if (this.captainInfo()?.isCaptain) {
        return 'Вы капитан команды';
      }

      if (this.captainInfo()?.teamId) {
        return 'Вы уже в команде';
      }

      return 'Сейчас можно вступить в команду';
    }

    if (this.hasTeamFormationEnded(assignment)) {
      return 'Формирование команд завершено';
    }

    return 'Команды задания';
  }

  getSelfSelectionStageText(assignment: Assignment): string {
    if (this.isCaptainSelectionOpen(assignment)) {
      return this.captainInfo()?.isCaptain
        ? 'После начала формирования остальные студенты смогут присоединиться к вашей команде.'
        : 'Можно назначить себя капитаном. Позже другие студенты смогут вступить в команды капитанов.';
    }

    if (this.isBeforeTeamFormationStart(assignment)) {
      return 'Выбор капитанов завершен. Когда начнется формирование команд, здесь появятся доступные действия.';
    }

    if (this.isTeamFormationStageOpen(assignment)) {
      if (this.captainInfo()?.isCaptain) {
        return 'Следите за составом команды. Другие студенты могут присоединиться, пока этап открыт.';
      }

      if (this.captainInfo()?.teamId) {
        return 'Вы можете оставаться в этой команде или выйти из нее до завершения формирования.';
      }

      return 'Выберите подходящую команду из списка ниже и нажмите «Вступить».';
    }

    if (this.hasTeamFormationEnded(assignment)) {
      return 'Составы команд больше нельзя менять, список доступен только для просмотра.';
    }

    return 'Здесь отображается текущий этап работы с командами.';
  }

  joinSelfSelectionTeam(team: AssignmentTeam): void {
    const assignment = this.assignment();
    if (!assignment || !this.canJoinSelfSelectionTeam(team, assignment) || this.processingSelfTeamId()) {
      return;
    }

    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.processingSelfTeamId.set(team.id);

    this.assignmentsService.joinTeamSelf(team.id).subscribe({
      next: () => {
        this.processingSelfTeamId.set(null);
        this.teamsSuccess.set('Вы вступили в команду');
        this.loadCaptainInfo(assignment.id);
        this.loadAssignmentTeams(assignment.id);
      },
      error: (err) => {
        console.error(err);
        this.processingSelfTeamId.set(null);
        this.teamsError.set(this.getApiErrorMessage(err, 'Не удалось вступить в команду'));
      },
    });
  }

  leaveSelfSelectionTeam(team: AssignmentTeam): void {
    const assignment = this.assignment();
    if (!assignment || !this.canLeaveSelfSelectionTeam(team, assignment) || this.processingSelfTeamId()) {
      return;
    }

    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.processingSelfTeamId.set(team.id);

    this.assignmentsService.leaveTeamSelf(team.id).subscribe({
      next: () => {
        this.processingSelfTeamId.set(null);
        this.teamsSuccess.set('Вы вышли из команды');
        this.loadCaptainInfo(assignment.id);
        this.loadAssignmentTeams(assignment.id);
      },
      error: (err) => {
        console.error(err);
        this.processingSelfTeamId.set(null);
        this.teamsError.set(this.getApiErrorMessage(err, 'Не удалось выйти из команды'));
      },
    });
  }

  loadCaptainInfoIfAvailable(assignment: Assignment): void {
    if (!this.shouldLoadCaptainInfo(assignment)) {
      this.captainInfo.set(null);
      return;
    }

    this.loadCaptainInfo(assignment.id);
  }

  shouldLoadCaptainInfo(assignment: Assignment): boolean {
    return (
      this.isStudent() &&
      (assignment.teamFormationMode !== 'teacher_managed' ||
        (assignment.requiresSubmission && this.hasTeamFormationEnded(assignment)))
    );
  }

  loadCaptainInfo(assignmentId: string): void {
    this.isCaptainInfoLoading.set(true);
    this.captainActionError.set('');

    this.assignmentsService.getMyCaptainInfo(assignmentId).subscribe({
      next: (captainInfo) => {
        this.captainInfo.set(captainInfo);
        this.isCaptainInfoLoading.set(false);

        const assignment = this.assignment();
        if (assignment && this.canViewCaptainFinalSelection(assignment, captainInfo)) {
          this.loadCaptainTeam(assignment.id);
        }
      },
      error: (err) => {
        console.error(err);
        this.captainInfo.set(null);
        this.captainTeam.set(null);
        this.isCaptainInfoLoading.set(false);
        this.captainActionError.set('Не удалось загрузить статус капитана');
      },
    });
  }

  loadCaptainTeam(assignmentId: string): void {
    this.isCaptainTeamLoading.set(true);
    this.captainTeamError.set('');

    this.assignmentsService.getCaptainMyTeam(assignmentId).subscribe({
      next: (team) => {
        this.captainTeam.set(team);
        this.isCaptainTeamLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.captainTeam.set(null);
        this.isCaptainTeamLoading.set(false);
        this.captainTeamError.set(this.getApiErrorMessage(err, 'Не удалось загрузить решения команды'));
      },
    });
  }

  shouldShowCaptainControls(assignment: Assignment): boolean {
    return (
      this.isStudent() &&
      assignment.teamFormationMode !== 'teacher_managed' &&
      this.isCaptainSelectionOpen(assignment)
    );
  }

  getUnavailableAssignmentText(assignment: Assignment): string {
    if (this.shouldShowCaptainControls(assignment)) {
      return 'Сейчас идет выбор капитанов. Можно назначить себя капитаном команды, а само задание откроется позже.';
    }

    if (this.isStudent()) {
      return 'Задание пока недоступно. Когда этап откроется, здесь появятся доступные действия.';
    }

    return 'Задание пока недоступно студентам. Преподаватель может управлять командами и настройками задания.';
  }

  getCaptainPanelStatus(): string {
    return this.isCurrentUserCaptain()
      ? 'Вы капитан команды'
      : 'Вы пока не капитан команды';
  }

  getCaptainActionLabel(): string {
    if (this.isCaptainActionLoading()) {
      return 'Сохраняем...';
    }

    return this.isCurrentUserCaptain()
      ? 'Отказаться от роли капитана'
      : 'Стать капитаном';
  }

  isCaptainSelectionOpen(assignment: Assignment): boolean {
    if (!assignment.captainSelectionEndsAtUtc) {
      return this.isTeamFormationOpen(assignment);
    }

    return new Date().getTime() <= new Date(assignment.captainSelectionEndsAtUtc).getTime();
  }

  isTeamFormationOpen(assignment: Assignment): boolean {
    if (!assignment.teamFormationEndsAtUtc) {
      return false;
    }

    return new Date().getTime() < new Date(assignment.teamFormationEndsAtUtc).getTime();
  }

  hasDeadlinePassed(assignment: Assignment): boolean {
    if (!assignment.deadline) {
      return false;
    }

    return new Date().getTime() >= new Date(assignment.deadline).getTime();
  }

  canSubmitSolution(assignment: Assignment): boolean {
    return (
      this.isStudent() &&
      assignment.requiresSubmission &&
      this.hasTeamFormationEnded(assignment) &&
      !this.hasDeadlinePassed(assignment)
    );
  }

  shouldShowSubmissionBlock(assignment: Assignment): boolean {
    return this.isStudent() && assignment.requiresSubmission && this.hasTeamFormationEnded(assignment);
  }

  getTeamsStageSubtitle(assignment: Assignment, formationText: string): string {
    if (this.hasTeamFormationEnded(assignment) && assignment.requiresSubmission && !this.hasDeadlinePassed(assignment)) {
      return 'Состав команды. Сейчас участники выполняют задание и отправляют решения.';
    }

    if (this.hasDeadlinePassed(assignment)) {
      return 'Состав команды. Дедлайн прошел, можно смотреть решения и выставлять оценки.';
    }

    if (assignment.isTeamCompositionLocked) {
      return 'Состав команды зафиксирован.';
    }

    return formationText;
  }

  getTeamsStageNotice(assignment: Assignment): string {
    if (this.hasTeamFormationEnded(assignment) && assignment.requiresSubmission && !this.hasDeadlinePassed(assignment)) {
      return 'Состав команды зафиксирован. Сейчас идет этап выполнения задания.';
    }

    if (this.hasDeadlinePassed(assignment)) {
      return 'Дедлайн прошел. Решения можно открыть и проверить.';
    }

    if (assignment.isTeamCompositionLocked) {
      return 'Состав команды зафиксирован.';
    }

    return 'Состав команды доступен для просмотра.';
  }

  loadMySubmissionIfAvailable(assignment: Assignment): void {
    if (!this.shouldShowSubmissionBlock(assignment)) {
      this.mySubmission.set(null);
      this.mySubmissionError.set('');
      this.isMySubmissionLoading.set(false);
      return;
    }

    this.loadMySubmission(assignment.id);
  }

  loadMySubmission(assignmentId: string): void {
    this.isMySubmissionLoading.set(true);
    this.mySubmissionError.set('');

    this.assignmentsService.getMySubmission(assignmentId).subscribe({
      next: (submission) => {
        this.mySubmission.set(submission);
        this.isMySubmissionLoading.set(false);
      },
      error: (err) => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.mySubmission.set(null);
          this.isMySubmissionLoading.set(false);
          return;
        }

        console.error(err);
        this.mySubmission.set(null);
        this.isMySubmissionLoading.set(false);
        this.mySubmissionError.set(this.getApiErrorMessage(err, 'Не удалось загрузить ваше решение'));
      },
    });
  }

  canViewCaptainFinalSelection(
    assignment: Assignment,
    captainInfo = this.captainInfo(),
  ): boolean {
    return (
      this.isStudent() &&
      captainInfo?.isCaptain === true &&
      assignment.requiresSubmission &&
      this.hasTeamFormationEnded(assignment)
    );
  }

  canSelectFinalSubmission(assignment: Assignment, submission: AssignmentSubmission): boolean {
    return (
      this.canViewCaptainFinalSelection(assignment) &&
      !this.hasDeadlinePassed(assignment) &&
      this.captainTeam()?.finalSubmissionId !== submission.id
    );
  }

  onSubmissionFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    if (!files.length) {
      return;
    }

    this.selectedSubmissionFiles.update((currentFiles) => [...currentFiles, ...files]);
    input.value = '';
    this.solutionError.set('');
    this.solutionSuccess.set('');
  }

  removeSubmissionFile(index: number): void {
    this.selectedSubmissionFiles.update((files) => files.filter((_, i) => i !== index));
  }

  uploadSolution(): void {
    const assignment = this.assignment();
    const files = this.selectedSubmissionFiles();

    if (!assignment || !this.canSubmitSolution(assignment) || this.isUploadingSubmission()) {
      return;
    }

    if (!files.length) {
      this.solutionError.set('Выберите хотя бы один файл решения');
      return;
    }

    this.solutionError.set('');
    this.solutionSuccess.set('');
    this.isUploadingSubmission.set(true);

    this.assignmentsService.uploadSubmissionFiles(assignment.id, files).subscribe({
      next: () => {
        this.selectedSubmissionFiles.set([]);
        this.isUploadingSubmission.set(false);
        this.solutionSuccess.set('Решение отправлено');
        this.loadMySubmission(assignment.id);

        if (this.canViewCaptainFinalSelection(assignment)) {
          this.loadCaptainTeam(assignment.id);
        }
      },
      error: (err) => {
        console.error(err);
        this.isUploadingSubmission.set(false);
        this.solutionError.set(this.getApiErrorMessage(err, 'Не удалось отправить решение'));
      },
    });
  }

  selectFinalSubmission(submission: AssignmentSubmission): void {
    const assignment = this.assignment();
    if (!assignment || !this.canSelectFinalSubmission(assignment, submission) || this.finalSubmissionActionId()) {
      return;
    }

    this.captainTeamError.set('');
    this.captainTeamSuccess.set('');
    this.finalSubmissionActionId.set(submission.id);

    this.assignmentsService.selectFinalSubmission(assignment.id, submission.id).subscribe({
      next: () => {
        this.finalSubmissionActionId.set(null);
        this.captainTeamSuccess.set('Финальное решение выбрано');
        this.loadCaptainTeam(assignment.id);
      },
      error: (err) => {
        console.error(err);
        this.finalSubmissionActionId.set(null);
        this.captainTeamError.set(this.getApiErrorMessage(err, 'Не удалось выбрать финальное решение'));
      },
    });
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

    const isCaptain = this.isCurrentUserCaptain();
    const request$ = isCaptain
      ? this.assignmentsService.removeMyselfCaptain(assignment.id)
      : this.assignmentsService.assignMyselfCaptain(assignment.id);

    request$.subscribe({
      next: () => {
        this.captainActionSuccess.set(
          isCaptain
            ? 'Вы отказались от роли капитана'
            : 'Вы стали капитаном',
        );
        this.isCaptainActionLoading.set(false);
        this.loadCaptainInfo(assignment.id);
        if (this.canViewSelfSelectionTeams(assignment)) {
          this.loadAssignmentTeams(assignment.id);
        }
        if (this.canViewCaptainDraft(assignment)) {
          this.loadCaptainDraftBoard(assignment);
        }
      },
      error: (err) => {
        console.error(err);
        this.captainActionError.set(
          isCaptain
            ? 'Не удалось отказаться от роли капитана'
            : 'Не удалось стать капитаном',
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

  getSubmissionAuthor(member: CaptainTeamMemberSubmissions): string {
    return [member.lastName, member.firstName, member.middleName].filter(Boolean).join(' ');
  }

  getSubmissionStatusLabel(status: AssignmentSubmission['status']): string {
    if (status === 1 || status === 'Submitted') {
      return 'Отправлено';
    }

    if (status === 2 || status === 'Reviewed') {
      return 'Проверено';
    }

    if (status === 3 || status === 'Returned') {
      return 'Возвращено';
    }

    return 'Отправлено';
  }

  getCriteriaTotalCount(): number {
    return this.criterionGroups().reduce((total, group) => total + group.criteria.length, 0);
  }

  getCriterionTypeLabel(type: Criterion['type']): string {
    switch (type) {
      case 'score':
        return 'Диапазон';
      case 'pass_fail':
        return 'Чекбокс';
      case 'option':
        return 'Выбор варианта';
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

  getCriterionFormType(): CriterionType {
    return this.normalizeCriterionType(this.criterionForm.controls.type.getRawValue());
  }

  isCriterionFormOpenFor(groupId: string): boolean {
    return this.criterionFormGroupId() === groupId;
  }

  getCriterionFormTitle(): string {
    return this.editingCriterionId() ? 'Редактировать критерий' : 'Новый критерий';
  }

  getCriterionNameError(): string {
    const control = this.criterionForm.controls.name;

    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите название критерия';
    if (control.errors['minlength']) return 'Название должно быть не короче 2 символов';
    if (control.errors['maxlength']) return 'Название должно быть не длиннее 200 символов';
    return '';
  }

  getCriterionScoreError(): string {
    const type = this.getCriterionFormType();

    if (type === 'score') {
      const min = this.criterionForm.controls.scoreMinValue.getRawValue();
      const max = this.criterionForm.controls.scoreMaxValue.getRawValue();

      if (max <= min) {
        return 'Максимум диапазона должен быть больше минимума';
      }
    }

    if (type === 'pass_fail') {
      const maxScore = this.criterionForm.controls.maxScore.getRawValue();
      const passScore = this.criterionForm.controls.passScore.getRawValue();
      const failScore = this.criterionForm.controls.failScore.getRawValue();

      if (passScore > maxScore || failScore > maxScore) {
        return 'Баллы не должны быть больше максимального значения';
      }
    }

    if (type === 'option') {
      const maxScore = this.criterionForm.controls.maxScore.getRawValue();
      const hasEmptyValue = this.optionRows().some((row) => !row.value.trim());
      const hasTooLargeScore = this.optionRows().some((row) => row.score > maxScore);

      if (hasEmptyValue) {
        return 'У каждого варианта должен быть код';
      }

      if (hasTooLargeScore) {
        return 'Баллы вариантов не должны быть больше максимального значения';
      }
    }

    return '';
  }

  private buildCriterionSettings(): CriterionSettings | null {
    const type = this.getCriterionFormType();
    const scoreError = this.getCriterionScoreError();

    if (scoreError) {
      this.criteriaSettingsError.set(scoreError);
      return null;
    }

    if (type === 'score') {
      const minValue = this.criterionForm.controls.scoreMinValue.getRawValue();
      const maxValue = this.criterionForm.controls.scoreMaxValue.getRawValue();

      return {
        minValue,
        maxValue,
        selectedValue: minValue,
        ranges: null,
      };
    }

    if (type === 'pass_fail') {
      return {
        options: [
          { value: 'pass', label: 'Выполнен' },
          { value: 'fail', label: 'Не выполнен' },
        ],
        scoreMappings: [
          { value: 'pass', score: this.criterionForm.controls.passScore.getRawValue() },
          { value: 'fail', score: this.criterionForm.controls.failScore.getRawValue() },
        ],
      };
    }

    if (type === 'option') {
      const rows = this.optionRows().map((row) => ({
        value: row.value.trim(),
        label: row.label.trim() || row.value.trim(),
        score: row.score,
      }));

      return {
        options: rows.map((row) => ({ value: row.value, label: row.label })),
        scoreMappings: rows.map((row) => ({ value: row.value, score: row.score })),
      };
    }

    return {
      coefficient: this.criterionForm.controls.multiplier.getRawValue(),
    };
  }

  private resolveCriterionMaxScore(type: CriterionType): number {
    if (type === 'score') {
      return this.criterionForm.controls.scoreMaxValue.getRawValue();
    }

    if (type === 'multiplier') {
      return 1;
    }

    return this.criterionForm.controls.maxScore.getRawValue();
  }

  private resolveCriterionCategory(type: CriterionType): CriterionCategory {
    return type === 'multiplier'
      ? 'multiplier'
      : this.normalizeCriterionCategory(this.criterionForm.controls.category.getRawValue());
  }

  private normalizeCriterionType(type: string): CriterionType {
    return type === 'score' || type === 'option' || type === 'multiplier'
      ? type
      : 'pass_fail';
  }

  private normalizeCriterionCategory(category: string): CriterionCategory {
    return category === 'bonus' || category === 'penalty' || category === 'multiplier'
      ? category
      : 'main';
  }

  getCriterionGroupNameError(): string {
    const control = this.criterionGroupForm.controls.name;

    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите название группы';
    if (control.errors['minlength']) return 'Название должно быть не короче 2 символов';
    if (control.errors['maxlength']) return 'Название должно быть не длиннее 200 символов';
    return '';
  }

  getEditCriterionGroupNameError(): string {
    const control = this.editCriterionGroupForm.controls.name;

    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите название группы';
    if (control.errors['minlength']) return 'Название должно быть не короче 2 символов';
    if (control.errors['maxlength']) return 'Название должно быть не длиннее 200 символов';
    return '';
  }

  private getApiErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const errorBody = err.error as { title?: string; detail?: string; message?: string } | string | null;

      if (typeof errorBody === 'string' && errorBody.trim()) {
        return errorBody;
      }

      if (errorBody && typeof errorBody === 'object') {
        return errorBody.title || errorBody.detail || errorBody.message || fallback;
      }
    }

    return fallback;
  }

  private toDateTimeLocalInput(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 16);
  }

  private toUtcIso(value: string): string {
    return new Date(value).toISOString();
  }

  trackByCommentId(_: number, comment: AssignmentComment): string {
    return comment.id;
  }

  trackByFileId(_: number, file: Assignment['files'][number]): string {
    return file.id;
  }

  trackBySubmissionFileId(_: number, file: SubmissionFile): string {
    return file.id;
  }

  trackByTeamId(_: number, team: AssignmentTeam): string {
    return team.id;
  }

  trackByCriterionGroupId(_: number, group: CriterionGroupWithCriteria): string {
    return group.id;
  }

  trackByCriterionId(_: number, criterion: Criterion): string {
    return criterion.id;
  }

  trackByMemberId(_: number, member: AssignmentTeamMember): string {
    return member.userId;
  }

  trackByStudentId(_: number, student: AssignmentTeamStudent): string {
    return student.id;
  }

  trackBySubmissionId(_: number, submission: AssignmentSubmission): string {
    return submission.id;
  }

  trackByCaptainTeamMemberId(_: number, member: CaptainTeamMemberSubmissions): string {
    return member.userId;
  }
}

interface CriterionOptionRow {
  value: string;
  label: string;
  score: number;
}

