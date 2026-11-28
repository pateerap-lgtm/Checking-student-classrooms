import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarOff,
  CheckCircle2,
  Clock,
  Eye,
  FileDown,
  Printer,
  School,
  Search,
  User,
  Users,
  X,
  XCircle,
  AlertCircle
} from 'lucide-react';
import {
  AcademicYear,
  AppUser,
  AttendanceLog,
  Classroom,
  Period,
  SchoolCalendarEntry,
  Student,
  SystemSettings,
  TeachingAssignment
} from '../../types';
import {
  formatThaiFullDate,
  formatToThaiBE,
  getTodayISODate,
  resolveCalendarDateStatus
} from '../../utils/thaiDate';
import { exportToExcel } from '../../utils/excel';

type DailyCheckStatusFilter = 'all' | 'checked' | 'unchecked';

interface AdminDailyReportViewProps {
  classes: Classroom[];
  assignments: TeachingAssignment[];
  attendanceLogs: AttendanceLog[];
  periods: Period[];
  students: Student[];
  teachers: AppUser[];
  allUsers: AppUser[];
  settings: SystemSettings;
  calendarEntries?: SchoolCalendarEntry[];
  activeYear?: AcademicYear;
}

interface AdminDailySlotRow {
  id: string;
  assignment: TeachingAssignment;
  teacherUsername: string;
  teacherName: string;
  isSubstituted: boolean;
  substituteTeacherUsername?: string;
  substituteTeacherName?: string;
  responsibleTeacherUsername: string;
  responsibleTeacherName: string;
  periodId: string;
  periodName: string;
  periodTime: string;
  periodOrder: number;
  classId: string;
  className: string;
  classStudentCount: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  isChecked: boolean;
  log?: AttendanceLog;
  present: number;
  absent: number;
  late: number;
  sick: number;
  leave: number;
  total: number;
  checkedTimeText: string;
}

export const AdminDailyReportView: React.FC<AdminDailyReportViewProps> = ({
  classes,
  assignments,
  attendanceLogs,
  periods,
  students,
  teachers,
  allUsers,
  settings,
  calendarEntries = [],
  activeYear
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISODate());
  const [selectedTeacherUsername, setSelectedTeacherUsername] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<DailyCheckStatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewingRow, setViewingRow] = useState<AdminDailySlotRow | null>(null);

  const dateCalendarStatus = useMemo(
    () => resolveCalendarDateStatus(selectedDate, calendarEntries),
    [selectedDate, calendarEntries]
  );

  const dayOfWeek = dateCalendarStatus.effectiveDayOfWeek;

  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => a.fullName.localeCompare(b.fullName, 'th')),
    [teachers]
  );

  const teacherNameMap = useMemo(() => {
    const map = new Map<string, string>();
    teachers.forEach((t) => map.set(t.username, t.fullName));
    allUsers.forEach((u) => {
      if (!map.has(u.username)) map.set(u.username, u.fullName);
    });
    return map;
  }, [teachers, allUsers]);

  const getTeacherName = (username?: string, fallback?: string) => {
    if (!username) return fallback || '-';
    return teacherNameMap.get(username) || fallback || username;
  };

  const effectiveDirectorName = useMemo(() => {
    if (settings.directorName?.trim()) return settings.directorName.trim();
    const dir = allUsers.find((u) => u.role === 'director');
    return dir?.fullName?.trim() || 'ผู้อำนวยการสถานศึกษา';
  }, [settings.directorName, allUsers]);

  const formatUpdatedTime = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  };

  // Build daily scheduled rows for selectedDate across all teachers (empty on holidays)
  const allDateRows = useMemo<AdminDailySlotRow[]>(() => {
    if (dateCalendarStatus.isHoliday || !dayOfWeek) return [];

    const dayLogs = attendanceLogs.filter((l) => l.date === selectedDate);
    const dayAssignments = assignments.filter((a) => a.dayOfWeek === dayOfWeek);

    const rows: AdminDailySlotRow[] = dayAssignments.map((a) => {
      const startP = periods.find((p) => p.id === a.periodId);
      const endP = a.endPeriodId ? periods.find((p) => p.id === a.endPeriodId) : startP;
      const periodOrder = startP?.order ?? 999;
      const periodTime = startP ? `${startP.startTime} - ${endP?.endTime || startP.endTime} น.` : '';
      const periodName = a.periodName || startP?.name || '-';

      const isSub =
        Boolean(a.substituteTeacherUsername) &&
        (!a.substituteDate || a.substituteDate === selectedDate);
      const primaryName = getTeacherName(a.teacherUsername, a.teacherName);
      const subName = isSub ? getTeacherName(a.substituteTeacherUsername) : undefined;
      const responsibleUsername =
        isSub && a.substituteTeacherUsername ? a.substituteTeacherUsername : a.teacherUsername;
      const responsibleName = isSub && subName ? subName : primaryName;

      const matchedLog = dayLogs.find(
        (l) =>
          (l.classId === a.classId || l.className === a.className) &&
          (l.subjectId === a.subjectId || l.subjectCode === a.subjectCode) &&
          (l.periodId === a.periodId || l.periodName === a.periodName)
      );

      const classStudentCount = students.filter(
        (s) => s.classId === a.classId || s.className === a.className
      ).length;

      const present = matchedLog
        ? matchedLog.summary?.present ??
          matchedLog.records.filter((r) => r.status === 'present').length
        : 0;
      const absent = matchedLog
        ? matchedLog.summary?.absent ??
          matchedLog.records.filter((r) => r.status === 'absent').length
        : 0;
      const late = matchedLog
        ? matchedLog.summary?.late ?? matchedLog.records.filter((r) => r.status === 'late').length
        : 0;
      const sick = matchedLog
        ? matchedLog.summary?.sick ?? matchedLog.records.filter((r) => r.status === 'sick').length
        : 0;
      const leave = matchedLog
        ? matchedLog.summary?.leave ??
          matchedLog.records.filter((r) => r.status === 'leave').length
        : 0;
      const total = matchedLog
        ? matchedLog.summary?.total ?? matchedLog.records.length
        : classStudentCount;

      return {
        id: a.id,
        assignment: a,
        teacherUsername: a.teacherUsername,
        teacherName: primaryName,
        isSubstituted: isSub,
        substituteTeacherUsername: a.substituteTeacherUsername,
        substituteTeacherName: subName,
        responsibleTeacherUsername: responsibleUsername,
        responsibleTeacherName: responsibleName,
        periodId: a.periodId,
        periodName,
        periodTime,
        periodOrder,
        classId: a.classId,
        className: a.className,
        classStudentCount,
        subjectId: a.subjectId,
        subjectCode: a.subjectCode,
        subjectName: a.subjectName,
        isChecked: Boolean(matchedLog),
        log: matchedLog,
        present,
        absent,
        late,
        sick,
        leave,
        total,
        checkedTimeText: formatUpdatedTime(matchedLog?.updatedAt)
      };
    });

    return rows.sort((a, b) => {
      const tCmp = a.responsibleTeacherName.localeCompare(b.responsibleTeacherName, 'th');
      if (tCmp !== 0) return tCmp;
      if (a.periodOrder !== b.periodOrder) return a.periodOrder - b.periodOrder;
      return a.className.localeCompare(b.className, 'th');
    });
  }, [
    dateCalendarStatus.isHoliday,
    dayOfWeek,
    attendanceLogs,
    assignments,
    selectedDate,
    periods,
    students,
    teacherNameMap
  ]);

  // Filter by selected teacher (ทั้งหมด or รายบุคคล) + search term (before status split so counts stay accurate)
  const teacherScopedRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allDateRows.filter((row) => {
      if (selectedTeacherUsername !== 'ALL') {
        const matchesTeacher =
          row.responsibleTeacherUsername === selectedTeacherUsername ||
          row.teacherUsername === selectedTeacherUsername;
        if (!matchesTeacher) return false;
      }
      if (q) {
        const match =
          row.responsibleTeacherName.toLowerCase().includes(q) ||
          row.teacherName.toLowerCase().includes(q) ||
          row.subjectCode.toLowerCase().includes(q) ||
          row.subjectName.toLowerCase().includes(q) ||
          row.className.toLowerCase().includes(q) ||
          row.periodName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allDateRows, selectedTeacherUsername, searchTerm]);

  const checkedRows = useMemo(
    () => teacherScopedRows.filter((r) => r.isChecked),
    [teacherScopedRows]
  );

  const uncheckedRows = useMemo(
    () => teacherScopedRows.filter((r) => !r.isChecked),
    [teacherScopedRows]
  );

  const displayedRows = useMemo(() => {
    if (statusFilter === 'checked') return checkedRows;
    if (statusFilter === 'unchecked') return uncheckedRows;
    return teacherScopedRows;
  }, [statusFilter, checkedRows, uncheckedRows, teacherScopedRows]);

  // Per-teacher summary counts for dropdown labels and summary table
  const teacherDailyStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        username: string;
        fullName: string;
        total: number;
        checked: number;
        unchecked: number;
      }
    >();

    sortedTeachers.forEach((t) => {
      stats.set(t.username, {
        username: t.username,
        fullName: t.fullName,
        total: 0,
        checked: 0,
        unchecked: 0
      });
    });

    allDateRows.forEach((r) => {
      if (!stats.has(r.responsibleTeacherUsername)) {
        stats.set(r.responsibleTeacherUsername, {
          username: r.responsibleTeacherUsername,
          fullName: r.responsibleTeacherName,
          total: 0,
          checked: 0,
          unchecked: 0
        });
      }
      const entry = stats.get(r.responsibleTeacherUsername)!;
      entry.total += 1;
      if (r.isChecked) entry.checked += 1;
      else entry.unchecked += 1;
    });

    return stats;
  }, [sortedTeachers, allDateRows]);

  const summaryKPI = useMemo(() => {
    const total = teacherScopedRows.length;
    const checked = checkedRows.length;
    const unchecked = uncheckedRows.length;
    const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
    const totalPresent = checkedRows.reduce((s, r) => s + r.present, 0);
    const totalAbsent = checkedRows.reduce((s, r) => s + r.absent, 0);
    return { total, checked, unchecked, percent, totalPresent, totalAbsent };
  }, [teacherScopedRows, checkedRows, uncheckedRows]);

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

  const statusFilterLabel =
    statusFilter === 'checked'
      ? 'เช็คชื่อแล้ว'
      : statusFilter === 'unchecked'
      ? 'ยังไม่เช็คชื่อ'
      : 'รวมทั้งหมด';

  const handleExportExcel = () => {
    const rows = displayedRows.map((r, idx) => ({
      'ลำดับ': idx + 1,
      'วันที่': formatToThaiBE(selectedDate),
      'สถานะ': r.isChecked ? 'เช็คชื่อแล้ว' : 'ยังไม่เช็คชื่อ',
      'ครูผู้สอน': r.isSubstituted
        ? `${r.responsibleTeacherName} (สอนแทน ${r.teacherName})`
        : r.responsibleTeacherName,
      'คาบสอน': r.periodName,
      'เวลา': r.periodTime || '-',
      'รหัสวิชา': r.subjectCode,
      'ชื่อวิชา': r.subjectName,
      'ชั้นเรียน': r.className,
      'มาเรียน': r.isChecked ? r.present : '-',
      'ขาด': r.isChecked ? r.absent : '-',
      'สาย': r.isChecked ? r.late : '-',
      'ป่วย': r.isChecked ? r.sick : '-',
      'กิจ': r.isChecked ? r.leave : '-',
      'รวมนักเรียน': r.total,
      'เวลาที่เช็คชื่อ': r.isChecked ? r.checkedTimeText : '-'
    }));
    exportToExcel(
      rows,
      `รายงานการเช็คชื่อรายวันของครู_${selectedDate}_${statusFilterLabel}`,
      statusFilterLabel
    );
  };

  const selectedTeacherLabel =
    selectedTeacherUsername === 'ALL'
      ? 'ครูทุกคน (ทั้งหมด)'
      : getTeacherName(selectedTeacherUsername);

  return (
    <div className="space-y-6">
      {/* Header & Controls (No Print) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs no-print space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0288D1] to-[#26A69A] flex items-center justify-center text-white shadow-md shadow-[#0288D1]/20 shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                  ผู้ดูแลระบบ
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Daily Teacher Attendance Report
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-0.5">
                รายงานการเช็คชื่อรายวันของครู
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                ตรวจสอบการเช็คชื่อประจำวันของครู (รายบุคคล / ทั้งหมด) แยกสถานะ เช็คชื่อแล้ว, ยังไม่เช็คชื่อ และรวมทั้งหมด
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={displayedRows.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 font-semibold text-xs shadow-2xs transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>ส่งออก Excel</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white font-semibold text-xs shadow-md shadow-[#0C7C82]/20 hover:opacity-95 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          {/* 1. Date Picker (4 cols) */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">เลือกวันที่</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => changeDateByDays(-1)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="วันก่อนหน้า"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
              />
              <button
                type="button"
                onClick={() => changeDateByDays(1)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="วันถัดไป"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getTodayISODate())}
                className="px-3 py-2.5 rounded-xl bg-teal-50 text-[#0C7C82] border border-teal-200 font-bold text-xs hover:bg-teal-100 cursor-pointer whitespace-nowrap"
              >
                วันนี้
              </button>
            </div>
            <div className="text-xs font-semibold text-[#0C7C82] flex flex-wrap items-center gap-1.5 pt-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatThaiFullDate(selectedDate)}</span>
              {dateCalendarStatus.isHoliday ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800">
                  {dateCalendarStatus.holidayTitle}
                </span>
              ) : dateCalendarStatus.isOpenedNormal && dayOfWeek ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                  เปิดสอนปกติ (ตารางวัน{dayOfWeek})
                </span>
              ) : dayOfWeek ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-teal-100 text-teal-800">
                  วัน{dayOfWeek}
                </span>
              ) : null}
            </div>
          </div>

          {/* 2. Teacher Dropdown (ทั้งหมด / รายบุคคล) (3 cols) */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              เลือกครูผู้สอน (ทั้งหมด / รายบุคคล)
            </label>
            <select
              value={selectedTeacherUsername}
              onChange={(e) => setSelectedTeacherUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
            >
              <option value="ALL">ทั้งหมด (ครูทุกคน • {allDateRows.length} คาบ)</option>
              {sortedTeachers.map((t) => {
                const st = teacherDailyStats.get(t.username);
                const countInfo = st && st.total > 0 ? ` (${st.checked}/${st.total})` : ' (ไม่มีสอน)';
                return (
                  <option key={t.id} value={t.username}>
                    {t.fullName}
                    {countInfo}
                  </option>
                );
              })}
            </select>
            <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5">
              {selectedTeacherUsername === 'ALL' ? (
                <>
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>แสดงข้อมูลครูทุกคนในวัน{dayOfWeek || '-'}</span>
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5 text-[#0C7C82]" />
                  <span>เฉพาะ: {selectedTeacherLabel}</span>
                </>
              )}
            </div>
          </div>

          {/* 3. Status Dropdown List (เช็คชื่อแล้ว, ยังไม่เช็คชื่อ, รวมทั้งหมด) (3 cols) */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              สถานะการเช็คชื่อ (Dropdown List)
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DailyCheckStatusFilter)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
            >
              <option value="all">รวมทั้งหมด ({summaryKPI.total} รายการ)</option>
              <option value="checked">เช็คชื่อแล้ว ({summaryKPI.checked} รายการ)</option>
              <option value="unchecked">ยังไม่เช็คชื่อ ({summaryKPI.unchecked} รายการ)</option>
            </select>
            <div className="text-[11px] text-slate-500 pt-0.5">
              แสดงตารางรูปแบบ: <strong className="text-[#0C7C82]">{statusFilterLabel}</strong>
            </div>
          </div>

          {/* 4. Search (2 cols) */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">ค้นหา</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="วิชา / ห้อง / ครู..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
              />
            </div>
            <div className="text-[11px] text-transparent select-none pt-0.5">.</div>
          </div>
        </div>

        {/* Interactive Summary KPI Cards (click to switch dropdown status filter) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
            }`}
          >
            <div className="text-[11px] font-bold opacity-80">รวมทั้งหมด</div>
            <div className="text-2xl font-extrabold mt-1">
              {summaryKPI.total} <span className="text-xs font-medium opacity-75">คาบ</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('checked')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'checked'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold opacity-90">เช็คชื่อแล้ว</span>
              <CheckCircle2 className="w-4 h-4 opacity-90" />
            </div>
            <div className="text-2xl font-extrabold mt-1">
              {summaryKPI.checked} <span className="text-xs font-medium opacity-80">คาบ</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('unchecked')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'unchecked'
                ? 'bg-red-600 text-white border-red-600 shadow-md'
                : 'bg-red-50 border-red-200 text-red-900 hover:bg-red-100/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold opacity-90">ยังไม่เช็คชื่อ</span>
              <XCircle className="w-4 h-4 opacity-90" />
            </div>
            <div className="text-2xl font-extrabold mt-1">
              {summaryKPI.unchecked} <span className="text-xs font-medium opacity-80">คาบ</span>
            </div>
          </button>

          <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-900">
            <div className="text-[11px] font-bold text-teal-700">ความครบถ้วนการเช็คชื่อ</div>
            <div className="text-2xl font-extrabold mt-1">
              {summaryKPI.percent}%{' '}
              <span className="text-xs font-medium text-teal-700">
                (มาเรียน {summaryKPI.totalPresent} คน)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Holiday Notice Banner */}
      {dateCalendarStatus.isHoliday ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center space-y-2">
          <CalendarOff className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-rose-800">
            {formatThaiFullDate(selectedDate)} เป็น{dateCalendarStatus.holidayTitle}
          </h3>
          <p className="text-xs text-rose-600">
            วันหยุดไม่มีตารางเรียนและไม่มีการเช็คชื่อนักเรียน กรุณาเลือกวันเปิดเรียนปกติเพื่อดูรายงานรายวัน
          </p>
        </div>
      ) : (
        /* Report Table Container (Screen + Printable) */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden print:border-none print:shadow-none print:rounded-none">
          {/* Print Only Official Header */}
          <div className="hidden print:block p-4 border-b-2 border-slate-800 text-center space-y-2 mb-4">
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
                <p className="text-xs text-slate-700">
                  {settings.affiliationName || 'สำนักงานเขตพื้นที่การศึกษา'}
                </p>
              </div>
            </div>

            <div className="pt-1">
              <h2 className="text-base font-bold text-slate-900">
                รายงานการเช็คชื่อรายวันของครู ({statusFilterLabel})
              </h2>
              <p className="text-xs text-slate-800 mt-0.5">
                วันที่: <strong>{formatThaiFullDate(selectedDate)}</strong> | ผู้สอน:{' '}
                <strong>{selectedTeacherLabel}</strong> | ปีการศึกษา:{' '}
                <strong>{activeYear?.name || '2569'}</strong>
              </p>
              <p className="text-[11px] text-slate-700 mt-0.5">
                รวมทั้งหมด: {summaryKPI.total} คาบ | เช็คชื่อแล้ว: {summaryKPI.checked} คาบ | ยังไม่เช็คชื่อ:{' '}
                {summaryKPI.unchecked} คาบ ({summaryKPI.percent}%)
              </p>
            </div>
          </div>

          {/* Screen Section Title */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span>
                  ตารางรายงาน: {statusFilterLabel}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    statusFilter === 'checked'
                      ? 'bg-emerald-100 text-emerald-800'
                      : statusFilter === 'unchecked'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {displayedRows.length} รายการ
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedTeacherLabel} • {formatThaiFullDate(selectedDate)}
              </p>
            </div>
          </div>

          {/* TABLE 1: เช็คชื่อแล้ว (Checked Table) */}
          {statusFilter === 'checked' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-50/70 border-y border-emerald-200 text-emerald-900 font-bold text-[11px] print:bg-slate-100 print:text-black">
                    <th className="py-3 px-3 text-center w-12 border-r border-emerald-200 print:border-slate-800">
                      ลำดับ
                    </th>
                    <th className="py-3 px-3 border-r border-emerald-200 print:border-slate-800 min-w-[150px]">
                      ครูผู้สอน
                    </th>
                    <th className="py-3 px-3 border-r border-emerald-200 print:border-slate-800 min-w-[125px]">
                      คาบสอน / เวลา
                    </th>
                    <th className="py-3 px-3 border-r border-emerald-200 print:border-slate-800 min-w-[175px]">
                      รายวิชา / ชั้นเรียน
                    </th>
                    <th className="py-3 px-2 text-center w-14 border-r border-emerald-200 print:border-slate-800">
                      มา
                    </th>
                    <th className="py-3 px-2 text-center w-14 border-r border-emerald-200 print:border-slate-800">
                      ขาด
                    </th>
                    <th className="py-3 px-2 text-center w-14 border-r border-emerald-200 print:border-slate-800">
                      สาย
                    </th>
                    <th className="py-3 px-2 text-center w-14 border-r border-emerald-200 print:border-slate-800">
                      ป่วย
                    </th>
                    <th className="py-3 px-2 text-center w-14 border-r border-emerald-200 print:border-slate-800">
                      กิจ
                    </th>
                    <th className="py-3 px-2 text-center w-14 border-r border-emerald-200 print:border-slate-800">
                      รวม
                    </th>
                    <th className="py-3 px-3 text-center w-24 border-r border-emerald-200 print:border-slate-800">
                      เวลาบันทึก
                    </th>
                    <th className="py-3 px-3 text-center w-20 no-print">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                  {checkedRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600 text-sm">
                          ยังไม่มีรายการเช็คชื่อในวันที่เลือก
                        </p>
                      </td>
                    </tr>
                  ) : (
                    checkedRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-emerald-50/30 bg-white">
                        <td className="py-3 px-3 text-center font-bold text-slate-600 border-r border-slate-100 print:border-slate-800">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                          <div className="font-bold text-slate-800">{row.responsibleTeacherName}</div>
                          {row.isSubstituted && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                              สอนแทน {row.teacherName}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                          <div className="font-semibold text-slate-800">{row.periodName}</div>
                          <div className="text-[10px] text-slate-500">{row.periodTime}</div>
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                          <div className="font-bold text-slate-800">
                            {row.subjectCode} {row.subjectName}
                          </div>
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-[#0C7C82] bg-teal-50 px-2 py-0.5 rounded-full">
                            {row.className}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-emerald-700 border-r border-slate-100 print:border-slate-800">
                          {row.present}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-red-600 border-r border-slate-100 print:border-slate-800">
                          {row.absent}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-amber-600 border-r border-slate-100 print:border-slate-800">
                          {row.late}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-sky-600 border-r border-slate-100 print:border-slate-800">
                          {row.sick}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-orange-600 border-r border-slate-100 print:border-slate-800">
                          {row.leave}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-slate-800 border-r border-slate-100 print:border-slate-800">
                          {row.total}
                        </td>
                        <td className="py-3 px-3 text-center text-[11px] font-medium text-slate-600 border-r border-slate-100 print:border-slate-800">
                          {row.checkedTimeText}
                        </td>
                        <td className="py-3 px-3 text-center no-print">
                          <button
                            type="button"
                            onClick={() => setViewingRow(row)}
                            className="p-1.5 rounded-xl text-[#0C7C82] hover:bg-teal-50 cursor-pointer"
                            title="ดูรายชื่อนักเรียนที่เช็คชื่อ"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TABLE 2: ยังไม่เช็คชื่อ (Unchecked Table) */}
          {statusFilter === 'unchecked' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-red-50/70 border-y border-red-200 text-red-900 font-bold text-[11px] print:bg-slate-100 print:text-black">
                    <th className="py-3 px-3 text-center w-12 border-r border-red-200 print:border-slate-800">
                      ลำดับ
                    </th>
                    <th className="py-3 px-3 border-r border-red-200 print:border-slate-800 min-w-[160px]">
                      ครูผู้รับผิดชอบการสอน
                    </th>
                    <th className="py-3 px-3 border-r border-red-200 print:border-slate-800 min-w-[130px]">
                      คาบสอน / เวลา
                    </th>
                    <th className="py-3 px-3 border-r border-red-200 print:border-slate-800 min-w-[190px]">
                      รายวิชา
                    </th>
                    <th className="py-3 px-3 text-center w-28 border-r border-red-200 print:border-slate-800">
                      ชั้นเรียน
                    </th>
                    <th className="py-3 px-3 text-center w-28 border-r border-red-200 print:border-slate-800">
                      นักเรียน (คน)
                    </th>
                    <th className="py-3 px-3 text-center w-32 border-r border-red-200 print:border-slate-800">
                      สถานะ
                    </th>
                    <th className="py-3 px-3 min-w-[140px] print:border-slate-800">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                  {uncheckedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                        <p className="font-semibold text-emerald-700 text-sm">
                          ยอดเยี่ยม! ไม่มีรายการที่ยังไม่เช็คชื่อในวันที่เลือก
                        </p>
                      </td>
                    </tr>
                  ) : (
                    uncheckedRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-red-50/30 bg-white">
                        <td className="py-3 px-3 text-center font-bold text-slate-600 border-r border-slate-100 print:border-slate-800">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                          <div className="font-bold text-slate-800">{row.responsibleTeacherName}</div>
                          {row.isSubstituted && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                              สอนแทน {row.teacherName}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                          <div className="font-semibold text-slate-800">{row.periodName}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 no-print" />
                            <span>{row.periodTime}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800 border-r border-slate-100 print:border-slate-800">
                          {row.subjectCode} {row.subjectName}
                        </td>
                        <td className="py-3 px-3 text-center border-r border-slate-100 print:border-slate-800">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-[#0C7C82]">
                            {row.className}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700 border-r border-slate-100 print:border-slate-800">
                          {row.classStudentCount}
                        </td>
                        <td className="py-3 px-3 text-center border-r border-slate-100 print:border-slate-800">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 print:bg-transparent print:text-black">
                            <AlertCircle className="w-3 h-3 no-print" />
                            <span>ยังไม่เช็คชื่อ</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-500 print:border-slate-800">
                          {row.isSubstituted
                            ? `มอบหมาย ${row.responsibleTeacherName} สอนแทน`
                            : 'รอครูผู้สอนบันทึกการเช็คชื่อ'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TABLE 3: รวมทั้งหมด (All Combined Table) */}
          {statusFilter === 'all' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-[11px] print:bg-slate-100 print:text-black">
                    <th className="py-3 px-3 text-center w-12 border-r border-slate-200 print:border-slate-800">
                      ลำดับ
                    </th>
                    <th className="py-3 px-3 text-center w-28 border-r border-slate-200 print:border-slate-800">
                      สถานะ
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[150px]">
                      ครูผู้สอน
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[125px]">
                      คาบสอน / เวลา
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[175px]">
                      รายวิชา / ชั้นเรียน
                    </th>
                    <th className="py-3 px-2 text-center w-12 text-emerald-700 border-r border-slate-200 print:border-slate-800">
                      มา
                    </th>
                    <th className="py-3 px-2 text-center w-12 text-red-600 border-r border-slate-200 print:border-slate-800">
                      ขาด
                    </th>
                    <th className="py-3 px-2 text-center w-12 text-amber-600 border-r border-slate-200 print:border-slate-800">
                      สาย
                    </th>
                    <th className="py-3 px-2 text-center w-12 text-sky-600 border-r border-slate-200 print:border-slate-800">
                      ป่วย
                    </th>
                    <th className="py-3 px-2 text-center w-12 text-orange-600 border-r border-slate-200 print:border-slate-800">
                      กิจ
                    </th>
                    <th className="py-3 px-3 text-center w-24 border-r border-slate-200 print:border-slate-800">
                      เวลาบันทึก
                    </th>
                    <th className="py-3 px-3 text-center w-20 no-print">ดูข้อมูล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                  {teacherScopedRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400">
                        <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600 text-sm">
                          ไม่พบตารางสอนตามเงื่อนไขในวันที่เลือก
                        </p>
                      </td>
                    </tr>
                  ) : (
                    teacherScopedRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          row.isChecked ? 'bg-white hover:bg-slate-50/70' : 'bg-red-50/30 hover:bg-red-50/60'
                        }`}
                      >
                        <td className="py-3 px-3 text-center font-bold text-slate-600 border-r border-slate-100 print:border-slate-800">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 text-center border-r border-slate-100 print:border-slate-800">
                          {row.isChecked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 print:bg-transparent print:text-black">
                              <CheckCircle2 className="w-3 h-3 no-print" />
                              <span>เช็คชื่อแล้ว</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 print:bg-transparent print:text-black">
                              <XCircle className="w-3 h-3 no-print" />
                              <span>ยังไม่เช็คชื่อ</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                          <div className="font-bold text-slate-800">{row.responsibleTeacherName}</div>
                          {row.isSubstituted && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                              สอนแทน {row.teacherName}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                          <div className="font-semibold text-slate-800">{row.periodName}</div>
                          <div className="text-[10px] text-slate-500">{row.periodTime}</div>
                        </td>
                        <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                          <div className="font-bold text-slate-800">
                            {row.subjectCode} {row.subjectName}
                          </div>
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-[#0C7C82] bg-teal-50 px-2 py-0.5 rounded-full">
                            {row.className}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-emerald-700 border-r border-slate-100 print:border-slate-800">
                          {row.isChecked ? row.present : '-'}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-red-600 border-r border-slate-100 print:border-slate-800">
                          {row.isChecked ? row.absent : '-'}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-amber-600 border-r border-slate-100 print:border-slate-800">
                          {row.isChecked ? row.late : '-'}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-sky-600 border-r border-slate-100 print:border-slate-800">
                          {row.isChecked ? row.sick : '-'}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-orange-600 border-r border-slate-100 print:border-slate-800">
                          {row.isChecked ? row.leave : '-'}
                        </td>
                        <td className="py-3 px-3 text-center text-[11px] font-medium text-slate-600 border-r border-slate-100 print:border-slate-800">
                          {row.isChecked ? row.checkedTimeText : '-'}
                        </td>
                        <td className="py-3 px-3 text-center no-print">
                          {row.isChecked && row.log ? (
                            <button
                              type="button"
                              onClick={() => setViewingRow(row)}
                              className="p-1.5 rounded-xl text-[#0C7C82] hover:bg-teal-50 cursor-pointer"
                              title="ดูรายชื่อนักเรียน"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Print Only Signature Footer */}
          <div className="hidden print:block pt-10 px-4 pb-4 text-center text-xs text-slate-800 print:break-inside-avoid">
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-4">
                <p className="leading-relaxed">ลงชื่อ........................................................</p>
                <p className="font-semibold">(........................................................)</p>
                <p className="text-[11px] text-slate-600">ผู้รายงาน / ผู้ดูแลระบบ</p>
                <p className="text-[10px] text-slate-500">
                  วันที่ ...... เดือน ..................... พ.ศ. ...........
                </p>
              </div>
              <div className="space-y-4">
                <p className="leading-relaxed">ลงชื่อ........................................................</p>
                <p className="font-semibold">(........................................................)</p>
                <p className="text-[11px] text-slate-600">หัวหน้าฝ่ายวิชาการ</p>
                <p className="text-[10px] text-slate-500">
                  วันที่ ...... เดือน ..................... พ.ศ. ...........
                </p>
              </div>
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
      )}

      {/* Detail Modal for Checked Row */}
      {viewingRow && viewingRow.log && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  รายละเอียดการเช็คชื่อ: {viewingRow.subjectCode} {viewingRow.subjectName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ครูผู้สอน: <strong>{viewingRow.responsibleTeacherName}</strong> • ชั้น{' '}
                  <strong>{viewingRow.className}</strong> • {viewingRow.periodName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingRow(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex justify-around text-xs font-bold text-center">
              <div>
                <div className="text-emerald-600 text-base">{viewingRow.present}</div>
                <div className="text-slate-500 text-[10px]">มาเรียน</div>
              </div>
              <div>
                <div className="text-red-600 text-base">{viewingRow.absent}</div>
                <div className="text-slate-500 text-[10px]">ขาด</div>
              </div>
              <div>
                <div className="text-amber-600 text-base">{viewingRow.late}</div>
                <div className="text-slate-500 text-[10px]">สาย</div>
              </div>
              <div>
                <div className="text-sky-600 text-base">{viewingRow.sick}</div>
                <div className="text-slate-500 text-[10px]">ป่วย</div>
              </div>
              <div>
                <div className="text-orange-600 text-base">{viewingRow.leave}</div>
                <div className="text-slate-500 text-[10px]">กิจ</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {viewingRow.log.records.map((r, i) => (
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
                onClick={() => setViewingRow(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
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
