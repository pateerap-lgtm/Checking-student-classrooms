export type UserRole = 'admin' | 'director' | 'teacher' | 'student';

export interface SystemSettings {
  schoolName: string;
  affiliationName: string;
  logoUrl: string;
  directorName?: string;
  updatedAt?: string;
}

export interface AcademicYear {
  id: string;
  name: string; // e.g. "2569"
  term1Start: string; // YYYY-MM-DD
  term1End: string;
  term2Start: string;
  term2End: string;
  isCurrent: boolean;
  color: string;
  order: number;
}

export interface Period {
  id: string;
  name: string; // e.g. "คาบที่ 1"
  startTime: string; // "08:30"
  endTime: string; // "09:20"
  isLunchBreak: boolean;
  order: number;
  academicYearId?: string;
}

export interface Classroom {
  id: string;
  name: string; // e.g. "ม.1/1"
  color: string;
  order: number;
  academicYearId?: string;
}

export interface AppUser {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: 'admin' | 'director' | 'teacher';
}

export interface Student {
  id: string;
  seq: number;
  name: string;
  className: string;
  username: string;
  password: string;
  classId: string;
  academicYearId?: string;
}

export type SubjectType = 'พื้นฐาน' | 'เพิ่มเติม' | 'พัฒนาผู้เรียน';

export interface Subject {
  id: string;
  code: string; // e.g. "ว21101"
  name: string; // e.g. "วิทยาศาสตร์ 1"
  type: SubjectType;
  periodsPerWeek: number;
  classId: string;
  className: string;
  academicYearId?: string;
}

export type DayOfWeek = 'จันทร์' | 'อังคาร' | 'พุธ' | 'พฤหัสบดี' | 'ศุกร์';

export interface TeachingAssignment {
  id: string;
  teacherUsername: string;
  teacherName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  periodId: string;
  endPeriodId?: string;
  periodName: string;
  dayOfWeek: DayOfWeek;
  color: string;
  academicYearId?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'sick' | 'leave';

export interface StudentAttendanceItem {
  studentId: string;
  seq: number;
  studentName: string;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  sick: number;
  leave: number;
  total: number;
}

export interface AttendanceLog {
  id: string;
  academicYearId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  classId: string;
  className: string;
  date: string; // YYYY-MM-DD
  thaiDateStr: string; // "11 พ.ค. 2569"
  dayOfWeek: DayOfWeek;
  periodId: string;
  periodName: string;
  teacherUsername: string;
  teacherName?: string;
  records: StudentAttendanceItem[];
  summary: AttendanceSummary;
  updatedAt: string;
}
