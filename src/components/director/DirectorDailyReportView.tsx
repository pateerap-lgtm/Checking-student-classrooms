import React, { useState, useMemo } from 'react';
import {
  Calendar,
  GraduationCap,
  Printer,
  FileDown,
  CheckCircle2,
  XCircle,
  Eye,
  School,
  Clock,
  User,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  FileText,
  X
} from 'lucide-react';
import {
  Classroom,
  Subject,
  TeachingAssignment,
  AttendanceLog,
  Period,
  Student,
  AppUser,
  SystemSettings,
  AcademicYear
} from '../../types';
import {
  getTodayISODate,
  getDayOfWeekFromDate,
  formatThaiFullDate,
  formatToThaiBE
} from '../../utils/thaiDate';

interface DirectorDailyReportViewProps {
  classes: Classroom[];
  subjects: Subject[];
  assignments: TeachingAssignment[];
  attendanceLogs: AttendanceLog[];
  periods: Period[];
  students: Student[];
  teachers: AppUser[];
  allUsers: AppUser[];
  settings: SystemSettings;
  activeYear?: AcademicYear;
}

export const DirectorDailyReportView: React.FC<DirectorDailyReportViewProps> = ({
  classes,
  subjects,
  assignments,
  attendanceLogs,
  periods,
  students,
  teachers,
  allUsers,
  settings,
  activeYear
}) => {
  // 1. Filter States
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISODate());
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');

  // Modal for individual subject attendance slip / document preview
  const [viewingSubjectLog, setViewingSubjectLog] = useState<{
    log?: AttendanceLog;
    assignment?: TeachingAssignment;
    period?: Period;
  } | null>(null);

  // Active Classroom
  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Students in selected classroom
  const classStudents = useMemo(() => {
    if (!currentClass) return [];
    return students
      .filter((s) => s.classId === currentClass.id)
      .sort((a, b) => a.seq - b.seq);
  }, [students, currentClass]);

  // Effective Director Name
  const effectiveDirectorName = useMemo(() => {
    if (settings.directorName?.trim()) {
      return settings.directorName.trim();
    }
    const directorUser = (allUsers || []).find((u) => u.role === 'director');
    if (directorUser?.fullName?.trim()) {
      return directorUser.fullName.trim();
    }
    return 'นายสมศักดิ์ รักเรียน';
  }, [settings.directorName, allUsers]);

  // Day of week from selected date
  const dayOfWeek = useMemo(() => {
    return getDayOfWeekFromDate(selectedDate);
  }, [selectedDate]);

  // Sorted Periods
  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => a.order - b.order);
  }, [periods]);

  // Timetable assignments scheduled for this class on this dayOfWeek
  const scheduledAssignments = useMemo(() => {
    if (!currentClass || !dayOfWeek) return [];
    return assignments.filter(
      (a) => a.classId === currentClass.id && a.dayOfWeek === dayOfWeek
    );
  }, [assignments, currentClass, dayOfWeek]);

  // Logs already recorded for this class on this date
  const dateClassLogs = useMemo(() => {
    if (!currentClass) return [];
    return attendanceLogs.filter(
      (l) => l.classId === currentClass.id && l.date === selectedDate
    );
  }, [attendanceLogs, currentClass, selectedDate]);

  // Build daily rows combining assignments and attendance logs
  interface DailyReportRow {
    order: number;
    periodId: string;
    periodName: string;
    periodTime: string;
    periodOrder: number;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    teacherName: string;
    isChecked: boolean;
    log?: AttendanceLog;
    assignment?: TeachingAssignment;
    presentCount: number;
    absentCount: number;
    leaveCount: number; // รวมลา = ป่วย + กิจ
    sickCount: number;
    errandCount: number; // กิจ
    totalStudents: number;
    percentAttendance: number;
  }

  const tableRows = useMemo<DailyReportRow[]>(() => {
    if (!currentClass) return [];

    const rows: DailyReportRow[] = [];
    const processedPeriodIds = new Set<string>();

    // 1. Process scheduled assignments
    scheduledAssignments.forEach((assignment) => {
      const periodObj = periods.find((p) => p.id === assignment.periodId);
      const periodOrder = periodObj?.order || 999;
      const periodTime = periodObj ? `${periodObj.startTime} - ${periodObj.endTime}` : '';
      const periodName = periodObj ? periodObj.name : assignment.periodName || 'คาบสอน';

      // Find matching attendance log
      const log = dateClassLogs.find(
        (l) =>
          (l.periodId === assignment.periodId && l.subjectId === assignment.subjectId) ||
          l.periodId === assignment.periodId
      );

      const isChecked = !!log;
      const presentCount = log ? (log.summary?.present ?? log.records.filter((r) => r.status === 'present').length) : 0;
      const absentCount = log ? (log.summary?.absent ?? log.records.filter((r) => r.status === 'absent').length) : 0;
      const sickCount = log ? (log.summary?.sick ?? log.records.filter((r) => r.status === 'sick').length) : 0;
      const errandCount = log ? (log.summary?.leave ?? log.records.filter((r) => r.status === 'leave').length) : 0;
      const leaveCount = sickCount + errandCount;
      const totalInLog = log ? (log.summary?.total ?? log.records.length) : classStudents.length;
      const percentAttendance = totalInLog > 0 && isChecked ? Math.round((presentCount / totalInLog) * 100) : 0;

      const teacherObj = teachers.find((t) => t.username === assignment.teacherUsername);
      const teacherName = log?.teacherName || assignment.teacherName || teacherObj?.fullName || 'ครูผู้สอน';

      rows.push({
        order: periodOrder,
        periodId: assignment.periodId,
        periodName,
        periodTime,
        periodOrder,
        subjectId: assignment.subjectId,
        subjectCode: assignment.subjectCode,
        subjectName: assignment.subjectName,
        teacherName,
        isChecked,
        log,
        assignment,
        presentCount,
        absentCount,
        leaveCount,
        sickCount,
        errandCount,
        totalStudents: totalInLog,
        percentAttendance
      });

      processedPeriodIds.add(assignment.periodId);
    });

    // 2. Check any logs recorded on this date not captured by timetable
    dateClassLogs.forEach((log) => {
      if (!processedPeriodIds.has(log.periodId)) {
        const periodObj = periods.find((p) => p.id === log.periodId);
        const periodOrder = periodObj?.order || 999;
        const periodTime = periodObj ? `${periodObj.startTime} - ${periodObj.endTime}` : '';
        const periodName = periodObj ? periodObj.name : log.periodName || 'คาบสอน';

        const presentCount = log.summary?.present ?? log.records.filter((r) => r.status === 'present').length;
        const absentCount = log.summary?.absent ?? log.records.filter((r) => r.status === 'absent').length;
        const sickCount = log.summary?.sick ?? log.records.filter((r) => r.status === 'sick').length;
        const errandCount = log.summary?.leave ?? log.records.filter((r) => r.status === 'leave').length;
        const leaveCount = sickCount + errandCount;
        const totalInLog = log.summary?.total ?? log.records.length;
        const percentAttendance = totalInLog > 0 ? Math.round((presentCount / totalInLog) * 100) : 0;

        rows.push({
          order: periodOrder,
          periodId: log.periodId,
          periodName,
          periodTime,
          periodOrder,
          subjectId: log.subjectId,
          subjectCode: log.subjectCode,
          subjectName: log.subjectName,
          teacherName: log.teacherName || 'ครูผู้สอน',
          isChecked: true,
          log,
          presentCount,
          absentCount,
          leaveCount,
          sickCount,
          errandCount,
          totalStudents: totalInLog,
          percentAttendance
        });
      }
    });

    // Sort by period order
    return rows.sort((a, b) => a.periodOrder - b.periodOrder);
  }, [currentClass, scheduledAssignments, dateClassLogs, periods, teachers, classStudents.length]);

  // Overall Daily Summary
  const summaryTotals = useMemo(() => {
    const checkedRows = tableRows.filter((r) => r.isChecked);
    const totalPeriods = tableRows.length;
    const checkedCount = checkedRows.length;
    const uncheckedCount = totalPeriods - checkedCount;

    const totalPresent = checkedRows.reduce((acc, r) => acc + r.presentCount, 0);
    const totalAbsent = checkedRows.reduce((acc, r) => acc + r.absentCount, 0);
    const totalSick = checkedRows.reduce((acc, r) => acc + r.sickCount, 0);
    const totalErrand = checkedRows.reduce((acc, r) => acc + r.errandCount, 0);
    const totalLeave = totalSick + totalErrand;

    const totalCapacity = checkedRows.reduce((acc, r) => acc + r.totalStudents, 0);
    const avgAttendancePercent = totalCapacity > 0 ? Math.round((totalPresent / totalCapacity) * 100) : 0;

    return {
      totalPeriods,
      checkedCount,
      uncheckedCount,
      totalPresent,
      totalAbsent,
      totalLeave,
      totalSick,
      totalErrand,
      avgAttendancePercent
    };
  }, [tableRows]);

  // Quick Date Navigation
  const changeDateByDays = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          SCREEN UI: Top Header & Filters (Hidden during print)
      ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] flex items-center justify-center text-white shadow-md shadow-[#0C7C82]/20 shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                  ผู้อำนวยการสถานศึกษา
                </span>
                <span className="text-xs text-slate-400 font-medium">Daily Attendance Audit</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-0.5">
                รายงานการเช็คชื่อรายวัน
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                ตรวจสอบการเช็คชื่อรายวิชาประจำวัน แยกตามห้องเรียน พร้อมสถานะและพิมพ์รายงาน
              </p>
            </div>
          </div>

          {/* Action Buttons: Print / PDF */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white font-semibold text-xs shadow-md shadow-[#0C7C82]/20 hover:scale-102 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงานรายวัน (window.print())</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-xs shadow-2xs transition-all cursor-pointer"
              title="ส่งออกเอกสารผ่านระบบพิมพ์เป็น PDF"
            >
              <FileDown className="w-4 h-4 text-slate-500" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Controls: Date Picker & Classroom Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 pt-5 items-end">
          {/* Date Picker (7 cols) */}
          <div className="lg:col-span-7 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              เลือกวันที่:
            </label>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <button
                type="button"
                onClick={() => changeDateByDays(-1)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="วันก่อนหน้า"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0C7C82]/30 focus:border-[#0C7C82] transition-all bg-slate-50/50"
                />
              </div>

              <button
                type="button"
                onClick={() => changeDateByDays(1)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="วันถัดไป"
              >
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedDate(getTodayISODate())}
                className="px-3 py-2.5 rounded-xl bg-teal-50 text-[#0C7C82] border border-teal-200 font-bold text-xs hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                วันนี้
              </button>
            </div>
            <div className="text-xs font-semibold text-[#0C7C82] flex items-center gap-1.5 pt-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatThaiFullDate(selectedDate)}</span>
              {dayOfWeek ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-teal-100 text-teal-800">
                  วัน{dayOfWeek}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800">
                  วันหยุดสุดสัปดาห์
                </span>
              )}
            </div>
          </div>

          {/* Classroom Selector (5 cols) */}
          <div className="lg:col-span-5 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              เลือกห้องเรียน:
            </label>
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0C7C82]/30 focus:border-[#0C7C82] transition-all bg-slate-50/50 cursor-pointer"
              >
                {classes.map((cls) => {
                  const stdCount = students.filter((s) => s.classId === cls.id).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} (นักเรียน {stdCount} คน)
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
              <span>
                ห้องเรียน: <strong className="text-slate-800">{currentClass?.name || '-'}</strong> |
                นักเรียนทั้งหมด: <strong className="text-slate-800">{classStudents.length} คน</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6 border-t border-slate-100 mt-5">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500">คาบเรียนทั้งหมด</div>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {summaryTotals.totalPeriods} <span className="text-xs font-normal text-slate-500">คาบ</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100">
            <div className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>เช็คแล้ว</span>
            </div>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {summaryTotals.checkedCount} <span className="text-xs font-normal text-emerald-600">วิชา</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-100">
            <div className="text-[11px] font-medium text-red-700 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              <span>ยังไม่เช็ค</span>
            </div>
            <div className="text-xl font-bold text-red-700 mt-1">
              {summaryTotals.uncheckedCount} <span className="text-xs font-normal text-red-600">วิชา</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-100">
            <div className="text-[11px] font-medium text-teal-700">มาเรียนรวม</div>
            <div className="text-xl font-bold text-teal-700 mt-1">
              {summaryTotals.totalPresent} <span className="text-xs font-normal text-teal-600">คน</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100">
            <div className="text-[11px] font-medium text-amber-700">ขาด / ลา รวม</div>
            <div className="text-xl font-bold text-amber-700 mt-1">
              {summaryTotals.totalAbsent + summaryTotals.totalLeave} <span className="text-xs font-normal text-amber-600">คน</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100">
            <div className="text-[11px] font-medium text-purple-700">มาเรียนเฉลี่ย</div>
            <div className="text-xl font-bold text-purple-700 mt-1">
              {summaryTotals.avgAttendancePercent}%
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SCREEN UI: Daily Attendance Table (Also used for Print via @media print)
      ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Printable Official Header (Only shown during print or with print-only) */}
        <div className="hidden print:block p-4 border-b border-slate-800 text-center space-y-2 mb-4">
          <div className="flex items-center justify-center gap-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-14 h-14 object-contain" />
            ) : (
              <School className="w-12 h-12 text-slate-800" />
            )}
            <div className="text-left">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {settings.schoolName || 'โรงเรียน'}
              </h1>
              <p className="text-xs text-slate-700 leading-snug">
                {settings.affiliationName || 'สำนักงานเขตพื้นที่การศึกษา / สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน'}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <h2 className="text-base font-bold text-slate-900">
              ตารางรายงานการเช็คชื่อรายวิชาประจำวัน
            </h2>
            <p className="text-xs text-slate-800 mt-0.5">
              ห้องเรียน: <strong>{currentClass?.name}</strong> |{' '}
              วันที่: <strong>{formatThaiFullDate(selectedDate)}</strong> |{' '}
              ปีการศึกษา: <strong>{activeYear?.name || '2569'}</strong>
            </p>
            <p className="text-[11px] text-slate-700 mt-0.5">
              จำนวนนักเรียนทั้งหมดในห้อง: {classStudents.length} คน | จำนวนวิชา/คาบที่สอน: {tableRows.length} คาบ | เช็คชื่อแล้ว: {summaryTotals.checkedCount} วิชา | ยังไม่เช็ค: {summaryTotals.uncheckedCount} วิชา
            </p>
          </div>
        </div>

        {/* Screen Table Header Bar (Hidden in print) */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <span>ตารางรายงานรายวิชาประจำวัน</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-semibold">
                {currentClass?.name}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatThaiFullDate(selectedDate)} (ทั้งหมด {tableRows.length} คาบ/วิชา)
            </p>
          </div>

          <div className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            สถานะ: <span className="text-emerald-600 font-bold">เช็คแล้ว {summaryTotals.checkedCount}</span> /{' '}
            <span className="text-red-500 font-bold">ยังไม่เช็ค {summaryTotals.uncheckedCount}</span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-[11px] print:bg-slate-100 print:text-black">
                {/* 1. ลำดับ */}
                <th className="py-3 px-3 text-center w-12 border-r border-slate-200 print:border-slate-800">
                  ลำดับ
                </th>
                {/* 2. สถานะ */}
                <th className="py-3 px-3 text-center w-28 border-r border-slate-200 print:border-slate-800">
                  สถานะ
                </th>
                {/* 3. ครูผู้สอน */}
                <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[140px]">
                  ครูผู้สอน
                </th>
                {/* 4. วิชา */}
                <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[160px]">
                  วิชา
                </th>
                {/* 5. คาบที่ */}
                <th className="py-3 px-3 text-center w-28 border-r border-slate-200 print:border-slate-800">
                  คาบที่
                </th>
                {/* 6. มาเรียน */}
                <th className="py-3 px-2 text-center w-14 text-emerald-700 border-r border-slate-200 print:border-slate-800">
                  มาเรียน
                </th>
                {/* 7. ขาด */}
                <th className="py-3 px-2 text-center w-14 text-red-600 border-r border-slate-200 print:border-slate-800">
                  ขาด
                </th>
                {/* 8. ลา */}
                <th className="py-3 px-2 text-center w-14 text-amber-600 border-r border-slate-200 print:border-slate-800">
                  ลา
                </th>
                {/* 9. ป่วย */}
                <th className="py-3 px-2 text-center w-14 text-sky-600 border-r border-slate-200 print:border-slate-800">
                  ป่วย
                </th>
                {/* 10. กิจ */}
                <th className="py-3 px-2 text-center w-14 text-orange-600 border-r border-slate-200 print:border-slate-800">
                  กิจ
                </th>
                {/* 11. เอกสาร (PDF, พิมพ์ window.print()) */}
                <th className="py-3 px-3 text-center w-32 no-print">
                  เอกสาร (PDF/พิมพ์)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-800">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600 text-sm">
                      ไม่มีตารางสอนหรือบันทึกการเช็คชื่อในวันนี้
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {dayOfWeek
                        ? `ห้องเรียน ${currentClass?.name} ไม่มีคาบสอนในวัน${dayOfWeek}`
                        : 'วันที่เลือกตรงกับวันหยุดสุดสัปดาห์ (เสาร์ - อาทิตย์)'}
                    </p>
                  </td>
                </tr>
              ) : (
                tableRows.map((row, index) => (
                  <tr
                    key={`${row.periodId}-${row.subjectId}-${index}`}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      row.isChecked ? 'bg-white' : 'bg-red-50/20'
                    }`}
                  >
                    {/* 1. ลำดับ */}
                    <td className="py-3 px-3 text-center font-bold text-slate-700 border-r border-slate-100 print:border-slate-800">
                      {index + 1}
                    </td>

                    {/* 2. สถานะ (เช็คแล้ว = เครื่องหมายถูกสีเขียว, ยังไม่เช็ค = กากบาทสีแดง) */}
                    <td className="py-3 px-3 text-center border-r border-slate-100 print:border-slate-800">
                      {row.isChecked ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 print:bg-transparent print:text-black">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 print:text-black" />
                          <span>เช็คแล้ว</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 print:bg-transparent print:text-black">
                          <XCircle className="w-3.5 h-3.5 text-red-600 print:text-black" />
                          <span>ยังไม่เช็ค</span>
                        </span>
                      )}
                    </td>

                    {/* 3. ครูผู้สอน */}
                    <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                      <div className="font-semibold text-slate-800">
                        {row.teacherName}
                      </div>
                    </td>

                    {/* 4. วิชา */}
                    <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                      <div className="font-bold text-slate-800">
                        {row.subjectCode}
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-1">
                        {row.subjectName}
                      </div>
                    </td>

                    {/* 5. คาบที่ */}
                    <td className="py-3 px-3 text-center border-r border-slate-100 print:border-slate-800">
                      <div className="font-semibold text-slate-800">
                        {row.periodName}
                      </div>
                      {row.periodTime && (
                        <div className="text-[10px] text-slate-400 print:text-slate-700">
                          {row.periodTime}
                        </div>
                      )}
                    </td>

                    {/* 6. มาเรียน */}
                    <td className="py-3 px-2 text-center font-bold text-emerald-700 border-r border-slate-100 print:border-slate-800">
                      {row.isChecked ? row.presentCount : '-'}
                    </td>

                    {/* 7. ขาด */}
                    <td className="py-3 px-2 text-center font-bold text-red-600 border-r border-slate-100 print:border-slate-800">
                      {row.isChecked ? (
                        row.absentCount > 0 ? (
                          <span className="text-red-600">{row.absentCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 8. ลา (รวมลา = ป่วย + กิจ) */}
                    <td className="py-3 px-2 text-center font-bold text-amber-600 border-r border-slate-100 print:border-slate-800">
                      {row.isChecked ? (
                        row.leaveCount > 0 ? (
                          <span className="text-amber-600">{row.leaveCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 9. ป่วย */}
                    <td className="py-3 px-2 text-center font-bold text-sky-600 border-r border-slate-100 print:border-slate-800">
                      {row.isChecked ? (
                        row.sickCount > 0 ? (
                          <span className="text-sky-600">{row.sickCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 10. กิจ */}
                    <td className="py-3 px-2 text-center font-bold text-orange-600 border-r border-slate-100 print:border-slate-800">
                      {row.isChecked ? (
                        row.errandCount > 0 ? (
                          <span className="text-orange-600">{row.errandCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 11. เอกสาร (PDF, พิมพ์ window.print()) */}
                    <td className="py-3 px-3 text-center no-print">
                      {row.isChecked && row.log ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setViewingSubjectLog({
                                log: row.log,
                                assignment: row.assignment,
                                period: periods.find((p) => p.id === row.periodId)
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0C7C82] font-semibold text-[11px] transition-colors cursor-pointer"
                            title="ดู/พิมพ์เอกสารการเช็คชื่อรายวิชานี้"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>ดู/พิมพ์</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal">
                          รอครูเช็คชื่อ
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Summary Row */}
            {tableRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-slate-800 text-[11px] print:bg-slate-100 print:border-slate-800">
                  <td colSpan={5} className="py-3 px-3 text-right border-r border-slate-200 print:border-slate-800">
                    รวมสรุปทั้งห้อง ({summaryTotals.checkedCount} วิชาที่เช็คแล้ว):
                  </td>
                  <td className="py-3 px-2 text-center text-emerald-800 border-r border-slate-200 print:border-slate-800">
                    {summaryTotals.totalPresent}
                  </td>
                  <td className="py-3 px-2 text-center text-red-700 border-r border-slate-200 print:border-slate-800">
                    {summaryTotals.totalAbsent}
                  </td>
                  <td className="py-3 px-2 text-center text-amber-700 border-r border-slate-200 print:border-slate-800">
                    {summaryTotals.totalLeave}
                  </td>
                  <td className="py-3 px-2 text-center text-sky-700 border-r border-slate-200 print:border-slate-800">
                    {summaryTotals.totalSick}
                  </td>
                  <td className="py-3 px-2 text-center text-orange-700 border-r border-slate-200 print:border-slate-800">
                    {summaryTotals.totalErrand}
                  </td>
                  <td className="py-3 px-3 text-center no-print text-[10px] text-slate-600">
                    มาเรียน {summaryTotals.avgAttendancePercent}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* =========================================================================
            PRINT ONLY: Signatures Section (Displayed at bottom of printed document)
        ========================================================================= */}
        <div className="hidden print:block pt-8 px-4 text-center text-xs text-slate-800 print:break-inside-avoid">
          <div className="grid grid-cols-3 gap-6">
            {/* Signature 1: Homeroom Teacher */}
            <div className="space-y-4">
              <p className="leading-relaxed">ลงชื่อ........................................................</p>
              <p className="font-semibold">(........................................................)</p>
              <p className="text-[11px] text-slate-600">ครูที่ปรึกษา / ครูประจำชั้น</p>
              <p className="text-[10px] text-slate-500">
                วันที่ ...... เดือน ..................... พ.ศ. ...........
              </p>
            </div>

            {/* Signature 2: Academic Head */}
            <div className="space-y-4">
              <p className="leading-relaxed">ลงชื่อ........................................................</p>
              <p className="font-semibold">(........................................................)</p>
              <p className="text-[11px] text-slate-600">หัวหน้าฝ่ายวิชาการ</p>
              <p className="text-[10px] text-slate-500">
                วันที่ ...... เดือน ..................... พ.ศ. ...........
              </p>
            </div>

            {/* Signature 3: School Director */}
            <div className="space-y-4">
              <p className="leading-relaxed">ลงชื่อ........................................................</p>
              <p className="font-semibold">({effectiveDirectorName})</p>
              <p className="text-[11px] text-slate-800 font-bold">ผู้อำนวยการสถานศึกษา</p>
              <p className="text-[10px] text-slate-500">
                วันที่ ...... เดือน ..................... พ.ศ. ...........
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL: Single Subject Attendance Slip / Document Viewer
      ========================================================================= */}
      {viewingSubjectLog && viewingSubjectLog.log && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-[#0C7C82] flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    เอกสารบันทึกการเช็คชื่อรายวิชา
                  </h3>
                  <p className="text-xs text-slate-500">
                    {viewingSubjectLog.log.subjectCode} {viewingSubjectLog.log.subjectName} | ห้อง {viewingSubjectLog.log.className}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 rounded-xl bg-[#0C7C82] text-white text-xs font-semibold hover:bg-[#096368] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>พิมพ์เอกสารนี้</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSubjectLog(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Subject Document */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Slip Official Letterhead */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 text-center space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">
                  {settings.schoolName || 'โรงเรียน'}
                </h4>
                <p className="text-xs text-slate-600">
                  ใบเช็คชื่อนักเรียนรายวิชา ({viewingSubjectLog.log.subjectCode} {viewingSubjectLog.log.subjectName})
                </p>
                <div className="text-xs text-slate-700 flex flex-wrap items-center justify-center gap-3 pt-1">
                  <span>ห้อง: <strong>{viewingSubjectLog.log.className}</strong></span>
                  <span>วันที่: <strong>{viewingSubjectLog.log.thaiDateStr || formatToThaiBE(viewingSubjectLog.log.date)}</strong></span>
                  <span>คาบ: <strong>{viewingSubjectLog.log.periodName}</strong></span>
                  <span>ครูผู้สอน: <strong>{viewingSubjectLog.log.teacherName || '-'}</strong></span>
                </div>
              </div>

              {/* Status Counters */}
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 font-bold border border-emerald-100">
                  มาเรียน {viewingSubjectLog.log.summary?.present || 0} คน
                </div>
                <div className="p-2 rounded-xl bg-red-50 text-red-700 font-bold border border-red-100">
                  ขาด {viewingSubjectLog.log.summary?.absent || 0} คน
                </div>
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 font-bold border border-amber-100">
                  สาย {viewingSubjectLog.log.summary?.late || 0} คน
                </div>
                <div className="p-2 rounded-xl bg-sky-50 text-sky-700 font-bold border border-sky-100">
                  ป่วย {viewingSubjectLog.log.summary?.sick || 0} คน
                </div>
                <div className="p-2 rounded-xl bg-orange-50 text-orange-700 font-bold border border-orange-100">
                  กิจ {viewingSubjectLog.log.summary?.leave || 0} คน
                </div>
              </div>

              {/* Student Attendance List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="py-2 px-3 text-center w-12 border-r border-slate-200">ลำดับ</th>
                      <th className="py-2 px-3 text-left border-r border-slate-200">ชื่อ - นามสกุล</th>
                      <th className="py-2 px-3 text-center w-28 border-r border-slate-200">สถานะ</th>
                      <th className="py-2 px-3 text-left">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingSubjectLog.log.records.map((rec, i) => (
                      <tr key={rec.studentId || i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center font-semibold text-slate-600 border-r border-slate-100">
                          {rec.seq || i + 1}
                        </td>
                        <td className="py-2 px-3 text-slate-800 font-medium border-r border-slate-100">
                          {rec.studentName}
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-100">
                          {rec.status === 'present' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              มาเรียน
                            </span>
                          ) : rec.status === 'absent' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                              ขาด
                            </span>
                          ) : rec.status === 'late' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              สาย
                            </span>
                          ) : rec.status === 'sick' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                              ป่วย
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">
                              กิจ
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">
                          {rec.note || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures in Slip */}
              <div className="grid grid-cols-2 gap-6 pt-4 text-center text-xs">
                <div className="space-y-3">
                  <p>ลงชื่อ........................................................</p>
                  <p className="font-semibold">({viewingSubjectLog.log.teacherName || '........................................................'})</p>
                  <p className="text-[11px] text-slate-600">ครูผู้สอน</p>
                </div>
                <div className="space-y-3">
                  <p>ลงชื่อ........................................................</p>
                  <p className="font-semibold">({effectiveDirectorName})</p>
                  <p className="text-[11px] text-slate-800 font-bold">ผู้อำนวยการสถานศึกษา</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setViewingSubjectLog(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
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
