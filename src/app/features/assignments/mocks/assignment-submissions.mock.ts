import { AssignmentSubmission } from "../../../core/models/assigment.model";


export const MOCK_ASSIGNMENT_SUBMISSIONS: AssignmentSubmission[] = [
  {
    id: 'sub-1',
    assignmentId: 'assignment-1',
    studentId: 'student-1',
    firstName: 'Иван',
    lastName: 'Петров',
    middleName: 'Александрович',
    created: '2026-03-14T10:15:00Z',
    grade: 0,
    status: 'Submitted',
    files: [
      {
        id: 'file-1',
        fileName: 'solution-photo.jpg',
        url: 'https://via.placeholder.com/1200x800.jpg',
        mimeType: 'image/jpeg',
        size: 245678,
        type: 'Image',
      },
    ],
  },
  {
    id: 'sub-2',
    assignmentId: 'assignment-1',
    studentId: 'student-2',
    firstName: 'Анна',
    lastName: 'Сидорова',
    middleName: 'Игоревна',
    created: '2026-03-14T12:40:00Z',
    grade: 5,
    status: 'Reviewed',
    files: [
      {
        id: 'file-2',
        fileName: 'report.pdf',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        mimeType: 'application/pdf',
        size: 456123,
        type: 'Document',
      },
    ],
  },
  {
    id: 'sub-3',
    assignmentId: 'assignment-1',
    studentId: 'student-3',
    firstName: 'Мария',
    lastName: 'Кузнецова',
    middleName: 'Олеговна',
    created: '2026-03-14T15:05:00Z',
    grade: 2,
    status: 'Returned',
    files: [
      {
        id: 'file-3',
        fileName: 'pottery-video.mp4',
        url: 'https://www.w3schools.com/html/mov_bbb.mp4',
        mimeType: 'video/mp4',
        size: 1024000,
        type: 'Video',
      },
    ],
  },
];