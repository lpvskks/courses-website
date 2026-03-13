import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';

import { Course, CoursesService } from '../../services/courses.service';
import { of } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesComponent implements OnInit {
  private readonly coursesService = inject(CoursesService);

  courses = signal<Course[]>([]);
  isLoading = signal(true);

  activeCourses = computed(() => this.courses().filter((course) => course.isActive));

  inactiveCourses = computed(() => this.courses().filter((course) => !course.isActive));

  ngOnInit(): void {
    const role = localStorage.getItem('user_role');

    const request$ =
      role === 'Admin'
        ? this.coursesService.getCourses()
        : role === 'Teacher'
          ? this.coursesService.getMyCourses('Teacher')
          : of([]);

    request$.subscribe({
      next: (courses) => {
        this.courses.set(courses);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки курсов', err);
        this.isLoading.set(false);
      },
    });
  }
}
