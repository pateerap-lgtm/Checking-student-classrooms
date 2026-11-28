import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CalendarRange,
  CheckCircle2,
  Clock,
  FileDown,
  FileSpreadsheet,
  Printer,
  School,
  Search,
  Users,
  BookOpen
} from 'lucide-react';
import {
  AcademicYear,
  AppUser,
  AttendanceLog,
  Period,
  SchoolCalendarEntry,
  SubstitutionLog,
  SystemSettings,
  TeachingAssignment
} from '../../types';
import {
  formatThaiFullDate,
  formatToThaiBE,
  getAcademicYearMonths,
  resolveCalendarDateStatus,
  YearMonthOption
} from '../../utils/thaiDate';
import { exportToExcel } from '../../utils/excel';

interface SubstitutionMonthlyReportViewProps {
  substitutionLogs: SubstitutionLog[];
  assignments: TeachingAssignment[];
  attendanceLogs: AttendanceLog[];
  teachers: AppUser[];
  allUsers: AppUser[];
  periods: Period[];
  calendarEntries?: SchoolCalendarEntry[];
  settings: SystemSettings;
  activeYear?: AcademicYear;
  currentUserRole: 'admin' | 'teacher';
  currentUserUsername?: string;
  currentUserFullName: string;
}

interface MergedSubstitutionRecord {
  key: string;
  date: string;
  dayOfWeek: string;
  periodId: string;
  periodName: string;
  timeRange: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  teacherUsername: string;
  teacherName: string;
  substituteTeacherUsername: string;
  substituteTeacherName: string;
  attendanceLog?: AttendanceLog;
}

export const SubstitutionMonthlyReportView: React.FC<SubstitutionMonthlyReportViewProps> = ({
  substitutionLogs,
  assignments,
  attendanceLogs,
  teachers,
  allUsers,
  periods,
  calendarEntries = [],
  settings,
  activeYear,
  currentUserRole,
  currentUserUsername,
  currentUserFullName
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
  const [teacherFilterRole, setTeacherFilterRole] = useState<'both' | 'primary' | 'substitute'>('both');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const selectedMonthOption = useMemo(
    () => monthOptions.find((m) => m.key === selectedMonthKey) || monthOptions[0],
    [monthOptions, selectedMonthKey]
  );

  const teacherNameMap = useMemo(() => {
    const map = new Map<string, string>();
    teachers.forEach((t) => map.set(t.username, t.fullName));
    allUsers.forEach((u) => {
      if (!map.has(u.username)) map.set(u.username, u.fullName);
    });
    return map;
  }, [teachers, allUsers]);

  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => a.fullName.localeCompare(b.fullName, 'th')),
    [teachers]
  );

  const getTeacherDisplayName = (username?: string, fallbackName?: string) => {
    if (!username) return fallbackName || '-';
    return teacherNameMap.get(username) || fallbackName || username;
  };

  const getPeriodTimeRange = (periodId?: string, endPeriodId?: string) => {
    if (!periodId) return '';
    const startP = periods.find((p) => p.id === periodId);
    if (!startP) return '';
    const endP = endPeriodId ? periods.find((p) => p.id === endPeriodId) : startP;
    return `${startP.startTime} - ${endP?.endTime || startP.endTime} น.`;
  };

  const effectiveDirectorName = useMemo(() => {
    if (settings.directorName?.trim()) return settings.directorName.trim();
    const dir = allUsers.find((u) => u.role === 'director');
    return dir?.fullName?.trim() || 'ผู้อำนวยการสถานศึกษา';
  }, [settings.directorName, allUsers]);

  // Merge substitution records from substitutionLogs, active assignments, and historical attendanceLogs
  // and exclude holiday dates
  const monthlyAllRecords = useMemo<MergedSubstitutionRecord[]>(() => {
    if (!selectedMonthKey) return [];
    const map = new Map<string, MergedSubstitutionRecord>();

    const findAttendance = (
      date: string,
      classId: string,
      subjectId: string,
      subjectCode: string,
      periodId: string,
      subUsername: string
    ) => {
      return attendanceLogs.find(
        (att) =>
          att.date === date &&
          (att.classId === classId || !classId) &&
          (att.subjectId === subjectId || att.subjectCode === subjectCode) &&
          (att.periodId === periodId || !periodId) &&
          (att.teacherUsername === subUsername || att.substituteTeacherUsername === subUsername)
      );
    };

    const addIfValid = (item: Omit<MergedSubstitutionRecord, 'attendanceLog'>) => {
      if (!item.date || !item.date.startsWith(selectedMonthKey)) return;
      if (!item.substituteTeacherUsername) return;
      if (resolveCalendarDateStatus(item.date, calendarEntries).isHoliday) return;

      if (!map.has(item.key)) {
        map.set(item.key, {
          ...item,
          attendanceLog: findAttendance(
            item.date,
            item.classId,
            item.subjectId,
            item.subjectCode,
            item.periodId,
            item.substituteTeacherUsername
          )
        });
      }
    };

    // 1. Primary source: substitutionLogs
    substitutionLogs.forEach((log) => {
      const key = `${log.date}__${log.classId}__${log.subjectId || log.subjectCode}__${log.periodId}`;
      addIfValid({
        key,
        date: log.date,
        dayOfWeek: log.dayOfWeek,
        periodId: log.periodId,
        periodName: log.periodName,
        timeRange: getPeriodTimeRange(log.periodId, log.endPeriodId),
        classId: log.classId,
        className: log.className,
        subjectId: log.subjectId,
        subjectCode: log.subjectCode,
        subjectName: log.subjectName,
        teacherUsername: log.teacherUsername,
        teacherName: getTeacherDisplayName(log.teacherUsername, log.teacherName),
        substituteTeacherUsername: log.substituteTeacherUsername,
        substituteTeacherName: getTeacherDisplayName(
          log.substituteTeacherUsername,
          log.substituteTeacherName
        )
      });
    });

    // 2. Active assignments with substituteDate in selected month
    assignments.forEach((a) => {
      if (!a.substituteTeacherUsername || !a.substituteDate) return;
      const key = `${a.substituteDate}__${a.classId}__${a.subjectId || a.subjectCode}__${a.periodId}`;
      addIfValid({
        key,
        date: a.substituteDate,
        dayOfWeek: a.dayOfWeek,
        periodId: a.periodId,
        periodName: a.periodName,
        timeRange: getPeriodTimeRange(a.periodId, a.endPeriodId),
        classId: a.classId,
        className: a.className,
        subjectId: a.subjectId,
        subjectCode: a.subjectCode,
        subjectName: a.subjectName,
        teacherUsername: a.teacherUsername,
        teacherName: getTeacherDisplayName(a.teacherUsername, a.teacherName),
        substituteTeacherUsername: a.substituteTeacherUsername,
        substituteTeacherName: getTeacherDisplayName(a.substituteTeacherUsername)
      });
    });

    // 3. Historical attendanceLogs marked with substituteTeacherUsername
    attendanceLogs.forEach((att) => {
      if (!att.substituteTeacherUsername) return;
      const key = `${att.date}__${att.classId}__${att.subjectId || att.subjectCode}__${att.periodId}`;
      // Look up original assignment to identify primary owner if att.teacherUsername was recorded as substitute
      const matchingAssign = assignments.find(
        (a) =>
          (a.classId === att.classId || a.className === att.className) &&
          (a.subjectId === att.subjectId || a.subjectCode === att.subjectCode) &&
          (a.periodId === att.periodId || a.periodName === att.periodName)
      );
      const primaryUsername = matchingAssign?.teacherUsername || att.teacherUsername;
      const primaryName = getTeacherDisplayName(
        primaryUsername,
        matchingAssign?.teacherName || att.teacherName
      );
      addIfValid({
        key,
        date: att.date,
        dayOfWeek: att.dayOfWeek,
        periodId: att.periodId,
        periodName: att.periodName,
        timeRange: getPeriodTimeRange(att.periodId, matchingAssign?.endPeriodId),
        classId: att.classId,
        className: att.className,
        subjectId: att.subjectId,
        subjectCode: att.subjectCode,
        subjectName: att.subjectName,
        teacherUsername: primaryUsername,
        teacherName: primaryName,
        substituteTeacherUsername: att.substituteTeacherUsername,
        substituteTeacherName: getTeacherDisplayName(att.substituteTeacherUsername)
      });
    });

    const isTeacherScoped = currentUserRole === 'teacher' && Boolean(currentUserUsername);

    return Array.from(map.values())
      .filter((rec) => {
        if (!isTeacherScoped) return true;
        return (
          rec.teacherUsername === currentUserUsername ||
          rec.substituteTeacherUsername === currentUserUsername
        );
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const orderA = periods.find((p) => p.id === a.periodId)?.order || 0;
        const orderB = periods.find((p) => p.id === b.periodId)?.order || 0;
        return orderA - orderB;
      });
  }, [
    selectedMonthKey,
    substitutionLogs,
    assignments,
    attendanceLogs,
    calendarEntries,
    periods,
    teacherNameMap,
    currentUserRole,
    currentUserUsername
  ]);

  const isTeacherOwnMode = currentUserRole === 'teacher' && Boolean(currentUserUsername);

  // Filtered records based on teacher & search
  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return monthlyAllRecords.filter((rec) => {
      if (isTeacherOwnMode && currentUserUsername) {
        if (teacherFilterRole === 'primary' && rec.teacherUsername !== currentUserUsername) {
          return false;
        }
        if (
          teacherFilterRole === 'substitute' &&
          rec.substituteTeacherUsername !== currentUserUsername
        ) {
          return false;
        }
      } else if (selectedTeacherUsername !== 'ALL') {
        if (teacherFilterRole === 'primary' && rec.teacherUsername !== selectedTeacherUsername) {
          return false;
        }
        if (
          teacherFilterRole === 'substitute' &&
          rec.substituteTeacherUsername !== selectedTeacherUsername
        ) {
          return false;
        }
        if (
          teacherFilterRole === 'both' &&
          rec.teacherUsername !== selectedTeacherUsername &&
          rec.substituteTeacherUsername !== selectedTeacherUsername
        ) {
          return false;
        }
      }
      if (q) {
        const match =
          rec.subjectCode.toLowerCase().includes(q) ||
          rec.subjectName.toLowerCase().includes(q) ||
          rec.className.toLowerCase().includes(q) ||
          rec.teacherName.toLowerCase().includes(q) ||
          rec.substituteTeacherName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    monthlyAllRecords,
    isTeacherOwnMode,
    currentUserUsername,
    selectedTeacherUsername,
    teacherFilterRole,
    searchTerm
  ]);

  // Per-teacher monthly statistics
  const teacherSummaryRows = useMemo(() => {
    const statsMap = new Map<
      string,
      {
        username: string;
        fullName: string;
        delegatedOutCount: number;
        substitutedInCount: number;
        checkedInCount: number;
      }
    >();

    const ensure = (username: string, fallbackName?: string) => {
      if (!statsMap.has(username)) {
        statsMap.set(username, {
          username,
          fullName: getTeacherDisplayName(username, fallbackName),
          delegatedOutCount: 0,
          substitutedInCount: 0,
          checkedInCount: 0
        });
      }
      return statsMap.get(username)!;
    };

    filteredRecords.forEach((rec) => {
      const primary = ensure(rec.teacherUsername, rec.teacherName);
      primary.delegatedOutCount += 1;

      const sub = ensure(rec.substituteTeacherUsername, rec.substituteTeacherName);
      sub.substitutedInCount += 1;
      if (rec.attendanceLog) {
        sub.checkedInCount += 1;
      }
    });

    return Array.from(statsMap.values())
      .filter((row) => (!isTeacherOwnMode ? true : row.username === currentUserUsername))
      .sort(
        (a, b) =>
          b.substitutedInCount - a.substitutedInCount ||
          b.delegatedOutCount - a.delegatedOutCount ||
          a.fullName.localeCompare(b.fullName, 'th')
      );
  }, [filteredRecords, teacherNameMap, isTeacherOwnMode, currentUserUsername]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const total = filteredRecords.length;
    const primarySet = new Set(filteredRecords.map((r) => r.teacherUsername));
    const subSet = new Set(filteredRecords.map((r) => r.substituteTeacherUsername));
    const delegatedOutCount = isTeacherOwnMode
      ? filteredRecords.filter((r) => r.teacherUsername === currentUserUsername).length
      : primarySet.size;
    const substitutedInCount = isTeacherOwnMode
      ? filteredRecords.filter((r) => r.substituteTeacherUsername === currentUserUsername).length
      : subSet.size;
    const checkedCount = filteredRecords.filter((r) => Boolean(r.attendanceLog)).length;
    const checkRate = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

    return {
      total,
      primaryCount: delegatedOutCount,
      subCount: substitutedInCount,
      checkedCount,
      checkRate
    };
  }, [filteredRecords, isTeacherOwnMode, currentUserUsername]);

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

  const handleExportExcel = () => {
    const rows = filteredRecords.map((r, idx) => ({
      'ลำดับ': idx + 1,
      'วันที่สอนแทน': formatToThaiBE(r.date),
      'วันตามตาราง': `วัน${r.dayOfWeek}`,
      'คาบสอน': r.periodName,
      'เวลา': r.timeRange || '-',
      'รหัสวิชา': r.subjectCode,
      'ชื่อวิชา': r.subjectName,
      'ชั้นเรียน': r.className,
      'ครูเจ้าของวิชา': r.teacherName,
      'ครูผู้สอนแทน': r.substituteTeacherName,
      'สถานะเช็คชื่อ': r.attendanceLog
        ? `เช็คชื่อแล้ว (มา ${r.attendanceLog.summary.present}/${r.attendanceLog.summary.total})`
        : 'ยังไม่เช็คชื่อ'
    }));
    exportToExcel(
      rows,
      `รายงานการจัดสอนแทน_${selectedMonthOption?.label || selectedMonthKey}`,
      'รายงานการสอนแทน'
    );
  };

  return (
    <div className="space-y-6">
      {/* Screen Header & Controls (Hidden in Print) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs no-print space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E65100] to-[#FB8C00] flex items-center justify-center text-white shadow-md shadow-[#E65100]/20 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                  {currentUserRole === 'admin' ? 'ผู้ดูแลระบบ' : `ครูผู้สอน (${currentUserFullName})`}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Monthly Substitution Report
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-0.5">
                {isTeacherOwnMode ? 'รายงานการสอนแทนของตนเอง (รายเดือน)' : 'รายงานการสอนแทนรายเดือน'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isTeacherOwnMode
                  ? 'แสดงประวัติการสอนแทนเฉพาะรายวิชาที่ตนเองมอบหมายหรือเข้าสอนแทน พร้อมพิมพ์รายงาน PDF'
                  : 'สรุปรายการมอบหมายและการปฏิบัติหน้าที่สอนแทนประจำเดือน พร้อมตรวจสอบสถานะการเช็คชื่อและพิมพ์รายงาน PDF'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRecords.length === 0}
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
              <span>พิมพ์ PDF (window.print())</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          {/* Month Selector */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">เลือกเดือน</label>
            <div className="flex items-center gap-2">
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

          {/* Teacher Filter (All teachers for Admin; Role-only scope for Teacher) */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              {isTeacherOwnMode ? 'ประเภทการสอนแทนของตนเอง' : 'กรองตามครูผู้สอน'}
            </label>
            {isTeacherOwnMode ? (
              <select
                value={teacherFilterRole}
                onChange={(e) =>
                  setTeacherFilterRole(e.target.value as 'both' | 'primary' | 'substitute')
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
              >
                <option value="both">ทั้งหมดของตนเอง (ทั้งที่มอบหมายและที่ไปสอนแทน)</option>
                <option value="primary">คาบที่ฉันมอบหมายให้ผู้อื่นสอนแทน</option>
                <option value="substitute">คาบที่ฉันเข้าสอนแทนผู้อื่น</option>
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={selectedTeacherUsername}
                  onChange={(e) => setSelectedTeacherUsername(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
                >
                  <option value="ALL">-- ครูทุกคนในโรงเรียน --</option>
                  {sortedTeachers.map((t) => (
                    <option key={t.id} value={t.username}>
                      {t.fullName}
                    </option>
                  ))}
                </select>
                {selectedTeacherUsername !== 'ALL' && (
                  <select
                    value={teacherFilterRole}
                    onChange={(e) =>
                      setTeacherFilterRole(e.target.value as 'both' | 'primary' | 'substitute')
                    }
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
                  >
                    <option value="both">ทั้งสองบทบาท</option>
                    <option value="primary">เจ้าของวิชา</option>
                    <option value="substitute">ผู้สอนแทน</option>
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">ค้นหา</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อครู, รหัสวิชา, ชื่อวิชา, ชั้นเรียน..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
              />
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-orange-800">
                {isTeacherOwnMode ? 'รายการสอนแทนของฉัน' : 'จำนวนการจัดสอนแทน'}
              </span>
              <ArrowRightLeft className="w-4 h-4 text-[#E65100]" />
            </div>
            <div className="text-2xl font-extrabold text-orange-900 mt-1">
              {kpis.total} <span className="text-xs font-medium">ครั้ง</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-800">
                {isTeacherOwnMode ? 'มีผู้อื่นสอนแทนให้' : 'ครูเจ้าของวิชาที่มอบหมาย'}
              </span>
              <Users className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-extrabold text-rose-900 mt-1">
              {kpis.primaryCount}{' '}
              <span className="text-xs font-medium">{isTeacherOwnMode ? 'คาบ' : 'ท่าน'}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-teal-800">
                {isTeacherOwnMode ? 'เข้าสอนแทนผู้อื่น' : 'ครูที่เข้าสอนแทน'}
              </span>
              <Users className="w-4 h-4 text-[#0C7C82]" />
            </div>
            <div className="text-2xl font-extrabold text-teal-900 mt-1">
              {kpis.subCount}{' '}
              <span className="text-xs font-medium">{isTeacherOwnMode ? 'คาบ' : 'ท่าน'}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800">เช็คชื่อสอนแทนแล้ว</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-900 mt-1">
              {kpis.checkedCount}/{kpis.total}{' '}
              <span className="text-xs font-semibold">({kpis.checkRate}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Report Sheet Container */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Official Print Header (Visible only in Print / PDF) */}
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
              {isTeacherOwnMode
                ? 'แบบรายงานสรุปการสอนแทนรายบุคคลประจำเดือน'
                : 'แบบรายงานสรุปการจัดสอนแทนประจำเดือน'}
            </h2>
            <p className="text-xs text-slate-800 mt-0.5">
              ประจำเดือน: <strong>{selectedMonthOption?.label}</strong> | ปีการศึกษา:{' '}
              <strong>{activeYear?.name || '2569'}</strong>
              {(isTeacherOwnMode || selectedTeacherUsername !== 'ALL') && (
                <>
                  {' '}
                  | ครูผู้สอน:{' '}
                  <strong>
                    {isTeacherOwnMode
                      ? currentUserFullName
                      : getTeacherDisplayName(selectedTeacherUsername)}
                  </strong>
                </>
              )}
            </p>
            <p className="text-[11px] text-slate-700 mt-0.5">
              {isTeacherOwnMode
                ? `รวมรายการสอนแทนทั้งหมด ${kpis.total} คาบ (มีผู้สอนแทน ${kpis.primaryCount} คาบ | เข้าสอนแทน ${kpis.subCount} คาบ) | เช็คชื่อแล้ว ${kpis.checkedCount} คาบ (${kpis.checkRate}%)`
                : `รวมการจัดสอนแทนทั้งหมด ${kpis.total} คาบ | ครูที่เข้าสอนแทน ${kpis.subCount} ท่าน | เช็คชื่อแล้ว ${kpis.checkedCount} คาบ (${kpis.checkRate}%)`}
            </p>
          </div>
        </div>

        {/* Section 1: Detailed Monthly Substitution Log Table */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-[#E65100]" />
              <span>รายการจัดสอนแทนประจำเดือน {selectedMonthOption?.label}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงรายละเอียดวัน เวลา รายวิชา ชั้นเรียน ครูเจ้าของวิชา ครูผู้สอนแทน และสถานะการเช็คชื่อ (ไม่รวมวันหยุด)
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            ทั้งหมด {filteredRecords.length} รายการ
          </span>
        </div>

        <div className="hidden print:block px-2 pt-1 pb-2">
          <h3 className="text-xs font-bold text-slate-900">
            1. รายละเอียดการปฏิบัติหน้าที่สอนแทนประจำเดือน {selectedMonthOption?.label}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-[11px] print:bg-slate-100 print:text-black">
                <th className="py-3 px-3 text-center w-12 border-r border-slate-200 print:border-slate-800">
                  ลำดับ
                </th>
                <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[130px]">
                  วันที่สอนแทน
                </th>
                <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[120px]">
                  วัน / คาบสอน
                </th>
                <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[180px]">
                  รายวิชา / ชั้นเรียน
                </th>
                <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[140px]">
                  ครูเจ้าของวิชา
                </th>
                <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[140px]">
                  ครูผู้สอนแทน
                </th>
                <th className="py-3 px-3 text-center min-w-[115px] print:border-slate-800">
                  สถานะเช็คชื่อ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600 text-sm">
                      ไม่พบข้อมูลการจัดสอนแทนในเดือน {selectedMonthOption?.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      ยังไม่มีการมอบหมายสอนแทนที่ตรงกับเงื่อนไขในเดือนนี้
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => (
                  <tr
                    key={rec.key}
                    className="hover:bg-slate-50/70 transition-colors bg-white print:break-inside-avoid"
                  >
                    <td className="py-3 px-3 text-center font-bold text-slate-600 border-r border-slate-100 print:border-slate-800">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                      <div className="font-bold text-slate-800 print:text-black">
                        {formatToThaiBE(rec.date)}
                      </div>
                      <div className="text-[10px] text-slate-500 print:text-slate-700">
                        {formatThaiFullDate(rec.date).split('ที่ ')[0]}
                      </div>
                    </td>
                    <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                      <div className="font-semibold text-slate-800 print:text-black">
                        วัน{rec.dayOfWeek} • {rec.periodName}
                      </div>
                      {rec.timeRange && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 print:text-slate-700">
                          <Clock className="w-3 h-3 no-print" />
                          <span>{rec.timeRange}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                      <div className="font-bold text-slate-800 print:text-black">
                        {rec.subjectCode} {rec.subjectName}
                      </div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-[#0C7C82] border border-teal-200 print:border-none print:bg-transparent print:p-0 print:text-slate-700">
                        ชั้น {rec.className}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 border-r border-slate-100 print:border-slate-800 print:text-black">
                      {rec.teacherName}
                    </td>
                    <td className="py-3 px-3 font-bold text-red-700 border-r border-slate-100 print:border-slate-800 print:text-black">
                      {rec.substituteTeacherName}
                    </td>
                    <td className="py-3 px-3 text-center print:border-slate-800">
                      {rec.attendanceLog ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 print:bg-transparent print:text-black print:p-0">
                          <CheckCircle2 className="w-3 h-3 no-print" />
                          <span>
                            เช็คแล้ว ({rec.attendanceLog.summary.present}/{rec.attendanceLog.summary.total})
                          </span>
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 print:bg-transparent print:border-none print:text-slate-700 print:p-0">
                          ยังไม่เช็คชื่อ
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Section 2: Per-Teacher Monthly Summary Table */}
        {teacherSummaryRows.length > 0 && (
          <div className="border-t-4 border-slate-100 print:border-t-2 print:border-slate-800 print:mt-6">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between no-print">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0C7C82]" />
                  <span>สรุปจำนวนครั้งรายบุคคล ประจำเดือน {selectedMonthOption?.label}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  แสดงจำนวนคาบที่มีผู้อื่นสอนแทน และจำนวนคาบที่เข้าสอนแทนผู้อื่นของครูแต่ละท่าน
                </p>
              </div>
            </div>

            <div className="hidden print:block px-2 pt-4 pb-2">
              <h3 className="text-xs font-bold text-slate-900">
                2. สรุปสถิติการสอนแทนรายบุคคล ประจำเดือน {selectedMonthOption?.label}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-[11px] print:bg-slate-100 print:text-black">
                    <th className="py-2.5 px-3 text-center w-12 border-r border-slate-200 print:border-slate-800">
                      ลำดับ
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-200 print:border-slate-800">
                      ชื่อ-นามสกุล ครู
                    </th>
                    <th className="py-2.5 px-3 text-center w-40 border-r border-slate-200 print:border-slate-800">
                      มีผู้สอนแทน (คาบ)
                    </th>
                    <th className="py-2.5 px-3 text-center w-40 border-r border-slate-200 print:border-slate-800">
                      เข้าสอนแทนผู้อื่น (คาบ)
                    </th>
                    <th className="py-2.5 px-3 text-center w-40 print:border-slate-800">
                      เช็คชื่อสอนแทนแล้ว (คาบ)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                  {teacherSummaryRows.map((row, idx) => (
                    <tr key={row.username} className="bg-white hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-600 border-r border-slate-100 print:border-slate-800">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-100 print:border-slate-800 print:text-black">
                        {row.fullName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-rose-700 border-r border-slate-100 print:border-slate-800 print:text-black">
                        {row.delegatedOutCount}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#0C7C82] border-r border-slate-100 print:border-slate-800 print:text-black">
                        {row.substitutedInCount}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-700 print:border-slate-800 print:text-black">
                        {row.checkedInCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Print Only: Official Signature Block */}
        <div className="hidden print:block pt-10 px-4 pb-4 text-center text-xs text-slate-800 print:break-inside-avoid">
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-4">
              <p className="leading-relaxed">ลงชื่อ........................................................</p>
              <p className="font-semibold">({currentUserFullName})</p>
              <p className="text-[11px] text-slate-600">ผู้จัดทำรายงาน / ผู้รับผิดชอบจัดสอนแทน</p>
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
    </div>
  );
};
