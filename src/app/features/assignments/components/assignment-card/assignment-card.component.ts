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
    return this.isStudent && this.assignment.isVisible && !this.assignment.isClosed;
  }

  get statusLabel(): string {
    if (this.assignment.status === 'available') {
      return 'Доступно';
    }

    if (this.assignment.status === 'finished') {
      return 'Завершено';
    }

    return '';
  }

  get statusModifierClass(): string {
    if (this.assignment.status === 'available') {
      return 'assignment-badge--available';
    }

    if (this.assignment.status === 'finished') {
      return 'assignment-badge--finished';
    }

    return '';
  }

  onOpen(): void {
    this.open.emit(this.assignment.id);
  }
}
