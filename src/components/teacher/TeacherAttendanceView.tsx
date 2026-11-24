import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  UserCheck,
  Eye,
  Edit2,
  Trash2,
  Lock,
  Sparkles,
  Info,
  X,
  Users
} from 'lucide-react';
import {
  TeachingAssignment,
  Period,
  Classroom,
  Subject,
  Student,
  DayOfWeek,
  AttendanceLog,
  AttendanceStatus,
  StudentAttendanceItem,
  AcademicYear,
  AppUser
} from '../../types';
import {
  DAY_ORDER,
  formatToThaiBE,
  formatThaiFullDate,
  getDayOfWeekFromDate,
  getTodayISODate
} from '../../utils/thaiDate';

interface TeacherAttendanceViewProps {
  teacherUsername: string;
  teacherFullName: string;
  assignments: TeachingAssignment[];
  teachers: AppUser[];
  periods: Period[];
  classes: Classroom[];
  subjects: Subject[];
  students: Student[];
  attendanceLogs: AttendanceLog[];
  activeYear?: AcademicYear;
  pendingAssignment?: TeachingAssignment | null;
  onClearPendingAssignment?: () => void;
  onSaveAttendance: (log: Omit<AttendanceLog, 'id'>) => Promise<void>;
  onUpdateAttendance: (id: string, log: Partial<AttendanceLog>) => Promise<void>;
  onDeleteAttendance: (id: string) => Promise<void>;
  onUpdateAssignment: (id: string, updated: Partial<TeachingAssignment>) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
}

export const TeacherAttendanceView: React.FC<TeacherAttendanceViewProps> = ({
  teacherUsername,
  teacherFullName,
  assignments,
  teachers,
  periods,
  classes,
  subjects,
  students,
  attendanceLogs,
  activeYear,
  pendingAssignment,
  onClearPendingAssignment,
  onSaveAttendance,
  onUpdateAttendance,
  onDeleteAttendance,
  onUpdateAssignment,
  openConfirm,
  showToast
}) => {
  // Date Picker state (defaults to today's ISO date e.g. 2026-10-14)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISODate());

  // Determine active day of week from selected date
  const selectedDayOfWeek = getDayOfWeekFromDate(selectedDate);

  // Helper to check if an assignment is active for teacher on selectedDate
  const isAssignmentActiveForTeacher = (a: TeachingAssignment, username: string, dateStr: string) => {
    const isOriginal = a.teacherUsername === username;
    const isSubstitute = a.substituteTeacherUsername === username;
    const subDate = a.substituteDate;

    if (a.substituteTeacherUsername) {
      if (subDate) {
        if (dateStr === subDate) {
          return isSubstitute;
        } else {
          return isOriginal;
        }
      } else {
        return isSubstitute;
      }
    }

    return isOriginal;
  };

  // Teacher's timetable assignments (including substitutions)
  const myAssignments = assignments.filter((a) => isAssignmentActiveForTeacher(a, teacherUsername, selectedDate));

  // Sorting periods
  const sortedPeriods = useMemo(() => [...periods].sort((a, b) => a.order - b.order), [periods]);

  // Checkbox at table header: Substitution mode toggle
  const [isSubstitutionMode, setIsSubstitutionMode] = useState(false);

  // Advance Substitution Modal States
  const [selectedSubAssignment, setSelectedSubAssignment] = useState<TeachingAssignment | null>(null);
  const [isSubEnabled, setIsSubEnabled] = useState(false);
  const [subTeacherUsername, setSubTeacherUsername] = useState('');
  const [subDate, setSubDate] = useState(getTodayISODate());
  const [isSubSaving, setIsSubSaving] = useState(false);

  const openSubModal = (a: TeachingAssignment) => {
    setSelectedSubAssignment(a);
    setIsSubEnabled(!!a.substituteTeacherUsername);
    setSubTeacherUsername(a.substituteTeacherUsername || '');
    setSubDate(a.substituteDate || selectedDate || getTodayISODate());
  };

  // Filter assignments displayed in timetable
  const displayAssignments = useMemo(() => {
    if (isSubstitutionMode) {
      return assignments.filter((a) => a.teacherUsername === teacherUsername || a.substituteTeacherUsername === teacherUsername);
    }
    return assignments.filter((a) => isAssignmentActiveForTeacher(a, teacherUsername, selectedDate));
  }, [assignments, isSubstitutionMode, teacherUsername, selectedDate]);

  // Calculate available substitute teachers for selectedSubAssignment (only teachers with free periods, excluding self)
  const availableSubstituteTeachers = useMemo(() => {
    if (!selectedSubAssignment) return [];
    const targetAssignment = selectedSubAssignment;

    const teachingPeriods = sortedPeriods.filter((p) => !p.isLunchBreak);
    const startIdx = teachingPeriods.findIndex((p) => p.id === targetAssignment.periodId);
    const endIdx = targetAssignment.endPeriodId
      ? teachingPeriods.findIndex((p) => p.id === targetAssignment.endPeriodId)
      : startIdx;
    const targetStart = startIdx !== -1 ? startIdx : 0;
    const targetEnd = endIdx !== -1 && endIdx >= targetStart ? endIdx : targetStart;
    const targetPeriodIds = teachingPeriods.slice(targetStart, targetEnd + 1).map((p) => p.id);

    return teachers.filter((t) => {
      // Exclude primary teacher (ไม่แสดงชื่อตนเอง)
      if (t.username === teacherUsername) return false;

      // Check conflict
      const hasConflict = assignments.some((a) => {
        if (a.id === targetAssignment.id) return false;
        if (a.dayOfWeek !== targetAssignment.dayOfWeek) return false;

        const isTeacher = a.teacherUsername === t.username || a.substituteTeacherUsername === t.username;
        if (!isTeacher) return false;

        const aStartIdx = teachingPeriods.findIndex((p) => p.id === a.periodId);
        const aEndIdx = a.endPeriodId
          ? teachingPeriods.findIndex((p) => p.id === a.endPeriodId)
          : aStartIdx;
        const realAStart = aStartIdx !== -1 ? aStartIdx : 0;
        const realAEnd = aEndIdx !== -1 && aEndIdx >= realAStart ? aEndIdx : realAStart;
        const aPeriodIds = teachingPeriods.slice(realAStart, realAEnd + 1).map((p) => p.id);

        return targetPeriodIds.some((pId) => aPeriodIds.includes(pId));
      });

      return !hasConflict;
    });
  }, [teachers, teacherUsername, selectedSubAssignment, sortedPeriods, assignments]);

  // Attendance checking modal states
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<TeachingAssignment | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [studentRecords, setStudentRecords] = useState<StudentAttendanceItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // View Attendance Detail Modal
  const [viewingLog, setViewingLog] = useState<AttendanceLog | null>(null);

  // Teacher logs (including substitutions)
  const teacherLogs = attendanceLogs.filter(
    (l) => l.teacherUsername === teacherUsername || l.substituteTeacherUsername === teacherUsername
  );

  // Auto-open modal when navigating from Dashboard with pendingAssignment
  useEffect(() => {
    if (pendingAssignment) {
      const today = getTodayISODate();
      setSelectedDate(today);
      setActiveAssignment(pendingAssignment);

      const existingLog = teacherLogs.find(
        (l) =>
          l.date === today &&
          l.subjectId === pendingAssignment.subjectId &&
          l.classId === pendingAssignment.classId &&
          l.periodId === pendingAssignment.periodId
      );

      if (existingLog) {
        setEditingLogId(existingLog.id);
        setStudentRecords(existingLog.records);
      } else {
        setEditingLogId(null);
        const classStudents = students
          .filter((s) => s.classId === pendingAssignment.classId || s.className === pendingAssignment.className)
          .sort((a, b) => a.seq - b.seq);

        const initialRecords: StudentAttendanceItem[] = classStudents.map((s, idx) => ({
          studentId: s.id,
          seq: s.seq || idx + 1,
          studentName: s.name,
          status: 'present' as AttendanceStatus,
        }));

        setStudentRecords(initialRecords);
      }

      setIsCheckModalOpen(true);
      onClearPendingAssignment?.();
    }
  }, [pendingAssignment]);

  // Open attendance modal for a timetable slot
  const handleSlotClick = (assignment: TeachingAssignment, slotDay: DayOfWeek) => {
    // ENFORCE: "แล้วให้ระบบเลือกวันเช็คชื่อที่ตรงกับวันที่เลือกได้เท่านั้น ถ้าเป็นวันอื่นไม่สามารถเช็คชื่อได้"
    if (slotDay !== selectedDayOfWeek) {
      showToast(
        'warning',
        `วันที่ท่านเลือก (${formatToThaiBE(selectedDate)}) ตรงกับวัน${selectedDayOfWeek || '-'} ไม่สามารถเช็คชื่อตารางสอนของวัน${slotDay}ได้`
      );
      return;
    }

    setActiveAssignment(assignment);

    // Check if an existing log exists for this date, subject, and class
    const existingLog = teacherLogs.find(
      (l) =>
        l.date === selectedDate &&
        l.subjectId === assignment.subjectId &&
        l.classId === assignment.classId &&
        l.periodId === assignment.periodId
    );

    if (existingLog) {
      setEditingLogId(existingLog.id);
      setStudentRecords(existingLog.records);
    } else {
      setEditingLogId(null);
      // Fetch students for this class
      const classStudents = students
        .filter((s) => s.classId === assignment.classId || s.className === assignment.className)
        .sort((a, b) => a.seq - b.seq);

      const initialRecords: StudentAttendanceItem[] = classStudents.map((s, idx) => ({
        studentId: s.id,
        seq: s.seq || idx + 1,
        studentName: s.name,
        status: 'present' as AttendanceStatus,
      }));

      setStudentRecords(initialRecords);
    }

    setIsCheckModalOpen(true);
  };

  // Change individual student status
  const handleStatusChange = (index: number, newStatus: AttendanceStatus) => {
    setStudentRecords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: newStatus };
      return updated;
    });
  };

  // Function to mark all present: "มีฟังก์ชั่นเช็คมาเรียนทั้งหมด"
  const handleMarkAllPresent = () => {
    setStudentRecords((prev) =>
      prev.map((item) => ({ ...item, status: 'present' }))
    );
    showToast('success', 'เช็คมาเรียนให้กับนักเรียนทุกคนเรียบร้อย');
  };

  // Calculate live summary numbers
  const liveSummary = studentRecords.reduce(
    (acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0 }
  );

  // Save attendance
  const handleSaveAttendance = async () => {
    if (!activeAssignment) return;

    setIsSaving(true);
    try {
      const summaryPayload = {
        present: liveSummary.present,
        absent: liveSummary.absent,
        late: liveSummary.late,
        sick: liveSummary.sick,
        leave: liveSummary.leave,
        total: liveSummary.total,
      };

      if (editingLogId) {
        await onUpdateAttendance(editingLogId, {
          records: studentRecords,
          summary: summaryPayload,
          updatedAt: new Date().toISOString()
        });
        showToast('success', 'อัพเดทข้อมูลการเช็คชื่อเรียบร้อยแล้ว');
      } else {
        await onSaveAttendance({
          academicYearId: activeYear?.id || 'year_2569',
          subjectId: activeAssignment.subjectId,
          subjectCode: activeAssignment.subjectCode,
          subjectName: activeAssignment.subjectName,
          classId: activeAssignment.classId,
          className: activeAssignment.className,
          date: selectedDate,
          thaiDateStr: formatToThaiBE(selectedDate),
          dayOfWeek: selectedDayOfWeek || activeAssignment.dayOfWeek,
          periodId: activeAssignment.periodId,
          periodName: activeAssignment.periodName,
          teacherUsername,
          teacherName: teacherFullName,
          substituteTeacherUsername: activeAssignment.substituteTeacherUsername,
          records: studentRecords,
          summary: summaryPayload,
          updatedAt: new Date().toISOString(),
        });
        showToast('success', 'บันทึกการเช็คชื่อนักเรียนสำเร็จแล้ว');
      }
      setIsCheckModalOpen(false);
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete attendance log
  const handleDeleteLog = (log: AttendanceLog) => {
    openConfirm(
      'ยืนยันการลบประวัติการเช็คชื่อ',
      `คุณต้องการลบข้อมูลเช็คชื่อวิชา ${log.subjectName} ประจำวันที่ ${log.thaiDateStr} ใช่หรือไม่?`,
      () => onDeleteAttendance(log.id),
      'danger'
    );
  };

  // Open edit modal directly from logs table
  const handleEditFromLog = (log: AttendanceLog) => {
    const matchedAssignment = myAssignments.find(
      (a) => a.subjectId === log.subjectId && a.classId === log.classId && a.periodId === log.periodId
    ) || {
      id: 'temp',
      teacherUsername: log.teacherUsername,
      teacherName: log.teacherName || teacherFullName,
      substituteTeacherUsername: log.substituteTeacherUsername,
      classId: log.classId,
      className: log.className,
      subjectId: log.subjectId,
      subjectCode: log.subjectCode,
      subjectName: log.subjectName,
      periodId: log.periodId,
      periodName: log.periodName,
      dayOfWeek: log.dayOfWeek,
      color: '#0C7C82'
    };

    setActiveAssignment(matchedAssignment);
    setEditingLogId(log.id);
    setStudentRecords(log.records);
    setIsCheckModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Date Picker Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full uppercase tracking-wider inline-block mb-1">
            เลือกวันที่เช็คชื่อ (พ.ศ. ภาษาไทย)
          </span>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#0C7C82]" />
            <span>ตารางสอนและการเช็คชื่อนักเรียน</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {formatThaiFullDate(selectedDate)} (ตรงกับวัน{selectedDayOfWeek || '-'})
          </p>
        </div>

        {/* Date Picker Control in Buddhist Era Thai format */}
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <Calendar className="w-5 h-5 text-[#0C7C82] ml-2 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">
              วันที่ในระบบ (พ.ศ.)
            </span>
            <span className="text-xs font-bold text-slate-800">
              {formatToThaiBE(selectedDate)}
            </span>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white cursor-pointer focus:ring-2 focus:ring-[#0C7C82]"
          />
        </div>
      </div>

      {/* Timetable Notice */}
      {isSubstitutionMode ? (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center gap-2.5 shadow-2xs">
          <Users className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>โหมดจัดสอนแทนล่วงหน้าเปิดอยู่:</strong> คลิกที่คาบสอนในตารางด้านล่างเพื่อเลือกครูผู้สอนแทนและกำหนดวันที่ต้องการให้สอนแทน หรือคลิกเพื่อแก้ไข/ยกเลิก
          </span>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-900 text-xs flex items-center gap-2.5">
          <Info className="w-4 h-4 text-teal-700 shrink-0" />
          <span>
            <strong>เงื่อนไขความถูกต้อง:</strong> วันที่ที่เลือกคือ <strong>{formatToThaiBE(selectedDate)} (วัน{selectedDayOfWeek || '-'})</strong> ระบบจะอนุญาตให้คลิกเช็คชื่อได้เฉพาะคาบสอนของ <strong>วัน{selectedDayOfWeek || '-'}</strong> เท่านั้น คาบของวันอื่นจะถูกล็อคไว้
          </span>
        </div>
      )}

      {/* Monday - Friday Timetable (ตารางสอน วันจันทร์-วันศุกร์) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#0C7C82]" />
            <h3 className="font-bold text-slate-800 text-base">
              ตารางสอนประจำสัปดาห์ (วันจันทร์ - วันศุกร์)
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Table Header Checkbox for Advance Substitution */}
            <label className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-50 border border-teal-200 cursor-pointer hover:bg-teal-100 transition-colors shadow-2xs">
              <input
                type="checkbox"
                checked={isSubstitutionMode}
                onChange={(e) => setIsSubstitutionMode(e.target.checked)}
                className="w-4 h-4 rounded text-[#0C7C82] focus:ring-[#0C7C82] border-slate-300 cursor-pointer"
              />
              <span className="text-xs font-bold text-[#0C7C82] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>เปิดโหมดจัดสอนแทนล่วงหน้า</span>
              </span>
            </label>

            <span className="text-xs text-slate-400 hidden sm:inline">
              {isSubstitutionMode ? 'คลิกที่คาบสอนเพื่อระบุครูสอนแทน' : 'คลิกที่คาบสอนเพื่อทำการเช็คชื่อ'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                <th className="py-4 px-4 w-32 border-r border-slate-200 bg-slate-100/70 text-slate-700 font-extrabold">
                  วัน / คาบ
                </th>
                {sortedPeriods.map((p) => (
                  <th
                    key={p.id}
                    className={`py-3 px-3 border-r border-slate-200 min-w-[130px] ${
                      p.isLunchBreak ? 'bg-amber-50/60 text-amber-900' : ''
                    }`}
                  >
                    <div className="font-bold">{p.isLunchBreak ? 'พักกลางวัน' : p.name}</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">
                      {p.startTime} - {p.endTime}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {DAY_ORDER.map((day) => {
                const isSelectedDay = day === selectedDayOfWeek;

                return (
                  <tr
                    key={day}
                    className={`transition-colors ${
                      isSelectedDay ? 'bg-teal-50/30' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Left: Monday - Friday */}
                    <td
                      className={`py-5 px-4 font-bold border-r border-slate-200 text-center ${
                        isSelectedDay
                          ? 'bg-[#0C7C82] text-white shadow-xs'
                          : 'bg-slate-50/70 text-slate-700'
                      }`}
                    >
                      <div className="text-sm">วัน{day}</div>
                      {isSelectedDay ? (
                        <span className="inline-block px-2 py-0.5 mt-1 rounded-full text-[10px] bg-white text-[#0C7C82] font-extrabold shadow-2xs">
                          วันปัจจุบัน
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                          ล็อค
                        </span>
                      )}
                    </td>

                    {/* Columns: Periods */}
                    {sortedPeriods.map((period) => {
                      if (period.isLunchBreak) {
                        return (
                          <td
                            key={period.id}
                            className="p-2 border-r border-slate-200 bg-amber-50/30 text-amber-800 text-[11px] font-medium"
                          >
                            <span className="inline-block py-2 px-1 text-slate-400">
                              พักกลางวัน
                            </span>
                          </td>
                        );
                      }

                      // Find assignment for this day and period (supports multi-period assignment)
                      const assignment = displayAssignments.find((a) => {
                        if (a.dayOfWeek !== day) return false;
                        if (a.periodId === period.id) return true;
                        if (a.endPeriodId && a.endPeriodId !== a.periodId) {
                          const startIdx = periods.findIndex((p) => p.id === a.periodId);
                          const endIdx = periods.findIndex((p) => p.id === a.endPeriodId);
                          const currIdx = periods.findIndex((p) => p.id === period.id);
                          if (startIdx !== -1 && endIdx !== -1 && currIdx >= startIdx && currIdx <= endIdx) {
                            return true;
                          }
                        }
                        return false;
                      });

                      if (!assignment) {
                        return (
                          <td
                            key={period.id}
                            className="p-2 border-r border-slate-200 text-slate-300 text-center"
                          >
                            -
                          </td>
                        );
                      }

                      // Check if already checked on selectedDate
                      const isAlreadyChecked = teacherLogs.some(
                        (l) =>
                          l.date === selectedDate &&
                          l.subjectId === assignment.subjectId &&
                          l.classId === assignment.classId &&
                          (l.periodId === assignment.periodId || l.periodId === period.id)
                      );

                      return (
                        <td key={period.id} className="p-2 border-r border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              if (isSubstitutionMode) {
                                openSubModal(assignment);
                              } else {
                                handleSlotClick(assignment, day);
                              }
                            }}
                            className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                              isSubstitutionMode
                                ? 'hover:scale-102 hover:shadow-md border-amber-300 bg-amber-50/40 ring-1 ring-amber-200'
                                : isSelectedDay
                                ? 'hover:scale-102 hover:shadow-md border-teal-300 bg-white ring-1 ring-teal-200'
                                : 'opacity-60 bg-slate-50 border-slate-200 hover:opacity-80'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span
                                className="px-2 py-0.5 rounded-md text-[10px] text-white font-bold shadow-2xs"
                                style={{ backgroundColor: assignment.color || '#0C7C82' }}
                              >
                                {assignment.className}
                              </span>

                              {isSubstitutionMode ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200">
                                  <Edit2 className="w-3 h-3" />
                                  <span>สอนแทน</span>
                                </span>
                              ) : isSelectedDay ? (
                                isAlreadyChecked ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>เช็คแล้ว</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-teal-600 font-bold bg-teal-50 px-1.5 py-0.5 rounded-full animate-pulse">
                                    <span>พร้อมเช็ค</span>
                                  </span>
                                )
                              ) : (
                                <Lock className="w-3 h-3 text-slate-400" />
                              )}
                            </div>

                            <div>
                              <div className="font-extrabold text-[#0C7C82] text-[11px] truncate">
                                {assignment.subjectCode}
                              </div>
                              <div className="text-[10px] font-semibold text-slate-800 truncate">
                                {assignment.subjectName}
                              </div>
                              {assignment.substituteTeacherUsername && (
                                <div className="mt-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                                  สอนแทนโดย: {teachers.find((t) => t.username === assignment.substituteTeacherUsername)?.fullName || assignment.substituteTeacherUsername}
                                </div>
                              )}
                            </div>

                            <div className="text-[10px] font-mono text-slate-500 font-medium mt-2 pt-1 border-t border-slate-100">
                              {period.startTime} - {period.endTime}
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saved Attendance Logs Section as required:
          "แสดงตารางเป็นรายการตามที่บันทึก เป็นรายวิชา ,
          ประกอบด้วย นักเรียน ,วันที่, มาเรียน,ขาด,สาย,ป่วย,กิจ (แสดงเป็นตัวเลขสรุปประจำวัน),(ดู,แก้ไข,ลบ)" */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base">
              ประวัติการบันทึกการเช็คชื่อของครู
            </h3>
            <p className="text-xs text-slate-500">
              สรุปยอด มาเรียน, ขาด, สาย, ป่วย, กิจ ประจำวันในแต่ละรายวิชา
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-teal-50 text-[#0C7C82] font-bold">
            ทั้งหมด {teacherLogs.length} รายการ
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 px-6">วันที่</th>
                <th className="py-4 px-6">รายวิชา & ชั้นเรียน</th>
                <th className="py-4 px-6">คาบสอน</th>
                <th className="py-4 px-4 text-center text-emerald-700 bg-emerald-50/40">มาเรียน</th>
                <th className="py-4 px-4 text-center text-red-700 bg-red-50/40">ขาด</th>
                <th className="py-4 px-4 text-center text-amber-700 bg-amber-50/40">สาย</th>
                <th className="py-4 px-4 text-center text-sky-700 bg-sky-50/40">ป่วย</th>
                <th className="py-4 px-4 text-center text-orange-700 bg-orange-50/40">กิจ</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {teacherLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    ยังไม่มีรายการบันทึกการเช็คชื่อ คลิกคาบสอนในตารางด้านบนเพื่อเริ่มเช็คชื่อ
                  </td>
                </tr>
              ) : (
                teacherLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-800 text-xs">
                      {log.thaiDateStr || formatToThaiBE(log.date)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <span className="font-mono text-[#0C7C82]">{log.subjectCode}</span>
                        <span>{log.subjectName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        ห้อง {log.className}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-600 font-mono">
                      {log.periodName}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-emerald-600 bg-emerald-50/20">
                      {log.summary?.present || 0}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-red-600 bg-red-50/20">
                      {log.summary?.absent || 0}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-amber-600 bg-amber-50/20">
                      {log.summary?.late || 0}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-sky-600 bg-sky-50/20">
                      {log.summary?.sick || 0}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-orange-600 bg-orange-50/20">
                      {log.summary?.leave || 0}
                    </td>
                    <td className="py-4 px-6 text-right space-x-1">
                      {/* View Action (ดู) */}
                      <button
                        onClick={() => setViewingLog(log)}
                        className="p-2 rounded-xl text-slate-600 hover:text-[#0C7C82] hover:bg-teal-50 transition-colors cursor-pointer"
                        title="ดูรายละเอียด"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {/* Edit Action (แก้ไข) */}
                      <button
                        onClick={() => handleEditFromLog(log)}
                        className="p-2 rounded-xl text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                        title="แก้ไขการเช็คชื่อ"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {/* Delete Action (ลบ) */}
                      <button
                        onClick={() => handleDeleteLog(log)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Check Modal (เช็คชื่อนักเรียน) */}
      {isCheckModalOpen && activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
              <div>
                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full uppercase">
                  {editingLogId ? 'แก้ไขการเช็คชื่อ' : 'บันทึกการเช็คชื่อประจำวัน'}
                </span>
                <h3 className="text-lg font-bold text-slate-800 mt-1">
                  วิชา {activeAssignment.subjectCode} {activeAssignment.subjectName} ({activeAssignment.className})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  วันที่: <strong>{formatToThaiBE(selectedDate)} (วัน{selectedDayOfWeek || '-'})</strong> • {activeAssignment.periodName}
                </p>
              </div>
              <button
                onClick={() => setIsCheckModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Counters & Mark All Present action button */}
            <div className="p-4 bg-teal-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Button: มีฟังก์ชั่นเช็คมาเรียนทั้งหมด as requested */}
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>เช็คมาเรียนทั้งหมด</span>
                </button>
              </div>

              {/* Status Counters */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">
                  มา: {liveSummary.present}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800">
                  ขาด: {liveSummary.absent}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">
                  สาย: {liveSummary.late}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800">
                  ป่วย: {liveSummary.sick}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800">
                  กิจ: {liveSummary.leave}
                </span>
                <span className="text-slate-500 font-normal">
                  (รวม {liveSummary.total} คน)
                </span>
              </div>
            </div>

            {/* Student List with Status Selection Buttons */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
              {studentRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  ยังไม่มีรายชื่อนักเรียนในห้อง {activeAssignment.className}
                </div>
              ) : (
                studentRecords.map((item, index) => (
                  <div
                    key={item.studentId || index}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50/70 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                        {item.seq || index + 1}
                      </span>
                      <span className="font-semibold text-slate-800 text-sm">
                        {item.studentName}
                      </span>
                    </div>

                    {/* Status Options: มาเรียน, ขาด, สาย, ป่วย, กิจ */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      {/* มาเรียน */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(index, 'present')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.status === 'present'
                            ? 'bg-emerald-600 text-white shadow-xs font-bold scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        มาเรียน
                      </button>

                      {/* ขาด */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(index, 'absent')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.status === 'absent'
                            ? 'bg-red-600 text-white shadow-xs font-bold scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'
                        }`}
                      >
                        ขาด
                      </button>

                      {/* สาย */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(index, 'late')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.status === 'late'
                            ? 'bg-amber-500 text-white shadow-xs font-bold scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                      >
                        สาย
                      </button>

                      {/* ป่วย */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(index, 'sick')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.status === 'sick'
                            ? 'bg-sky-500 text-white shadow-xs font-bold scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-700'
                        }`}
                      >
                        ป่วย
                      </button>

                      {/* กิจ */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(index, 'leave')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.status === 'leave'
                            ? 'bg-orange-500 text-white shadow-xs font-bold scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700'
                        }`}
                      >
                        กิจ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsCheckModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAttendance}
                className="px-6 py-2 rounded-xl text-white text-xs font-semibold bg-[#0C7C82] hover:bg-[#096368] shadow-md shadow-[#0C7C82]/20 cursor-pointer flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>บันทึกการเช็คชื่อ</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">รายละเอียดการเช็คชื่อ</h3>
                <p className="text-xs text-slate-500">
                  วิชา {viewingLog.subjectCode} {viewingLog.subjectName} • {viewingLog.className} • วันที่ {viewingLog.thaiDateStr}
                </p>
              </div>
              <button
                onClick={() => setViewingLog(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex justify-around text-xs font-bold text-center">
              <div>
                <div className="text-emerald-600 text-base">{viewingLog.summary.present}</div>
                <div className="text-slate-500 text-[10px]">มาเรียน</div>
              </div>
              <div>
                <div className="text-red-600 text-base">{viewingLog.summary.absent}</div>
                <div className="text-slate-500 text-[10px]">ขาด</div>
              </div>
              <div>
                <div className="text-amber-600 text-base">{viewingLog.summary.late}</div>
                <div className="text-slate-500 text-[10px]">สาย</div>
              </div>
              <div>
                <div className="text-sky-600 text-base">{viewingLog.summary.sick}</div>
                <div className="text-slate-500 text-[10px]">ป่วย</div>
              </div>
              <div>
                <div className="text-orange-600 text-base">{viewingLog.summary.leave}</div>
                <div className="text-slate-500 text-[10px]">กิจ</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {viewingLog.records.map((r, i) => (
                <div
                  key={r.studentId || i}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-white text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-400 w-5">{r.seq || i + 1}.</span>
                    <span className="font-medium text-slate-800">{r.studentName}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      r.status === 'present'
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.status === 'absent'
                        ? 'bg-red-100 text-red-800'
                        : r.status === 'late'
                        ? 'bg-amber-100 text-amber-800'
                        : r.status === 'sick'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {r.status === 'present'
                      ? 'มาเรียน'
                      : r.status === 'absent'
                      ? 'ขาดเรียน'
                      : r.status === 'late'
                      ? 'มาสาย'
                      : r.status === 'sick'
                      ? 'ลาป่วย'
                      : 'ลากิจ'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advance Substitution Modal */}
      {selectedSubAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-[#0C7C82] flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    จัดสอนแทนล่วงหน้า
                  </h3>
                  <p className="text-xs text-slate-500">
                    วิชา {selectedSubAssignment.subjectCode} {selectedSubAssignment.subjectName} ({selectedSubAssignment.className})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSubAssignment(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Course & Teacher Details */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>วันสอนตามตาราง: <strong>วัน{selectedSubAssignment.dayOfWeek}</strong> • {selectedSubAssignment.periodName}</div>
                <div>ครูผู้สอนหลัก: <strong>{selectedSubAssignment.teacherName || teacherFullName}</strong></div>
              </div>

              {/* Checkbox: เปิดการจัดสอนแทนวิชานี้ */}
              <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSubEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsSubEnabled(checked);
                      if (!checked) {
                        setSubTeacherUsername('');
                      } else {
                        if (!subDate) setSubDate(selectedDate || getTodayISODate());
                      }
                    }}
                    className="w-4 h-4 rounded text-[#0C7C82] focus:ring-[#0C7C82] border-slate-300 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      ต้องการจัดสอนแทน (ระบุครูสอนแทน)
                    </span>
                    <span className="text-[11px] text-slate-500 font-normal block">
                      เลือกครูผู้สอนแทนที่มีคาบว่างและกำหนดวันที่สอนแทน
                    </span>
                  </div>
                </label>

                {/* Form inputs when checkbox is enabled */}
                {isSubEnabled && (
                  <div className="pt-3 border-t border-teal-200/80 space-y-3 animate-fade-in">
                    {/* Date picker: วันที่ต้องการให้สอนแทน */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                        วันที่ต้องการให้สอนแทน <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={subDate}
                        onChange={(e) => setSubDate(e.target.value)}
                        required={isSubEnabled}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
                      />
                    </div>

                    {/* Dropdown: เลือกครูผู้สอนแทน (เฉพาะครูที่มีคาบว่าง) */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between gap-1">
                        <span>เลือกครูผู้สอนแทน <span className="text-red-500">*</span></span>
                        <span className="text-[10px] text-teal-800 font-medium bg-teal-100 px-2 py-0.5 rounded-md border border-teal-200">
                          แสดงเฉพาะครูที่มีคาบว่าง
                        </span>
                      </label>
                      <select
                        value={subTeacherUsername}
                        onChange={(e) => setSubTeacherUsername(e.target.value)}
                        required={isSubEnabled}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
                      >
                        <option value="">-- เลือกครูผู้สอนแทน (เฉพาะครูที่มีคาบว่าง) --</option>
                        {availableSubstituteTeachers.length === 0 ? (
                          <option value="" disabled>
                            -- ไม่มีครูผู้สอนท่านอื่นที่มีคาบว่างในช่วงเวลานี้ --
                          </option>
                        ) : (
                          availableSubstituteTeachers.map((t: AppUser) => (
                            <option key={t.id} value={t.username}>
                              {t.fullName} ({t.username}) • มีคาบว่าง
                            </option>
                          ))
                        )}
                      </select>
                      {availableSubstituteTeachers.length === 0 && (
                        <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>ครูท่านอื่นมีตารางสอนติดคาบเรียนในช่วงเวลานี้ทั้งหมด</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                {selectedSubAssignment.substituteTeacherUsername && (
                  <button
                    type="button"
                    disabled={isSubSaving}
                    onClick={async () => {
                      setIsSubSaving(true);
                      try {
                        await onUpdateAssignment(selectedSubAssignment.id, {
                          substituteTeacherUsername: '',
                          substituteDate: ''
                        });
                        showToast('success', 'ยกเลิกการสอนแทน เรียบร้อยแล้ว');
                        setSelectedSubAssignment(null);
                      } catch (err) {
                        showToast('error', 'เกิดข้อผิดพลาดในการยกเลิกการสอนแทน');
                      } finally {
                        setIsSubSaving(false);
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer border border-rose-200 mr-auto"
                  >
                    ยกเลิกการสอนแทน
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedSubAssignment(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
                >
                  ปิด
                </button>

                <button
                  type="button"
                  disabled={isSubSaving}
                  onClick={async () => {
                    if (isSubEnabled) {
                      if (!subTeacherUsername) {
                        showToast('warning', 'กรุณาเลือกครูผู้สอนแทน');
                        return;
                      }
                      if (!subDate) {
                        showToast('warning', 'กรุณาระบุวันที่ต้องการให้สอนแทน');
                        return;
                      }
                    }

                    setIsSubSaving(true);
                    try {
                      await onUpdateAssignment(selectedSubAssignment.id, {
                        substituteTeacherUsername: isSubEnabled ? subTeacherUsername : '',
                        substituteDate: isSubEnabled ? subDate : ''
                      });
                      showToast('success', isSubEnabled ? 'บันทึกการจัดสอนแทนล่วงหน้าเรียบร้อยแล้ว' : 'บันทึกการยกเลิกการสอนแทนเรียบร้อยแล้ว');
                      setSelectedSubAssignment(null);
                    } catch (err) {
                      showToast('error', 'เกิดข้อผิดพลาดในการบันทึกการสอนแทน');
                    } finally {
                      setIsSubSaving(false);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                >
                  {isSubSaving ? 'กำลังบันทึก...' : 'บันทึกการจัดสอนแทน'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
