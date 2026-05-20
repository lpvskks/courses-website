export type CriterionType = 'score' | 'pass_fail' | 'option' | 'multiplier';

export type CriterionCategory = 'main' | 'bonus' | 'penalty' | 'multiplier';

export type AssignmentGradingMode = 'sum_points' | 'base_with_multipliers';

export type MainCriteriaThresholdBehavior = 'set_to_zero' | 'mark_as_failed';

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

export interface ScoreCriterionSettings {
  minValue: number;
  maxValue: number;
  selectedValue: number;
  multiplier?: number | null;
  ranges?: CriterionRange[] | null;
}

export interface ChoiceCriterionSettings {
  multiplier?: number | null;
  options: CriterionOption[];
  scoreMappings: CriterionScoreMapping[];
}

export interface MultiplierCriterionSettings {
  coefficient: number;
}

export type CriterionSettings =
  | ScoreCriterionSettings
  | ChoiceCriterionSettings
  | MultiplierCriterionSettings;

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

export interface CreateCriterionRequest {
  name: string;
  description?: string | null;
  type: CriterionType;
  category?: CriterionCategory | null;
  settings: CriterionSettings;
  maxScore: number;
  sortOrder: number;
}

export interface UpdateCriterionRequest {
  name?: string | null;
  description?: string | null;
  type?: CriterionType | null;
  category?: CriterionCategory | null;
  settings?: CriterionSettings | null;
  maxScore?: number | null;
  sortOrder?: number | null;
}

export interface MainCriteriaThresholdSettings {
  enabled: boolean;
  threshold?: number | null;
  behavior?: MainCriteriaThresholdBehavior | null;
}

export interface PenaltyRule {
  enabled: boolean;
  percentage?: number | null;
}

export interface AssignmentPenaltySettings {
  deadline: PenaltyRule;
  progress: PenaltyRule;
  requiredCriteria: PenaltyRule;
}

export interface AssignmentGradingRules {
  mode: AssignmentGradingMode;
  baseGrade?: number | null;
  mainCriteriaThreshold: MainCriteriaThresholdSettings;
  penalties: AssignmentPenaltySettings;
}

export interface CriterionAssessmentValue {
  criterionId: string;
  value: unknown;
}

export interface GradePenaltyInput {
  deadline: boolean;
  progress: boolean;
  requiredCriteria: boolean;
}

export interface SaveSubmissionAssessmentRequest {
  values: CriterionAssessmentValue[];
  penalties: GradePenaltyInput;
  comment?: string | null;
}

export interface AppliedAssessmentPenalty {
  source?: string | null;
  label?: string | null;
  value?: number | null;
}

export interface AssessmentCalculationDetails {
  mainPoints?: number | null;
  bonusPoints?: number | null;
  penaltyPoints?: number | null;
  multiplier?: number | null;
  finalGrade?: number | null;
  appliedPenalties?: AppliedAssessmentPenalty[] | null;
  [key: string]: unknown;
}

export interface SubmissionAssessment {
  id: string;
  submissionId: string;
  assignmentId: string;
  studentId: string;
  checkedByUserId: string;
  criterionValues: unknown;
  mainPoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  multiplier: number;
  finalGrade: number;
  calculationDetails?: AssessmentCalculationDetails | null;
  checkedAtUtc: string;
  comment?: string | null;
}

export interface SubmissionAssessmentCriterionGroup extends CriterionGroup {
  criteria: Criterion[];
}

export interface SubmissionAssessmentForm {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  rules: AssignmentGradingRules;
  groups: SubmissionAssessmentCriterionGroup[];
  savedAssessment?: SubmissionAssessment | null;
}
