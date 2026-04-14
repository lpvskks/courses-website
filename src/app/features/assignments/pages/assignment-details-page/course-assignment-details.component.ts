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
import { forkJoin } from 'rxjs';

import { Assignment } from '../../../../core/models/assigment.model';
import { AssignmentComment } from '../../../../core/models/assignment-comment.model';
import {
  AssignmentCaptainInfo,
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
  teams = signal<AssignmentTeam[]>([]);
  availableStudents = signal<AssignmentTeamStudent[]>([]);

  isLoading = signal(true);
  isCommentsLoading = signal(true);
  isSendingComment = signal(false);
  isCaptainInfoLoading = signal(false);
  isCaptainActionLoading = signal(false);
  isTeamsLoading = signal(false);
  isCreatingTeam = signal(false);
  isCreateTeamModalOpen = signal(false);
  isAddMembersModalOpen = signal(false);

  loadError = signal('');
  commentsError = signal('');
  submitError = signal('');
  submitSuccess = signal('');
  captainActionError = signal('');
  captainActionSuccess = signal('');
  unavailableAssignmentNotice = signal('');
  teamsError = signal('');
  teamsSuccess = signal('');
  processingMemberKey = signal<string | null>(null);
  selectedTeamStudentIds = signal<string[]>([]);
  teamPickerMode = signal<'captain' | 'members' | null>(null);
  teamModalError = signal('');
  selectedTeamForMembersId = signal<string | null>(null);

  readonly commentForm = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(1000)]],
  });

  readonly createTeamForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    captainId: [''],
  });

  readonly selectedTeamStudents = computed(() => {
    const selectedIds = new Set(this.selectedTeamStudentIds());
    return this.availableStudents().filter((student) => selectedIds.has(student.id));
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
    this.captainInfo.set(null);
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

  resetTeamsState(): void {
    this.teams.set([]);
    this.availableStudents.set([]);
    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.processingMemberKey.set(null);
    this.selectedTeamStudentIds.set([]);
    this.teamPickerMode.set(null);
    this.teamModalError.set('');
    this.selectedTeamForMembersId.set(null);
    this.isAddMembersModalOpen.set(false);
    this.createTeamForm.reset();
    this.isCreateTeamModalOpen.set(false);
  }

  loadTeamsIfAvailable(assignment: Assignment): void {
    if (!this.canManageManualTeams(assignment)) {
      return;
    }

    this.loadManualDistribution(assignment.id);
  }

  canManageManualTeams(assignment: Assignment): boolean {
    return (this.isAdmin() || this.isTeacher()) && assignment.teamFormationMode === 'teacher_managed';
  }

  canEditManualTeams(assignment: Assignment): boolean {
    return this.canManageManualTeams(assignment) && !this.hasAssignmentStarted(assignment);
  }

  hasAssignmentStarted(assignment: Assignment): boolean {
    if (!assignment.startsAtUtc) {
      return false;
    }

    return new Date().getTime() >= new Date(assignment.startsAtUtc).getTime();
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

  openCreateTeamModal(): void {
    const assignment = this.assignment();
    if (!assignment || !this.canEditManualTeams(assignment)) {
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
    this.teamPickerMode.set('members');
  }

  setCaptain(studentId: string): void {
    this.createTeamForm.controls.captainId.setValue(studentId);

    if (studentId && !this.selectedTeamStudentIds().includes(studentId)) {
      this.selectedTeamStudentIds.update((ids) => [...ids, studentId]);
    }

    this.teamPickerMode.set(null);
  }

  toggleTeamStudent(student: AssignmentTeamStudent, maxTeamSize: number): void {
    this.teamModalError.set('');

    const ids = this.selectedTeamStudentIds();
    const isSelected = ids.includes(student.id);

    if (isSelected) {
      this.selectedTeamStudentIds.set(ids.filter((id) => id !== student.id));

      if (this.createTeamForm.controls.captainId.getRawValue() === student.id) {
        this.createTeamForm.controls.captainId.setValue('');
      }

      return;
    }

    if (ids.length >= maxTeamSize) {
      this.teamModalError.set(`В команде может быть не больше ${maxTeamSize} студентов`);
      return;
    }

    this.selectedTeamStudentIds.set([...ids, student.id]);
  }

  isStudentSelected(studentId: string): boolean {
    return this.selectedTeamStudentIds().includes(studentId);
  }

  createTeam(): void {
    this.createTeamForm.markAllAsTouched();
    this.teamsError.set('');
    this.teamsSuccess.set('');
    this.teamModalError.set('');

    const assignment = this.assignment();
    if (!assignment || !this.canEditManualTeams(assignment) || this.createTeamForm.invalid) {
      return;
    }

    const name = this.createTeamForm.controls.name.getRawValue().trim();
    if (!name) {
      this.createTeamForm.controls.name.setErrors({ required: true });
      return;
    }

    this.isCreatingTeam.set(true);

    this.assignmentsService.createTeam(assignment.id, { name }).subscribe({
      next: (team) => {
        this.addInitialMembersToCreatedTeam(assignment.id, team);
      },
      error: (err) => {
        console.error(err);
        this.isCreatingTeam.set(false);
        this.teamsError.set('Не удалось создать команду');
      },
    });
  }

  private addInitialMembersToCreatedTeam(assignmentId: string, team: AssignmentTeam): void {
    const captainId = this.createTeamForm.controls.captainId.getRawValue();
    const studentIds = Array.from(new Set([...this.selectedTeamStudentIds(), captainId].filter(Boolean)));

    if (!studentIds.length) {
      this.finishTeamCreation(assignmentId, 'Команда создана');
      return;
    }

    forkJoin(studentIds.map((studentId) => this.assignmentsService.addTeamMember(team.id, studentId))).subscribe({
      next: () => {
        if (!captainId) {
          this.finishTeamCreation(assignmentId, 'Команда создана, студенты добавлены');
          return;
        }

        this.assignCaptainAfterTeamCreation(assignmentId, captainId);
      },
      error: (err) => {
        console.error(err);
        this.isCreatingTeam.set(false);
        this.teamsError.set('Команда создана, но не удалось добавить всех студентов');
        this.loadManualDistribution(assignmentId);
      },
    });
  }

  private assignCaptainAfterTeamCreation(assignmentId: string, captainId: string): void {
    this.assignmentsService.assignCaptain(assignmentId, captainId).subscribe({
      next: () => this.finishTeamCreation(assignmentId, 'Команда создана, капитан назначен'),
      error: (err) => {
        console.error(err);
        this.isCreatingTeam.set(false);
        this.teamsError.set('Команда создана, но не удалось назначить капитана');
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

  isTeamFull(team: AssignmentTeam, assignment: Assignment): boolean {
    return team.members.length >= assignment.maxTeamSize;
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

  trackByTeamId(_: number, team: AssignmentTeam): string {
    return team.id;
  }

  trackByMemberId(_: number, member: AssignmentTeamMember): string {
    return member.userId;
  }

  trackByStudentId(_: number, student: AssignmentTeamStudent): string {
    return student.id;
  }
}
