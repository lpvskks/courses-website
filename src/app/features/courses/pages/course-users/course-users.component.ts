import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-course-users',
  standalone: true,
  template: `
    <section style="padding: 32px;">
      <h1>Пользователи курса</h1>
      <p>Здесь позже будет реализована страница пользователей курса.</p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseUsersComponent {}