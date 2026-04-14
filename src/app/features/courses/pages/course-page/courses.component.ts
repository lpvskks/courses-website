import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Course, CoursesService } from '../../services/courses.service';
import { CreateCourseModalComponent } from '../../components/create-course-modal/create-course-modal.component';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, RouterLink, CreateCourseModalComponent],
  templateUrl: './courses.component.html',
  styleUrl: './courses.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoursesComponent implements OnInit {
  private readonly coursesService = inject(CoursesService);

  courses = signal<Course[]>([]);
  isLoading = signal(true);
  isCreateModalOpen = signal(false);
  userRole = signal<string | null>(null);

  activeCourses = computed(() =>
    this.courses().filter((course) => course.isActive),
  );

  inactiveCourses = computed(() =>
    this.courses().filter((course) => !course.isActive),
  );

  isAdmin = computed(() => this.userRole() === 'Admin');

  ngOnInit(): void {
    const role = localStorage.getItem('user_role');
    this.userRole.set(role);

    const request$ =
      role === 'Admin'
        ? this.coursesService.getCourses()
        : role === 'Teacher' || role === 'Student'
          ? this.coursesService.getMyCourses(role)
          : this.coursesService.getMyCourses();

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

  openCreateModal(): void {
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  onCourseCreated(course: Course): void {
    this.courses.update((current) => [course, ...current]);
    this.isCreateModalOpen.set(false);
  }
}
