import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

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
  @Input() isStudent = false;
  @Output() open = new EventEmitter<string>();

  get isUnavailableForStudent(): boolean {
    return this.isStudent && this.assignment.isClosed;
  }

  onOpen(): void {
    if (this.isUnavailableForStudent) {
      return;
    }

    this.open.emit(this.assignment.id);
  }
}
