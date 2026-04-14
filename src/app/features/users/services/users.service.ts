import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { CourseUser } from "../../../core/models/course-user.model";

@Injectable({
  providedIn: 'root',
})

export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://111.88.155.34:5196/api/courses';

  getCourseTeachers(courseId: string): Observable<CourseUser[]> {
    return this.http.get<CourseUser[]>(`${this.baseUrl}/${courseId}/teachers`);
  }

  getCourseStudents(courseId: string): Observable<CourseUser[]> {
    return this.http.get<CourseUser[]>(`${this.baseUrl}/${courseId}/students`);
  }

  assignTeacher(courseId: string, teacherId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${courseId}/teachers/${teacherId}`, {});
  }

  removeTeacher(courseId: string, teacherId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${courseId}/teachers/${teacherId}`);
  }

  blockStudent(courseId: string, studentId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${courseId}/students/${studentId}/block`, {});
  }

  unblockStudent(courseId: string, studentId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${courseId}/students/${studentId}/unblock`, {});
  }
}
