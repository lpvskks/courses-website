export interface CourseUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isBlocked?: boolean;
  role?: 'Admin' |'Teacher' | 'Student';
}