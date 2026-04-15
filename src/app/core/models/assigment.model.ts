export interface AssignmentFile {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  text: string;
  status: string;
  startsAtUtc: string;
  minTeamSize: number;
  maxTeamSize: number;
  teamFormationMode: string;
  captainSelectionEndsAtUtc: string;
  teamFormationStartsAtUtc: string;
  teamFormationEndsAtUtc: string;
  draftCurrentCaptainUserId: string | null;
  draftStartedAtUtc: string | null;
  draftCompletedAtUtc: string | null;
  isTeamCompositionLocked: boolean;
  teamCompositionLockedAtUtc: string | null;
  isVisible: boolean;
  isClosed: boolean;
  requiresSubmission: boolean;
  deadline: string;
  created: string;
  files: AssignmentFile[];
}

export interface AssignmentsResponse {
  items: Assignment[];
  totalCount: number;
}

export interface SubmissionFile {
  id: string;
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
  type: 'Image' | 'Document' | 'Video' | string | number;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  created: string;
  grade: number | null;
  teacherComment?: string | null;
  gradedByTeacherId?: string | null;
  gradedAtUtc?: string | null;
  status: 'Submitted' | 'Reviewed' | 'Returned' | string | number;
  files: SubmissionFile[];
}
