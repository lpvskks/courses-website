import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Assignment } from '../../../../core/models/assigment.model';
import {
  CreateCriterionRequest,
  Criterion,
  CriterionCategory,
  CriterionGroup,
  CriterionSettings,
  CriterionType,
} from '../../../../core/models/grading.model';
import { AssignmentsService } from '../../services/assignments.service';

@Component({
  selector: 'app-create-assignment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-assignment-modal.component.html',
  styleUrl: './create-assignment-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAssignmentModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly assignmentsService = inject(AssignmentsService);

  @Input({ required: true }) courseId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  readonly role = signal(localStorage.getItem('user_role'));
  readonly isAdmin = computed(() => this.role() === 'Admin');

  readonly isSaving = signal(false);
  readonly isCriteriaSaving = signal(false);
  readonly submitError = signal('');
  readonly criteriaError = signal('');
  readonly criteriaSuccess = signal('');
  readonly selectedFiles = signal<File[]>([]);
  readonly step = signal<'details' | 'criteria-choice' | 'criteria'>('details');
  readonly createdAssignment = signal<Assignment | null>(null);
  readonly criterionGroups = signal<Array<CriterionGroup & { criteria: Criterion[] }>>([]);
  readonly selectedCriterionGroupId = signal<string | null>(null);

  readonly scoreOptions = Array.from({ length: 101 }, (_, index) => index);
  readonly positiveScoreOptions = Array.from({ length: 100 }, (_, index) => index + 1);
  readonly multiplierOptions = [0, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2];

  readonly optionRows = signal<CriterionOptionRow[]>([
    { value: 'option_1', label: 'Вариант 1', score: 0 },
    { value: 'option_2', label: 'Вариант 2', score: 0 },
  ]);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    text: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5000)]],
    startsAtUtc: ['', [Validators.required]],
    minTeamSize: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
    maxTeamSize: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
    teamFormationMode: ['teacher_managed', [Validators.required]],
    captainSelectionEndsAtUtc: ['', [Validators.required]],
    teamFormationEndsAtUtc: ['', [Validators.required]],
    isVisible: [true],
    requiresSubmission: [true],
    deadline: ['', [Validators.required]],
  });

  readonly criterionGroupForm = this.fb.nonNullable.group({
    name: ['Основные критерии', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    description: [''],
    sortOrder: [1, [Validators.required, Validators.min(0)]],
  });

  readonly criterionForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    description: [''],
    type: ['pass_fail' as CriterionType, [Validators.required]],
    category: ['main' as CriterionCategory, [Validators.required]],
    maxScore: [10, [Validators.required, Validators.min(1)]],
    sortOrder: [1, [Validators.required, Validators.min(0)]],
    scoreMinValue: [0, [Validators.required, Validators.min(0)]],
    scoreMaxValue: [10, [Validators.required, Validators.min(1)]],
    passScore: [10, [Validators.required, Validators.min(0)]],
    failScore: [0, [Validators.required, Validators.min(0)]],
    multiplier: [1, [Validators.required, Validators.min(0)]],
  });

  showCaptainSelectionEndsAt(): boolean {
    return true;
  }

  close(): void {
    if (this.isSaving() || this.isCriteriaSaving()) {
      return;
    }

    if (this.createdAssignment()) {
      this.created.emit();
      return;
    }

    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onEsc(): void {
    this.close();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newFiles = Array.from(input.files ?? []);

    if (!newFiles.length) {
      return;
    }

    this.selectedFiles.update((currentFiles) => {
      const existingKeys = new Set(
        currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
      );

      const uniqueNewFiles = newFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        return !existingKeys.has(key);
      });

      return [...currentFiles, ...uniqueNewFiles];
    });

    input.value = '';
  }

  removeFile(index: number): void {
    this.selectedFiles.update((files) => files.filter((_, i) => i !== index));
  }

  save(): void {
    this.form.markAllAsTouched();
    this.submitError.set('');

    if (
      !this.isAdmin() ||
      this.form.invalid ||
      !this.courseId ||
      !this.isCaptainSelectionDateFilled() ||
      !this.areDatesValid() ||
      !this.areTeamSizesValid()
    ) {
      return;
    }

    this.isSaving.set(true);

    this.assignmentsService
      .createAssignment({
        courseId: this.courseId,
        title: this.form.controls.title.getRawValue().trim(),
        text: this.form.controls.text.getRawValue().trim(),
        startsAtUtc: this.toUtcIso(this.form.controls.startsAtUtc.getRawValue()),
        minTeamSize: this.form.controls.minTeamSize.getRawValue(),
        maxTeamSize: this.form.controls.maxTeamSize.getRawValue(),
        teamFormationMode: this.form.controls.teamFormationMode.getRawValue(),
        captainSelectionEndsAtUtc: this.toUtcIso(this.getCaptainSelectionEndsAtValue()),
        teamFormationEndsAtUtc: this.toUtcIso(
          this.form.controls.teamFormationEndsAtUtc.getRawValue(),
        ),
        isVisible: this.form.controls.isVisible.getRawValue(),
        requiresSubmission: this.form.controls.requiresSubmission.getRawValue(),
        deadline: this.toUtcIso(this.form.controls.deadline.getRawValue()),
      })
      .subscribe({
        next: (createdAssignment) => {
          const files = this.selectedFiles();

          if (!files.length) {
            this.openCriteriaChoiceStep(createdAssignment);
            return;
          }

          this.assignmentsService.uploadAssignmentFiles(createdAssignment.id, files).subscribe({
            next: () => {
              this.openCriteriaChoiceStep(createdAssignment);
            },
            error: (err) => {
              console.error(err);
              this.isSaving.set(false);
              this.submitError.set('Задание создано, но не удалось загрузить прикрепленные файлы');
            },
          });
        },
        error: (err) => {
          console.error(err);
          this.isSaving.set(false);
          this.submitError.set('Не удалось создать задание');
        },
      });
  }

  createCriterionGroup(): void {
    const assignment = this.createdAssignment();
    this.criterionGroupForm.markAllAsTouched();
    this.criteriaError.set('');
    this.criteriaSuccess.set('');

    if (!assignment || this.criterionGroupForm.invalid || this.isCriteriaSaving()) {
      return;
    }

    this.isCriteriaSaving.set(true);

    this.assignmentsService
      .createCriterionGroup(assignment.id, {
        name: this.criterionGroupForm.controls.name.getRawValue().trim(),
        description: this.criterionGroupForm.controls.description.getRawValue().trim() || null,
        sortOrder: this.criterionGroupForm.controls.sortOrder.getRawValue(),
      })
      .subscribe({
        next: (group) => {
          this.criterionGroups.update((groups) => [...groups, { ...group, criteria: [] }]);
          this.selectedCriterionGroupId.set(group.id);
          this.criterionGroupForm.reset({
            name: '',
            description: '',
            sortOrder: this.criterionGroups().length + 1,
          });
          this.resetCriterionForm(1);
          this.criteriaSuccess.set('Группа критериев добавлена');
          this.isCriteriaSaving.set(false);
        },
        error: (err) => {
          console.error(err);
          this.criteriaError.set('Не удалось добавить группу критериев');
          this.isCriteriaSaving.set(false);
        },
      });
  }

  saveCriterion(): void {
    const groupId = this.selectedCriterionGroupId();
    this.criterionForm.markAllAsTouched();
    this.criteriaError.set('');
    this.criteriaSuccess.set('');

    if (!groupId) {
      this.criteriaError.set('Сначала создайте или выберите группу критериев');
      return;
    }

    if (this.criterionForm.invalid || this.isCriteriaSaving()) {
      return;
    }

    const settings = this.buildCriterionSettings();
    if (!settings) {
      return;
    }

    const type = this.criterionForm.controls.type.getRawValue();
    const payload: CreateCriterionRequest = {
      name: this.criterionForm.controls.name.getRawValue().trim(),
      description: this.criterionForm.controls.description.getRawValue().trim() || null,
      type,
      category: type === 'multiplier'
        ? 'multiplier'
        : this.criterionForm.controls.category.getRawValue(),
      settings,
      maxScore: type === 'multiplier' ? 1 : this.criterionForm.controls.maxScore.getRawValue(),
      sortOrder: this.criterionForm.controls.sortOrder.getRawValue(),
    };

    this.isCriteriaSaving.set(true);

    this.assignmentsService.createCriterion(groupId, payload).subscribe({
      next: (criterion) => {
        this.criterionGroups.update((groups) =>
          groups.map((group) =>
            group.id === groupId
              ? { ...group, criteria: [...group.criteria, criterion] }
              : group,
          ),
        );
        const group = this.criterionGroups().find((item) => item.id === groupId);
        this.resetCriterionForm((group?.criteria.length ?? 0) + 1);
        this.criteriaSuccess.set('Критерий добавлен');
        this.isCriteriaSaving.set(false);
      },
      error: (err) => {
        console.error(err);
        this.criteriaError.set('Не удалось добавить критерий');
        this.isCriteriaSaving.set(false);
      },
    });
  }

  finishCriteriaSetup(): void {
    if (this.isCriteriaSaving()) {
      return;
    }

    this.created.emit();
  }

  openCriteriaSetup(): void {
    this.step.set('criteria');
    this.criteriaError.set('');
    this.criteriaSuccess.set('Настройте группы и критерии оценивания');
  }

  configureCriteriaLater(): void {
    if (this.isCriteriaSaving()) {
      return;
    }

    this.created.emit();
  }

  getModalTitle(): string {
    switch (this.step()) {
      case 'criteria-choice':
        return 'Задание создано';
      case 'criteria':
        return 'Критерии оценивания';
      default:
        return 'Новое задание';
    }
  }

  getModalSubtitle(): string {
    switch (this.step()) {
      case 'criteria-choice':
        return 'Можно настроить оценивание сразу или вернуться к этому позже';
      case 'criteria':
        return 'Добавьте группы и критерии для проверки решений';
      default:
        return 'Заполните условия, сроки и параметры командной работы';
    }
  }

  selectCriterionGroup(groupId: string): void {
    this.selectedCriterionGroupId.set(groupId);
    const group = this.criterionGroups().find((item) => item.id === groupId);
    this.resetCriterionForm((group?.criteria.length ?? 0) + 1);
  }

  onCriterionTypeChange(): void {
    const type = this.criterionForm.controls.type.getRawValue();

    if (type === 'multiplier') {
      this.criterionForm.controls.category.setValue('multiplier');
      this.criterionForm.controls.maxScore.setValue(1);
      return;
    }

    if (this.criterionForm.controls.category.getRawValue() === 'multiplier') {
      this.criterionForm.controls.category.setValue('main');
    }
  }

  addOptionRow(): void {
    const nextIndex = this.optionRows().length + 1;
    this.optionRows.update((rows) => [
      ...rows,
      { value: `option_${nextIndex}`, label: `Вариант ${nextIndex}`, score: 0 },
    ]);
  }

  removeOptionRow(index: number): void {
    if (this.optionRows().length <= 1) {
      return;
    }

    this.optionRows.update((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  }

  updateOptionRow(index: number, field: keyof CriterionOptionRow, event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = field === 'score' ? Number(target.value) : target.value;

    this.optionRows.update((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  trackByCriterionGroupId(_: number, group: CriterionGroup): string {
    return group.id;
  }

  trackByCriterionId(_: number, criterion: Criterion): string {
    return criterion.id;
  }

  trackByOptionRow(_: number, row: CriterionOptionRow): string {
    return row.value;
  }

  getCriterionTypeLabel(type: Criterion['type']): string {
    switch (type) {
      case 'score':
        return 'Диапазон';
      case 'pass_fail':
        return 'Чекбокс';
      case 'option':
        return 'Выбор варианта';
      case 'multiplier':
        return 'Множитель';
      default:
        return String(type);
    }
  }

  getCriterionCategoryLabel(category: Criterion['category']): string {
    switch (category) {
      case 'main':
        return 'Основной';
      case 'bonus':
        return 'Бонус';
      case 'penalty':
        return 'Штраф';
      case 'multiplier':
        return 'Множитель';
      default:
        return String(category);
    }
  }

  getCriteriaCount(): number {
    return this.criterionGroups().reduce((total, group) => total + group.criteria.length, 0);
  }

  getCriterionScoreOptions(): number[] {
    const maxScore = this.criterionForm.controls.maxScore.getRawValue();
    return this.scoreOptions.filter((score) => score <= maxScore);
  }

  getScoreMinOptions(): number[] {
    const maxValue = this.criterionForm.controls.scoreMaxValue.getRawValue();
    return this.scoreOptions.filter((score) => score < maxValue);
  }

  getScoreMaxOptions(): number[] {
    const minValue = this.criterionForm.controls.scoreMinValue.getRawValue();
    return this.positiveScoreOptions.filter((score) => score > minValue);
  }

  formatFileSize(size: number): string {
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
    return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
  }

  trackByFile(_: number, file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  get titleError(): string {
    const control = this.form.controls.title;
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите название задания';
    if (control.errors['minlength']) return 'Название должно быть не менее 2 символов';
    if (control.errors['maxlength']) return 'Название должно быть не более 150 символов';
    return '';
  }

  get textError(): string {
    const control = this.form.controls.text;
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Введите описание задания';
    if (control.errors['minlength']) return 'Описание должно быть не менее 5 символов';
    if (control.errors['maxlength']) return 'Описание должно быть не более 5000 символов';
    return '';
  }

  get startsAtError(): string {
    const requiredError = this.getRequiredDateError('startsAtUtc', 'Выберите дату начала задания');

    if (requiredError) return requiredError;

    if (!this.isStartsAtValid()) {
      return 'Начало задания должно быть раньше срока формирования команды';
    }

    return '';
  }

  get captainSelectionEndsAtError(): string {
    const control = this.form.controls.captainSelectionEndsAtUtc;

    if (control.touched && !control.getRawValue()) {
      return 'Выберите срок выбора капитана';
    }

    if (!this.isCaptainSelectionDateValid()) {
      return 'Срок выбора капитана должен быть не позже начала формирования команды';
    }

    return '';
  }

  get teamFormationEndsAtError(): string {
    const requiredError = this.getRequiredDateError(
      'teamFormationEndsAtUtc',
      'Выберите срок формирования команды',
    );

    if (requiredError) return requiredError;

    if (!this.isTeamFormationDateValid()) {
      return this.showCaptainSelectionEndsAt()
        ? 'Срок формирования команды должен быть позже срока выбора капитана'
        : 'Срок формирования команды должен быть позже начала задания';
    }

    return '';
  }

  get deadlineError(): string {
    const requiredError = this.getRequiredDateError('deadline', 'Выберите дедлайн');

    if (requiredError) return requiredError;

    if (!this.isDeadlineValid()) {
      return 'Дедлайн должен быть позже срока формирования команды';
    }

    return '';
  }

  get minTeamSizeError(): string {
    const control = this.form.controls.minTeamSize;
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'Укажите минимальный размер команды';
    if (control.errors['min']) return 'Минимум 1 участник';
    if (control.errors['max']) return 'Не больше 100 участников';
    return '';
  }

  get maxTeamSizeError(): string {
    const control = this.form.controls.maxTeamSize;
    if (!control.touched && this.areTeamSizesValid()) return '';

    if (control.errors?.['required']) return 'Укажите максимальный размер команды';
    if (control.errors?.['min']) return 'Минимум 1 участник';
    if (control.errors?.['max']) return 'Не больше 100 участников';
    if (!this.areTeamSizesValid()) return 'Максимум должен быть не меньше минимума';
    return '';
  }

  private getRequiredDateError(
    controlName: 'startsAtUtc' | 'teamFormationEndsAtUtc' | 'deadline',
    message: string,
  ): string {
    const control = this.form.controls[controlName];
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return message;
    return '';
  }

  private areTeamSizesValid(): boolean {
    return (
      this.form.controls.maxTeamSize.getRawValue() >= this.form.controls.minTeamSize.getRawValue()
    );
  }

  private areDatesValid(): boolean {
    return (
      this.isCaptainSelectionDateValid() &&
      this.isTeamFormationDateValid() &&
      this.isStartsAtValid() &&
      this.isDeadlineValid()
    );
  }

  private isCaptainSelectionDateValid(): boolean {
    return (
      this.isBeforeOrEqual('captainSelectionEndsAtUtc', 'startsAtUtc') &&
      this.isBefore('captainSelectionEndsAtUtc', 'teamFormationEndsAtUtc')
    );
  }

  private isTeamFormationDateValid(): boolean {
    const isAfterStart = this.isAfter('teamFormationEndsAtUtc', 'startsAtUtc');

    return isAfterStart && this.isAfter('teamFormationEndsAtUtc', 'captainSelectionEndsAtUtc');
  }

  private isStartsAtValid(): boolean {
    return this.isBefore('startsAtUtc', 'teamFormationEndsAtUtc');
  }

  private isDeadlineValid(): boolean {
    return this.isAfter('deadline', 'teamFormationEndsAtUtc');
  }

  private isBefore(earlierControlName: DateControlName, laterControlName: DateControlName): boolean {
    const earlier = this.form.controls[earlierControlName].getRawValue();
    const later = this.form.controls[laterControlName].getRawValue();

    if (!earlier || !later) {
      return true;
    }

    return new Date(earlier).getTime() < new Date(later).getTime();
  }

  private isBeforeOrEqual(
    earlierControlName: DateControlName,
    laterControlName: DateControlName,
  ): boolean {
    const earlier = this.form.controls[earlierControlName].getRawValue();
    const later = this.form.controls[laterControlName].getRawValue();

    if (!earlier || !later) {
      return true;
    }

    return new Date(earlier).getTime() <= new Date(later).getTime();
  }

  private isAfter(laterControlName: DateControlName, earlierControlName: DateControlName): boolean {
    const later = this.form.controls[laterControlName].getRawValue();
    const earlier = this.form.controls[earlierControlName].getRawValue();

    if (!later || !earlier) {
      return true;
    }

    return new Date(later).getTime() > new Date(earlier).getTime();
  }

  private toUtcIso(value: string): string {
    return new Date(value).toISOString();
  }

  private isCaptainSelectionDateFilled(): boolean {
    return !!this.form.controls.captainSelectionEndsAtUtc.getRawValue();
  }

  private getCaptainSelectionEndsAtValue(): string {
    return this.form.controls.captainSelectionEndsAtUtc.getRawValue();
  }

  private openCriteriaChoiceStep(createdAssignment: Assignment): void {
    this.createdAssignment.set(createdAssignment);
    this.step.set('criteria-choice');
    this.isSaving.set(false);
    this.criteriaError.set('');
    this.criteriaSuccess.set('');
  }

  private resetCriterionForm(nextSortOrder = 1): void {
    this.criterionForm.reset({
      name: '',
      description: '',
      type: 'pass_fail',
      category: 'main',
      maxScore: 10,
      sortOrder: nextSortOrder,
      scoreMinValue: 0,
      scoreMaxValue: 10,
      passScore: 10,
      failScore: 0,
      multiplier: 1,
    });
    this.optionRows.set([
      { value: 'option_1', label: 'Вариант 1', score: 0 },
      { value: 'option_2', label: 'Вариант 2', score: 0 },
    ]);
  }

  private buildCriterionSettings(): CriterionSettings | null {
    const type = this.criterionForm.controls.type.getRawValue();

    if (type === 'score') {
      const minValue = this.criterionForm.controls.scoreMinValue.getRawValue();
      const maxValue = this.criterionForm.controls.scoreMaxValue.getRawValue();

      if (maxValue <= minValue) {
        this.criteriaError.set('Максимум диапазона должен быть больше минимума');
        return null;
      }

      return {
        minValue,
        maxValue,
        selectedValue: minValue,
      };
    }

    if (type === 'pass_fail') {
      const maxScore = this.criterionForm.controls.maxScore.getRawValue();
      const passScore = this.criterionForm.controls.passScore.getRawValue();
      const failScore = this.criterionForm.controls.failScore.getRawValue();

      if (passScore > maxScore || failScore > maxScore) {
        this.criteriaError.set('Баллы не должны быть больше максимального значения');
        return null;
      }

      return {
        multiplier: 1,
        options: [
          { value: 'pass', label: 'Выполнен' },
          { value: 'fail', label: 'Не выполнен' },
        ],
        scoreMappings: [
          { value: 'pass', score: passScore },
          { value: 'fail', score: failScore },
        ],
      };
    }

    if (type === 'option') {
      const maxScore = this.criterionForm.controls.maxScore.getRawValue();
      const rows = this.optionRows();

      if (rows.some((row) => !row.value.trim())) {
        this.criteriaError.set('У каждого варианта должен быть код');
        return null;
      }

      if (rows.some((row) => row.score > maxScore)) {
        this.criteriaError.set('Баллы вариантов не должны быть больше максимального значения');
        return null;
      }

      return {
        multiplier: 1,
        options: rows.map((row) => ({
          value: row.value.trim(),
          label: row.label.trim() || row.value.trim(),
        })),
        scoreMappings: rows.map((row) => ({
          value: row.value.trim(),
          score: row.score,
        })),
      };
    }

    return {
      coefficient: this.criterionForm.controls.multiplier.getRawValue(),
    };
  }
}

type DateControlName =
  | 'captainSelectionEndsAtUtc'
  | 'teamFormationEndsAtUtc'
  | 'startsAtUtc'
  | 'deadline';

interface CriterionOptionRow {
  value: string;
  label: string;
  score: number;
}








