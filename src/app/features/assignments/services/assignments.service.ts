import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Assignment } from '../../../core/models/assigment.model';
import { AssignmentComment } from '../../../core/models/assignment-comment.model';

@Injectable({
  providedIn: 'root',
})
export class AssignmentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://localhost:7226/api/assignments';

  getAssignmentById(assignmentId: string): Observable<Assignment> {
    return this.http.get<Assignment>(`${this.baseUrl}/${assignmentId}`);
  }

  getAssignmentComments(assignmentId: string): Observable<AssignmentComment[]> {
    return this.http.get<AssignmentComment[]>(`${this.baseUrl}/${assignmentId}/comments`);
  }

  createComment(assignmentId: string, payload: { text: string }): Observable<AssignmentComment> {
    return this.http.post<AssignmentComment>(`${this.baseUrl}/${assignmentId}/comments`, payload);
  }

  createAssignment(payload: {
    courseId: string;
    title: string;
    text: string;
    requiresSubmission: boolean;
    deadline: string;
  }): Observable<Assignment> {
    return this.http.post<Assignment>(this.baseUrl, payload);
  }

  uploadAssignmentFiles(assignmentId: string, files: File[]): Observable<void> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });

    return this.http.post<void>(`${this.baseUrl}/${assignmentId}/files`, formData);
  }
}
