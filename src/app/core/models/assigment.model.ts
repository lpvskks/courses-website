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
  type: 'Image' | 'Document' | 'Video' | string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  middleName: string;
  created: string;
  grade: number;
  status: 'Submitted' | 'Reviewed' | 'Returned' | string;
  files: SubmissionFile[];
}