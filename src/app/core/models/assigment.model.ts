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