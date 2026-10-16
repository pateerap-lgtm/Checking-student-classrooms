import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Printer,
  Calendar,
  School,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Sparkles,
  Users,
  User,
  ArrowLeft,
  Award,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  CheckSquare,
  ClipboardCheck,
  ChevronRight,
  ArrowRight,
  UserCheck,
  UserX,
  CalendarRange,
  RotateCcw
} from 'lucide-react';
import {
  AttendanceLog,
  Classroom,
  Subject,
  SystemSettings,
  AcademicYear,
  TeachingAssignment,
  Student,
  DayOfWeek,
  AttendanceStatus,
  StudentAttendanceItem,
  AppUser,
  Period,
  UserRole
} from '../../types';
import {
  THAI_MONTHS_FULL,
  formatToThaiBE,
  formatThaiFullDate,
  getAcademicYearMonths,
  getDayOfWeekFromDate,
  getTodayISODate
} from '../../utils/thaiDate';

export type ReportMode = 'daily_audit' | 'class' | 'individual';

interface TeacherReportViewProps {
  attendanceLogs: AttendanceLog[];
  assignments: TeachingAssignment[];
  classes: Classroom[];
  subjects: Subject[];
  students: Student[];
  settings: SystemSettings;
  teacherUsername: string;
  teacherFullName: string;
  activeYear?: AcademicYear;
  allAttendanceLogs?: AttendanceLog[];
  allAssignments?: TeachingAssignment[];
  teachers?: AppUser[];
  allUsers?: AppUser[];
  periods?: Period[];
  currentUserRole?: string;
  onUpdateAttendance?: (id: string, log: Partial<AttendanceLog>) => Promise<void>;
  onSaveAttendance?: (log: Omit<AttendanceLog, 'id'>) => Promise<void>;
  initialStudentId?: string | null;
  initialClassId?: string | null;
  onClearInitialStudent?: () => void;
  onNavigateTab?: (tab: string) => void;
  onSelectAssignmentForAttendance?: (assignment: TeachingAssignment) => void;
}

export const TeacherReportView: React.FC<TeacherReportViewProps> = ({
  attendanceLogs,
  assignments,
  classes,
  subjects,
  students,
  settings,
  teacherUsername,
  teacherFullName,
  activeYear,
  allAttendanceLogs,
  allAssignments,
  teachers = [],
  allUsers = [],
  periods = [],
  currentUserRole = 'teacher',
  onUpdateAttendance,
  onSaveAttendance,
  initialStudentId,
  initialClassId,
  onClearInitialStudent,
  onNavigateTab,
  onSelectAssignmentForAttendance
}) => {
  // Report Mode:
  // 'daily_audit' = ตรวจสอบการเช็คชื่อครูผู้สอนประจำวัน (Daily Audit: Who checked all, who is incomplete, remaining subjects)
  // 'class' = ทั้งชั้นเรียน (Class Attendance Sheet)
  // 'individual' = รายบุคคล (Individual Student Slip แบบ ปพ.5)
  const [reportMode, setReportMode] = useState<ReportMode>('daily_audit');

  // Scope when printing individual reports: 'single' = เฉพาะคนนี้, 'all' = พิมพ์ทุกคนในห้อง (แยกคนละหน้า)
  const [individualScope, setIndividualScope] = useState<'single' | 'all'>('single');

  // Teacher selector for Admin/Director in Class/Individual reports
  const isAdminOrDirector = currentUserRole === 'admin' || currentUserRole === 'director';
  const [selectedAdminTeacher, setSelectedAdminTeacher] = useState<string>(() => {
    return teacherUsername || (teachers[0]?.username || '');
  });

  const effectiveTeacherUsername = isAdminOrDirector && selectedAdminTeacher ? selectedAdminTeacher : teacherUsername;
  const effectiveTeacherObj = teachers.find((t) => t.username === effectiveTeacherUsername);
  const effectiveTeacherFullName = effectiveTeacherObj?.fullName || teacherFullName;

  // Director Name for Signatures in PDF and Official Reports
  const effectiveDirectorName = useMemo(() => {
    if (settings.directorName && settings.directorName.trim()) {
      return settings.directorName.trim();
    }
    const dirUser = (allUsers || []).find((u) => u.role === 'director');
    if (dirUser && dirUser.fullName && dirUser.fullName.trim()) {
      return dirUser.fullName.trim();
    }
    return 'ดร.สุรัตน์ มีเกียรติ';
  }, [settings.directorName, allUsers]);

  // --- DAILY TEACHER ATTENDANCE AUDIT STATE & COMPUTATIONS ---
  const [selectedAuditDate, setSelectedAuditDate] = useState<string>(getTodayISODate());
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | 'completed' | 'incomplete' | 'no_classes'>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [expandedTeacherUsernames, setExpandedTeacherUsernames] = useState<Set<string>>(new Set());

  const toggleTeacherExpand = (uname: string) => {
    setExpandedTeacherUsernames((prev) => {
      const next = new Set(prev);
      if (next.has(uname)) next.delete(uname);
      else next.add(uname);
      return next;
    });
  };

  const auditDayOfWeek = useMemo(() => {
    return getDayOfWeekFromDate(selectedAuditDate);
  }, [selectedAuditDate]);

  const auditThaiDateFull = useMemo(() => {
    return formatThaiFullDate(selectedAuditDate);
  }, [selectedAuditDate]);

  const isAuditToday = selectedAuditDate === getTodayISODate();
  const isAuditWeekend = !auditDayOfWeek;

  // List of teachers for audit
  const effectiveTeacherList: AppUser[] = useMemo(() => {
    if (teachers && teachers.length > 0) return teachers;
    return [{
      id: 'teacher-1',
      username: teacherUsername,
      fullName: teacherFullName,
      password: '',
      role: 'teacher' as const
    }];
  }, [teachers, teacherUsername, teacherFullName]);

  // Daily Audit Calculation for every teacher
  const teacherAudits = useMemo(() => {
    const rawAssignments = allAssignments || assignments;
    const rawLogs = allAttendanceLogs || attendanceLogs;

    return effectiveTeacherList.map((t) => {
      // Scheduled assignments for this teacher on this day of week
      const scheduled = auditDayOfWeek
        ? rawAssignments.filter((a) => a.teacherUsername === t.username && a.dayOfWeek === auditDayOfWeek)
        : [];

      // Sort scheduled periods by period order
      const sortedScheduled = [...scheduled].sort((a, b) => {
        const pA = periods.find((p) => p.id === a.periodId);
        const pB = periods.find((p) => p.id === b.periodId);
        return (pA?.order ?? 0) - (pB?.order ?? 0);
      });

      // Map each scheduled assignment with its attendance check status
      const items = sortedScheduled.map((a) => {
        const matchedLog = rawLogs.find(
          (l) =>
            l.date === selectedAuditDate &&
            l.teacherUsername === t.username &&
            (l.classId === a.classId || l.className === a.className) &&
            (l.subjectId === a.subjectId || l.subjectCode === a.subjectCode) &&
            (l.periodId === a.periodId || l.periodName === a.periodName)
        );

        const startPer = periods.find((p) => p.id === a.periodId);
        const endPer = a.endPeriodId ? periods.find((p) => p.id === a.endPeriodId) : startPer;
        const timeRange = startPer ? `${startPer.startTime} - ${endPer?.endTime || startPer.endTime} น.` : '';

        return {
          assignment: a,
          isChecked: Boolean(matchedLog),
          log: matchedLog,
          startPeriod: startPer,
          endPeriod: endPer,
          timeRange
        };
      });

      const totalPeriods = items.length;
      const checkedItems = items.filter((i) => i.isChecked);
      const remainingItems = items.filter((i) => !i.isChecked);
      const checkedCount = checkedItems.length;
      const remainingCount = remainingItems.length;
      const percentage = totalPeriods > 0 ? Math.round((checkedCount / totalPeriods) * 100) : 0;

      let status: 'completed' | 'incomplete' | 'not_checked' | 'no_classes' = 'no_classes';
      if (totalPeriods > 0) {
        if (remainingCount === 0) {
          status = 'completed';
        } else if (checkedCount > 0) {
          status = 'incomplete';
        } else {
          status = 'not_checked';
        }
      }

      return {
        teacher: t,
        items,
        totalPeriods,
        checkedItems,
        remainingItems,
        checkedCount,
        remainingCount,
        percentage,
        status
      };
    });
  }, [effectiveTeacherList, allAssignments, assignments, allAttendanceLogs, attendanceLogs, auditDayOfWeek, selectedAuditDate, periods]);

  // Overall KPI statistics
  const auditStats = useMemo(() => {
    const scheduledTeachers = teacherAudits.filter((t) => t.totalPeriods > 0);
    const completedTeachers = teacherAudits.filter((t) => t.status === 'completed');
    const incompleteTeachers = teacherAudits.filter((t) => t.status === 'incomplete');
    const notCheckedTeachers = teacherAudits.filter((t) => t.status === 'not_checked');
    const pendingTeachers = teacherAudits.filter((t) => t.status === 'incomplete' || t.status === 'not_checked');
    const noClassTeachers = teacherAudits.filter((t) => t.status === 'no_classes');

    const totalPeriods = teacherAudits.reduce((acc, t) => acc + t.totalPeriods, 0);
    const checkedPeriods = teacherAudits.reduce((acc, t) => acc + t.checkedCount, 0);
    const remainingPeriods = totalPeriods - checkedPeriods;
    const completionRate = scheduledTeachers.length > 0 ? Math.round((completedTeachers.length / scheduledTeachers.length) * 100) : 0;
    const periodsRate = totalPeriods > 0 ? Math.round((checkedPeriods / totalPeriods) * 100) : 0;

    return {
      scheduledTeachersCount: scheduledTeachers.length,
      completedTeachersCount: completedTeachers.length,
      incompleteTeachersCount: incompleteTeachers.length,
      notCheckedTeachersCount: notCheckedTeachers.length,
      pendingTeachersCount: pendingTeachers.length,
      noClassTeachersCount: noClassTeachers.length,
      totalPeriods,
      checkedPeriods,
      remainingPeriods,
      completionRate,
      periodsRate
    };
  }, [teacherAudits]);

  // Filtered teacher audits based on search and tab filter
  const filteredTeacherAudits = useMemo(() => {
    return teacherAudits.filter((t) => {
      // Filter by status tab
      if (auditStatusFilter === 'completed') {
        if (t.status !== 'completed') return false;
      } else if (auditStatusFilter === 'incomplete') {
        if (t.status !== 'incomplete' && t.status !== 'not_checked') return false;
      } else if (auditStatusFilter === 'no_classes') {
        if (t.status !== 'no_classes') return false;
      } else {
        // 'all' shows all scheduled teachers
        if (t.totalPeriods === 0) return false;
      }

      // Filter by search query
      if (auditSearchQuery.trim()) {
        const query = auditSearchQuery.toLowerCase().trim();
        const nameMatch =
          t.teacher.fullName.toLowerCase().includes(query) ||
          t.teacher.username.toLowerCase().includes(query);
        const subjectMatch = t.items.some(
          (item) =>
            item.assignment.subjectName.toLowerCase().includes(query) ||
            item.assignment.subjectCode.toLowerCase().includes(query) ||
            item.assignment.className.toLowerCase().includes(query)
        );
        if (!nameMatch && !subjectMatch) return false;
      }

      return true;
    });
  }, [teacherAudits, auditStatusFilter, auditSearchQuery]);

  // 1. Filter classrooms that this teacher teaches
  const teacherClasses = useMemo(() => {
    const rawAssignments = allAssignments || assignments;
    const myAssignments = rawAssignments.filter((a) => a.teacherUsername === effectiveTeacherUsername);
    const classIds = new Set(myAssignments.map((a) => a.classId));
    const classNames = new Set(myAssignments.map((a) => a.className));
    return classes.filter((c) => classIds.has(c.id) || classNames.has(c.name));
  }, [classes, assignments, allAssignments, effectiveTeacherUsername]);

  // Selected Classroom State
  const [selectedClassId, setSelectedClassId] = useState<string>(
    teacherClasses[0]?.id || ''
  );

  // Auto-sync selectedClassId when teacherClasses loads or updates
  useEffect(() => {
    if (teacherClasses.length > 0) {
      if (!selectedClassId || !teacherClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(teacherClasses[0].id);
      }
    }
  }, [teacherClasses, selectedClassId]);

  const currentClass = useMemo(() => {
    return teacherClasses.find((c) => c.id === selectedClassId || c.name === selectedClassId) || teacherClasses[0];
  }, [teacherClasses, selectedClassId]);

  // 2. Filter ONLY subjects that this teacher teaches for the selected classroom
  const teacherSubjects = useMemo(() => {
    if (!currentClass) return [];
    const rawAssignments = allAssignments || assignments;
    const myClassAssignments = rawAssignments.filter(
      (a) =>
        a.teacherUsername === effectiveTeacherUsername &&
        (a.classId === currentClass.id || a.className === currentClass.name)
    );
    const subIds = new Set(myClassAssignments.map((a) => a.subjectId));
    const subCodes = new Set(myClassAssignments.map((a) => a.subjectCode));
    const subNames = new Set(myClassAssignments.map((a) => a.subjectName));
    return subjects.filter(
      (s) => subIds.has(s.id) || subCodes.has(s.code) || subNames.has(s.name)
    );
  }, [subjects, assignments, allAssignments, effectiveTeacherUsername, currentClass]);

  // Selected Subject State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    teacherSubjects[0]?.id || ''
  );

  // Auto-sync selectedSubjectId when teacherSubjects loads or updates
  useEffect(() => {
    if (teacherSubjects.length > 0) {
      if (!selectedSubjectId || !teacherSubjects.some((s) => s.id === selectedSubjectId)) {
        setSelectedSubjectId(teacherSubjects[0].id);
      }
    }
  }, [teacherSubjects, selectedSubjectId]);

  const currentSubject = useMemo(() => {
    return teacherSubjects.find((s) => s.id === selectedSubjectId || s.code === selectedSubjectId) || teacherSubjects[0];
  }, [teacherSubjects, selectedSubjectId]);

  // 3. Available months in the active academic year only
  const availableMonths = useMemo(() => {
    return getAcademicYearMonths(activeYear);
  }, [activeYear]);

  // Default month: Current calendar month if within active academic year, else first month in list
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const months = getAcademicYearMonths(activeYear);
    const today = new Date();
    const curKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return months.some((m) => m.key === curKey) ? curKey : months[0]?.key || curKey;
  });

  useEffect(() => {
    if (availableMonths.length > 0) {
      if (!selectedMonth || !availableMonths.some((m) => m.key === selectedMonth)) {
        const today = new Date();
        const curKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const match = availableMonths.find((m) => m.key === curKey);
        setSelectedMonth(match ? curKey : availableMonths[0].key);
      }
    }
  }, [availableMonths, selectedMonth]);

  // Handle classroom change (re-sync subject)
  const handleClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    const targetClass = teacherClasses.find((c) => c.id === newClassId);
    if (!targetClass) return;

    const rawAssignments = allAssignments || assignments;
    const myClassAssignments = rawAssignments.filter(
      (a) =>
        a.teacherUsername === effectiveTeacherUsername &&
        (a.classId === targetClass.id || a.className === targetClass.name)
    );
    const subIds = new Set(myClassAssignments.map((a) => a.subjectId));
    const subCodes = new Set(myClassAssignments.map((a) => a.subjectCode));
    const subs = subjects.filter((s) => subIds.has(s.id) || subCodes.has(s.code));
    setSelectedSubjectId(subs[0]?.id || '');
  };

  const selectedMonthObj = availableMonths.find((m) => m.key === selectedMonth);
  const selectedMonthLabel = selectedMonthObj?.label || selectedMonth;

  // Students in selected classroom (sorted by sequence)
  const classStudents = useMemo(() => {
    if (!currentClass) return [];
    return students
      .filter((s) => s.classId === currentClass.id || s.className === currentClass.name)
      .sort((a, b) => a.seq - b.seq);
  }, [students, currentClass]);

  // Selected student for individual report
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Auto-sync selectedStudentId when classStudents changes
  useEffect(() => {
    if (classStudents.length > 0) {
      if (!selectedStudentId || !classStudents.some((s) => s.id === selectedStudentId)) {
        setSelectedStudentId(classStudents[0].id);
      }
    }
  }, [classStudents, selectedStudentId]);

  // Sync initial student and class if passed via props
  useEffect(() => {
    if (initialClassId && teacherClasses.some((c) => c.id === initialClassId)) {
      setSelectedClassId(initialClassId);
    }
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      setReportMode('individual');
      onClearInitialStudent?.();
    }
  }, [initialStudentId, initialClassId, teacherClasses, onClearInitialStudent]);

  const currentStudent = useMemo(() => {
    return classStudents.find((s) => s.id === selectedStudentId) || classStudents[0];
  }, [classStudents, selectedStudentId]);

  // Teaching days of the week for this class and subject from assignments
  const assignedDaysOfWeek = useMemo(() => {
    if (!currentClass || !currentSubject) return new Set<DayOfWeek>();
    const rawAssignments = allAssignments || assignments;
    const list = rawAssignments
      .filter(
        (a) =>
          a.teacherUsername === effectiveTeacherUsername &&
          (a.classId === currentClass.id || a.className === currentClass.name) &&
          (a.subjectId === currentSubject.id || a.subjectCode === currentSubject.code)
      )
      .map((a) => a.dayOfWeek);
    return new Set<DayOfWeek>(list);
  }, [assignments, allAssignments, effectiveTeacherUsername, currentClass, currentSubject]);

  // Logs for this teacher, class, subject, and selected month
  const monthLogs = useMemo(() => {
    if (!currentClass || !currentSubject) return [];
    const rawLogs = allAttendanceLogs || attendanceLogs;
    return rawLogs.filter(
      (l) =>
        l.teacherUsername === effectiveTeacherUsername &&
        (l.classId === currentClass.id || l.className === currentClass.name) &&
        (l.subjectId === currentSubject.id || l.subjectCode === currentSubject.code) &&
        l.date.startsWith(selectedMonth)
    );
  }, [attendanceLogs, allAttendanceLogs, effectiveTeacherUsername, currentClass, currentSubject, selectedMonth]);

  // Teaching periods lookup for assignment slot
  const matchedAssignment = useMemo(() => {
    if (!currentClass || !currentSubject) return undefined;
    const rawAssignments = allAssignments || assignments;
    return rawAssignments.find(
      (a) =>
        a.teacherUsername === effectiveTeacherUsername &&
        (a.classId === currentClass.id || a.className === currentClass.name) &&
        (a.subjectId === currentSubject.id || a.subjectCode === currentSubject.code)
    );
  }, [assignments, allAssignments, effectiveTeacherUsername, currentClass, currentSubject]);

  // Determine all teaching dates in this month
  const teachingDates = useMemo(() => {
    const datesSet = new Set<string>();

    monthLogs.forEach((l) => datesSet.add(l.date));

    if (selectedMonth && assignedDaysOfWeek.size > 0) {
      const parts = selectedMonth.split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayOfWeek = getDayOfWeekFromDate(dateStr);
        if (dayOfWeek && assignedDaysOfWeek.has(dayOfWeek)) {
          datesSet.add(dateStr);
        }
      }
    }

    return Array.from(datesSet).sort();
  }, [monthLogs, selectedMonth, assignedDaysOfWeek]);

  // Quick lookup map: date -> studentId (or name) -> status
  const attendanceMatrix = useMemo(() => {
    const map = new Map<string, Map<string, AttendanceStatus>>();
    monthLogs.forEach((log) => {
      const dateMap = new Map<string, AttendanceStatus>();
      log.records?.forEach((rec) => {
        dateMap.set(rec.studentId, rec.status);
        dateMap.set(rec.studentName, rec.status);
      });
      map.set(log.date, dateMap);
    });
    return map;
  }, [monthLogs]);

  // Interactive inline check modal or popover state
  const [activeCellEdit, setActiveCellEdit] = useState<{
    dateStr: string;
    studentId: string;
    studentName: string;
    currentStatus?: AttendanceStatus;
  } | null>(null);

  // Status cycling or selecting
  const handleSetStudentStatus = async (
    dateStr: string,
    student: Student,
    newStatus: AttendanceStatus
  ) => {
    if (!currentClass || !currentSubject) return;

    const existingLog = monthLogs.find((l) => l.date === dateStr);

    if (existingLog && onUpdateAttendance) {
      const updatedRecords: StudentAttendanceItem[] = classStudents.map((std, idx) => {
        const prevRec = existingLog.records?.find(
          (r) => r.studentId === std.id || r.studentName === std.name
        );
        const st = std.id === student.id ? newStatus : (prevRec?.status || 'present');
        return {
          studentId: std.id,
          seq: std.seq || idx + 1,
          studentName: std.name,
          status: st
        };
      });

      const summary = updatedRecords.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          acc.total += 1;
          return acc;
        },
        { present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0 }
      );

      await onUpdateAttendance(existingLog.id, {
        records: updatedRecords,
        summary,
        updatedAt: new Date().toISOString()
      });
    } else if (onSaveAttendance) {
      const dayOfWeek = getDayOfWeekFromDate(dateStr) || 'จันทร์';
      const initialRecords: StudentAttendanceItem[] = classStudents.map((std, idx) => ({
        studentId: std.id,
        seq: std.seq || idx + 1,
        studentName: std.name,
        status: std.id === student.id ? newStatus : ('present' as AttendanceStatus)
      }));

      const summary = initialRecords.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          acc.total += 1;
          return acc;
        },
        { present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0 }
      );

      await onSaveAttendance({
        academicYearId: activeYear?.id || '',
        subjectId: currentSubject.id,
        subjectCode: currentSubject.code,
        subjectName: currentSubject.name,
        classId: currentClass.id,
        className: currentClass.name,
        date: dateStr,
        thaiDateStr: formatToThaiBE(dateStr),
        dayOfWeek,
        periodId: matchedAssignment?.periodId || '',
        periodName: matchedAssignment?.periodName || 'คาบสอน',
        teacherUsername,
        teacherName: teacherFullName,
        records: initialRecords,
        summary,
        updatedAt: new Date().toISOString()
      });
    }

    setActiveCellEdit(null);
  };

  // Calculate per-student stats (row totals)
  const studentStats = useMemo(() => {
    return classStudents.map((std) => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let sick = 0;
      let leave = 0;

      teachingDates.forEach((date) => {
        const dateMap = attendanceMatrix.get(date);
        if (dateMap) {
          const st = dateMap.get(std.id) || dateMap.get(std.name);
          if (st === 'present') present++;
          else if (st === 'absent') absent++;
          else if (st === 'late') late++;
          else if (st === 'sick') sick++;
          else if (st === 'leave') leave++;
        }
      });

      const totalCounted = present + absent + late + sick + leave;
      const rate = totalCounted > 0 ? Math.round((present / totalCounted) * 100) : 0;

      return {
        studentId: std.id,
        present,
        absent,
        late,
        sick,
        leave,
        totalCounted,
        rate
      };
    });
  }, [classStudents, teachingDates, attendanceMatrix]);

  // Calculate per-date stats (column totals)
  const dateTotals = useMemo(() => {
    const totals: {
      [date: string]: { present: number; absent: number; late: number; sick: number; leave: number; total: number };
    } = {};

    teachingDates.forEach((date) => {
      const dateMap = attendanceMatrix.get(date);
      let p = 0, a = 0, l = 0, s = 0, lv = 0;

      if (dateMap) {
        classStudents.forEach((std) => {
          const st = dateMap.get(std.id) || dateMap.get(std.name);
          if (st === 'present') p++;
          else if (st === 'absent') a++;
          else if (st === 'late') l++;
          else if (st === 'sick') s++;
          else if (st === 'leave') lv++;
        });
      }

      totals[date] = {
        present: p,
        absent: a,
        late: l,
        sick: s,
        leave: lv,
        total: p + a + l + s + lv
      };
    });

    return totals;
  }, [teachingDates, attendanceMatrix, classStudents]);

  // Print / Export PDF Handler
  const handlePrint = () => {
    window.print();
  };

  // Helper for cell rendering
  const renderStatusSymbol = (status?: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <span className="text-emerald-700 font-extrabold text-sm leading-none">✓</span>;
      case 'absent':
        return <span className="text-red-600 font-bold text-xs leading-none">ข</span>;
      case 'late':
        return <span className="text-amber-600 font-bold text-xs leading-none">ส</span>;
      case 'sick':
        return <span className="text-sky-600 font-bold text-xs leading-none">ป</span>;
      case 'leave':
        return <span className="text-orange-600 font-bold text-xs leading-none">ก</span>;
      default:
        return <span className="text-slate-300 font-normal leading-none">-</span>;
    }
  };

  // Render an Individual Student Slip (Used for single or batch print)
  const renderIndividualSlip = (student: Student, studentIndex: number) => {
    const stats = studentStats[studentIndex] || {
      present: 0,
      absent: 0,
      late: 0,
      sick: 0,
      leave: 0,
      totalCounted: 0,
      rate: 0
    };

    const isPassedStandard = stats.rate >= 80;

    return (
      <div
        key={student.id}
        className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none print:w-full space-y-5 page-break print:break-after-page"
      >
        {/* Official Header */}
        <div className="text-center pb-3 border-b-2 border-slate-800 space-y-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
            {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}
          </h2>
          <p className="text-xs text-slate-700 leading-tight">
            {settings.affiliationName || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาอุดรธานี เขต 3'}
          </p>
          <h3 className="text-sm font-bold text-[#0C7C82] print:text-black pt-1">
            รายงานเวลาเรียนและประวัติการเข้าเรียนรายบุคคล (แบบ ปพ.5)
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            ประจำเดือน{selectedMonthLabel} ปีการศึกษา {activeYear?.name || '2569'}
          </p>
        </div>

        {/* Student & Course Profile Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 print:bg-transparent print:border-slate-400 print:p-3">
          <div className="space-y-1.5">
            <div>
              <span className="text-slate-500">ชื่อ-นามสกุล: </span>
              <strong className="text-slate-900 text-sm">{student.name}</strong>
            </div>
            <div>
              <span className="text-slate-500">เลขที่: </span>
              <strong>{student.seq || studentIndex + 1}</strong>
              <span className="text-slate-500 ml-3">รหัสประจำตัว: </span>
              <strong className="font-mono">{student.username || '-'}</strong>
            </div>
            <div>
              <span className="text-slate-500">ชั้นเรียน: </span>
              <strong>ห้อง {currentClass?.name || '-'}</strong>
            </div>
          </div>

          <div className="space-y-1.5">
            <div>
              <span className="text-slate-500">รายวิชา: </span>
              <strong className="text-slate-900">
                {currentSubject ? `${currentSubject.code} ${currentSubject.name}` : '-'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">ประเภทวิชา: </span>
              <span>{currentSubject?.type || '-'}</span>
              <span className="text-slate-500 ml-3">จำนวน: </span>
              <span>{currentSubject?.periodsPerWeek || '-'} คาบ/สัปดาห์</span>
            </div>
            <div>
              <span className="text-slate-500">ครูผู้สอน: </span>
              <strong>{teacherFullName}</strong>
            </div>
          </div>
        </div>

        {/* Attendance Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 print:border-slate-400 print:bg-transparent">
            <div className="text-[11px] text-emerald-800 font-medium">มาเรียน</div>
            <div className="text-lg font-bold text-emerald-700">{stats.present}</div>
            <div className="text-[10px] text-emerald-600">วัน/คาบ</div>
          </div>

          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 print:border-slate-400 print:bg-transparent">
            <div className="text-[11px] text-red-800 font-medium">ขาดเรียน</div>
            <div className="text-lg font-bold text-red-600">{stats.absent}</div>
            <div className="text-[10px] text-red-500">วัน/คาบ</div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 print:border-slate-400 print:bg-transparent">
            <div className="text-[11px] text-amber-800 font-medium">มาสาย</div>
            <div className="text-lg font-bold text-amber-600">{stats.late}</div>
            <div className="text-[10px] text-amber-500">วัน/คาบ</div>
          </div>

          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 print:border-slate-400 print:bg-transparent">
            <div className="text-[11px] text-sky-800 font-medium">ลาป่วย</div>
            <div className="text-lg font-bold text-sky-600">{stats.sick}</div>
            <div className="text-[10px] text-sky-500">วัน/คาบ</div>
          </div>

          <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 print:border-slate-400 print:bg-transparent">
            <div className="text-[11px] text-orange-800 font-medium">ลากิจ</div>
            <div className="text-lg font-bold text-orange-600">{stats.leave}</div>
            <div className="text-[10px] text-orange-500">วัน/คาบ</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-300 print:border-slate-400 print:bg-transparent">
            <div className="text-[11px] text-slate-800 font-medium">ร้อยละเวลาเรียน</div>
            <div className="text-lg font-extrabold text-slate-900">{stats.rate}%</div>
            <div className="text-[10px] font-bold text-[#0C7C82]">
              {isPassedStandard ? '✓ ผ่านเกณฑ์' : '⚠️ ต่ำกว่า 80%'}
            </div>
          </div>
        </div>

        {/* Detailed Daily Attendance Records Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#0C7C82]" />
              <span>ประวัติการเข้าเรียนรายวันในเดือนนี้ ({teachingDates.length} คาบ/วัน)</span>
            </h4>
            <span className="text-[11px] text-slate-500">
              รวมเวลาเรียนที่เปิดสอน: {stats.totalCounted} คาบ
            </span>
          </div>

          <table className="w-full text-center border-collapse border border-slate-600 text-xs text-slate-900 print:text-[9.5px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold">
                <th className="py-1.5 px-2 border border-slate-600 w-12 text-center">ลำดับ</th>
                <th className="py-1.5 px-3 border border-slate-600 text-left">วันที่สอน</th>
                <th className="py-1.5 px-3 border border-slate-600 text-center w-28">วันในสัปดาห์</th>
                <th className="py-1.5 px-3 border border-slate-600 text-center w-32">สถานะการเข้าเรียน</th>
                <th className="py-1.5 px-3 border border-slate-600 text-left">หมายเหตุ / สภาพการมาเรียน</th>
              </tr>
            </thead>
            <tbody>
              {teachingDates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 border border-slate-600">
                    ไม่มีรายการคาบสอนในเดือน {selectedMonthLabel}
                  </td>
                </tr>
              ) : (
                teachingDates.map((dateStr, idx) => {
                  const dateMap = attendanceMatrix.get(dateStr);
                  const status = dateMap?.get(student.id) || dateMap?.get(student.name);
                  const dayOfWeek = getDayOfWeekFromDate(dateStr) || '-';

                  let statusBadge = (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold text-slate-400">
                      - ยังไม่ได้บันทึก
                    </span>
                  );

                  if (status === 'present') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        ✓ มาเรียน
                      </span>
                    );
                  } else if (status === 'absent') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">
                        ข ขาดเรียน
                      </span>
                    );
                  } else if (status === 'late') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                        ส มาสาย
                      </span>
                    );
                  } else if (status === 'sick') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800">
                        ป ลาป่วย
                      </span>
                    );
                  } else if (status === 'leave') {
                    statusBadge = (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800">
                        ก ลากิจ
                      </span>
                    );
                  }

                  return (
                    <tr key={dateStr} className="hover:bg-slate-50/50">
                      <td className="py-1 px-2 border border-slate-600 font-semibold">{idx + 1}</td>
                      <td className="py-1 px-3 border border-slate-600 text-left font-medium">
                        {formatToThaiBE(dateStr)}
                      </td>
                      <td className="py-1 px-3 border border-slate-600 text-center">
                        วัน{dayOfWeek}
                      </td>
                      <td className="py-1 px-3 border border-slate-600 text-center font-bold">
                        {statusBadge}
                      </td>
                      <td className="py-1 px-3 border border-slate-600 text-left text-slate-500 text-[11px]">
                        {status === 'present'
                          ? 'เข้าเรียนตามเวลาปกติ'
                          : status === 'absent'
                          ? 'ไม่มาเรียนโดยไม่แจ้งสาเหตุ'
                          : status === 'late'
                          ? 'เข้าเรียนหลังเวลาเริ่มคาบ'
                          : status === 'sick'
                          ? 'มีใบลาป่วยถูกต้อง'
                          : status === 'leave'
                          ? 'มีใบลากิจถูกต้อง'
                          : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Evaluation Summary Note */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 print:bg-transparent print:border-slate-400">
          <strong>สรุปผลการประเมินเวลาเรียน: </strong>
          {isPassedStandard ? (
            <span className="text-emerald-700 font-bold">
              มีเวลาเรียนร้อยละ {stats.rate}% ผ่านเกณฑ์การประเมินเวลาเรียนขั้นต่ำ (80%) มีสิทธิ์ได้รับการประเมินผลการเรียน
            </span>
          ) : (
            <span className="text-red-600 font-bold">
              มีเวลาเรียนร้อยละ {stats.rate}% ต่ำกว่าเกณฑ์มาตรฐาน (ต่ำกว่า 80%) อยู่ในกลุ่มเฝ้าระวังและต้องติดตามแก้ไขเวลาเรียน
            </span>
          )}
        </div>

        {/* 3-Signatory Block: Teacher, School Director, Parent */}
        <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs text-slate-800 print:pt-4 print:break-inside-avoid">
          <div className="space-y-4">
            <p className="leading-relaxed">
              ลงชื่อ........................................................
            </p>
            <p className="font-semibold">({effectiveTeacherFullName})</p>
            <p className="text-[11px] text-slate-500">ครูผู้สอน</p>
            <p className="text-[11px] text-slate-400">
              วันที่........./........./..........
            </p>
          </div>

          <div className="space-y-4">
            <p className="leading-relaxed">
              ลงชื่อ........................................................
            </p>
            <p className="font-semibold">({effectiveDirectorName})</p>
            <p className="text-[11px] text-slate-600 font-medium">ผู้อำนวยการสถานศึกษา</p>
            <p className="text-[11px] text-slate-400">
              วันที่........./........./..........
            </p>
          </div>

          <div className="space-y-4">
            <p className="leading-relaxed">
              ลงชื่อ........................................................
            </p>
            <p className="font-semibold">(........................................................)</p>
            <p className="text-[11px] text-slate-500">ผู้ปกครองนักเรียน (รับทราบ)</p>
            <p className="text-[11px] text-slate-400">
              วันที่........./........./..........
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-['Sarabun',sans-serif]">
      {/* Explicit Print Page Settings: A4 Portrait with Narrow Margin */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 portrait !important;
          margin: 0.5cm !important;
        }
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 0.5cm !important;
          }
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          html, body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      {/* Control Header & Filters (Hidden during print / PDF) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5 no-print">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#0C7C82]" />
              <span>
                {reportMode === 'daily_audit'
                  ? 'ระบบตรวจสอบการเช็คชื่อครูผู้สอน'
                  : reportMode === 'class'
                  ? 'รายงานสรุปการเช็คชื่อรายวิชา (ทั้งชั้นเรียน)'
                  : 'รายงานเวลาเรียนและประวัติการเข้าเรียนรายบุคคล (แบบ ปพ.5)'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {reportMode === 'daily_audit'
                ? 'ตรวจสอบสถานะการเช็คชื่อของครูผู้สอนประจำวัน ว่าครูท่านใดเช็คครบแล้ว ท่านใดเช็คยังไม่ครบ และเหลือวิชาอะไรบ้าง'
                : reportMode === 'class'
                ? 'ตารางสรุปการเช็คชื่อรายวิชาตามวันที่สอนจริงในแต่ละเดือน และ Export รายงานเป็นไฟล์ PDF'
                : 'เอกสารสรุปเวลาเรียนและประวัติการเข้าเรียนรายบุคคลสำหรับพิมพ์และจัดเก็บเป็นหลักฐาน'}
            </p>
          </div>

          {/* Mode Switcher & Export PDF Button */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Report Mode Tabs: Daily Audit vs Class vs Individual */}
            <div className="p-1 rounded-2xl bg-slate-100 flex flex-wrap items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setReportMode('daily_audit')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  reportMode === 'daily_audit'
                    ? 'bg-white text-[#0C7C82] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardCheck className="w-4 h-4 text-[#0C7C82]" />
                <span>ตรวจสอบการเช็คชื่อ (รายวัน)</span>
                {auditStats.pendingTeachersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    ค้าง {auditStats.pendingTeachersCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setReportMode('class')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  reportMode === 'class'
                    ? 'bg-white text-[#0C7C82] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>รายงานทั้งชั้นเรียน</span>
              </button>

              <button
                type="button"
                onClick={() => setReportMode('individual')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  reportMode === 'individual'
                    ? 'bg-white text-[#0C7C82] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>รายงานนักเรียนรายบุคคล</span>
              </button>
            </div>

            {/* Print / Export PDF Button */}
            <button
              onClick={handlePrint}
              disabled={
                reportMode !== 'daily_audit' &&
                (teacherClasses.length === 0 || teacherSubjects.length === 0)
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-sm disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>
                {reportMode === 'daily_audit'
                  ? 'พิมพ์สรุปการตรวจสอบ (PDF/Print)'
                  : reportMode === 'class'
                  ? 'พิมพ์ / บันทึก PDF ทั้งชั้นเรียน'
                  : individualScope === 'all'
                  ? `พิมพ์ / บันทึก PDF ทุกคน (${classStudents.length} หน้า)`
                  : 'พิมพ์ / บันทึก PDF รายบุคคล'}
              </span>
            </button>
          </div>
        </div>

        {/* CONTROLS FOR DAILY AUDIT MODE */}
        {reportMode === 'daily_audit' && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            {/* Date Selection Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-teal-50/60 border border-teal-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#0C7C82]" />
                  <span className="text-xs font-bold text-slate-800">วันที่ตรวจสอบ:</span>
                </div>

                {/* Quick Date Buttons */}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSelectedAuditDate(getTodayISODate())}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isAuditToday
                        ? 'bg-[#0C7C82] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    วันนี้
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      setSelectedAuditDate(`${y}-${m}-${day}`);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      !isAuditToday
                        ? 'bg-slate-200 text-slate-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    เมื่อวาน
                  </button>
                </div>

                {/* Date Input */}
                <input
                  type="date"
                  value={selectedAuditDate}
                  onChange={(e) => setSelectedAuditDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
                />
              </div>

              {/* Thai Full Date & Day Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 font-medium hidden sm:inline">
                  {auditThaiDateFull}
                </span>
                {auditDayOfWeek ? (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                      auditDayOfWeek === 'จันทร์'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : auditDayOfWeek === 'อังคาร'
                        ? 'bg-pink-100 text-pink-900 border border-pink-300'
                        : auditDayOfWeek === 'พุธ'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : auditDayOfWeek === 'พฤหัสบดี'
                        ? 'bg-orange-100 text-orange-900 border border-orange-300'
                        : 'bg-sky-100 text-sky-900 border border-sky-300'
                    }`}
                  >
                    วัน{auditDayOfWeek}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                    วันหยุดสุดสัปดาห์
                  </span>
                )}
              </div>
            </div>

            {/* Weekend Notice if applicable */}
            {isAuditWeekend && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    วันที่เลือกตรงกับวันหยุดสุดสัปดาห์ (เสาร์-อาทิตย์) โดยปกติโรงเรียนจะไม่มีตารางสอน
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAuditDate(getTodayISODate())}
                  className="px-3 py-1 bg-white border border-amber-300 rounded-lg text-[11px] font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  กลับสู่วันนี้
                </button>
              </div>
            )}

            {/* 4 KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Total Teachers with Scheduled Classes */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-medium">ครูที่มีสอนวันนี้</span>
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-slate-800">
                    {auditStats.scheduledTeachersCount}
                  </span>
                  <span className="text-xs text-slate-500">
                    / {effectiveTeacherList.length} ท่าน
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  รวมคาบสอน {auditStats.totalPeriods} คาบ
                </div>
              </div>

              {/* Completed All Checks */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-2xs">
                <div className="flex items-center justify-between text-emerald-800 mb-1">
                  <span className="text-xs font-bold">เช็คครบแล้วทุกวิชา</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-emerald-700">
                    {auditStats.completedTeachersCount}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">
                    ({auditStats.completionRate}%)
                  </span>
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  บันทึกครบ 100% ทุกคาบสอนในวันนี้
                </div>
              </div>

              {/* Incomplete / Pending Checks */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs">
                <div className="flex items-center justify-between text-amber-800 mb-1">
                  <span className="text-xs font-bold">ยังเช็คไม่ครบ / ค้างเช็ค</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-amber-700">
                    {auditStats.pendingTeachersCount}
                  </span>
                  <span className="text-xs font-bold text-amber-600">
                    ท่าน
                  </span>
                </div>
                <div className="text-[11px] text-amber-700 mt-1 flex flex-wrap gap-1">
                  <span>ยังไม่ครบ {auditStats.incompleteTeachersCount} ท่าน</span>
                  <span>•</span>
                  <span>ยังไม่เช็คเลย {auditStats.notCheckedTeachersCount} ท่าน</span>
                </div>
              </div>

              {/* Total Periods Checked Rate */}
              <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 shadow-2xs">
                <div className="flex items-center justify-between text-teal-800 mb-1">
                  <span className="text-xs font-bold">คาบเรียนที่เช็คแล้ว</span>
                  <Clock className="w-4 h-4 text-teal-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-teal-700">
                    {auditStats.checkedPeriods}
                  </span>
                  <span className="text-xs text-teal-600">
                    / {auditStats.totalPeriods} คาบ
                  </span>
                </div>
                <div className="text-[11px] text-teal-700 mt-1">
                  ความคืบหน้า {auditStats.periodsRate}% (เหลือ {auditStats.remainingPeriods} คาบ)
                </div>
              </div>
            </div>

            {/* Filter Tabs and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              {/* Quick Status Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAuditStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    auditStatusFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ทั้งหมดที่มีสอน ({auditStats.scheduledTeachersCount})
                </button>

                <button
                  type="button"
                  onClick={() => setAuditStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    auditStatusFilter === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  ✓ เช็คครบแล้ว ({auditStats.completedTeachersCount})
                </button>

                <button
                  type="button"
                  onClick={() => setAuditStatusFilter('incomplete')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    auditStatusFilter === 'incomplete'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  ⚠️ ยังไม่ครบ / ยังไม่เช็ค ({auditStats.pendingTeachersCount})
                </button>

                <button
                  type="button"
                  onClick={() => setAuditStatusFilter('no_classes')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    auditStatusFilter === 'no_classes'
                      ? 'bg-slate-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  ไม่มีสอนวันนี้ ({auditStats.noClassTeachersCount})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อครู, รหัสวิชา, ห้อง..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0C7C82] text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS FOR CLASS / INDIVIDUAL REPORT MODES */}
        {reportMode !== 'daily_audit' && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            {/* If Admin/Director: Allow selecting which teacher to view */}
            {isAdminOrDirector && effectiveTeacherList.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-900">
                  <User className="w-4 h-4 text-[#0C7C82]" />
                  <span>เลือกครูผู้สอนที่ต้องการดูรายงาน:</span>
                </div>
                <select
                  value={selectedAdminTeacher}
                  onChange={(e) => setSelectedAdminTeacher(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-teal-300 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
                >
                  {effectiveTeacherList.map((t) => (
                    <option key={t.username} value={t.username}>
                      {t.fullName} ({t.username})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filter Controls: Only classes taught and only subjects taught */}
            {teacherClasses.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {isAdminOrDirector
                    ? `ครูผู้สอน ${effectiveTeacherFullName} ยังไม่มีชั้นเรียนที่ได้รับมอบหมายการสอนในระบบ`
                    : 'ท่านยังไม่มีชั้นเรียนที่ได้รับมอบหมายการสอนในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อจัดตารางสอน'}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Select Classroom: Shows ONLY classes taught by this teacher */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                    <span>เลือกชั้นเรียนที่สอน <span className="text-red-500">*</span></span>
                    <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-normal">
                      เฉพาะที่สอน ({teacherClasses.length} ห้อง)
                    </span>
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
                  >
                    {teacherClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Select Subject: Shows ONLY subjects taught by this teacher for this class */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                    <span>เลือกรายวิชาที่สอน <span className="text-red-500">*</span></span>
                    <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-normal">
                      เฉพาะห้อง {currentClass?.name || ''} ({teacherSubjects.length} วิชา)
                    </span>
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
                  >
                    {teacherSubjects.length === 0 ? (
                      <option value="" disabled>-- ไม่มีวิชาที่สอนในห้องนี้ --</option>
                    ) : (
                      teacherSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} {s.name} ({s.type})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* 3. Select Month: Filtered strictly to months in active academic year */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                    <span>เลือกเดือนที่แสดง <span className="text-red-500">*</span></span>
                    <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-normal">
                      ช่วงปีการศึกษา {activeYear?.name || '2569'}
                    </span>
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
                  >
                    {availableMonths.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Sub-controls when in 'individual' mode */}
            {reportMode === 'individual' && classStudents.length > 0 && (
              <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-teal-900 mb-1.5">
                    เลือกนักเรียนที่ต้องการดู / Export รายงาน:
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-teal-300 text-sm font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
                  >
                    {classStudents.map((std, idx) => {
                      const stats = studentStats[idx];
                      return (
                        <option key={std.id} value={std.id}>
                          เลขที่ {std.seq || idx + 1}: {std.name} ({std.username || '-'}) — มาเรียน {stats?.rate || 0}%
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-teal-900 mb-1.5">
                    ตัวเลือกการพิมพ์ / Export PDF:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIndividualScope('single')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                        individualScope === 'single'
                          ? 'bg-[#0C7C82] text-white border-[#0C7C82] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      เฉพาะคนนี้ ({currentStudent?.name?.split(' ')[0] || 'ที่เลือก'})
                    </button>

                    <button
                      type="button"
                      onClick={() => setIndividualScope('all')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                        individualScope === 'all'
                          ? 'bg-[#0C7C82] text-white border-[#0C7C82] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      พิมพ์ทุกคนในห้อง ({classStudents.length} คน แยกหน้า)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tip for Interactive Checking and Printing */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#0C7C82]" />
                <span>
                  <strong>ระบบ Export PDF:</strong> เลือกรูปแบบที่ต้องการ (ทั้งชั้นเรียน หรือ รายบุคคล) แล้วคลิกปุ่ม &quot;พิมพ์ / บันทึก PDF&quot; เพื่อบันทึกเป็นเอกสาร A4 แนวตั้ง
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                มาตรฐาน A4 แนวตั้ง (Portrait) ระยะขอบแคบ 0.5 ซม.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIEW: ตรวจสอบการเช็คชื่อครูผู้สอนประจำวัน (DAILY TEACHER ATTENDANCE AUDIT) */}
      {reportMode === 'daily_audit' && (
        <>
          {/* SCREEN AUDIT CARDS (Hidden on print) */}
          <div className="space-y-4 no-print">
            {filteredTeacherAudits.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">ไม่พบข้อมูลครูผู้สอนตามเงื่อนไขที่เลือก</h3>
                <p className="text-xs text-slate-500 mt-1">
                  ลองเปลี่ยนตัวกรองสถานะ หรือค้นหาด้วยชื่ออื่น
                </p>
              </div>
            ) : (
              filteredTeacherAudits.map((item) => {
                const isMyAccount = item.teacher.username === teacherUsername;
                const isExpanded = expandedTeacherUsernames.has(item.teacher.username);

                return (
                  <div
                    key={item.teacher.username}
                    className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                      item.status === 'completed'
                        ? 'border-emerald-200/80 hover:border-emerald-300'
                        : item.status === 'incomplete'
                        ? 'border-amber-300 hover:border-amber-400 bg-amber-50/15'
                        : item.status === 'not_checked'
                        ? 'border-rose-300 hover:border-rose-400 bg-rose-50/15'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Teacher Card Header */}
                    <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100">
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shadow-sm ${
                            item.status === 'completed'
                              ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white'
                              : item.status === 'incomplete'
                              ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-white'
                              : item.status === 'not_checked'
                              ? 'bg-gradient-to-tr from-rose-500 to-red-400 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {item.teacher.fullName?.slice(0, 2) || item.teacher.username?.slice(0, 2) || 'ครู'}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">
                              {item.teacher.fullName}
                            </h3>
                            {isMyAccount && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0C7C82] text-white">
                                บัญชีของคุณ
                              </span>
                            )}
                            <span className="text-xs text-slate-400 font-mono">
                              @{item.teacher.username}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                            <span>
                              มีตารางสอนวันนี้:{' '}
                              <strong className="text-slate-800">
                                {item.totalPeriods} คาบ
                              </strong>
                            </span>
                            {item.totalPeriods > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 font-semibold">
                                  เช็คแล้ว {item.checkedCount} คาบ
                                </span>
                                {item.remainingCount > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-rose-600 font-bold">
                                      ค้างเช็ค {item.remainingCount} วิชา
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Badges & Action */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Status Pill */}
                        {item.status === 'completed' && (
                          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>เช็คชื่อครบแล้วทุกวิชา ({item.checkedCount}/{item.totalPeriods} คาบ • 100%)</span>
                          </div>
                        )}

                        {item.status === 'incomplete' && (
                          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span>
                              ยังเช็คไม่ครบ (เช็คแล้ว {item.checkedCount}/{item.totalPeriods} คาบ • เหลือ {item.remainingCount} วิชา)
                            </span>
                          </div>
                        )}

                        {item.status === 'not_checked' && (
                          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
                            <Clock className="w-4 h-4 text-rose-600" />
                            <span>
                              ยังไม่ได้เช็คชื่อ (0/{item.totalPeriods} คาบ • เหลือ {item.remainingCount} วิชา)
                            </span>
                          </div>
                        )}

                        {item.status === 'no_classes' && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                            <span>ไม่มีตารางสอนในวันนี้</span>
                          </div>
                        )}

                        {/* Expand Details Toggle */}
                        {item.totalPeriods > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleTeacherExpand(item.teacher.username)}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-all"
                            title={isExpanded ? 'ย่อรายละเอียด' : 'ดูรายละเอียดทุกวิชา'}
                          >
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar (if teacher has classes) */}
                    {item.totalPeriods > 0 && (
                      <div className="w-full bg-slate-100 h-1.5">
                        <div
                          className={`h-full transition-all duration-500 ${
                            item.status === 'completed'
                              ? 'bg-emerald-500'
                              : item.status === 'incomplete'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    )}

                    {/* Teacher Content Body */}
                    {item.totalPeriods > 0 && (
                      <div className="p-5 sm:p-6 space-y-4">
                        {/* 1. HIGHLIGHT: REMAINING UNCHECKED SUBJECTS (วิชาที่ยังค้างเช็คชื่อ) */}
                        {item.remainingItems.length > 0 && (
                          <div className="rounded-2xl p-4 bg-rose-50/70 border-2 border-rose-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-rose-900 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                                <span>
                                  วิชาที่เหลือยังไม่ได้เช็คชื่อในวันนี้ ({item.remainingItems.length} รายวิชา):
                                </span>
                              </h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-800">
                                ต้องติดตามเช็คชื่อ
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {item.remainingItems.map((rem) => (
                                <div
                                  key={rem.assignment.id}
                                  className="p-3 rounded-xl bg-white border border-rose-200 shadow-2xs flex flex-col justify-between gap-2.5"
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="font-bold text-slate-900 text-xs leading-tight">
                                        {rem.assignment.subjectCode} {rem.assignment.subjectName}
                                      </div>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 shrink-0">
                                        ❌ ยังไม่เช็คชื่อ
                                      </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-600">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-700">
                                        ห้อง {rem.assignment.className}
                                      </span>
                                      <span className="flex items-center gap-1 font-medium text-slate-500">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <span>
                                          คาบที่ {rem.assignment.periodName} ({rem.timeRange || 'ตามตารางสอน'})
                                        </span>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Quick action button to check this assignment */}
                                  {onSelectAssignmentForAttendance && (
                                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => onSelectAssignmentForAttendance(rem.assignment)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] cursor-pointer shadow-2xs"
                                      >
                                        <span>ไปเช็คชื่อวิชานี้</span>
                                        <ArrowRight className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. CHECKED SUBJECTS (วิชาที่เช็คชื่อแล้ว) */}
                        {item.checkedItems.length > 0 && (
                          <div className={`space-y-2.5 ${item.remainingItems.length > 0 && !isExpanded ? 'hidden' : 'block'}`}>
                            <div className="flex items-center justify-between text-xs text-slate-700 font-bold">
                              <span className="flex items-center gap-1.5 text-emerald-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>วิชาที่เช็คชื่อแล้วในวันนี้ ({item.checkedItems.length} รายวิชา):</span>
                              </span>
                              <span className="text-[11px] font-normal text-slate-400">
                                บันทึกข้อมูลเรียบร้อย
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {item.checkedItems.map((chk) => (
                                <div
                                  key={chk.assignment.id}
                                  className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-200/80 shadow-2xs flex flex-col justify-between gap-2"
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="font-bold text-slate-900 text-xs">
                                        {chk.assignment.subjectCode} {chk.assignment.subjectName}
                                      </div>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0 flex items-center gap-1">
                                        <Check className="w-3 h-3 text-emerald-700" />
                                        <span>เช็คแล้ว</span>
                                      </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-600">
                                      <span className="px-2 py-0.5 rounded-md bg-white border border-emerald-100 font-semibold text-slate-700">
                                        ห้อง {chk.assignment.className}
                                      </span>
                                      <span className="text-slate-500">
                                        คาบที่ {chk.assignment.periodName} ({chk.timeRange})
                                      </span>
                                    </div>
                                  </div>

                                  {/* Student summary pills */}
                                  {chk.log?.summary && (
                                    <div className="pt-2 border-t border-emerald-100 flex flex-wrap items-center gap-1.5 text-[10px]">
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100/80 text-emerald-900 font-bold">
                                        มา {chk.log.summary.present || 0}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                                        ขาด {chk.log.summary.absent || 0}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                                        สาย {chk.log.summary.late || 0}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold">
                                        ลา {(chk.log.summary.sick || 0) + (chk.log.summary.leave || 0)}
                                      </span>
                                      <span className="text-slate-400 ml-auto">
                                        รวม {chk.log.summary.total || 0} คน
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Collapsed view indicator if remaining items exist */}
                        {item.remainingItems.length > 0 && item.checkedItems.length > 0 && !isExpanded && (
                          <div className="text-center pt-1">
                            <button
                              type="button"
                              onClick={() => toggleTeacherExpand(item.teacher.username)}
                              className="text-[11px] font-bold text-[#0C7C82] hover:underline cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>แสดงวิชาที่เช็คแล้วอีก {item.checkedItems.length} วิชา</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* PRINT DOCUMENT LAYOUT FOR DAILY AUDIT (Visible ONLY when printing) */}
          <div className="hidden print:block font-['Sarabun',sans-serif] text-slate-900 bg-white">
            {/* Document Header */}
            <div className="text-center pb-3 mb-3 border-b-2 border-slate-900 space-y-1">
              <h2 className="text-lg font-bold leading-tight">
                {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}
              </h2>
              <p className="text-xs text-slate-700 leading-tight">
                {settings.affiliationName || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาอุดรธานี เขต 3'}
              </p>
              <h3 className="text-sm font-bold text-slate-900 pt-1">
                รายงานสรุปผลการตรวจสอบการเช็คชื่อนักเรียนของครูผู้สอนประจำวัน
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                ประจำ{auditThaiDateFull} (ปีการศึกษา {activeYear?.name || '2569'})
              </p>
            </div>

            {/* Audit Summary Statistics Bar */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs border border-slate-600 rounded-lg p-2.5 mb-3">
              <div>
                <div className="text-[10px] text-slate-600">ครูที่มีสอนวันนี้</div>
                <div className="text-sm font-bold">{auditStats.scheduledTeachersCount} ท่าน</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-600">เช็คชื่อครบทุกวิชา</div>
                <div className="text-sm font-bold text-emerald-800">
                  {auditStats.completedTeachersCount} ท่าน ({auditStats.completionRate}%)
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-600">ยังเช็คไม่ครบ / ค้างเช็ค</div>
                <div className="text-sm font-bold text-red-700">{auditStats.pendingTeachersCount} ท่าน</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-600">รวมคาบเรียนที่เช็คแล้ว</div>
                <div className="text-sm font-bold">
                  {auditStats.checkedPeriods} / {auditStats.totalPeriods} คาบ ({auditStats.periodsRate}%)
                </div>
              </div>
            </div>

            {/* Official Audit Table */}
            <table className="w-full text-center border-collapse border border-slate-600 text-xs">
              <thead>
                <tr className="bg-slate-100 font-bold">
                  <th className="py-1.5 px-2 border border-slate-600 w-10">ลำดับ</th>
                  <th className="py-1.5 px-3 border border-slate-600 text-left w-48">ชื่อ-สกุลครูผู้สอน</th>
                  <th className="py-1.5 px-2 border border-slate-600 w-16">คาบสอน</th>
                  <th className="py-1.5 px-2 border border-slate-600 w-16">เช็คแล้ว</th>
                  <th className="py-1.5 px-3 border border-slate-600 w-28">ผลการเช็คชื่อ</th>
                  <th className="py-1.5 px-3 border border-slate-600 text-left">
                    รายวิชาและคาบที่ยังค้างเช็คชื่อในวันนี้
                  </th>
                </tr>
              </thead>
              <tbody>
                {teacherAudits
                  .filter((t) => t.totalPeriods > 0)
                  .map((t, idx) => (
                    <tr key={t.teacher.username} className="border-b border-slate-600">
                      <td className="py-1.5 px-2 border border-slate-600 font-semibold">{idx + 1}</td>
                      <td className="py-1.5 px-3 border border-slate-600 text-left font-bold">
                        {t.teacher.fullName}
                      </td>
                      <td className="py-1.5 px-2 border border-slate-600">{t.totalPeriods}</td>
                      <td className="py-1.5 px-2 border border-slate-600 font-bold">
                        {t.checkedCount}
                      </td>
                      <td className="py-1.5 px-3 border border-slate-600 font-bold">
                        {t.status === 'completed' ? (
                          <span className="text-emerald-800">✓ ครบทุกวิชา</span>
                        ) : t.status === 'incomplete' ? (
                          <span className="text-amber-800">⚠️ ยังไม่ครบ ({t.remainingCount} วิชา)</span>
                        ) : (
                          <span className="text-red-700">❌ ยังไม่เช็ค</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 border border-slate-600 text-left text-[10.5px]">
                        {t.remainingItems.length === 0 ? (
                          <span className="text-emerald-700 font-medium">✓ บันทึกเวลาเรียนครบถ้วนทุกคาบ</span>
                        ) : (
                          <div className="space-y-0.5">
                            {t.remainingItems.map((rem) => (
                              <div key={rem.assignment.id} className="text-red-700 font-semibold">
                                • {rem.assignment.subjectCode} {rem.assignment.subjectName} (ห้อง {rem.assignment.className}) คาบที่ {rem.assignment.periodName} ({rem.timeRange})
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* Official 3-Signatory Block */}
            <div className="grid grid-cols-3 gap-4 pt-8 text-center text-xs print:break-inside-avoid">
              <div className="space-y-4">
                <p className="leading-relaxed">ลงชื่อ........................................................</p>
                <p className="font-semibold">({teacherFullName})</p>
                <p className="text-[11px] text-slate-600">ครูเวรประจำวัน / ผู้รายงาน</p>
                <p className="text-[11px] text-slate-500">วันที่........./........./..........</p>
              </div>

              <div className="space-y-4">
                <p className="leading-relaxed">ลงชื่อ........................................................</p>
                <p className="font-semibold">(........................................................)</p>
                <p className="text-[11px] text-slate-600">หัวหน้าฝ่ายวิชาการ</p>
                <p className="text-[11px] text-slate-500">วันที่........./........./..........</p>
              </div>

              <div className="space-y-4">
                <p className="leading-relaxed">ลงชื่อ........................................................</p>
                <p className="font-semibold">({effectiveDirectorName})</p>
                <p className="text-[11px] text-slate-600 font-medium">ผู้อำนวยการสถานศึกษา</p>
                <p className="text-[11px] text-slate-500">วันที่........./........./..........</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEW 1: ทั้งชั้นเรียน (CLASS ATTENDANCE SHEET) */}
      {reportMode === 'class' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none print:w-full overflow-hidden">
          {/* Official Document Header */}
          <div className="text-center pb-3 mb-3 border-b-2 border-slate-800 space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}
            </h2>
            <p className="text-xs text-slate-700 leading-tight">
              {settings.affiliationName || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาอุดรธานี เขต 3'}
            </p>
            <h3 className="text-sm font-bold text-[#0C7C82] print:text-black pt-1">
              รายงานสรุปการเช็คชื่อการเข้าเรียนของนักเรียนสำหรับรายวิชา (แบบ ปพ.5)
            </h3>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-slate-800 pt-1 font-medium">
              <span>
                <strong>รายวิชา:</strong> {currentSubject ? `${currentSubject.code} ${currentSubject.name}` : '-'}
              </span>
              <span>
                <strong>ชั้นเรียน:</strong> {currentClass?.name || '-'}
              </span>
              <span>
                <strong>ประจำเดือน:</strong> {selectedMonthLabel}
              </span>
              <span>
                <strong>ปีการศึกษา:</strong> {activeYear?.name || '2569'}
              </span>
              <span>
                <strong>ครูผู้สอน:</strong> {teacherFullName}
              </span>
            </div>
          </div>

          {/* Legend Guide Bar */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-700 mb-2.5 px-3 py-1 bg-slate-50 border border-slate-300 rounded-xl print:border-none print:bg-transparent print:px-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium">
              <span className="font-bold text-slate-800">คำอธิบายสัญลักษณ์:</span>
              <span className="inline-flex items-center gap-1">
                <strong className="text-emerald-700 font-extrabold text-xs">✓</strong> = มาเรียน
              </span>
              <span className="inline-flex items-center gap-1">
                <strong className="text-red-600 font-bold text-xs">ข</strong> = ขาด
              </span>
              <span className="inline-flex items-center gap-1">
                <strong className="text-amber-600 font-bold text-xs">ส</strong> = สาย
              </span>
              <span className="inline-flex items-center gap-1">
                <strong className="text-sky-600 font-bold text-xs">ป</strong> = ป่วย
              </span>
              <span className="inline-flex items-center gap-1">
                <strong className="text-orange-600 font-bold text-xs">ก</strong> = กิจ
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              แสดงเฉพาะวันที่มีสอนในเดือนนี้ ({teachingDates.length} วัน)
            </div>
          </div>

          {/* Attendance Matrix Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-center border-collapse border border-slate-600 text-xs text-slate-900 print:text-[9px] print:w-full">
              <thead>
                {/* Top Header Row */}
                <tr className="bg-slate-100 text-slate-900 font-bold">
                  <th className="py-1.5 px-1 border border-slate-600 w-10 shrink-0 text-center print:w-7 print:px-0.5 print:py-1" rowSpan={2}>
                    ลำดับ
                  </th>
                  <th className="py-1.5 px-3 border border-slate-600 min-w-[160px] text-left print:min-w-0 print:px-1.5 print:py-1 print:text-[9.5px]" rowSpan={2}>
                    ชื่อนักเรียน
                  </th>

                  {/* Date Columns Header */}
                  {teachingDates.length === 0 ? (
                    <th className="py-2 px-4 border border-slate-600 text-center text-slate-500 font-normal">
                      ไม่มีคาบสอนในเดือน {selectedMonthLabel}
                    </th>
                  ) : (
                    <th
                      className="py-1 px-1 border border-slate-600 text-center font-bold print:py-0.5 print:text-[9px]"
                      colSpan={teachingDates.length}
                    >
                      วันที่ (เฉพาะวันที่มีสอนในเดือน {selectedMonthLabel})
                    </th>
                  )}

                  {/* Summary Columns Header */}
                  <th className="py-1 px-1 border border-slate-600 text-center font-bold print:py-0.5 print:text-[9px]" colSpan={6}>
                    สรุป (วัน)
                  </th>
                </tr>

                {/* Second Header Row */}
                <tr className="bg-slate-50 text-[11px] print:text-[8.5px] font-bold">
                  {teachingDates.map((dateStr) => {
                    const dayNum = parseInt(dateStr.split('-')[2], 10);
                    const dayOfWeek = getDayOfWeekFromDate(dateStr);
                    const shortDay = dayOfWeek ? dayOfWeek.slice(0, 2) : '';

                    return (
                      <th
                        key={dateStr}
                        className="py-1 px-0.5 border border-slate-600 min-w-[26px] max-w-[32px] text-center print:min-w-0 print:w-auto print:px-0.5 print:py-0.5"
                        title={formatToThaiBE(dateStr)}
                      >
                        <div className="text-xs print:text-[9px] font-bold leading-tight">{dayNum}</div>
                        <div className="text-[9px] print:text-[7.5px] text-slate-500 font-normal leading-tight">
                          {shortDay}
                        </div>
                      </th>
                    );
                  })}

                  {/* Summary Subheaders: มา, ขาด, สาย, ป่วย, กิจ, ร้อยละ */}
                  <th className="py-1 px-1 border border-slate-600 w-8 print:w-6 print:px-0.5 text-emerald-800 text-[10px] print:text-[8px]">มา</th>
                  <th className="py-1 px-1 border border-slate-600 w-8 print:w-6 print:px-0.5 text-red-700 text-[10px] print:text-[8px]">ขาด</th>
                  <th className="py-1 px-1 border border-slate-600 w-8 print:w-6 print:px-0.5 text-amber-700 text-[10px] print:text-[8px]">สาย</th>
                  <th className="py-1 px-1 border border-slate-600 w-8 print:w-6 print:px-0.5 text-sky-700 text-[10px] print:text-[8px]">ป่วย</th>
                  <th className="py-1 px-1 border border-slate-600 w-8 print:w-6 print:px-0.5 text-orange-700 text-[10px] print:text-[8px]">กิจ</th>
                  <th className="py-1 px-1 border border-slate-600 w-10 print:w-7 print:px-0.5 text-slate-900 text-[10px] print:text-[8px]">%</th>
                </tr>
              </thead>

              {/* Table Body: Student Rows */}
              <tbody className="divide-y divide-slate-400 text-xs print:text-[9px]">
                {classStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={teachingDates.length + 8}
                      className="py-8 text-center text-slate-400 border border-slate-400"
                    >
                      ยังไม่มีรายชื่อนักเรียนในห้อง {currentClass?.name || ''}
                    </td>
                  </tr>
                ) : (
                  classStudents.map((std, idx) => {
                    const stats = studentStats[idx];

                    return (
                      <tr
                        key={std.id || idx}
                        className="hover:bg-teal-50/20 print:hover:bg-transparent transition-colors group"
                      >
                        {/* 1. ลำดับ */}
                        <td className="py-1 px-1 border border-slate-600 text-center font-semibold text-slate-700 print:py-0.5 print:px-0.5 print:text-[9px]">
                          {std.seq || idx + 1}
                        </td>

                        {/* 2. ชื่อนักเรียน with Quick Individual Report Button */}
                        <td className="py-1 px-2.5 border border-slate-600 text-left font-medium text-slate-900 whitespace-nowrap print:py-0.5 print:px-1.5 print:text-[9.5px]">
                          <div className="flex items-center justify-between gap-1">
                            <span>{std.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentId(std.id);
                                setReportMode('individual');
                              }}
                              title="ดูและ Export PDF รายงานรายบุคคลของนักเรียนคนนี้"
                              className="no-print opacity-0 group-hover:opacity-100 p-1 rounded-md text-[#0C7C82] hover:bg-[#0C7C82]/10 transition-opacity cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* 3. วันที่ (แต่ละวันที่มีสอน) */}
                        {teachingDates.length === 0 ? (
                          <td className="py-1 px-2 border border-slate-600 text-slate-400">-</td>
                        ) : (
                          teachingDates.map((dateStr) => {
                            const dateMap = attendanceMatrix.get(dateStr);
                            const status = dateMap?.get(std.id) || dateMap?.get(std.name);

                            return (
                              <td
                                key={dateStr}
                                onClick={() => {
                                  setActiveCellEdit({
                                    dateStr,
                                    studentId: std.id,
                                    studentName: std.name,
                                    currentStatus: status
                                  });
                                }}
                                className="py-1 px-0.5 border border-slate-600 text-center font-bold cursor-pointer hover:bg-teal-100/50 print:cursor-default print:hover:bg-transparent transition-colors select-none print:py-0.5 print:px-0 print:text-[9px]"
                                title={`คลิกเพื่อเช็คชื่อ: ${std.name} (${formatToThaiBE(dateStr)})`}
                              >
                                {renderStatusSymbol(status)}
                              </td>
                            );
                          })
                        )}

                        {/* Student Individual Summary Totals */}
                        <td className="py-1 px-1 border border-slate-600 text-center font-bold text-emerald-800 bg-emerald-50/30 print:bg-transparent print:py-0.5 print:px-0.5 print:text-[8.5px]">
                          {stats?.present || 0}
                        </td>
                        <td className="py-1 px-1 border border-slate-600 text-center font-bold text-red-700 bg-red-50/30 print:bg-transparent print:py-0.5 print:px-0.5 print:text-[8.5px]">
                          {stats?.absent || 0}
                        </td>
                        <td className="py-1 px-1 border border-slate-600 text-center font-bold text-amber-700 bg-amber-50/30 print:bg-transparent print:py-0.5 print:px-0.5 print:text-[8.5px]">
                          {stats?.late || 0}
                        </td>
                        <td className="py-1 px-1 border border-slate-600 text-center font-bold text-sky-700 bg-sky-50/30 print:bg-transparent print:py-0.5 print:px-0.5 print:text-[8.5px]">
                          {stats?.sick || 0}
                        </td>
                        <td className="py-1 px-1 border border-slate-600 text-center font-bold text-orange-700 bg-orange-50/30 print:bg-transparent print:py-0.5 print:px-0.5 print:text-[8.5px]">
                          {stats?.leave || 0}
                        </td>
                        <td className="py-1 px-1 border border-slate-600 text-center font-bold text-slate-900 print:py-0.5 print:px-0.5 print:text-[8.5px]">
                          {stats?.rate}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Footer: Daily Summary Counts */}
              {classStudents.length > 0 && teachingDates.length > 0 && (
                <tfoot>
                  {/* รวมมาเรียน */}
                  <tr className="bg-emerald-50/70 font-bold text-[11px] print:text-[8.5px] text-emerald-900 border-t-2 border-slate-600">
                    <td colSpan={2} className="py-1 px-2 border border-slate-600 text-right print:py-0.5 print:px-1">
                      รวมมาเรียน (คน):
                    </td>
                    {teachingDates.map((dateStr) => (
                      <td key={dateStr} className="py-1 px-0.5 border border-slate-600 text-center font-bold print:py-0.5 print:px-0">
                        {dateTotals[dateStr]?.present || 0}
                      </td>
                    ))}
                    <td colSpan={6} className="py-1 px-2 border border-slate-600 text-center print:py-0.5 print:px-0.5">
                      {studentStats.reduce((sum, s) => sum + s.present, 0)} ครั้ง
                    </td>
                  </tr>

                  {/* รวมขาดเรียน */}
                  <tr className="bg-red-50/70 font-bold text-[11px] print:text-[8.5px] text-red-900">
                    <td colSpan={2} className="py-1 px-2 border border-slate-600 text-right print:py-0.5 print:px-1">
                      รวมขาดเรียน (คน):
                    </td>
                    {teachingDates.map((dateStr) => (
                      <td key={dateStr} className="py-1 px-0.5 border border-slate-600 text-center font-bold print:py-0.5 print:px-0">
                        {dateTotals[dateStr]?.absent || 0}
                      </td>
                    ))}
                    <td colSpan={6} className="py-1 px-2 border border-slate-600 text-center print:py-0.5 print:px-0.5">
                      {studentStats.reduce((sum, s) => sum + s.absent, 0)} ครั้ง
                    </td>
                  </tr>

                  {/* รวมสาย, ป่วย, กิจ */}
                  <tr className="bg-slate-100 font-bold text-[11px] print:text-[8.5px] text-slate-800">
                    <td colSpan={2} className="py-1 px-2 border border-slate-600 text-right print:py-0.5 print:px-1">
                      รวมสาย/ป่วย/กิจ (คน):
                    </td>
                    {teachingDates.map((dateStr) => {
                      const dt = dateTotals[dateStr];
                      const otherCount = (dt?.late || 0) + (dt?.sick || 0) + (dt?.leave || 0);
                      return (
                        <td key={dateStr} className="py-1 px-0.5 border border-slate-600 text-center font-bold print:py-0.5 print:px-0">
                          {otherCount}
                        </td>
                      );
                    })}
                    <td colSpan={6} className="py-1 px-2 border border-slate-600 text-center print:py-0.5 print:px-0.5">
                      {studentStats.reduce((sum, s) => sum + s.late + s.sick + s.leave, 0)} ครั้ง
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Official Signature Block */}
          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs text-slate-800 print:pt-6 print:gap-4 print:break-inside-avoid">
            <div className="space-y-6">
              <p className="leading-relaxed">
                ลงชื่อ..................................................................ครูผู้สอน
              </p>
              <p className="font-semibold">({effectiveTeacherFullName})</p>
              <p className="text-[11px] text-slate-500">
                วันที่.........เดือน..................................พ.ศ. {activeYear?.name || '2569'}
              </p>
            </div>

            <div className="space-y-6">
              <p className="leading-relaxed">
                ลงชื่อ..................................................................ผู้อำนวยการสถานศึกษา
              </p>
              <p className="font-semibold">({effectiveDirectorName})</p>
              <p className="text-[11px] text-slate-600 font-medium">
                ผู้อำนวยการสถานศึกษา
              </p>
              <p className="text-[11px] text-slate-500">
                วันที่.........เดือน..................................พ.ศ. {activeYear?.name || '2569'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: นักเรียนรายบุคคล (INDIVIDUAL STUDENT SLIP / BATCH ALL) */}
      {reportMode === 'individual' && (
        <div className="space-y-6">
          {classStudents.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center text-slate-400 border border-slate-200">
              ยังไม่มีรายชื่อนักเรียนในห้อง {currentClass?.name || ''}
            </div>
          ) : individualScope === 'all' ? (
            /* Batch print all students in class, 1 page per student */
            <div className="space-y-6 print:space-y-0">
              {classStudents.map((std, idx) => renderIndividualSlip(std, idx))}
            </div>
          ) : (
            /* Single selected student */
            currentStudent &&
            renderIndividualSlip(
              currentStudent,
              classStudents.findIndex((s) => s.id === currentStudent.id)
            )
          )}
        </div>
      )}

      {/* Interactive Quick Status Selector Modal (When teacher clicks a date cell on screen) */}
      {activeCellEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  เช็คชื่อ: {activeCellEdit.studentName}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  วันที่ {formatToThaiBE(activeCellEdit.dateStr)}
                </p>
              </div>
              <button
                onClick={() => setActiveCellEdit(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              {/* มาเรียน */}
              <button
                type="button"
                onClick={() => {
                  const std = classStudents.find((s) => s.id === activeCellEdit.studentId);
                  if (std) handleSetStudentStatus(activeCellEdit.dateStr, std, 'present');
                }}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-between cursor-pointer transition-all ${
                  activeCellEdit.currentStatus === 'present'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-extrabold text-base">✓</span>
                  <span>มาเรียน</span>
                </span>
                <span className="text-[10px] font-normal">ปกติ</span>
              </button>

              {/* ขาด */}
              <button
                type="button"
                onClick={() => {
                  const std = classStudents.find((s) => s.id === activeCellEdit.studentId);
                  if (std) handleSetStudentStatus(activeCellEdit.dateStr, std, 'absent');
                }}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-between cursor-pointer transition-all ${
                  activeCellEdit.currentStatus === 'absent'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-red-50 text-red-800 hover:bg-red-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-extrabold text-sm">ข</span>
                  <span>ขาดเรียน</span>
                </span>
                <span className="text-[10px] font-normal">ไม่มา</span>
              </button>

              {/* สาย */}
              <button
                type="button"
                onClick={() => {
                  const std = classStudents.find((s) => s.id === activeCellEdit.studentId);
                  if (std) handleSetStudentStatus(activeCellEdit.dateStr, std, 'late');
                }}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-between cursor-pointer transition-all ${
                  activeCellEdit.currentStatus === 'late'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-extrabold text-sm">ส</span>
                  <span>มาสาย</span>
                </span>
                <span className="text-[10px] font-normal">สาย</span>
              </button>

              {/* ป่วย */}
              <button
                type="button"
                onClick={() => {
                  const std = classStudents.find((s) => s.id === activeCellEdit.studentId);
                  if (std) handleSetStudentStatus(activeCellEdit.dateStr, std, 'sick');
                }}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-between cursor-pointer transition-all ${
                  activeCellEdit.currentStatus === 'sick'
                    ? 'bg-sky-500 text-white shadow-md'
                    : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-extrabold text-sm">ป</span>
                  <span>ลาป่วย</span>
                </span>
                <span className="text-[10px] font-normal">มีใบลาป่วย</span>
              </button>

              {/* กิจ */}
              <button
                type="button"
                onClick={() => {
                  const std = classStudents.find((s) => s.id === activeCellEdit.studentId);
                  if (std) handleSetStudentStatus(activeCellEdit.dateStr, std, 'leave');
                }}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-between cursor-pointer transition-all ${
                  activeCellEdit.currentStatus === 'leave'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="font-extrabold text-sm">ก</span>
                  <span>ลากิจ</span>
                </span>
                <span className="text-[10px] font-normal">มีธุระจำเป็น</span>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveCellEdit(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
