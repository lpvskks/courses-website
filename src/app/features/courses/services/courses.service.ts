import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Course {
  id: string;
  name: string;
  description: string;
  code: string;
  isActive: boolean;
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
}