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
  Sparkles
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
  StudentAttendanceItem
} from '../../types';
import {
  THAI_MONTHS_FULL,
  formatToThaiBE,
  getAcademicYearMonths,
  getDayOfWeekFromDate
} from '../../utils/thaiDate';

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
  onUpdateAttendance?: (id: string, log: Partial<AttendanceLog>) => Promise<void>;
  onSaveAttendance?: (log: Omit<AttendanceLog, 'id'>) => Promise<void>;
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
  onUpdateAttendance,
  onSaveAttendance
}) => {
  // 1. Filter ONLY classrooms that this teacher teaches ("ให้แสดงเฉพาะชั้นเรียนที่สอน")
  const teacherClasses = useMemo(() => {
    const myAssignments = assignments.filter((a) => a.teacherUsername === teacherUsername);
    const classIds = new Set(myAssignments.map((a) => a.classId));
    const classNames = new Set(myAssignments.map((a) => a.className));
    return classes.filter((c) => classIds.has(c.id) || classNames.has(c.name));
  }, [classes, assignments, teacherUsername]);

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

  // 2. Filter ONLY subjects that this teacher teaches for the selected classroom ("และรายวิชาที่สอนเท่านั้น")
  const teacherSubjects = useMemo(() => {
    if (!currentClass) return [];
    const myClassAssignments = assignments.filter(
      (a) =>
        a.teacherUsername === teacherUsername &&
        (a.classId === currentClass.id || a.className === currentClass.name)
    );
    const subIds = new Set(myClassAssignments.map((a) => a.subjectId));
    const subCodes = new Set(myClassAssignments.map((a) => a.subjectCode));
    const subNames = new Set(myClassAssignments.map((a) => a.subjectName));
    return subjects.filter(
      (s) => subIds.has(s.id) || subCodes.has(s.code) || subNames.has(s.name)
    );
  }, [subjects, assignments, teacherUsername, currentClass]);

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

  // 3. Available months in the active academic year only ("เดือนในช่วงที่ตั้งปีการศึกษาเท่านั้น เช่น ตุลาคม 2569")
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

    const myClassAssignments = assignments.filter(
      (a) =>
        a.teacherUsername === teacherUsername &&
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

  // Teaching days of the week for this class and subject from assignments
  const assignedDaysOfWeek = useMemo(() => {
    if (!currentClass || !currentSubject) return new Set<DayOfWeek>();
    const list = assignments
      .filter(
        (a) =>
          a.teacherUsername === teacherUsername &&
          (a.classId === currentClass.id || a.className === currentClass.name) &&
          (a.subjectId === currentSubject.id || a.subjectCode === currentSubject.code)
      )
      .map((a) => a.dayOfWeek);
    return new Set<DayOfWeek>(list);
  }, [assignments, teacherUsername, currentClass, currentSubject]);

  // Logs for this teacher, class, subject, and selected month
  const monthLogs = useMemo(() => {
    if (!currentClass || !currentSubject) return [];
    return attendanceLogs.filter(
      (l) =>
        l.teacherUsername === teacherUsername &&
        (l.classId === currentClass.id || l.className === currentClass.name) &&
        (l.subjectId === currentSubject.id || l.subjectCode === currentSubject.code) &&
        l.date.startsWith(selectedMonth)
    );
  }, [attendanceLogs, teacherUsername, currentClass, currentSubject, selectedMonth]);

  // Teaching periods lookup for assignment slot
  const matchedAssignment = useMemo(() => {
    if (!currentClass || !currentSubject) return undefined;
    return assignments.find(
      (a) =>
        a.teacherUsername === teacherUsername &&
        (a.classId === currentClass.id || a.className === currentClass.name) &&
        (a.subjectId === currentSubject.id || a.subjectCode === currentSubject.code)
    );
  }, [assignments, teacherUsername, currentClass, currentSubject]);

  // Determine all teaching dates in this month:
  // Shows ONLY days that have scheduled teaching or recorded attendance ("แสดงเฉพาะวันที่มีสอน")
  const teachingDates = useMemo(() => {
    const datesSet = new Set<string>();

    // Add any dates where attendance was already recorded
    monthLogs.forEach((l) => datesSet.add(l.date));

    // If assignments specify days of week, calculate all dates in that month that fall on those days
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

    // Find existing log for this date, class, subject
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
        status: std.id === student.id ? newStatus : 'present'
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
        academicYearId: activeYear?.id || 'year_2569',
        subjectId: currentSubject.id,
        subjectCode: currentSubject.code,
        subjectName: currentSubject.name,
        classId: currentClass.id,
        className: currentClass.name,
        date: dateStr,
        thaiDateStr: formatToThaiBE(dateStr),
        dayOfWeek,
        periodId: matchedAssignment?.periodId || 'p1',
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

  // Calculate per-student stats in this month
  const studentStats = useMemo(() => {
    return classStudents.map((std) => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let sick = 0;
      let leave = 0;
      let totalCounted = 0;

      teachingDates.forEach((date) => {
        const dateMap = attendanceMatrix.get(date);
        if (dateMap) {
          const status = dateMap.get(std.id) || dateMap.get(std.name);
          if (status === 'present') {
            present++;
            totalCounted++;
          } else if (status === 'absent') {
            absent++;
            totalCounted++;
          } else if (status === 'late') {
            late++;
            totalCounted++;
          } else if (status === 'sick') {
            sick++;
            totalCounted++;
          } else if (status === 'leave') {
            leave++;
            totalCounted++;
          }
        }
      });

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

  const handlePrint = () => {
    window.print();
  };

  // Helper for cell rendering: มาเรียน=เครื่องหมายถูก (✓), ขาด=ข ,สาย=ส,ป่วย=ป,กิจ=ก
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

  return (
    <div className="space-y-6 font-['Sarabun',sans-serif]">
      {/* Control Header & Filters (Hidden during print / PDF) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5 no-print">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#0C7C82]" />
              <span>รายงานสรุปการเช็คชื่อรายวิชา</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ตารางสรุปการเช็คชื่อรายบุคคลตามวันที่สอนจริงในแต่ละเดือน (เฉพาะชั้นเรียนและรายวิชาที่สอน)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={teacherClasses.length === 0 || teacherSubjects.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-sm disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงาน / บันทึกเป็น PDF (แนวนอน ระยะขอบแคบ)</span>
            </button>
          </div>
        </div>

        {/* Filter Controls: Only classes taught and only subjects taught */}
        {teacherClasses.length === 0 ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>ท่านยังไม่มีชั้นเรียนที่ได้รับมอบหมายการสอนในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อจัดตารางสอน</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
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

        {/* Tip for Interactive Checking and Printing */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#0C7C82]" />
            <span>
              <strong>การเช็คชื่อ:</strong> สามารถคลิกที่ช่องวันที่ของนักเรียนเพื่อเช็คชื่อหรือเปลี่ยนสถานะได้โดยตรง
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            เอกสารพิมพ์ถูกจัดรูปแบบตามมาตรฐาน A4 แนวนอน (Landscape) ระยะขอบแคบ (Narrow)
          </div>
        </div>
      </div>

      {/* Official Report Document Container (Formatted for screen and Landscape A4 PDF print) */}
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
          <table className="w-full text-center border-collapse border border-slate-600 text-xs text-slate-900 print:text-[10px]">
            <thead>
              {/* Top Header Row */}
              <tr className="bg-slate-100 text-slate-900 font-bold">
                <th className="py-1.5 px-1 border border-slate-600 w-10 shrink-0 text-center" rowSpan={2}>
                  ลำดับ
                </th>
                <th className="py-1.5 px-3 border border-slate-600 min-w-[160px] text-left" rowSpan={2}>
                  ชื่อนักเรียน
                </th>

                {/* Date Columns Header (วันที่: 1, 2, 3... แสดงเฉพาะวันที่มีสอน) */}
                {teachingDates.length === 0 ? (
                  <th className="py-2 px-4 border border-slate-600 text-center text-slate-500 font-normal">
                    ไม่มีคาบสอนในเดือน {selectedMonthLabel}
                  </th>
                ) : (
                  <th
                    className="py-1 px-1 border border-slate-600 text-center font-bold"
                    colSpan={teachingDates.length}
                  >
                    วันที่ (เฉพาะวันที่มีสอนในเดือน {selectedMonthLabel})
                  </th>
                )}

                {/* Summary Columns Header */}
                <th className="py-1 px-1 border border-slate-600 text-center font-bold" colSpan={6}>
                  สรุป (วัน)
                </th>
              </tr>

              {/* Second Header Row: Specific Day Numbers (1, 2, 3...) & Summary Subheaders */}
              <tr className="bg-slate-50 text-[11px] print:text-[9px] font-bold">
                {teachingDates.map((dateStr) => {
                  const dayNum = parseInt(dateStr.split('-')[2], 10);
                  const dayOfWeek = getDayOfWeekFromDate(dateStr);
                  const shortDay = dayOfWeek ? dayOfWeek.slice(0, 2) : '';

                  return (
                    <th
                      key={dateStr}
                      className="py-1 px-0.5 border border-slate-600 min-w-[26px] max-w-[32px] text-center"
                      title={formatToThaiBE(dateStr)}
                    >
                      <div className="text-xs print:text-[10px] font-bold leading-tight">{dayNum}</div>
                      <div className="text-[9px] print:text-[8px] text-slate-500 font-normal leading-tight">
                        {shortDay}
                      </div>
                    </th>
                  );
                })}

                {/* Summary Subheaders: มา, ขาด, สาย, ป่วย, กิจ, ร้อยละ */}
                <th className="py-1 px-1 border border-slate-600 w-8 text-emerald-800 text-[10px]">มา</th>
                <th className="py-1 px-1 border border-slate-600 w-8 text-red-700 text-[10px]">ขาด</th>
                <th className="py-1 px-1 border border-slate-600 w-8 text-amber-700 text-[10px]">สาย</th>
                <th className="py-1 px-1 border border-slate-600 w-8 text-sky-700 text-[10px]">ป่วย</th>
                <th className="py-1 px-1 border border-slate-600 w-8 text-orange-700 text-[10px]">กิจ</th>
                <th className="py-1 px-1 border border-slate-600 w-10 text-slate-900 text-[10px]">%</th>
              </tr>
            </thead>

            {/* Table Body: Student Rows */}
            <tbody className="divide-y divide-slate-400 text-xs print:text-[10px]">
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
                      className="hover:bg-teal-50/20 print:hover:bg-transparent transition-colors"
                    >
                      {/* 1. ลำดับ */}
                      <td className="py-1 px-1 border border-slate-600 text-center font-semibold text-slate-700">
                        {std.seq || idx + 1}
                      </td>

                      {/* 2. ชื่อนักเรียน */}
                      <td className="py-1 px-2.5 border border-slate-600 text-left font-medium text-slate-900 whitespace-nowrap">
                        {std.name}
                      </td>

                      {/* 3. วันที่ (แต่ละวันที่มีสอน: 1, 2, 3...) */}
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
                              className="py-1 px-0.5 border border-slate-600 text-center font-bold cursor-pointer hover:bg-teal-100/50 print:cursor-default print:hover:bg-transparent transition-colors select-none"
                              title={`คลิกเพื่อเช็คชื่อ: ${std.name} (${formatToThaiBE(dateStr)})`}
                            >
                              {renderStatusSymbol(status)}
                            </td>
                          );
                        })
                      )}

                      {/* Student Individual Summary Totals */}
                      <td className="py-1 px-1 border border-slate-600 text-center font-bold text-emerald-800 bg-emerald-50/30 print:bg-transparent">
                        {stats?.present || 0}
                      </td>
                      <td className="py-1 px-1 border border-slate-600 text-center font-bold text-red-700 bg-red-50/30 print:bg-transparent">
                        {stats?.absent || 0}
                      </td>
                      <td className="py-1 px-1 border border-slate-600 text-center font-bold text-amber-700 bg-amber-50/30 print:bg-transparent">
                        {stats?.late || 0}
                      </td>
                      <td className="py-1 px-1 border border-slate-600 text-center font-bold text-sky-700 bg-sky-50/30 print:bg-transparent">
                        {stats?.sick || 0}
                      </td>
                      <td className="py-1 px-1 border border-slate-600 text-center font-bold text-orange-700 bg-orange-50/30 print:bg-transparent">
                        {stats?.leave || 0}
                      </td>
                      <td className="py-1 px-1 border border-slate-600 text-center font-bold text-slate-900">
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
                <tr className="bg-emerald-50/70 font-bold text-[11px] print:text-[9px] text-emerald-900 border-t-2 border-slate-600">
                  <td colSpan={2} className="py-1 px-2 border border-slate-600 text-right">
                    รวมมาเรียน (คน):
                  </td>
                  {teachingDates.map((dateStr) => (
                    <td key={dateStr} className="py-1 px-0.5 border border-slate-600 text-center font-bold">
                      {dateTotals[dateStr]?.present || 0}
                    </td>
                  ))}
                  <td colSpan={6} className="py-1 px-2 border border-slate-600 text-center">
                    {studentStats.reduce((sum, s) => sum + s.present, 0)} ครั้ง
                  </td>
                </tr>

                {/* รวมขาดเรียน */}
                <tr className="bg-red-50/70 font-bold text-[11px] print:text-[9px] text-red-900">
                  <td colSpan={2} className="py-1 px-2 border border-slate-600 text-right">
                    รวมขาดเรียน (คน):
                  </td>
                  {teachingDates.map((dateStr) => (
                    <td key={dateStr} className="py-1 px-0.5 border border-slate-600 text-center font-bold">
                      {dateTotals[dateStr]?.absent || 0}
                    </td>
                  ))}
                  <td colSpan={6} className="py-1 px-2 border border-slate-600 text-center">
                    {studentStats.reduce((sum, s) => sum + s.absent, 0)} ครั้ง
                  </td>
                </tr>

                {/* รวมสาย, ป่วย, กิจ */}
                <tr className="bg-slate-100 font-bold text-[11px] print:text-[9px] text-slate-800">
                  <td colSpan={2} className="py-1 px-2 border border-slate-600 text-right">
                    รวมสาย/ป่วย/กิจ (คน):
                  </td>
                  {teachingDates.map((dateStr) => {
                    const dt = dateTotals[dateStr];
                    const otherCount = (dt?.late || 0) + (dt?.sick || 0) + (dt?.leave || 0);
                    return (
                      <td key={dateStr} className="py-1 px-0.5 border border-slate-600 text-center font-bold">
                        {otherCount}
                      </td>
                    );
                  })}
                  <td colSpan={6} className="py-1 px-2 border border-slate-600 text-center">
                    {studentStats.reduce((sum, s) => sum + s.late + s.sick + s.leave, 0)} ครั้ง
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Official Signature Block (Formatted for A4 Landscape Document) */}
        <div className="grid grid-cols-2 gap-12 pt-8 text-center text-xs text-slate-800 print:pt-6">
          <div className="space-y-6">
            <p className="leading-relaxed">
              ลงชื่อ..................................................................ครูผู้สอน
            </p>
            <p className="font-semibold">({teacherFullName})</p>
            <p className="text-[11px] text-slate-500">
              วันที่.........เดือน..................................พ.ศ. {activeYear?.name || '2569'}
            </p>
          </div>

          <div className="space-y-6">
            <p className="leading-relaxed">
              ลงชื่อ..................................................................ผู้บริหาร/ผู้ตรวจ
            </p>
            <p className="font-semibold">(..................................................................)</p>
            <p className="text-[11px] text-slate-500">
              วันที่.........เดือน..................................พ.ศ. {activeYear?.name || '2569'}
            </p>
          </div>
        </div>
      </div>

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
