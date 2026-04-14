import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { CourseUser } from "../../../core/models/course-user.model";

export interface UsersResponse {
  items: CourseUser[];
  totalCount: number;
}

@Injectable({
  providedIn: 'root',
})

export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly coursesUrl = 'http://111.88.155.34:5196/api/courses';
  private readonly usersUrl = 'http://111.88.155.34:5196/api/users';

  getUsers(params: {
    Search?: string;
    Role?: 'Admin' | 'Teacher' | 'Student';
    SortBy?: string;
    Desc?: boolean;
    Page?: number;
    PageSize?: number;
  }): Observable<UsersResponse> {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return this.http.get<UsersResponse>(this.usersUrl, { params: httpParams });
  }

  getCourseTeachers(courseId: string): Observable<CourseUser[]> {
    return this.http.get<CourseUser[]>(`${this.coursesUrl}/${courseId}/teachers`);
  }

  getCourseStudents(courseId: string): Observable<CourseUser[]> {
    return this.http.get<CourseUser[]>(`${this.coursesUrl}/${courseId}/students`);
  }

  assignTeacher(courseId: string, teacherId: string): Observable<void> {
    return this.http.post<void>(`${this.coursesUrl}/${courseId}/teachers/${teacherId}`, {});
  }

  removeTeacher(courseId: string, teacherId: string): Observable<void> {
    return this.http.delete<void>(`${this.coursesUrl}/${courseId}/teachers/${teacherId}`);
  }

  addStudent(courseId: string, studentId: string): Observable<void> {
    return this.http.post<void>(`${this.coursesUrl}/${courseId}/students/${studentId}`, {});
  }

  blockStudent(courseId: string, studentId: string): Observable<void> {
    return this.http.patch<void>(`${this.coursesUrl}/${courseId}/students/${studentId}/block`, {});
  }

  unblockStudent(courseId: string, studentId: string): Observable<void> {
    return this.http.patch<void>(`${this.coursesUrl}/${courseId}/students/${studentId}/unblock`, {});
  }
}
