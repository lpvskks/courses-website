import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';

import { Assignment, AssignmentSubmission } from '../../../core/models/assigment.model';
import { AssignmentComment } from '../../../core/models/assignment-comment.model';
import { MOCK_ASSIGNMENT_SUBMISSIONS } from '../mocks/assignment-submissions.mock';

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
  deadline: string;
}

@Injectable({
  providedIn: 'root',
})
export class AssignmentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://111.88.155.34:5196/api/assignments';

  getAssignmentById(assignmentId: string): Observable<Assignment> {
    return this.http.get<Assignment>(`${this.baseUrl}/${assignmentId}`);
  }

  getAssignmentComments(assignmentId: string): Observable<AssignmentComment[]> {
    return this.http.get<AssignmentComment[]>(`${this.baseUrl}/${assignmentId}/comments`);
  }

  createComment(assignmentId: string, payload: { text: string }): Observable<AssignmentComment> {
    return this.http.post<AssignmentComment>(`${this.baseUrl}/${assignmentId}/comments`, payload);
  }

  createAssignment(payload: CreateAssignmentRequest): Observable<Assignment> {
    return this.http.post<Assignment>(this.baseUrl, payload);
  }

  uploadAssignmentFiles(assignmentId: string, files: File[]): Observable<void> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });

    return this.http.post<void>(`${this.baseUrl}/${assignmentId}/files`, formData);
  }

  getAssignmentSubmissions(assignmentId: string) {
    const useMock = true;

    if (useMock) {
      return of(
        MOCK_ASSIGNMENT_SUBMISSIONS.map((item) => ({
          ...item,
          assignmentId,
        })),
      );
    }

    return this.http.get<AssignmentSubmission[]>(`${this.baseUrl}/${assignmentId}/submissions`);
  }

  getAssignmentSubmissionById(assignmentId: string, submissionId: string) {
    const useMock = true;

    if (useMock) {
      const item = MOCK_ASSIGNMENT_SUBMISSIONS.find((x) => x.id === submissionId);

      return of({
        ...item!,
        assignmentId,
      });
    }

    return this.http.get<AssignmentSubmission>(
      `${this.baseUrl}/${assignmentId}/submissions/${submissionId}`,
    );
  }

  updateSubmissionGrade(submissionId: string, payload: { value: number }) {
    return this.http.put<void>(
      `http://111.88.155.34:5196/api/submissions/${submissionId}/grade`,
      payload,
    );
  }
}
