import { Routes } from '@angular/router';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { CoursesComponent } from './features/courses/pages/course-page/courses.component';

export const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'courses', component: CoursesComponent },
  {
    path: 'courses/:courseId',
    loadComponent: () =>
      import('./features/courses/pages/course-details-page/course-details.component').then(
        (m) => m.CourseDetailsComponent,
      ),
  },
  {
    path: 'courses/:courseId/users',
    loadComponent: () =>
      import('./features/courses/pages/course-users/course-users.component').then(
        (m) => m.CourseUsersComponent,
      ),
  },
];
