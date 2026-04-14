import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AssignmentsResponse } from '../../../core/models/assigment.model';

export interface Course {
  id: string;
  name: string;
  description: string;
  code: string;
  isActive: boolean;
  registrationStartsAtUtc?: string | null;
  registrationEndsAtUtc?: string | null;
}

export interface UpdateCourseRequest {
  name: string;
  description: string;
  registrationStartsAtUtc?: string;
  registrationEndsAtUtc?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CoursesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://111.88.155.34:5196/api/courses';

  getCourses(): Observable<Course[]> {
    return this.http.get<Course[]>(this.baseUrl);
  }

  getMyCourses(filter?: string): Observable<Course[]> {
    const params = filter ? { filter } : undefined;

    return this.http.get<Course[]>(`${this.baseUrl}/my`, { params });
  }
  getCourseById(courseId: string): Observable<Course> {
    return this.http.get<Course>(`${this.baseUrl}/${courseId}`);
  }

  createCourse(request: UpdateCourseRequest): Observable<Course> {
    return this.http.post<Course>(this.baseUrl, request);
  }
  updateCourse(courseId: string, request: UpdateCourseRequest): Observable<Course> {
    return this.http.put<Course>(`${this.baseUrl}/${courseId}`, request);
  }

  getCourseAssignments(
    courseId: string,
    page: number,
    pageSize: number,
    visibleOnly = false,
  ): Observable<AssignmentsResponse> {
    const assignmentsUrl = `${this.baseUrl}/${courseId}/assignments${visibleOnly ? '/visible' : ''}`;

    return this.http.get<AssignmentsResponse>(assignmentsUrl, {
      params: {
        page,
        pageSize,
      },
    });
  }

  archiveCourse(courseId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${courseId}/archive`, {});
  }

  restoreCourse(courseId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${courseId}/restore`, {});
  }
}
