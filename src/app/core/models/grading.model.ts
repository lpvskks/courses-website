export type CriterionType = 'score' | 'pass_fail' | 'option' | 'multiplier';

export type CriterionCategory = 'main' | 'bonus' | 'penalty' | 'multiplier';

export interface CriterionOption {
  value: string;
  label?: string | null;
}

export interface CriterionRange {
  from: number;
  to: number;
  score: number;
}

export interface CriterionScoreMapping {
  value: string;
  score: number;
}

export interface Criterion {
  id: string;
  criterionGroupId: string;
  name: string;
  description?: string | null;
  type: CriterionType | string;
  category: CriterionCategory | string;
  settings: unknown;
  maxScore: number;
  sortOrder: number;
  createdAtUtc: string;
}

export interface CriterionGroup {
  id: string;
  assignmentId: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  createdAtUtc: string;
}

export interface CriterionGroupWithCriteria extends CriterionGroup {
  criteria: Criterion[];
}

export interface CreateCriterionGroupRequest {
  name: string;
  description?: string | null;
  sortOrder: number;
}

export interface UpdateCriterionGroupRequest {
  name?: string | null;
  description?: string | null;
  sortOrder?: number | null;
}
