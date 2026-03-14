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
      import('./features/users/pages/users-page/course-users-page.component').then(
        (m) => m.CourseUsersPageComponent,
      ),
  },
  {
    path: 'courses/:courseId/assignments/:assignmentId',
    loadComponent: () =>
      import('./features/assignments/pages/assignment-details-page/course-assignment-details.component').then(
        (m) => m.CourseAssignmentDetailsComponent,
      ),
  },

  {
  path: 'courses/:courseId/assignments/:assignmentId/solutions',
  loadComponent: () =>
    import('./features/assignments/pages/assignment-solutions-page/assignment-solutions-page.component')
      .then((m) => m.AssignmentSolutionsPageComponent),
},
{
  path: 'courses/:courseId/assignments/:assignmentId/solutions/:submissionId',
  loadComponent: () =>
    import('./features/assignments/pages/assignment-submission-details/assignment-submission-details.component')
      .then((m) => m.AssignmentSubmissionDetailsComponent),
},
];
