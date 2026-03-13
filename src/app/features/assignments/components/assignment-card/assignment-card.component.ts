import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { Assignment } from '../../../../core/models/assigment.model';

@Component({
  selector: 'app-assignment-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assignment-card.component.html',
  styleUrl: './assignment-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentCardComponent {
  @Input({ required: true }) assignment!: Assignment;
}