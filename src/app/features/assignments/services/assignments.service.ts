import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Assignment, AssignmentSubmission } from '../../../core/models/assigment.model';
import { AssignmentComment } from '../../../core/models/assignment-comment.model';
import {
  AssignmentGradingRules,
  CreateCriterionRequest,
  CreateCriterionGroupRequest,
  Criterion,
  CriterionGroup,
  SaveSubmissionAssessmentRequest,
  SubmissionAssessment,
  SubmissionAssessmentForm,
  UpdateCriterionRequest,
  UpdateCriterionGroupRequest,
} from '../../../core/models/grading.model';

export interface CreateAssignmentRequest {
  courseId: string;
  title: string;
  text: string;
  startsAtUtc: string;
  minTeamSize: number;
  maxTeamSize: number;
  teamFormationMode: string;
  captainSelectionEndsAtUtc: string;
  teamFormationEndsAtUtc: string;
  isVisible: boolean;
  requiresSubmission: boolean;
  peerReviewEnabled: boolean;
  peerReviewStartsAtUtc: string | null;
  peerReviewEndsAtUtc: string | null;
  peerReviewRequiredReviewsCount: number | null;
  peerReviewPenaltyPercent: number | null;
  deadline: string;
}

export interface UpdateAssignmentPeerReviewRequest {
  peerReviewEnabled: boolean;
  peerReviewStartsAtUtc: string | null;
  peerReviewEndsAtUtc: string | null;
  peerReviewRequiredReviewsCount: number | null;
  peerReviewPenaltyPercent: number | null;
}

export interface PeerReviewAssignmentInfo {
  id: string;
  assignmentId: string;
  reviewerTeamId: string;
  reviewerTeamName: string;
  reviewedTeamId: string;
  reviewedTeamName: string;
  createdAtUtc: string;
}

export interface PeerReviewAssignmentResult {
  assignmentId: string;
  teamsCount: number;
  requiredReviewsCount: number;
  assignments: PeerReviewAssignmentInfo[];
}

export interface AssignmentCaptainInfo {
  assignmentId: string;
  isCaptain: boolean;
  teamId: string | null;
  finalSubmissionId: string | null;
  canSelectFinalSubmission: boolean;
}

export interface AssignmentTeamMember {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAtUtc: string;
}

export interface AssignmentTeamStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isBlocked: boolean;
}

export interface AssignmentTeam {
  id: string;
  assignmentId: string;
  captain: AssignmentTeamMember | null;
  finalSubmissionId: string | null;
  name: string;
  createdAtUtc: string;
  members: AssignmentTeamMember[];
}

export interface ManualDistributionResponse {
  teams: AssignmentTeam[];
  availableStudents: AssignmentTeamStudent[];
}

export interface CaptainTeamMemberSubmissions {
  userId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  submissions: AssignmentSubmission[];
}

export interface CaptainTeam {
  id: string;
  assignmentId: string;
  name: string;
  captain: AssignmentTeamMember;
  finalSubmissionId: string | null;
  members: CaptainTeamMemberSubmissions[];
}

export interface AssignmentDraftState {
  isStarted: boolean;
  isCompleted: boolean;
  currentCaptainUserId: string | null;
  startedAtUtc: string | null;
  completedAtUtc: string | null;
  teams: AssignmentTeam[];
  availableStudents: AssignmentTeamStudent[];
}

export interface SubmissionGrade {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  grade: number | null;
  teacherComment: string | null;
  gradedByTeacherId: string | null;
  gradedAtUtc: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AssignmentsService {
  private readonly http = inject(HttpClient);

  private readonly rootUrl = 'http://111.88.156.199:5196';
  private readonly baseUrl = 'http://111.88.156.199:5196/api/assignments';
  private readonly submissionsUrl = 'http://111.88.156.199:5196/api/submissions';


  getAssignmentById(assignmentId: string): Observable<Assignment> {
    return this.http.get<Assignment>(`${this.baseUrl}/${assignmentId}`);
  }

  getAssignmentComments(assignmentId: string): Observable<AssignmentComment[]> {
    return this.http.get<AssignmentComment[]>(`${this.baseUrl}/${assignmentId}/comments`);
  }

  getGradingRules(assignmentId: string): Observable<AssignmentGradingRules> {
    return this.http.get<AssignmentGradingRules>(`${this.baseUrl}/${assignmentId}/grading-rules`);
  }

  updateGradingRules(
    assignmentId: string,
    payload: AssignmentGradingRules,
  ): Observable<AssignmentGradingRules> {
    return this.http.put<AssignmentGradingRules>(
      `${this.baseUrl}/${assignmentId}/grading-rules`,
      payload,
    );
  }

  updatePeerReviewSettings(
    assignmentId: string,
    payload: UpdateAssignmentPeerReviewRequest,
  ): Observable<Assignment> {
    return this.http.patch<Assignment>(`${this.baseUrl}/${assignmentId}/peer-review`, payload);
  }

  generatePeerReviewAssignments(assignmentId: string): Observable<PeerReviewAssignmentResult> {
    return this.http.post<PeerReviewAssignmentResult>(
      `${this.baseUrl}/${assignmentId}/peer-review/assignments/generate`,
      {},
    );
  }

  getCriterionGroups(assignmentId: string): Observable<CriterionGroup[]> {
    return this.http.get<CriterionGroup[]>(`${this.baseUrl}/${assignmentId}/criterion-groups`);
  }

  createCriterionGroup(
    assignmentId: string,
    payload: CreateCriterionGroupRequest,
  ): Observable<CriterionGroup> {
    return this.http.post<CriterionGroup>(`${this.baseUrl}/${assignmentId}/criterion-groups`, payload);
  }

  updateCriterionGroup(
    criterionGroupId: string,
    payload: UpdateCriterionGroupRequest,
  ): Observable<CriterionGroup> {
    return this.http.put<CriterionGroup>(
      `${this.baseUrl}/criterion-groups/${criterionGroupId}`,
      payload,
    );
  }

  deleteCriterionGroup(criterionGroupId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/criterion-groups/${criterionGroupId}`);
  }

  getCriteria(criterionGroupId: string): Observable<Criterion[]> {
    return this.http.get<Criterion[]>(
      `${this.rootUrl}/api/criterion-groups/${criterionGroupId}/criteria`,
    );
  }

  createCriterion(
    criterionGroupId: string,
    payload: CreateCriterionRequest,
  ): Observable<Criterion> {
    return this.http.post<Criterion>(
      `${this.rootUrl}/api/criterion-groups/${criterionGroupId}/criteria`,
      payload,
    );
  }

  updateCriterion(criterionId: string, payload: UpdateCriterionRequest): Observable<Criterion> {
    return this.http.put<Criterion>(`${this.rootUrl}/api/criteria/${criterionId}`, payload);
  }

  deleteCriterion(criterionId: string): Observable<void> {
    return this.http.delete<void>(`${this.rootUrl}/api/criteria/${criterionId}`);
  }

  getMyCaptainInfo(assignmentId: string): Observable<AssignmentCaptainInfo> {
    return this.http.get<AssignmentCaptainInfo>(`${this.baseUrl}/${assignmentId}/captains/me`);
  }

  assignMyselfCaptain(assignmentId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${assignmentId}/captains/self`, {});
  }

  assignCaptain(assignmentId: string, studentId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${assignmentId}/captains/${studentId}`, {});
  }

  removeMyselfCaptain(assignmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${assignmentId}/captains/self`);
  }

  getAssignmentCaptains(assignmentId: string): Observable<AssignmentTeamMember[]> {
    return this.http.get<AssignmentTeamMember[]>(`${this.baseUrl}/${assignmentId}/captains`);
  }

  removeCaptain(assignmentId: string, studentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${assignmentId}/captains/${studentId}`);
  }

  createComment(assignmentId: string, payload: { text: string }): Observable<AssignmentComment> {
    return this.http.post<AssignmentComment>(`${this.baseUrl}/${assignmentId}/comments`, payload);
  }

  createAssignment(payload: CreateAssignmentRequest): Observable<Assignment> {
    return this.http.post<Assignment>(this.baseUrl, payload);
  }

  createTeam(assignmentId: string, payload: { name: string }): Observable<AssignmentTeam> {
    return this.http.post<AssignmentTeam>(`${this.baseUrl}/${assignmentId}/teams`, payload);
  }

  getAssignmentTeams(assignmentId: string): Observable<AssignmentTeam[]> {
    return this.http.get<AssignmentTeam[]>(`${this.baseUrl}/${assignmentId}/teams`);
  }

  getManualDistribution(assignmentId: string): Observable<ManualDistributionResponse> {
    return this.http.get<ManualDistributionResponse>(
      `${this.baseUrl}/${assignmentId}/teams/manual-distribution`,
    );
  }

  runRandomDistribution(assignmentId: string): Observable<AssignmentTeam[]> {
    return this.http.post<AssignmentTeam[]>(
      `${this.baseUrl}/${assignmentId}/teams/random-distribution`,
      {},
    );
  }

  getDraftState(assignmentId: string): Observable<AssignmentDraftState> {
    return this.http.get<AssignmentDraftState>(`${this.baseUrl}/${assignmentId}/teams/draft`);
  }

  startDraft(assignmentId: string): Observable<AssignmentDraftState> {
    return this.http.post<AssignmentDraftState>(`${this.baseUrl}/${assignmentId}/teams/draft/start`, {});
  }

  pickDraftStudent(assignmentId: string, studentId: string): Observable<AssignmentDraftState> {
    return this.http.post<AssignmentDraftState>(
      `${this.baseUrl}/${assignmentId}/teams/draft/pick/${studentId}`,
      {},
    );
  }

  addTeamMember(teamId: string, studentId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/teams/${teamId}/members/${studentId}`, {});
  }

  removeTeamMember(teamId: string, studentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/teams/${teamId}/members/${studentId}`);
  }

  lockTeams(assignmentId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${assignmentId}/teams/lock`, {});
  }

  joinTeamSelf(teamId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/teams/${teamId}/join-self`, {});
  }

  leaveTeamSelf(teamId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/teams/${teamId}/leave-self`);
  }

  uploadAssignmentFiles(assignmentId: string, files: File[]): Observable<void> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });

    return this.http.post<void>(`${this.baseUrl}/${assignmentId}/files`, formData);
  }

  uploadSubmissionFiles(assignmentId: string, files: File[]): Observable<AssignmentSubmission> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });

    return this.http.post<AssignmentSubmission>(`${this.submissionsUrl}/${assignmentId}/files`, formData);
  }

  getMySubmission(assignmentId: string): Observable<AssignmentSubmission> {
    return this.http.get<AssignmentSubmission>(
      `${this.rootUrl}/assignments/${assignmentId}/my-submission`,
    );
  }

  getCaptainMyTeam(assignmentId: string): Observable<CaptainTeam> {
    return this.http.get<CaptainTeam>(`${this.baseUrl}/${assignmentId}/teams/captain/my-team`);
  }

  selectFinalSubmission(assignmentId: string, submissionId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${assignmentId}/teams/captain/final-submission`, {
      submissionId,
    });
  }

  getAssignmentSubmissions(assignmentId: string) {
    return this.http.get<AssignmentSubmission[]>(
      `${this.rootUrl}/assignments/${assignmentId}/submissions`,
    );
  }

  getAssignmentSubmissionById(assignmentId: string, submissionId: string) {
    return this.http.get<AssignmentSubmission>(`${this.submissionsUrl}/${submissionId}`);
  }

  getSubmissionAssessmentForm(submissionId: string): Observable<SubmissionAssessmentForm> {
    return this.http.get<SubmissionAssessmentForm>(
      `${this.submissionsUrl}/${submissionId}/assessment-form`,
    );
  }

  getSubmissionAssessment(submissionId: string): Observable<SubmissionAssessment> {
    return this.http.get<SubmissionAssessment>(`${this.submissionsUrl}/${submissionId}/assessment`);
  }

  saveSubmissionAssessment(
    submissionId: string,
    payload: SaveSubmissionAssessmentRequest,
  ): Observable<SubmissionAssessment> {
    return this.http.put<SubmissionAssessment>(
      `${this.submissionsUrl}/${submissionId}/assessment`,
      payload,
    );
  }

  updateSubmissionGrade(submissionId: string, payload: { value: number; comment?: string | null }) {
    return this.http.put<SubmissionGrade>(
      `http://111.88.156.199:5196/api/submissions/${submissionId}/grade`,
      payload,
    );
  }

  deleteSubmissionGrade(submissionId: string): Observable<void> {
    return this.http.delete<void>(`${this.submissionsUrl}/${submissionId}/grade`);
  }
}
