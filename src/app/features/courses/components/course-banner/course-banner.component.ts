import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Course } from '../../services/courses.service';

@Component({
  selector: 'app-course-banner',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './course-banner.component.html',
  styleUrl: './course-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseBannerComponent {
  @Input({ required: true }) course!: Course;
  @Input({ required: true }) form!: FormGroup;
  @Input() isAdmin = false;
  @Input() isEditMode = false;
  @Input() isSaving = false;
  @Input() submitError = '';
  @Input() nameError = '';
  @Input() descriptionError = '';

  @Output() openUsers = new EventEmitter<void>();
  @Output() enableEdit = new EventEmitter<void>();
  @Output() cancelEdit = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
}