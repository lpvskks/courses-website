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
}

export interface UpdateCourseRequest {
  name: string;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class CoursesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://localhost:7226/api/courses';

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

  updateCourse(courseId: string, request: UpdateCourseRequest): Observable<Course> {
    return this.http.put<Course>(`${this.baseUrl}/${courseId}`, request);
  }

  getCourseAssignments(
    courseId: string,
    page: number,
    pageSize: number,
  ): Observable<AssignmentsResponse> {
    return this.http.get<AssignmentsResponse>(`${this.baseUrl}/${courseId}/assignments`, {
      params: {
        page,
        pageSize,
      },
    });
  }
}
