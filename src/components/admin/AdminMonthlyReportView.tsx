import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarRange,
  CheckCircle2,
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
  Period,
  SchoolCalendarEntry,
  Student,
  SystemSettings,
  TeachingAssignment
} from '../../types';
import {
  formatThaiFullDate,
  formatToThaiBE,
  getAcademicYearMonths,
  getTodayISODate,
  resolveCalendarDateStatus,
  YearMonthOption
} from '../../utils/thaiDate';
import { exportToExcel } from '../../utils/excel';

type MonthlyStatusFilter = 'all' | 'checked' | 'unchecked';
type MonthlyViewTab = 'by_teacher' | 'by_date' | 'detail_slots';

interface AdminMonthlyReportViewProps {
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

interface MonthlySlotRecord {
  key: string;
  date: string;
  dayOfWeek: string;
  isOpenedNormal: boolean;
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

export const AdminMonthlyReportView: React.FC<AdminMonthlyReportViewProps> = ({
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
  const monthOptions = useMemo<YearMonthOption[]>(
    () => getAcademicYearMonths(activeYear),
    [activeYear]
  );

  const initialMonthKey = useMemo(() => {
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const found = monthOptions.find((m) => m.key === curKey);
    return found ? found.key : monthOptions[0]?.key || curKey;
  }, [monthOptions]);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(initialMonthKey);
  const [selectedTeacherUsername, setSelectedTeacherUsername] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<MonthlyStatusFilter>('all');
  const [viewTab, setViewTab] = useState<MonthlyViewTab>('by_teacher');
  const [onlyUpToToday, setOnlyUpToToday] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewingSlot, setViewingSlot] = useState<MonthlySlotRecord | null>(null);

  const todayISODate = getTodayISODate();

  const selectedMonthOption = useMemo(
    () => monthOptions.find((m) => m.key === selectedMonthKey) || monthOptions[0],
    [monthOptions, selectedMonthKey]
  );

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

  // All open teaching dates in the selected month (excluding holidays/weekends unless opened normal)
  const openSchoolDates = useMemo(() => {
    if (!selectedMonthOption) return [];
    const { year, monthIndex } = selectedMonthOption;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const result: {
      date: string;
      dayOfWeek: string;
      isOpenedNormal: boolean;
    }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (onlyUpToToday && dateStr > todayISODate) continue;

      const calStatus = resolveCalendarDateStatus(dateStr, calendarEntries);
      if (calStatus.isHoliday || !calStatus.effectiveDayOfWeek) continue;

      result.push({
        date: dateStr,
        dayOfWeek: calStatus.effectiveDayOfWeek,
        isOpenedNormal: calStatus.isOpenedNormal
      });
    }
    return result;
  }, [selectedMonthOption, onlyUpToToday, todayISODate, calendarEntries]);

  // Roll up daily evaluation across every open school date in the month
  const allMonthSlots = useMemo<MonthlySlotRecord[]>(() => {
    if (openSchoolDates.length === 0) return [];

    // Pre-index attendance logs by date
    const logsByDate = new Map<string, AttendanceLog[]>();
    attendanceLogs.forEach((l) => {
      if (!l.date.startsWith(selectedMonthKey)) return;
      if (!logsByDate.has(l.date)) logsByDate.set(l.date, []);
      logsByDate.get(l.date)!.push(l);
    });

    const records: MonthlySlotRecord[] = [];

    openSchoolDates.forEach(({ date, dayOfWeek, isOpenedNormal }) => {
      const dayLogs = logsByDate.get(date) || [];
      const dayAssignments = assignments.filter((a) => a.dayOfWeek === dayOfWeek);

      dayAssignments.forEach((a) => {
        const startP = periods.find((p) => p.id === a.periodId);
        const endP = a.endPeriodId ? periods.find((p) => p.id === a.endPeriodId) : startP;
        const periodOrder = startP?.order ?? 999;
        const periodTime = startP ? `${startP.startTime} - ${endP?.endTime || startP.endTime} น.` : '';
        const periodName = a.periodName || startP?.name || '-';

        const isSub =
          Boolean(a.substituteTeacherUsername) &&
          (!a.substituteDate || a.substituteDate === date);
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

        records.push({
          key: `${date}__${a.id}`,
          date,
          dayOfWeek,
          isOpenedNormal,
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
        });
      });
    });

    return records.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.periodOrder !== b.periodOrder) return a.periodOrder - b.periodOrder;
      return a.responsibleTeacherName.localeCompare(b.responsibleTeacherName, 'th');
    });
  }, [
    openSchoolDates,
    attendanceLogs,
    selectedMonthKey,
    assignments,
    periods,
    students,
    teacherNameMap
  ]);

  // Teacher-scoped + search-filtered slots (before status split)
  const teacherScopedSlots = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allMonthSlots.filter((slot) => {
      if (selectedTeacherUsername !== 'ALL') {
        const matchesTeacher =
          slot.responsibleTeacherUsername === selectedTeacherUsername ||
          slot.teacherUsername === selectedTeacherUsername;
        if (!matchesTeacher) return false;
      }
      if (q) {
        const match =
          slot.responsibleTeacherName.toLowerCase().includes(q) ||
          slot.teacherName.toLowerCase().includes(q) ||
          slot.subjectCode.toLowerCase().includes(q) ||
          slot.subjectName.toLowerCase().includes(q) ||
          slot.className.toLowerCase().includes(q) ||
          slot.periodName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allMonthSlots, selectedTeacherUsername, searchTerm]);

  // Slots filtered by status dropdown (รวมทั้งหมด / เช็คชื่อแล้ว / ยังไม่เช็คชื่อ)
  const filteredSlots = useMemo(() => {
    if (statusFilter === 'checked') return teacherScopedSlots.filter((s) => s.isChecked);
    if (statusFilter === 'unchecked') return teacherScopedSlots.filter((s) => !s.isChecked);
    return teacherScopedSlots;
  }, [teacherScopedSlots, statusFilter]);

  // Aggregation 1: Per-teacher monthly summary (from daily evaluation data)
  const teacherMonthlySummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        username: string;
        fullName: string;
        activeDates: Set<string>;
        totalPeriods: number;
        checkedPeriods: number;
        uncheckedPeriods: number;
        present: number;
        absent: number;
        late: number;
        sick: number;
        leave: number;
        percent: number;
      }
    >();

    // Seed all teachers if viewing ALL and no search
    if (selectedTeacherUsername === 'ALL' && !searchTerm.trim()) {
      sortedTeachers.forEach((t) => {
        map.set(t.username, {
          username: t.username,
          fullName: t.fullName,
          activeDates: new Set<string>(),
          totalPeriods: 0,
          checkedPeriods: 0,
          uncheckedPeriods: 0,
          present: 0,
          absent: 0,
          late: 0,
          sick: 0,
          leave: 0,
          percent: 0
        });
      });
    }

    teacherScopedSlots.forEach((s) => {
      if (!map.has(s.responsibleTeacherUsername)) {
        map.set(s.responsibleTeacherUsername, {
          username: s.responsibleTeacherUsername,
          fullName: s.responsibleTeacherName,
          activeDates: new Set<string>(),
          totalPeriods: 0,
          checkedPeriods: 0,
          uncheckedPeriods: 0,
          present: 0,
          absent: 0,
          late: 0,
          sick: 0,
          leave: 0,
          percent: 0
        });
      }
      const entry = map.get(s.responsibleTeacherUsername)!;
      entry.activeDates.add(s.date);
      entry.totalPeriods += 1;
      if (s.isChecked) {
        entry.checkedPeriods += 1;
        entry.present += s.present;
        entry.absent += s.absent;
        entry.late += s.late;
        entry.sick += s.sick;
        entry.leave += s.leave;
      } else {
        entry.uncheckedPeriods += 1;
      }
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        daysCount: item.activeDates.size,
        percent:
          item.totalPeriods > 0 ? Math.round((item.checkedPeriods / item.totalPeriods) * 100) : 0
      }))
      .filter((item) => {
        if (statusFilter === 'checked') return item.checkedPeriods > 0;
        if (statusFilter === 'unchecked') return item.uncheckedPeriods > 0;
        return item.totalPeriods > 0 || selectedTeacherUsername === 'ALL';
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'th'));
  }, [teacherScopedSlots, sortedTeachers, selectedTeacherUsername, searchTerm, statusFilter]);

  // Aggregation 2: Day-by-day summary across the month (from daily evaluation data)
  const dailySummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        dayOfWeek: string;
        isOpenedNormal: boolean;
        totalPeriods: number;
        checkedPeriods: number;
        uncheckedPeriods: number;
        present: number;
        absent: number;
        late: number;
        sick: number;
        leave: number;
        percent: number;
      }
    >();

    openSchoolDates.forEach((d) => {
      map.set(d.date, {
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        isOpenedNormal: d.isOpenedNormal,
        totalPeriods: 0,
        checkedPeriods: 0,
        uncheckedPeriods: 0,
        present: 0,
        absent: 0,
        late: 0,
        sick: 0,
        leave: 0,
        percent: 0
      });
    });

    teacherScopedSlots.forEach((s) => {
      const entry = map.get(s.date);
      if (!entry) return;
      entry.totalPeriods += 1;
      if (s.isChecked) {
        entry.checkedPeriods += 1;
        entry.present += s.present;
        entry.absent += s.absent;
        entry.late += s.late;
        entry.sick += s.sick;
        entry.leave += s.leave;
      } else {
        entry.uncheckedPeriods += 1;
      }
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percent:
          item.totalPeriods > 0 ? Math.round((item.checkedPeriods / item.totalPeriods) * 100) : 0
      }))
      .filter((item) => {
        if (item.totalPeriods === 0) return false;
        if (statusFilter === 'checked') return item.checkedPeriods > 0;
        if (statusFilter === 'unchecked') return item.uncheckedPeriods > 0;
        return true;
      });
  }, [openSchoolDates, teacherScopedSlots, statusFilter]);

  // Overall Monthly KPIs
  const monthlyKPI = useMemo(() => {
    const totalPeriods = teacherScopedSlots.length;
    const checkedPeriods = teacherScopedSlots.filter((s) => s.isChecked).length;
    const uncheckedPeriods = totalPeriods - checkedPeriods;
    const percent = totalPeriods > 0 ? Math.round((checkedPeriods / totalPeriods) * 100) : 0;
    const totalPresent = teacherScopedSlots
      .filter((s) => s.isChecked)
      .reduce((acc, s) => acc + s.present, 0);
    return {
      openDaysCount: openSchoolDates.length,
      totalPeriods,
      checkedPeriods,
      uncheckedPeriods,
      percent,
      totalPresent
    };
  }, [teacherScopedSlots, openSchoolDates.length]);

  const changeMonthByOffset = (offset: number) => {
    const idx = monthOptions.findIndex((m) => m.key === selectedMonthKey);
    if (idx === -1) return;
    const nextIdx = idx + offset;
    if (nextIdx >= 0 && nextIdx < monthOptions.length) {
      setSelectedMonthKey(monthOptions[nextIdx].key);
    }
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

  const selectedTeacherLabel =
    selectedTeacherUsername === 'ALL'
      ? 'ครูทุกคน (ทั้งหมด)'
      : getTeacherName(selectedTeacherUsername);

  const handleExportExcel = () => {
    if (viewTab === 'by_teacher') {
      const rows = teacherMonthlySummaries.map((t, idx) => ({
        'ลำดับ': idx + 1,
        'ครูผู้สอน': t.fullName,
        'จำนวนวันสอนในเดือน': t.daysCount,
        'คาบตามตารางทั้งหมด': t.totalPeriods,
        'เช็คชื่อแล้ว (คาบ)': t.checkedPeriods,
        'ยังไม่เช็คชื่อ (คาบ)': t.uncheckedPeriods,
        'ร้อยละการเช็คชื่อ (%)': `${t.percent}%`,
        'มาเรียนรวม': t.present,
        'ขาดรวม': t.absent,
        'สายรวม': t.late,
        'ป่วยรวม': t.sick,
        'กิจรวม': t.leave
      }));
      exportToExcel(
        rows,
        `รายงานรายเดือน_สรุปรายครู_${selectedMonthOption?.label || selectedMonthKey}`,
        'สรุปรายครู'
      );
    } else if (viewTab === 'by_date') {
      const rows = dailySummaries.map((d, idx) => ({
        'ลำดับ': idx + 1,
        'วันที่': formatToThaiBE(d.date),
        'วัน': `วัน${d.dayOfWeek}${d.isOpenedNormal ? ' (เปิดสอนปกติ)' : ''}`,
        'คาบทั้งหมด': d.totalPeriods,
        'เช็คชื่อแล้ว': d.checkedPeriods,
        'ยังไม่เช็คชื่อ': d.uncheckedPeriods,
        'ร้อยละความครบถ้วน': `${d.percent}%`,
        'มาเรียน': d.present,
        'ขาด': d.absent,
        'สาย': d.late,
        'ป่วย': d.sick,
        'กิจ': d.leave
      }));
      exportToExcel(
        rows,
        `รายงานรายเดือน_สรุปรายวัน_${selectedMonthOption?.label || selectedMonthKey}`,
        'สรุปรายวัน'
      );
    } else {
      const rows = filteredSlots.map((s, idx) => ({
        'ลำดับ': idx + 1,
        'วันที่': formatToThaiBE(s.date),
        'สถานะ': s.isChecked ? 'เช็คชื่อแล้ว' : 'ยังไม่เช็คชื่อ',
        'ครูผู้สอน': s.isSubstituted
          ? `${s.responsibleTeacherName} (สอนแทน ${s.teacherName})`
          : s.responsibleTeacherName,
        'คาบสอน': s.periodName,
        'รายวิชา': `${s.subjectCode} ${s.subjectName}`,
        'ชั้นเรียน': s.className,
        'มาเรียน': s.isChecked ? s.present : '-',
        'ขาด': s.isChecked ? s.absent : '-',
        'สาย': s.isChecked ? s.late : '-',
        'ป่วย': s.isChecked ? s.sick : '-',
        'กิจ': s.isChecked ? s.leave : '-',
        'เวลาบันทึก': s.isChecked ? s.checkedTimeText : '-'
      }));
      exportToExcel(
        rows,
        `รายงานรายเดือน_รายละเอียดคาบ_${selectedMonthOption?.label || selectedMonthKey}`,
        'รายละเอียดรายคาบ'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls (No Print) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs no-print space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8E24AA] to-[#0C7C82] flex items-center justify-center text-white shadow-md shadow-[#8E24AA]/20 shrink-0">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                  ผู้ดูแลระบบ
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Monthly Teacher Attendance Summary
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-0.5">
                รายงานการเช็คชื่อรายเดือน (สรุปจากรายงานรายวัน)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                ประมวลผลข้อมูลจากรายงานการเช็คชื่อรายวันของครูตลอดทั้งเดือน แยกดูรายครู รายวัน และรายละเอียดรายคาบ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-xs shadow-2xs transition-all cursor-pointer"
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
              <span>พิมพ์ PDF (window.print())</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          {/* Month Picker (4 cols) */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">เลือกเดือน</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => changeMonthByOffset(-1)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => changeMonthByOffset(1)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="เดือนถัดไป"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Teacher Dropdown (ทั้งหมด / รายบุคคล) (3 cols) */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              ครูผู้สอน (ทั้งหมด / รายบุคคล)
            </label>
            <select
              value={selectedTeacherUsername}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTeacherUsername(val);
                if (val !== 'ALL' && viewTab === 'by_teacher') {
                  setViewTab('by_date');
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
            >
              <option value="ALL">ทั้งหมด (ครูทุกคน • {sortedTeachers.length} ท่าน)</option>
              {sortedTeachers.map((t) => (
                <option key={t.id} value={t.username}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown List (3 cols) */}
          <div className="lg:col-span-3 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              สถานะการเช็คชื่อ (Dropdown List)
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MonthlyStatusFilter)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
            >
              <option value="all">รวมทั้งหมด ({monthlyKPI.totalPeriods} คาบ)</option>
              <option value="checked">เช็คชื่อแล้ว ({monthlyKPI.checkedPeriods} คาบ)</option>
              <option value="unchecked">ยังไม่เช็คชื่อ ({monthlyKPI.uncheckedPeriods} คาบ)</option>
            </select>
          </div>

          {/* Search (2 cols) */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">ค้นหา</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ครู / วิชา / ห้อง..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
              />
            </div>
          </div>
        </div>

        {/* Sub-options & View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyUpToToday}
              onChange={(e) => setOnlyUpToToday(e.target.checked)}
              className="w-4 h-4 rounded text-[#0C7C82] focus:ring-[#0C7C82] border-slate-300 cursor-pointer"
            />
            <span>ประมวลผลถึงวันที่ปัจจุบัน ({formatToThaiBE(todayISODate)}) ไม่นับวันที่ยังไม่ถึง</span>
          </label>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
            <button
              type="button"
              onClick={() => setViewTab('by_teacher')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewTab === 'by_teacher'
                  ? 'bg-white text-[#0C7C82] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>สรุปรายครู</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab('by_date')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewTab === 'by_date'
                  ? 'bg-white text-[#0C7C82] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>สรุปรายวันในเดือน</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab('detail_slots')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewTab === 'detail_slots'
                  ? 'bg-white text-[#0C7C82] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>รายละเอียดรายคาบ</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-600">วันเปิดสอนที่ประมวลผล</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">
              {monthlyKPI.openDaysCount} <span className="text-xs font-medium text-slate-500">วัน</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
            }`}
          >
            <div className="text-[11px] font-bold opacity-80">คาบตามตารางรวม</div>
            <div className="text-2xl font-extrabold mt-1">
              {monthlyKPI.totalPeriods} <span className="text-xs font-medium opacity-75">คาบ</span>
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
              <span className="text-[11px] font-bold opacity-90">เช็คชื่อแล้วรวม</span>
              <CheckCircle2 className="w-4 h-4 opacity-90" />
            </div>
            <div className="text-2xl font-extrabold mt-1">
              {monthlyKPI.checkedPeriods}{' '}
              <span className="text-xs font-semibold opacity-85">({monthlyKPI.percent}%)</span>
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
              <span className="text-[11px] font-bold opacity-90">ยังไม่เช็คชื่อรวม</span>
              <XCircle className="w-4 h-4 opacity-90" />
            </div>
            <div className="text-2xl font-extrabold mt-1">
              {monthlyKPI.uncheckedPeriods} <span className="text-xs font-medium opacity-80">คาบ</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Report Table Container (Screen + Printable) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Official Print Header */}
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
              รายงานสรุปการเช็คชื่อรายเดือนของครู ({statusFilterLabel})
            </h2>
            <p className="text-xs text-slate-800 mt-0.5">
              ประจำเดือน: <strong>{selectedMonthOption?.label}</strong> | ผู้สอน:{' '}
              <strong>{selectedTeacherLabel}</strong> | ปีการศึกษา:{' '}
              <strong>{activeYear?.name || '2569'}</strong>
            </p>
            <p className="text-[11px] text-slate-700 mt-0.5">
              วันเปิดสอน: {monthlyKPI.openDaysCount} วัน | คาบรวม: {monthlyKPI.totalPeriods} คาบ |
              เช็คชื่อแล้ว: {monthlyKPI.checkedPeriods} คาบ ({monthlyKPI.percent}%) | ยังไม่เช็คชื่อ:{' '}
              {monthlyKPI.uncheckedPeriods} คาบ
            </p>
          </div>
        </div>

        {/* Screen Table Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 flex-wrap">
              <span>
                {viewTab === 'by_teacher'
                  ? 'ตารางสรุปการเช็คชื่อรายครู ประจำเดือน'
                  : viewTab === 'by_date'
                  ? 'ตารางสรุปการเช็คชื่อรายวัน ประจำเดือน'
                  : 'ตารางรายละเอียดรายคาบ ประจำเดือน'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800 font-bold">
                {selectedMonthOption?.label}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-bold">
                {statusFilterLabel}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedTeacherLabel} • ไม่รวมวันหยุดราชการและวันหยุดสุดสัปดาห์ (ยกเว้นวันที่เปิดสอนปกติ)
            </p>
          </div>
        </div>

        {/* VIEW 1: By Teacher Summary Table */}
        {viewTab === 'by_teacher' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-[11px] print:bg-slate-100 print:text-black">
                  <th className="py-3 px-3 text-center w-12 border-r border-slate-200 print:border-slate-800">
                    ลำดับ
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[170px]">
                    ครูผู้สอน
                  </th>
                  <th className="py-3 px-3 text-center w-20 border-r border-slate-200 print:border-slate-800">
                    วันสอน
                  </th>
                  <th className="py-3 px-3 text-center w-24 border-r border-slate-200 print:border-slate-800">
                    คาบรวม
                  </th>
                  <th className="py-3 px-3 text-center w-24 text-emerald-700 border-r border-slate-200 print:border-slate-800">
                    เช็คแล้ว
                  </th>
                  <th className="py-3 px-3 text-center w-24 text-red-600 border-r border-slate-200 print:border-slate-800">
                    ยังไม่เช็ค
                  </th>
                  <th className="py-3 px-3 text-center w-24 border-r border-slate-200 print:border-slate-800">
                    ร้อยละ (%)
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-emerald-700 border-r border-slate-200 print:border-slate-800">
                    มา
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-red-600 border-r border-slate-200 print:border-slate-800">
                    ขาด
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-amber-600 border-r border-slate-200 print:border-slate-800">
                    สาย
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-sky-600 border-r border-slate-200 print:border-slate-800">
                    ป่วย
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-orange-600 border-r border-slate-200 print:border-slate-800">
                    กิจ
                  </th>
                  <th className="py-3 px-3 text-center w-24 no-print">ดูรายวัน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                {teacherMonthlySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      <CalendarRange className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600 text-sm">
                        ไม่พบข้อมูลการเช็คชื่อในเดือน {selectedMonthOption?.label}
                      </p>
                    </td>
                  </tr>
                ) : (
                  teacherMonthlySummaries.map((row, idx) => (
                    <tr key={row.username} className="hover:bg-slate-50/70 bg-white">
                      <td className="py-3 px-3 text-center font-bold text-slate-600 border-r border-slate-100 print:border-slate-800">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800 border-r border-slate-100 print:border-slate-800">
                        {row.fullName}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600 border-r border-slate-100 print:border-slate-800">
                        {row.daysCount}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800 border-r border-slate-100 print:border-slate-800">
                        {row.totalPeriods}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-700 border-r border-slate-100 print:border-slate-800">
                        {row.checkedPeriods}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-red-600 border-r border-slate-100 print:border-slate-800">
                        {row.uncheckedPeriods > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 print:bg-transparent">
                            {row.uncheckedPeriods}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-bold border-r border-slate-100 print:border-slate-800">
                        <span
                          className={
                            row.percent === 100
                              ? 'text-emerald-700'
                              : row.percent >= 80
                              ? 'text-teal-700'
                              : 'text-amber-700'
                          }
                        >
                          {row.percent}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-emerald-700 border-r border-slate-100 print:border-slate-800">
                        {row.present}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-red-600 border-r border-slate-100 print:border-slate-800">
                        {row.absent}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-amber-600 border-r border-slate-100 print:border-slate-800">
                        {row.late}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-sky-600 border-r border-slate-100 print:border-slate-800">
                        {row.sick}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-orange-600 border-r border-slate-100 print:border-slate-800">
                        {row.leave}
                      </td>
                      <td className="py-3 px-3 text-center no-print">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTeacherUsername(row.username);
                            setViewTab('by_date');
                          }}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-teal-50 text-[#0C7C82] hover:bg-teal-100 cursor-pointer"
                        >
                          ดูรายวัน
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 2: By Date Summary Table (Daily Roll-up across the month) */}
        {viewTab === 'by_date' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-[11px] print:bg-slate-100 print:text-black">
                  <th className="py-3 px-3 text-center w-12 border-r border-slate-200 print:border-slate-800">
                    ลำดับ
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[140px]">
                    วันที่
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[120px]">
                    วัน / ตารางสอน
                  </th>
                  <th className="py-3 px-3 text-center w-24 border-r border-slate-200 print:border-slate-800">
                    คาบรวม
                  </th>
                  <th className="py-3 px-3 text-center w-24 text-emerald-700 border-r border-slate-200 print:border-slate-800">
                    เช็คแล้ว
                  </th>
                  <th className="py-3 px-3 text-center w-24 text-red-600 border-r border-slate-200 print:border-slate-800">
                    ยังไม่เช็ค
                  </th>
                  <th className="py-3 px-3 text-center w-24 border-r border-slate-200 print:border-slate-800">
                    ร้อยละ (%)
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-emerald-700 border-r border-slate-200 print:border-slate-800">
                    มา
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-red-600 border-r border-slate-200 print:border-slate-800">
                    ขาด
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-amber-600 border-r border-slate-200 print:border-slate-800">
                    สาย
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-sky-600 border-r border-slate-200 print:border-slate-800">
                    ป่วย
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-orange-600 print:border-slate-800">
                    กิจ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                {dailySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600 text-sm">
                        ไม่พบข้อมูลรายวันตามเงื่อนไขในเดือน {selectedMonthOption?.label}
                      </p>
                    </td>
                  </tr>
                ) : (
                  dailySummaries.map((d, idx) => (
                    <tr key={d.date} className="hover:bg-slate-50/70 bg-white">
                      <td className="py-3 px-3 text-center font-bold text-slate-600 border-r border-slate-100 print:border-slate-800">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800 border-r border-slate-100 print:border-slate-800">
                        {formatToThaiBE(d.date)}
                      </td>
                      <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                        <span className="font-semibold text-slate-700">วัน{d.dayOfWeek}</span>
                        {d.isOpenedNormal && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                            เปิดสอนปกติ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800 border-r border-slate-100 print:border-slate-800">
                        {d.totalPeriods}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-700 border-r border-slate-100 print:border-slate-800">
                        {d.checkedPeriods}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-red-600 border-r border-slate-100 print:border-slate-800">
                        {d.uncheckedPeriods}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800 border-r border-slate-100 print:border-slate-800">
                        {d.percent}%
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-emerald-700 border-r border-slate-100 print:border-slate-800">
                        {d.present}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-red-600 border-r border-slate-100 print:border-slate-800">
                        {d.absent}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-amber-600 border-r border-slate-100 print:border-slate-800">
                        {d.late}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-sky-600 border-r border-slate-100 print:border-slate-800">
                        {d.sick}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-orange-600 print:border-slate-800">
                        {d.leave}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 3: Detailed Slot-by-Slot Table */}
        {viewTab === 'detail_slots' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-[11px] print:bg-slate-100 print:text-black">
                  <th className="py-3 px-3 text-center w-12 border-r border-slate-200 print:border-slate-800">
                    ลำดับ
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[115px]">
                    วันที่
                  </th>
                  <th className="py-3 px-3 text-center w-28 border-r border-slate-200 print:border-slate-800">
                    สถานะ
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[145px]">
                    ครูผู้สอน
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[110px]">
                    คาบสอน
                  </th>
                  <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[170px]">
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
                  <th className="py-3 px-3 text-center w-20 no-print">ดูข้อมูล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                {filteredSlots.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600 text-sm">
                        ไม่พบรายการรายคาบตามเงื่อนไข
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSlots.map((slot, idx) => (
                    <tr
                      key={slot.key}
                      className={slot.isChecked ? 'bg-white hover:bg-slate-50/70' : 'bg-red-50/30'}
                    >
                      <td className="py-3 px-3 text-center font-bold text-slate-600 border-r border-slate-100 print:border-slate-800">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800 border-r border-slate-100 print:border-slate-800">
                        <div>{formatToThaiBE(slot.date)}</div>
                        <div className="text-[10px] text-slate-500">วัน{slot.dayOfWeek}</div>
                      </td>
                      <td className="py-3 px-3 text-center border-r border-slate-100 print:border-slate-800">
                        {slot.isChecked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 print:bg-transparent print:text-black">
                            เช็คชื่อแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 print:bg-transparent print:text-black">
                            ยังไม่เช็คชื่อ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                        <div className="font-bold text-slate-800">{slot.responsibleTeacherName}</div>
                        {slot.isSubstituted && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            สอนแทน {slot.teacherName}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                        <div className="font-semibold text-slate-800">{slot.periodName}</div>
                        <div className="text-[10px] text-slate-500">{slot.periodTime}</div>
                      </td>
                      <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                        <div className="font-bold text-slate-800">
                          {slot.subjectCode} {slot.subjectName}
                        </div>
                        <span className="text-[10px] font-bold text-[#0C7C82]">{slot.className}</span>
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-emerald-700 border-r border-slate-100 print:border-slate-800">
                        {slot.isChecked ? slot.present : '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-red-600 border-r border-slate-100 print:border-slate-800">
                        {slot.isChecked ? slot.absent : '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-amber-600 border-r border-slate-100 print:border-slate-800">
                        {slot.isChecked ? slot.late : '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-sky-600 border-r border-slate-100 print:border-slate-800">
                        {slot.isChecked ? slot.sick : '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-orange-600 border-r border-slate-100 print:border-slate-800">
                        {slot.isChecked ? slot.leave : '-'}
                      </td>
                      <td className="py-3 px-3 text-center no-print">
                        {slot.isChecked && slot.log ? (
                          <button
                            type="button"
                            onClick={() => setViewingSlot(slot)}
                            className="p-1.5 rounded-xl text-[#0C7C82] hover:bg-teal-50 cursor-pointer"
                            title="ดูรายละเอียดรายชื่อนักเรียน"
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

        {/* Print Only Signature Block */}
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

      {/* Detail Modal */}
      {viewingSlot && viewingSlot.log && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  รายละเอียดการเช็คชื่อ: {viewingSlot.subjectCode} {viewingSlot.subjectName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatThaiFullDate(viewingSlot.date)} • ครู:{' '}
                  <strong>{viewingSlot.responsibleTeacherName}</strong> • ชั้น{' '}
                  <strong>{viewingSlot.className}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingSlot(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex justify-around text-xs font-bold text-center">
              <div>
                <div className="text-emerald-600 text-base">{viewingSlot.present}</div>
                <div className="text-slate-500 text-[10px]">มาเรียน</div>
              </div>
              <div>
                <div className="text-red-600 text-base">{viewingSlot.absent}</div>
                <div className="text-slate-500 text-[10px]">ขาด</div>
              </div>
              <div>
                <div className="text-amber-600 text-base">{viewingSlot.late}</div>
                <div className="text-slate-500 text-[10px]">สาย</div>
              </div>
              <div>
                <div className="text-sky-600 text-base">{viewingSlot.sick}</div>
                <div className="text-slate-500 text-[10px]">ป่วย</div>
              </div>
              <div>
                <div className="text-orange-600 text-base">{viewingSlot.leave}</div>
                <div className="text-slate-500 text-[10px]">กิจ</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {viewingSlot.log.records.map((r, i) => (
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
                onClick={() => setViewingSlot(null)}
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
