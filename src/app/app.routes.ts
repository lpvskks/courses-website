import { Routes } from '@angular/router';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { CoursesComponent } from './features/courses/pages/courses.component';

export const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'courses', component: CoursesComponent },
];
