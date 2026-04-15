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
  AssignmentCaptainInfo,
  CaptainTeam,
  CaptainTeamMemberSubmissions,
  AssignmentTeam,
  AssignmentTeamMember,
  AssignmentTeamStudent,
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
  captainTeam = signal<CaptainTeam | null>(null);
  mySubmission = signal<AssignmentSubmission | null>(null);
  teams = signal<AssignmentTeam[]>([]);
  availableStudents = signal<AssignmentTeamStudent[]>([]);
  selectedSubmissionFiles = signal<File[]>([]);

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
  processingMemberKey = signal<string | null>(null);
  selectedTeamStudentIds = signal<string[]>([]);
  teamPickerMode = signal<'captain' | 'members' | null>(null);
  teamModalError = signal('');
  selectedTeamForMembersId = signal<string | null>(null);

  readonly commentForm = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(1000)]],
  });

  readonly createTeamForm = this.fb.nonNullable.group({
    name: [''],
    captainId: ['', [Validators.required]],
  });

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

  canUseSelfSelectionTeams(assignment: Assignment): boolean {
    return this.isStudent() && this.canViewSelfSelectionTeams(assignment) && this.isTeamFormationStageOpen(assignment);
  }

  canRunRandomDistribution(assignment: Assignment): boolean {
    return (
      this.canManageRandomTeams(assignment) &&
      !this.hasTeamFormationEnded(assignment)
    );
  }

  canEditManualTeams(assignment: Assignment): boolean {
    return (
      this.canManageManualTeams(assignment) &&
      !this.hasTeamFormationEnded(assignment) &&
      !assignment.isTeamCompositionLocked
    );
  }

  canLockManualTeams(assignment: Assignment): boolean {
    return this.canEditManualTeams(assignment) && this.teams().length > 1;
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
    if (!assignment || !this.canEditManualTeams(assignment)) {
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
    if (!this.canEditManualTeams(assignment) || this.isTeamFull(team, assignment)) {
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
    if (!assignment || !this.canEditManualTeams(assignment) || this.createTeamForm.invalid) {
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
        this.loadManualDistribution(assignmentId);
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
    this.loadManualDistribution(assignmentId);
  }

  addStudentToTeam(team: AssignmentTeam, student: AssignmentTeamStudent): void {
    const assignment = this.assignment();
    if (!assignment || !this.canEditManualTeams(assignment) || this.processingMemberKey()) {
      return;
    }

    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.processingMemberKey.set(`${team.id}:${student.id}:add`);

    this.assignmentsService.addTeamMember(team.id, student.id).subscribe({
      next: () => {
        this.processingMemberKey.set(null);
        this.teamsSuccess.set('Студент добавлен в команду');
        this.loadManualDistribution(assignment.id);
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
    if (!assignment || !this.canEditManualTeams(assignment) || this.processingMemberKey()) {
      return;
    }

    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.processingMemberKey.set(`${team.id}:${member.userId}:remove`);

    this.assignmentsService.removeTeamMember(team.id, member.userId).subscribe({
      next: () => {
        this.processingMemberKey.set(null);
        this.teamsSuccess.set('Студент удален из команды');
        this.loadManualDistribution(assignment.id);
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
        if (this.canViewSelfSelectionTeams(assignment)) {
          this.loadAssignmentTeams(assignment.id);
        }
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

