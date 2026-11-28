import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Calendar,
  Clock,
  Search,
  Users,
  BookOpen,
  Edit2,
  Trash2,
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  LayoutGrid,
  List,
  X,
  UserCheck
} from 'lucide-react';
import {
  AcademicYear,
  AppUser,
  Classroom,
  DayOfWeek,
  Period,
  SchoolCalendarEntry,
  TeachingAssignment
} from '../../types';
import {
  DAY_ORDER,
  formatToThaiBE,
  getTodayISODate,
  resolveCalendarDateStatus
} from '../../utils/thaiDate';

interface TeacherSubstitutionViewProps {
  currentTeacherUsername: string;
  currentTeacherFullName: string;
  assignments: TeachingAssignment[];
  teachers: AppUser[];
  periods: Period[];
  classes: Classroom[];
  calendarEntries?: SchoolCalendarEntry[];
  activeYear?: AcademicYear;
  onUpdateAssignment: (id: string, updated: Partial<TeachingAssignment>) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
}

export const TeacherSubstitutionView: React.FC<TeacherSubstitutionViewProps> = ({
  currentTeacherUsername,
  currentTeacherFullName,
  assignments,
  teachers,
  periods,
  classes,
  calendarEntries = [],
  activeYear,
  onUpdateAssignment,
  openConfirm,
  showToast
}) => {
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('ALL');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlySubstituted, setOnlySubstituted] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'timetable'>('table');

  // Substitution Modal state
  const [selectedAssignment, setSelectedAssignment] = useState<TeachingAssignment | null>(null);
  const [subTeacherUsername, setSubTeacherUsername] = useState('');
  const [subDate, setSubDate] = useState(getTodayISODate());
  const [isSaving, setIsSaving] = useState(false);

  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => a.order - b.order),
    [periods]
  );

  const teachingPeriods = useMemo(
    () => sortedPeriods.filter((p) => !p.isLunchBreak),
    [sortedPeriods]
  );

  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => a.fullName.localeCompare(b.fullName, 'th')),
    [teachers]
  );

  const teacherNameMap = useMemo(() => {
    const map = new Map<string, string>();
    teachers.forEach((t) => map.set(t.username, t.fullName));
    return map;
  }, [teachers]);

  const getTeacherDisplayName = (username?: string, fallbackName?: string) => {
    if (!username) return fallbackName || '-';
    return teacherNameMap.get(username) || fallbackName || username;
  };

  // All assignments currently delegated to a substitute teacher
  const activeSubstitutedAssignments = useMemo(() => {
    return assignments
      .filter((a) => Boolean(a.substituteTeacherUsername))
      .sort((a, b) => {
        const dA = a.substituteDate || '';
        const dB = b.substituteDate || '';
        if (dA !== dB) return dA.localeCompare(dB);
        return DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
      });
  }, [assignments]);

  // Helper to get period span indices
  const getAssignmentPeriodIds = (a: TeachingAssignment): string[] => {
    const startIdx = teachingPeriods.findIndex((p) => p.id === a.periodId);
    const endIdx = a.endPeriodId
      ? teachingPeriods.findIndex((p) => p.id === a.endPeriodId)
      : startIdx;
    const realStart = startIdx !== -1 ? startIdx : 0;
    const realEnd = endIdx !== -1 && endIdx >= realStart ? endIdx : realStart;
    return teachingPeriods.slice(realStart, realEnd + 1).map((p) => p.id);
  };

  // Filter assignments for display
  const filteredAssignments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return assignments
      .filter((a) => {
        if (selectedTeacherFilter !== 'ALL' && a.teacherUsername !== selectedTeacherFilter) {
          return false;
        }
        if (selectedDayFilter !== 'ALL' && a.dayOfWeek !== selectedDayFilter) {
          return false;
        }
        if (onlySubstituted && !a.substituteTeacherUsername) {
          return false;
        }
        if (q) {
          const primaryName = getTeacherDisplayName(a.teacherUsername, a.teacherName).toLowerCase();
          const subName = a.substituteTeacherUsername
            ? getTeacherDisplayName(a.substituteTeacherUsername).toLowerCase()
            : '';
          const match =
            a.subjectCode.toLowerCase().includes(q) ||
            a.subjectName.toLowerCase().includes(q) ||
            a.className.toLowerCase().includes(q) ||
            primaryName.includes(q) ||
            subName.includes(q) ||
            a.teacherUsername.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const teacherCmp = getTeacherDisplayName(a.teacherUsername, a.teacherName).localeCompare(
          getTeacherDisplayName(b.teacherUsername, b.teacherName),
          'th'
        );
        if (teacherCmp !== 0) return teacherCmp;
        const dayCmp = DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
        if (dayCmp !== 0) return dayCmp;
        const orderA = sortedPeriods.find((p) => p.id === a.periodId)?.order || 0;
        const orderB = sortedPeriods.find((p) => p.id === b.periodId)?.order || 0;
        return orderA - orderB;
      });
  }, [
    assignments,
    selectedTeacherFilter,
    selectedDayFilter,
    onlySubstituted,
    searchTerm,
    sortedPeriods,
    teacherNameMap
  ]);

  // Assignments for timetable view when a specific teacher is chosen
  const timetableTeacherAssignments = useMemo(() => {
    if (selectedTeacherFilter === 'ALL') return [];
    return assignments.filter((a) => a.teacherUsername === selectedTeacherFilter);
  }, [assignments, selectedTeacherFilter]);

  // Available substitute teachers with FREE PERIODS on selectedAssignment's day & period
  const availableSubstituteTeachers = useMemo(() => {
    if (!selectedAssignment) return [];
    const targetPeriodIds = getAssignmentPeriodIds(selectedAssignment);

    return sortedTeachers.filter((t) => {
      // Never allow assigning the primary teacher as their own substitute
      if (t.username === selectedAssignment.teacherUsername) return false;

      const hasConflict = assignments.some((a) => {
        if (a.id === selectedAssignment.id) return false;
        if (a.dayOfWeek !== selectedAssignment.dayOfWeek) return false;

        const isTeacherBusy =
          a.teacherUsername === t.username ||
          (a.substituteTeacherUsername === t.username &&
            (!a.substituteDate || !subDate || a.substituteDate === subDate));
        if (!isTeacherBusy) return false;

        const aPeriodIds = getAssignmentPeriodIds(a);
        return targetPeriodIds.some((pId) => aPeriodIds.includes(pId));
      });

      return !hasConflict;
    });
  }, [selectedAssignment, sortedTeachers, assignments, subDate, teachingPeriods]);

  const subDateCalendarStatus = useMemo(
    () => (subDate ? resolveCalendarDateStatus(subDate, calendarEntries) : null),
    [subDate, calendarEntries]
  );

  const openModal = (a: TeachingAssignment) => {
    setSelectedAssignment(a);
    setSubTeacherUsername(a.substituteTeacherUsername || '');
    setSubDate(a.substituteDate || getTodayISODate());
  };

  const handleSaveSubstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    if (!subTeacherUsername) {
      showToast('warning', 'กรุณาเลือกครูผู้สอนแทน');
      return;
    }
    if (!subDate) {
      showToast('warning', 'กรุณาระบุวันที่ต้องการให้สอนแทน');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateAssignment(selectedAssignment.id, {
        substituteTeacherUsername: subTeacherUsername,
        substituteDate: subDate
      });
      const primaryName = getTeacherDisplayName(
        selectedAssignment.teacherUsername,
        selectedAssignment.teacherName
      );
      const subName = getTeacherDisplayName(subTeacherUsername);
      showToast(
        'success',
        `จัดสอนแทนวิชา ${selectedAssignment.subjectCode} (${primaryName} → ${subName}) เรียบร้อยแล้ว`
      );
      setSelectedAssignment(null);
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการบันทึกการจัดสอนแทน');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSubstitution = (a: TeachingAssignment, closeModalAfter: boolean = false) => {
    const primaryName = getTeacherDisplayName(a.teacherUsername, a.teacherName);
    const subName = getTeacherDisplayName(a.substituteTeacherUsername);
    openConfirm(
      'ยืนยันการยกเลิกการสอนแทน',
      `ต้องการยกเลิกการสอนแทนวิชา ${a.subjectCode} ${a.subjectName} (${a.className}) ของ ${primaryName} ที่มอบหมายให้ ${subName} ใช่หรือไม่?`,
      async () => {
        try {
          await onUpdateAssignment(a.id, {
            substituteTeacherUsername: '',
            substituteDate: ''
          });
          showToast('success', 'ยกเลิกการสอนแทนเรียบร้อยแล้ว');
          if (closeModalAfter) {
            setSelectedAssignment(null);
          }
        } catch (err) {
          showToast('error', 'เกิดข้อผิดพลาดในการยกเลิกการสอนแทน');
        }
      },
      'warning'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#F57C00] flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <span>จัดสอนแทน (สำหรับครูทุกท่าน)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1.5">
            ผู้ได้รับสิทธิ์: <strong className="text-slate-700">{currentTeacherFullName}</strong> • สามารถมอบหมาย แก้ไข และยกเลิกการสอนแทนของครูในโรงเรียนได้ทุกท่าน (ปีการศึกษา {activeYear?.name || '2569'})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
            <UserCheck className="w-4 h-4" />
            <span>สิทธิ์จัดการครูทุกคน: เปิด</span>
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0C7C82] flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">ครูผู้สอนทั้งหมด</p>
            <p className="text-2xl font-extrabold text-slate-800">
              {sortedTeachers.length} <span className="text-xs font-medium text-slate-400">ท่าน</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">คาบสอนทั้งหมดในระบบ</p>
            <p className="text-2xl font-extrabold text-slate-800">
              {assignments.length} <span className="text-xs font-medium text-slate-400">รายการ</span>
            </p>
          </div>
        </div>

        <div
          className={`p-5 rounded-3xl border shadow-xs flex items-center gap-4 ${
            activeSubstitutedAssignments.length > 0
              ? 'bg-red-50/70 border-red-200'
              : 'bg-white border-slate-100'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              activeSubstitutedAssignments.length > 0
                ? 'bg-red-100 text-red-600'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <p
              className={`text-xs font-medium ${
                activeSubstitutedAssignments.length > 0 ? 'text-red-700' : 'text-slate-500'
              }`}
            >
              รายการที่จัดสอนแทนอยู่
            </p>
            <p
              className={`text-2xl font-extrabold ${
                activeSubstitutedAssignments.length > 0 ? 'text-red-700' : 'text-slate-800'
              }`}
            >
              {activeSubstitutedAssignments.length}{' '}
              <span className="text-xs font-medium opacity-75">รายวิชา</span>
            </p>
          </div>
        </div>
      </div>

      {/* Active Substitutions Quick Panel */}
      {activeSubstitutedAssignments.length > 0 && (
        <div className="bg-white rounded-3xl border border-red-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-red-50/80 border-b border-red-100 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-red-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <span>รายการที่จัดสอนแทนอยู่ในระบบ ({activeSubstitutedAssignments.length} รายการ)</span>
            </h3>
            <span className="text-[11px] text-red-600 font-medium">
              รายวิชาที่มีการจัดสอนแทนจะแสดงเป็นสีแดง
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeSubstitutedAssignments.map((a) => {
              const primaryName = getTeacherDisplayName(a.teacherUsername, a.teacherName);
              const subName = getTeacherDisplayName(a.substituteTeacherUsername);
              const dateCal = a.substituteDate
                ? resolveCalendarDateStatus(a.substituteDate, calendarEntries)
                : null;
              return (
                <div
                  key={a.id}
                  className="p-4 rounded-2xl bg-red-50 border border-red-300 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-600 text-white mb-1">
                          จัดสอนแทน
                        </span>
                        <h4 className="font-bold text-red-900 text-sm leading-tight">
                          {a.subjectCode} {a.subjectName}
                        </h4>
                        <p className="text-xs text-red-700 font-semibold">
                          ชั้น {a.className} • วัน{a.dayOfWeek} ({a.periodName})
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-red-200/80 text-xs space-y-1 text-red-800">
                      <div>
                        ครูผู้สอนหลัก: <strong>{primaryName}</strong>
                      </div>
                      <div>
                        ครูผู้สอนแทน: <strong className="text-red-900">{subName}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Calendar className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span>
                          วันที่สอนแทน:{' '}
                          <strong>
                            {a.substituteDate ? formatToThaiBE(a.substituteDate) : 'ยังไม่ระบุวันที่'}
                          </strong>
                        </span>
                        {dateCal?.isHoliday && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                            <CalendarOff className="w-3 h-3" />
                            วันหยุด
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-red-200/60">
                    <button
                      type="button"
                      onClick={() => openModal(a)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-red-700 border border-red-300 hover:bg-red-100 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>แก้ไข</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelSubstitution(a)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ยกเลิกสอนแทน</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter & Controls */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Teacher Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              เลือกครูผู้สอนหลัก
            </label>
            <select
              value={selectedTeacherFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTeacherFilter(val);
                if (val === 'ALL' && viewMode === 'timetable') {
                  setViewMode('table');
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
            >
              <option value="ALL">-- ครูผู้สอนทั้งหมด ({sortedTeachers.length} ท่าน) --</option>
              {sortedTeachers.map((t) => {
                const count = assignments.filter((a) => a.teacherUsername === t.username).length;
                return (
                  <option key={t.id} value={t.username}>
                    {t.fullName} ({count} คาบ)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Day Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              วันสอนตามตาราง
            </label>
            <select
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
            >
              <option value="ALL">ทุกวัน (จันทร์ - ศุกร์)</option>
              {DAY_ORDER.map((day) => (
                <option key={day} value={day}>
                  วัน{day}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              ค้นหารายวิชา / ครู / ชั้นเรียน
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="พิมพ์ชื่อครู, รหัสวิชา, ชื่อวิชา หรือชั้นเรียน..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlySubstituted}
              onChange={(e) => setOnlySubstituted(e.target.checked)}
              className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-slate-300 cursor-pointer"
            />
            <span>แสดงเฉพาะรายวิชาที่จัดสอนแทนอยู่</span>
          </label>

          {selectedTeacherFilter !== 'ALL' && (
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-[#0C7C82] shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>มุมมองรายการ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timetable')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'timetable'
                    ? 'bg-white text-[#0C7C82] shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>ตารางสอนครูท่านนี้</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* View Content: Timetable Grid (when specific teacher + timetable mode) OR All Teachers List Table */}
      {selectedTeacherFilter !== 'ALL' && viewMode === 'timetable' ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0C7C82]" />
              <span>
                ตารางสอนของ {getTeacherDisplayName(selectedTeacherFilter)} (คลิกที่รายวิชาเพื่อจัดสอนแทน)
              </span>
            </h3>
            <span className="text-[11px] text-red-600 font-semibold">
              * กรอบสีแดง = มีการจัดสอนแทนแล้ว
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                  <th className="p-3 text-center w-28 border-r border-slate-200">วัน / คาบ</th>
                  {sortedPeriods.map((p) => (
                    <th
                      key={p.id}
                      className={`p-3 text-center border-r border-slate-200 min-w-[125px] ${
                        p.isLunchBreak ? 'bg-amber-50/70 text-amber-800' : ''
                      }`}
                    >
                      <div className="font-bold">{p.name}</div>
                      <div className="text-[10px] font-normal text-slate-400">
                        {p.startTime} - {p.endTime}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {DAY_ORDER.map((day) => {
                  const renderedCells: React.ReactNode[] = [];
                  let pIdx = 0;

                  while (pIdx < sortedPeriods.length) {
                    const p = sortedPeriods[pIdx];
                    if (p.isLunchBreak) {
                      renderedCells.push(
                        <td
                          key={p.id}
                          className="p-2 text-center bg-amber-50/40 border-r border-slate-200 text-[11px] font-bold text-amber-700"
                        >
                          พักเที่ยง
                        </td>
                      );
                      pIdx += 1;
                      continue;
                    }

                    const slotAssignment = timetableTeacherAssignments.find(
                      (a) => a.dayOfWeek === day && a.periodId === p.id
                    );

                    if (!slotAssignment) {
                      renderedCells.push(
                        <td key={p.id} className="p-2 border-r border-slate-200 bg-slate-50/20 text-center">
                          <span className="text-[10px] text-slate-300">ว่าง</span>
                        </td>
                      );
                      pIdx += 1;
                      continue;
                    }

                    // Calculate colSpan across consecutive non-lunch periods
                    let colSpan = 1;
                    if (slotAssignment.endPeriodId && slotAssignment.endPeriodId !== p.id) {
                      for (let next = pIdx + 1; next < sortedPeriods.length; next++) {
                        if (sortedPeriods[next].isLunchBreak) break;
                        colSpan += 1;
                        if (sortedPeriods[next].id === slotAssignment.endPeriodId) break;
                      }
                    }

                    const isSub = Boolean(slotAssignment.substituteTeacherUsername);
                    const subName = isSub
                      ? getTeacherDisplayName(slotAssignment.substituteTeacherUsername)
                      : '';
                    const classroomColor =
                      classes.find(
                        (c) =>
                          c.id === slotAssignment.classId || c.name === slotAssignment.className
                      )?.color ||
                      slotAssignment.color ||
                      '#0C7C82';

                    renderedCells.push(
                      <td
                        key={p.id}
                        colSpan={colSpan}
                        className="p-2 border-r border-slate-200 align-top"
                      >
                        <button
                          type="button"
                          onClick={() => openModal(slotAssignment)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
                            isSub
                              ? 'bg-red-50 border-red-400 text-red-800 hover:bg-red-100/70'
                              : 'bg-white border-slate-200 hover:border-[#0C7C82] text-slate-800'
                          }`}
                          style={
                            !isSub
                              ? { borderLeftWidth: '4px', borderLeftColor: classroomColor }
                              : { borderLeftWidth: '4px', borderLeftColor: '#dc2626' }
                          }
                        >
                          <div className="font-bold text-xs leading-tight truncate">
                            {slotAssignment.subjectCode} {slotAssignment.subjectName}
                          </div>
                          <div className="text-[11px] font-semibold mt-0.5 opacity-80">
                            {slotAssignment.className}
                          </div>
                          {isSub ? (
                            <div className="mt-1.5 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md inline-block">
                              สอนแทน: {subName}
                              {slotAssignment.substituteDate
                                ? ` (${formatToThaiBE(slotAssignment.substituteDate)})`
                                : ''}
                            </div>
                          ) : (
                            <div className="mt-1.5 text-[10px] text-[#0C7C82] font-semibold">
                              คลิกเพื่อจัดสอนแทน
                            </div>
                          )}
                        </button>
                      </td>
                    );

                    pIdx += colSpan;
                  }

                  return (
                    <tr key={day} className="hover:bg-slate-50/40">
                      <td className="p-3 text-center font-bold text-xs text-slate-700 bg-slate-50/70 border-r border-slate-200">
                        วัน{day}
                      </td>
                      {renderedCells}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0C7C82]" />
              <span>ตารางสอนของครูทั้งหมด ({filteredAssignments.length} รายการ)</span>
            </h3>
            <span className="text-[11px] text-slate-500">
              กดปุ่ม "จัดสอนแทน" หรือ "แก้ไขสอนแทน" ด้านขวาของแต่ละรายวิชา
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3.5 px-5">ครูผู้สอนหลัก</th>
                  <th className="py-3.5 px-5">วัน / คาบสอน</th>
                  <th className="py-3.5 px-5">รายวิชา</th>
                  <th className="py-3.5 px-5 text-center">ชั้นเรียน</th>
                  <th className="py-3.5 px-5">สถานะการสอนแทน</th>
                  <th className="py-3.5 px-5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                      ไม่พบข้อมูลรายวิชาที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((a) => {
                    const isSub = Boolean(a.substituteTeacherUsername);
                    const primaryName = getTeacherDisplayName(a.teacherUsername, a.teacherName);
                    const subName = isSub ? getTeacherDisplayName(a.substituteTeacherUsername) : '';
                    return (
                      <tr
                        key={a.id}
                        className={`transition-colors ${
                          isSub ? 'bg-red-50/70 hover:bg-red-100/50' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="py-3.5 px-5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTeacherFilter(a.teacherUsername);
                              setViewMode('timetable');
                            }}
                            className={`font-bold text-left hover:underline cursor-pointer ${
                              isSub ? 'text-red-900' : 'text-slate-800'
                            }`}
                            title="คลิกเพื่อดูตารางสอนของครูท่านนี้"
                          >
                            {primaryName}
                          </button>
                          <div className="text-[11px] text-slate-400 font-mono">{a.teacherUsername}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className={`font-bold text-xs ${isSub ? 'text-red-800' : 'text-slate-700'}`}>
                            วัน{a.dayOfWeek}
                          </div>
                          <div className="text-[11px] text-slate-500">{a.periodName}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className={`font-bold text-sm ${isSub ? 'text-red-800' : 'text-slate-800'}`}>
                            {a.subjectCode} {a.subjectName}
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                              isSub
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : 'bg-teal-50 text-[#0C7C82] border border-teal-200'
                            }`}
                          >
                            {a.className}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          {isSub ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>สอนแทน: {subName}</span>
                              </span>
                              <div className="text-[11px] font-semibold text-red-700">
                                วันที่: {a.substituteDate ? formatToThaiBE(a.substituteDate) : 'ทุกสัปดาห์ (ยังไม่ระบุวันที่)'}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>สอนตามปกติ</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openModal(a)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                                isSub
                                  ? 'bg-white text-red-700 border border-red-300 hover:bg-red-50'
                                  : 'bg-[#0C7C82] text-white hover:bg-[#096368] shadow-2xs'
                              }`}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>{isSub ? 'แก้ไขสอนแทน' : 'จัดสอนแทน'}</span>
                            </button>
                            {isSub && (
                              <button
                                type="button"
                                onClick={() => handleCancelSubstitution(a)}
                                className="p-1.5 rounded-xl text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                                title="ยกเลิกการสอนแทน"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Substitution Assign/Edit Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#F57C00] flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {selectedAssignment.substituteTeacherUsername ? 'แก้ไขการจัดสอนแทน' : 'จัดสอนแทน'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    วิชา {selectedAssignment.subjectCode} {selectedAssignment.subjectName} ({selectedAssignment.className})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAssignment(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubstitution} className="space-y-4">
              {/* Target Class Info */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">ครูผู้สอนหลัก:</span>
                  <strong className="text-slate-800">
                    {getTeacherDisplayName(
                      selectedAssignment.teacherUsername,
                      selectedAssignment.teacherName
                    )}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">วันและคาบสอน:</span>
                  <strong className="text-slate-800">
                    วัน{selectedAssignment.dayOfWeek} • {selectedAssignment.periodName}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">ชั้นเรียน:</span>
                  <strong className="text-[#0C7C82]">{selectedAssignment.className}</strong>
                </div>
              </div>

              {/* Date Picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  วันที่ต้องการให้สอนแทน <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={subDate}
                  onChange={(e) => setSubDate(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
                />
                {subDateCalendarStatus?.isHoliday && (
                  <p className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1.5 font-semibold bg-red-50 px-3 py-1.5 rounded-xl border border-red-200">
                    <CalendarOff className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      คำเตือน: วันที่ {formatToThaiBE(subDate)} เป็น{subDateCalendarStatus.holidayTitle}
                    </span>
                  </p>
                )}
              </div>

              {/* Available Substitute Teacher Selector */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between gap-2">
                  <span>
                    เลือกครูผู้สอนแทน <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[10px] text-teal-800 font-medium bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    แสดงเฉพาะครูที่มีคาบว่าง ({availableSubstituteTeachers.length} ท่าน)
                  </span>
                </label>
                <select
                  value={subTeacherUsername}
                  onChange={(e) => setSubTeacherUsername(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
                >
                  <option value="">-- เลือกครูผู้สอนแทน (เฉพาะครูที่มีคาบว่าง) --</option>
                  {availableSubstituteTeachers.length === 0 ? (
                    <option value="" disabled>
                      -- ไม่มีครูท่านอื่นที่มีคาบว่างในช่วงเวลานี้ --
                    </option>
                  ) : (
                    availableSubstituteTeachers.map((t) => (
                      <option key={t.id} value={t.username}>
                        {t.fullName} ({t.username}) • คาบว่าง
                      </option>
                    ))
                  )}
                </select>
                {availableSubstituteTeachers.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>ครูท่านอื่นทุกท่านติดตารางสอนในช่วงเวลานี้แล้ว</span>
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                {selectedAssignment.substituteTeacherUsername && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleCancelSubstitution(selectedAssignment, true)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer border border-rose-200 mr-auto"
                  >
                    ยกเลิกการสอนแทน
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
                >
                  ปิด
                </button>

                <button
                  type="submit"
                  disabled={isSaving || availableSubstituteTeachers.length === 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:shadow-md disabled:opacity-50 cursor-pointer transition-all"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกการจัดสอนแทน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
