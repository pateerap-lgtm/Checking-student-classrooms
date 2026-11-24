import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ArrowRightLeft,
  CheckCircle2,
  X,
  Trash2,
  Edit2,
  RotateCcw,
  Users,
  Info,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import {
  SchoolCalendarEntry,
  CalendarDayType,
  TeachingAssignment,
  AppUser,
  Period,
  AcademicYear,
  DayOfWeek
} from '../../types';
import {
  THAI_MONTHS_FULL,
  DAY_ORDER,
  formatToThaiBE,
  formatThaiFullDate,
  getTodayISODate,
  getDayOfWeekFromDate,
  getAcademicYearMonths,
  parseISODateLocal,
  isWeekendDate,
  resolveCalendarDateStatus
} from '../../utils/thaiDate';

interface CalendarViewProps {
  calendarEntries: SchoolCalendarEntry[];
  assignments: TeachingAssignment[];
  teachers: AppUser[];
  periods: Period[];
  activeYear?: AcademicYear;
  onSaveCalendarEntry: (entry: Omit<SchoolCalendarEntry, 'id'> & { id?: string }) => Promise<void>;
  onSaveCalendarEntriesBatch: (entries: (Omit<SchoolCalendarEntry, 'id'> & { id?: string })[]) => Promise<void>;
  onDeleteCalendarEntry: (id: string) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

const WEEKDAY_HEADERS = [
  { label: 'อาทิตย์', isWeekend: true },
  { label: 'จันทร์', isWeekend: false },
  { label: 'อังคาร', isWeekend: false },
  { label: 'พุธ', isWeekend: false },
  { label: 'พฤหัสบดี', isWeekend: false },
  { label: 'ศุกร์', isWeekend: false },
  { label: 'เสาร์', isWeekend: true }
];

const HOLIDAY_PRESETS = [
  'วันหยุดราชการ',
  'วันนักขัตฤกษ์',
  'วันหยุดชดเชย',
  'วันหยุดพิเศษ',
  'วันปิดภาคเรียน'
];

function toISODate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getNextSaturdayISO(fromDateStr: string): string {
  const d = parseISODateLocal(fromDateStr) || new Date();
  const day = d.getDay();
  const daysUntilSat = day === 6 ? 7 : (6 - day + 7) % 7 || 7;
  const sat = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilSat);
  return toISODate(sat.getFullYear(), sat.getMonth(), sat.getDate());
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  calendarEntries,
  assignments,
  teachers,
  periods,
  activeYear,
  onSaveCalendarEntry,
  onSaveCalendarEntriesBatch,
  onDeleteCalendarEntry,
  openConfirm,
  showToast
}) => {
  const todayISO = getTodayISODate();
  const initialDate = parseISODateLocal(todayISO) || new Date();

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-11

  // Modal state for clicking a calendar date
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<CalendarDayType>('holiday');
  const [modalTitle, setModalTitle] = useState<string>('');

  // When mode === 'holiday': optional direct transfer of this day's classes to another date
  const [enableHolidayTransfer, setEnableHolidayTransfer] = useState<boolean>(false);
  const [holidayTransferTargetDate, setHolidayTransferTargetDate] = useState<string>('');

  // When mode === 'normal': source schedule transfer options
  const [transferSourceMode, setTransferSourceMode] = useState<'none' | 'holiday' | 'weekday'>('weekday');
  const [selectedSourceHolidayDate, setSelectedSourceHolidayDate] = useState<string>('');
  const [selectedTransferDay, setSelectedTransferDay] = useState<DayOfWeek>('จันทร์');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const sortedPeriods = useMemo(() => [...periods].sort((a, b) => a.order - b.order), [periods]);

  // Academic year month options + ensure current view month is selectable
  const monthOptions = useMemo(() => {
    const base = getAcademicYearMonths(activeYear);
    const currentKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    if (!base.some((m) => m.key === currentKey)) {
      return [
        ...base,
        {
          key: currentKey,
          label: `${THAI_MONTHS_FULL[viewMonth]} ${viewYear + 543}`,
          year: viewYear,
          monthIndex: viewMonth,
          yearBE: viewYear + 543
        }
      ].sort((a, b) => a.key.localeCompare(b.key));
    }
    return base;
  }, [activeYear, viewYear, viewMonth]);

  // Sorted calendar entries
  const sortedEntries = useMemo(
    () => [...calendarEntries].sort((a, b) => a.date.localeCompare(b.date)),
    [calendarEntries]
  );

  // Weekday holidays available as transfer sources
  const weekdayHolidayEntries = useMemo(() => {
    return sortedEntries.filter((e) => e.type === 'holiday' && getDayOfWeekFromDate(e.date) !== null);
  }, [sortedEntries]);

  // Map from transferredFromDate -> target entry
  const transferredOutMap = useMemo(() => {
    const map = new Map<string, SchoolCalendarEntry>();
    calendarEntries.forEach((e) => {
      if (e.type === 'normal' && e.transferredFromDate) {
        map.set(e.transferredFromDate, e);
      }
    });
    return map;
  }, [calendarEntries]);

  // Count stats for active year
  const stats = useMemo(() => {
    const holidays = calendarEntries.filter((e) => e.type === 'holiday').length;
    const openedNormal = calendarEntries.filter((e) => e.type === 'normal').length;
    const transferred = calendarEntries.filter((e) => e.type === 'normal' && !!e.transferDayOfWeek).length;
    return { holidays, openedNormal, transferred };
  }, [calendarEntries]);

  // Build 42-cell (6-week) or dynamic week calendar grid
  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: Array<{ dateStr: string; day: number; isCurrentMonth: boolean }> = [];

    // Leading days from previous month
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(viewYear, viewMonth - 1, d);
      cells.push({
        dateStr: toISODate(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate()),
        day: d,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: toISODate(viewYear, viewMonth, d),
        day: d,
        isCurrentMonth: true
      });
    }

    // Trailing days to complete last week row
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const needed = 7 - remainder;
      for (let d = 1; d <= needed; d++) {
        const nextDate = new Date(viewYear, viewMonth + 1, d);
        cells.push({
          dateStr: toISODate(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()),
          day: d,
          isCurrentMonth: false
        });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const handleNextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const handleJumpToday = () => {
    const now = parseISODateLocal(todayISO) || new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  // Assignments helper by DayOfWeek
  const getAssignmentsForDay = (dayOfWeek: DayOfWeek | null) => {
    if (!dayOfWeek) return [];
    return assignments
      .filter((a) => a.dayOfWeek === dayOfWeek)
      .sort((a, b) => {
        const pa = sortedPeriods.find((p) => p.id === a.periodId)?.order || 999;
        const pb = sortedPeriods.find((p) => p.id === b.periodId)?.order || 999;
        if (pa !== pb) return pa - pb;
        return (a.teacherName || '').localeCompare(b.teacherName || '', 'th');
      });
  };

  // Open modal when clicking a date
  const openDateModal = (dateStr: string) => {
    const existing = calendarEntries.find((e) => e.date === dateStr);
    const weekend = isWeekendDate(dateStr);
    const naturalDay = getDayOfWeekFromDate(dateStr);

    setSelectedDate(dateStr);

    if (existing) {
      setModalMode(existing.type);
      setModalTitle(existing.title || '');
      if (existing.type === 'holiday') {
        const transferredTarget = transferredOutMap.get(dateStr);
        setEnableHolidayTransfer(!!transferredTarget);
        setHolidayTransferTargetDate(transferredTarget?.date || getNextSaturdayISO(dateStr));
        setTransferSourceMode(weekend ? 'weekday' : 'none');
        setSelectedTransferDay(naturalDay || 'จันทร์');
        setSelectedSourceHolidayDate('');
      } else {
        setEnableHolidayTransfer(false);
        setHolidayTransferTargetDate(getNextSaturdayISO(dateStr));
        if (existing.transferredFromDate) {
          setTransferSourceMode('holiday');
          setSelectedSourceHolidayDate(existing.transferredFromDate);
          setSelectedTransferDay(existing.transferDayOfWeek || 'จันทร์');
        } else if (existing.transferDayOfWeek) {
          setTransferSourceMode('weekday');
          setSelectedTransferDay(existing.transferDayOfWeek);
          setSelectedSourceHolidayDate('');
        } else {
          setTransferSourceMode(weekend ? 'weekday' : 'none');
          setSelectedTransferDay(naturalDay || 'จันทร์');
          setSelectedSourceHolidayDate('');
        }
      }
    } else {
      // No override yet:
      // If weekend -> default to offering 'normal' (open weekend as normal) or 'holiday'
      // If weekday -> default to 'holiday' (set public holiday)
      if (weekend) {
        setModalMode('normal');
        setModalTitle('เปิดเรียนปกติ (ชดเชย)');
        if (weekdayHolidayEntries.length > 0) {
          const latestHoliday = weekdayHolidayEntries[weekdayHolidayEntries.length - 1];
          setTransferSourceMode('holiday');
          setSelectedSourceHolidayDate(latestHoliday.date);
          setSelectedTransferDay(getDayOfWeekFromDate(latestHoliday.date) || 'จันทร์');
        } else {
          setTransferSourceMode('weekday');
          setSelectedSourceHolidayDate('');
          setSelectedTransferDay('จันทร์');
        }
      } else {
        setModalMode('holiday');
        setModalTitle('วันหยุดราชการ');
        setTransferSourceMode('none');
        setSelectedSourceHolidayDate('');
        setSelectedTransferDay(naturalDay || 'จันทร์');
      }
      setEnableHolidayTransfer(false);
      setHolidayTransferTargetDate(getNextSaturdayISO(dateStr));
    }
  };

  const selectedDateInfo = useMemo(() => {
    if (!selectedDate) return null;
    const status = resolveCalendarDateStatus(selectedDate, calendarEntries);
    const naturalDay = getDayOfWeekFromDate(selectedDate);
    const naturalAssignments = getAssignmentsForDay(naturalDay);
    return { status, naturalDay, naturalAssignments };
  }, [selectedDate, calendarEntries, assignments, sortedPeriods]);

  // Resolve effective transfer day & source date for Normal mode preview
  const normalTransferPreview = useMemo(() => {
    if (!selectedDate) return { day: null as DayOfWeek | null, fromDate: undefined as string | undefined, list: [] as TeachingAssignment[] };
    const naturalDay = getDayOfWeekFromDate(selectedDate);

    let effectiveDay: DayOfWeek | null = null;
    let fromDate: string | undefined = undefined;

    if (transferSourceMode === 'none') {
      effectiveDay = naturalDay;
    } else if (transferSourceMode === 'holiday') {
      if (selectedSourceHolidayDate) {
        effectiveDay = getDayOfWeekFromDate(selectedSourceHolidayDate);
        fromDate = selectedSourceHolidayDate;
      }
    } else if (transferSourceMode === 'weekday') {
      effectiveDay = selectedTransferDay;
    }

    const list = getAssignmentsForDay(effectiveDay);
    return { day: effectiveDay, fromDate, list };
  }, [selectedDate, transferSourceMode, selectedSourceHolidayDate, selectedTransferDay, assignments, sortedPeriods]);

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;

    const existing = calendarEntries.find((item) => item.date === selectedDate);
    const naturalDay = getDayOfWeekFromDate(selectedDate);
    const weekend = isWeekendDate(selectedDate);
    const nowISO = new Date().toISOString();
    const yearId = activeYear?.id || 'year_2569';

    if (modalMode === 'holiday') {
      const cleanTitle = modalTitle.trim() || 'วันหยุดราชการ';

      if (enableHolidayTransfer) {
        if (!holidayTransferTargetDate) {
          showToast('warning', 'กรุณาระบุวันที่เปิดเรียนปกติปลายทางที่ต้องการโอนรายวิชาไป');
          return;
        }
        if (holidayTransferTargetDate === selectedDate) {
          showToast('warning', 'วันที่ปลายทางต้องไม่ซ้ำกับวันที่หยุด');
          return;
        }
        if (!naturalDay) {
          showToast('warning', 'วันนี้เป็นวันหยุดเสาร์-อาทิตย์ ไม่มีรายวิชาปกติให้โอน');
          return;
        }

        const existingTarget = calendarEntries.find((item) => item.date === holidayTransferTargetDate);
        const batchPayload: (Omit<SchoolCalendarEntry, 'id'> & { id?: string })[] = [
          {
            id: existing?.id,
            date: selectedDate,
            type: 'holiday',
            title: cleanTitle,
            academicYearId: yearId,
            updatedAt: nowISO
          },
          {
            id: existingTarget?.id,
            date: holidayTransferTargetDate,
            type: 'normal',
            title: existingTarget?.type === 'normal' && existingTarget.title
              ? existingTarget.title
              : `เปิดเรียนปกติ (โอนตารางวัน${naturalDay} ${formatToThaiBE(selectedDate)})`,
            transferDayOfWeek: naturalDay,
            transferredFromDate: selectedDate,
            academicYearId: yearId,
            updatedAt: nowISO
          }
        ];

        setIsSaving(true);
        try {
          await onSaveCalendarEntriesBatch(batchPayload);
          showToast(
            'success',
            `กำหนดวันหยุด "${cleanTitle}" และโอนรายวิชาของครูทั้งหมดไปวันที่ ${formatToThaiBE(holidayTransferTargetDate)} สำเร็จ`
          );
          setSelectedDate(null);
        } finally {
          setIsSaving(false);
        }
        return;
      }

      // Just save holiday
      setIsSaving(true);
      try {
        await onSaveCalendarEntry({
          id: existing?.id,
          date: selectedDate,
          type: 'holiday',
          title: cleanTitle,
          academicYearId: yearId,
          updatedAt: nowISO
        });
        showToast('success', `บันทึกวันหยุด "${cleanTitle}" (${formatToThaiBE(selectedDate)}) สำเร็จ`);
        setSelectedDate(null);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // modalMode === 'normal'
    if (weekend && !normalTransferPreview.day) {
      showToast('warning', 'กรุณาเลือกวันหรือวันหยุดที่ต้องการโอนรายวิชามาสอนในวันนี้');
      return;
    }

    const cleanTitle =
      modalTitle.trim() ||
      (weekend ? 'เปิดเรียนปกติ (สอนชดเชย)' : 'วันเปิดเรียนปกติ');

    const payload: Omit<SchoolCalendarEntry, 'id'> & { id?: string } = {
      id: existing?.id,
      date: selectedDate,
      type: 'normal',
      title: cleanTitle,
      academicYearId: yearId,
      updatedAt: nowISO
    };

    if (transferSourceMode !== 'none' && normalTransferPreview.day) {
      payload.transferDayOfWeek = normalTransferPreview.day;
      if (normalTransferPreview.fromDate) {
        payload.transferredFromDate = normalTransferPreview.fromDate;
      }
    } else if (naturalDay) {
      payload.transferDayOfWeek = naturalDay;
    }

    setIsSaving(true);
    try {
      await onSaveCalendarEntry(payload);
      showToast(
        'success',
        payload.transferDayOfWeek
          ? `เปิดวันปกติ ${formatToThaiBE(selectedDate)} และจัดตารางสอนวัน${payload.transferDayOfWeek}ให้ครูทั้งหมดสำเร็จ`
          : `บันทึกวันเปิดเรียนปกติ ${formatToThaiBE(selectedDate)} สำเร็จ`
      );
      setSelectedDate(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDate = () => {
    if (!selectedDate) return;
    const existing = calendarEntries.find((item) => item.date === selectedDate);
    if (!existing) return;

    openConfirm(
      'คืนค่าเริ่มต้นตามระบบ',
      `ต้องการลบการตั้งค่าพิเศษของวันที่ ${formatToThaiBE(selectedDate)} เพื่อกลับไปใช้ค่าเริ่มต้น (${isWeekendDate(selectedDate) ? 'วันหยุดเสาร์-อาทิตย์อัตโนมัติ' : 'วันเรียนปกติ'}) ใช่หรือไม่?`,
      async () => {
        await onDeleteCalendarEntry(existing.id);
        setSelectedDate(null);
        showToast('success', 'คืนค่าวันที่เป็นค่าเริ่มต้นตามระบบแล้ว');
      },
      'warning'
    );
  };

  const handleDeleteEntryFromList = (entry: SchoolCalendarEntry) => {
    openConfirm(
      'ยืนยันการลบรายการปฏิทิน',
      `ต้องการลบ "${entry.title}" วันที่ ${formatToThaiBE(entry.date)} ใช่หรือไม่?`,
      async () => {
        await onDeleteCalendarEntry(entry.id);
        showToast('success', 'ลบรายการปฏิทินเรียบร้อยแล้ว');
      },
      'danger'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Summary */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-[#0C7C82]" />
              <span>กำหนดปฏิทินและวันหยุดราชการ</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              คลิกที่วันที่ในตารางปฏิทินเพื่อกำหนดวันหยุดราชการ (ไม่สามารถเช็คชื่อได้) หรือเปิดวันเสาร์-อาทิตย์เป็นวันเรียนปกติพร้อมโอนรายวิชาของครูทั้งหมดมาสอนได้
            </p>
          </div>

          {/* Summary KPI Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span>วันหยุดราชการ: {stats.holidays} วัน</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>เปิดเรียนปกติ/ชดเชย: {stats.openedNormal} วัน</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
              <span>โอนตารางสอน: {stats.transferred} วัน</span>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-900 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div>
              <strong>กติกาปฏิทินอัตโนมัติ:</strong> วันเสาร์และวันอาทิตย์จะเป็น <strong>วันหยุดอัตโนมัติ</strong> (ครูไม่สามารถเช็คชื่อได้) ส่วนวันจันทร์–ศุกร์เป็นวันเรียนปกติ
            </div>
            <div className="text-teal-800">
              หากต้องการ <strong>หยุดราชการ</strong> หรือ <strong>เปิดวันเสาร์-อาทิตย์ให้เป็นวันเรียนปกติและโอนรายวิชาของครูทั้งหมด</strong> ให้คลิกที่ช่องวันที่ในปฏิทินด้านล่าง
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Table Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Month Navigator */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#0C7C82] hover:border-[#0C7C82] transition-colors cursor-pointer"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-extrabold text-slate-800 min-w-[190px] text-center">
              {THAI_MONTHS_FULL[viewMonth]} พ.ศ. {viewYear + 543}
            </h3>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#0C7C82] hover:border-[#0C7C82] transition-colors cursor-pointer"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                if (y && m) {
                  setViewYear(y);
                  setViewMonth(m - 1);
                }
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
            >
              {monthOptions.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleJumpToday}
              className="px-3.5 py-2 rounded-xl bg-[#0C7C82] hover:bg-[#096368] text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              เดือนปัจจุบัน
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-4 text-[11px] bg-white">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-white border border-slate-300 inline-block"></span>
            <span className="text-slate-600">วันเรียนปกติ (จ.-ศ.)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-400 inline-block"></span>
            <span className="text-red-700 font-semibold">วันหยุดราชการ / วันหยุดพิเศษ (เช็คชื่อไม่ได้)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300 inline-block"></span>
            <span className="text-slate-600">เสาร์-อาทิตย์ (วันหยุดอัตโนมัติ)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400 inline-block"></span>
            <span className="text-emerald-800 font-semibold">เปิดเป็นวันปกติ / โอนรายวิชามาสอน</span>
          </div>
        </div>

        {/* 7-Column Calendar Grid */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold">
                {WEEKDAY_HEADERS.map((h) => (
                  <th
                    key={h.label}
                    className={`py-3 px-2 text-center border-r border-slate-200 last:border-r-0 ${
                      h.isWeekend ? 'text-rose-700 bg-rose-50/50' : 'text-slate-700'
                    }`}
                  >
                    วัน{h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: calendarCells.length / 7 }).map((_, weekIdx) => (
                <tr key={weekIdx} className="border-b border-slate-200 last:border-b-0">
                  {calendarCells.slice(weekIdx * 7, weekIdx * 7 + 7).map((cell) => {
                    const status = resolveCalendarDateStatus(cell.dateStr, calendarEntries);
                    const isToday = cell.dateStr === todayISO;
                    const transferredTarget = transferredOutMap.get(cell.dateStr);
                    const activeDayAssignmentsCount = status.effectiveDayOfWeek
                      ? assignments.filter((a) => a.dayOfWeek === status.effectiveDayOfWeek).length
                      : 0;

                    let cellBg = 'bg-white hover:bg-teal-50/40';
                    if (!cell.isCurrentMonth) {
                      cellBg = 'bg-slate-50/60 opacity-50 hover:opacity-85';
                    } else if (status.isCustomHoliday) {
                      cellBg = 'bg-red-50/85 hover:bg-red-100/70';
                    } else if (status.isOpenedNormal) {
                      cellBg = 'bg-emerald-50/80 hover:bg-emerald-100/70';
                    } else if (status.isWeekend) {
                      cellBg = 'bg-slate-100/80 hover:bg-slate-200/60';
                    }

                    return (
                      <td
                        key={cell.dateStr}
                        className={`p-1.5 border-r border-slate-200 last:border-r-0 align-top h-28 transition-colors cursor-pointer ${cellBg}`}
                        onClick={() => openDateModal(cell.dateStr)}
                      >
                        <div className="h-full flex flex-col justify-between p-1 rounded-xl">
                          {/* Top row: Day number + Today/Override chip */}
                          <div className="flex items-start justify-between gap-1">
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold ${
                                isToday
                                  ? 'bg-[#0C7C82] text-white shadow-sm ring-2 ring-teal-200'
                                  : status.isCustomHoliday
                                  ? 'text-red-700'
                                  : status.isOpenedNormal
                                  ? 'text-emerald-800'
                                  : status.isWeekend
                                  ? 'text-rose-600'
                                  : 'text-slate-800'
                              }`}
                            >
                              {cell.day}
                            </span>

                            {isToday && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#0C7C82]/10 text-[#0C7C82]">
                                วันนี้
                              </span>
                            )}
                          </div>

                          {/* Middle status content */}
                          <div className="mt-1 space-y-1">
                            {status.isCustomHoliday && (
                              <>
                                <div className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-bold leading-tight truncate shadow-2xs">
                                  {status.holidayTitle}
                                </div>
                                {transferredTarget && (
                                  <div className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-bold truncate border border-indigo-200">
                                    โอนไป {formatToThaiBE(transferredTarget.date)}
                                  </div>
                                )}
                              </>
                            )}

                            {!status.isCustomHoliday && status.isOpenedNormal && (
                              <>
                                <div className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold leading-tight truncate shadow-2xs">
                                  {status.entry?.title || 'เปิดเรียนปกติ'}
                                </div>
                                {status.effectiveDayOfWeek && (
                                  <div className="px-1.5 py-0.5 rounded bg-white/90 text-emerald-800 border border-emerald-300 text-[9px] font-bold truncate">
                                    ตารางวัน{status.effectiveDayOfWeek} ({activeDayAssignmentsCount} คาบ)
                                  </div>
                                )}
                              </>
                            )}

                            {!status.isCustomHoliday && !status.isOpenedNormal && status.isWeekend && (
                              <div className="px-2 py-0.5 rounded-md bg-rose-100/80 text-rose-700 text-[10px] font-semibold inline-block">
                                วันหยุดอัตโนมัติ
                              </div>
                            )}

                            {!status.isCustomHoliday && !status.isOpenedNormal && !status.isWeekend && (
                              <div className="text-[10px] text-slate-400 font-medium px-1">
                                ปกติ {activeDayAssignmentsCount > 0 ? `(${activeDayAssignmentsCount} คาบ)` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configured Calendar Overrides Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base">
              รายการวันหยุดราชการและวันเปิดเรียนพิเศษที่กำหนดไว้
            </h3>
            <p className="text-xs text-slate-500">
              แสดงรายการที่มีการกำหนดเพิ่มเติมในปีการศึกษา {activeYear?.name || '2569'}
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-teal-50 text-[#0C7C82] font-bold">
            ทั้งหมด {sortedEntries.length} รายการ
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 px-6">วันที่</th>
                <th className="py-4 px-6">สถานะ</th>
                <th className="py-4 px-6">ชื่อวัน / รายละเอียด</th>
                <th className="py-4 px-6">การโอนรายวิชา</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                    ยังไม่มีการกำหนดวันหยุดราชการหรือเปิดเรียนพิเศษ คลิกที่วันที่ในปฏิทินด้านบนเพื่อตั้งค่า
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => {
                  const transferredOutTarget = transferredOutMap.get(entry.date);
                  const transferCount = entry.transferDayOfWeek
                    ? assignments.filter((a) => a.dayOfWeek === entry.transferDayOfWeek).length
                    : 0;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-800 text-xs whitespace-nowrap">
                        {formatThaiFullDate(entry.date)}
                      </td>
                      <td className="py-4 px-6">
                        {entry.type === 'holiday' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                            วันหยุด (เช็คชื่อไม่ได้)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            เปิดเป็นวันปกติ
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-800 text-xs">
                        {entry.title}
                      </td>
                      <td className="py-4 px-6 text-xs">
                        {entry.type === 'normal' && entry.transferDayOfWeek ? (
                          <div className="inline-flex flex-col gap-0.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold">
                            <span>
                              จัดสอนตามตารางวัน{entry.transferDayOfWeek} ({transferCount} คาบของครูทั้งหมด)
                            </span>
                            {entry.transferredFromDate && (
                              <span className="text-[10px] text-indigo-600">
                                โอนจากวันที่ {formatToThaiBE(entry.transferredFromDate)}
                              </span>
                            )}
                          </div>
                        ) : entry.type === 'holiday' && transferredOutTarget ? (
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-semibold text-[11px]">
                            โอนรายวิชาไปวันที่ {formatToThaiBE(transferredOutTarget.date)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-1 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDateModal(entry.date)}
                          className="p-2 rounded-xl text-slate-600 hover:text-[#0C7C82] hover:bg-teal-50 transition-colors cursor-pointer"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEntryFromList(entry)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Configure Selected Date */}
      {selectedDate && selectedDateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 text-[#0C7C82] flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    ตั้งค่าวันที่ในปฏิทิน
                  </h3>
                  <p className="text-xs font-semibold text-[#0C7C82] mt-0.5">
                    {formatThaiFullDate(selectedDate)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    สถานะเริ่มต้นของระบบ:{' '}
                    <strong>
                      {selectedDateInfo.status.isWeekend
                        ? 'วันหยุดสุดสัปดาห์อัตโนมัติ (เสาร์-อาทิตย์)'
                        : `วันเปิดเรียนปกติ (วัน${selectedDateInfo.naturalDay})`}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-5 overflow-y-auto flex-1 pr-1">
              {/* Type Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalMode('holiday');
                    if (!modalTitle || modalTitle.startsWith('เปิดเรียนปกติ')) {
                      setModalTitle('วันหยุดราชการ');
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    modalMode === 'holiday'
                      ? 'border-red-500 bg-red-50/70 ring-2 ring-red-100'
                      : 'border-slate-200 bg-white hover:border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-extrabold text-red-700">
                      กำหนดเป็นวันหยุดราชการ
                    </span>
                    {modalMode === 'holiday' && <CheckCircle2 className="w-4 h-4 text-red-600" />}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    ครูไม่สามารถเช็คชื่อนักเรียนในวันนี้ได้ และสามารถโอนรายวิชาไปสอนวันอื่นได้
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalMode('normal');
                    if (!modalTitle || modalTitle === 'วันหยุดราชการ') {
                      setModalTitle(
                        selectedDateInfo.status.isWeekend ? 'เปิดเรียนปกติ (ชดเชย)' : 'เปิดเรียนปกติ'
                      );
                    }
                  }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    modalMode === 'normal'
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-100'
                      : 'border-slate-200 bg-white hover:border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-extrabold text-emerald-800">
                      เปิดเป็นวันเรียนปกติ
                    </span>
                    {modalMode === 'normal' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    เปิดให้เช็คชื่อได้ตามปกติ (รวมถึงวันเสาร์-อาทิตย์) และโอนตารางสอนมาจัดสอนได้
                  </p>
                </button>
              </div>

              {/* Holiday Configuration */}
              {modalMode === 'holiday' && (
                <div className="space-y-4 p-4 rounded-2xl bg-red-50/40 border border-red-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      ชื่อวันหยุดราชการ / หมายเหตุ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={modalTitle}
                      onChange={(e) => setModalTitle(e.target.value)}
                      placeholder="เช่น วันปิยมหาราช, วันหยุดพิเศษ"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-red-400"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {HOLIDAY_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setModalTitle(preset)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                            modalTitle === preset
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-700'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Optional: Transfer all teachers' subjects of this day to an opened-normal date */}
                  {selectedDateInfo.naturalDay && (
                    <div className="p-3.5 rounded-2xl bg-white border border-red-200 space-y-3">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableHolidayTransfer}
                          onChange={(e) => {
                            setEnableHolidayTransfer(e.target.checked);
                            if (e.target.checked && !holidayTransferTargetDate) {
                              setHolidayTransferTargetDate(getNextSaturdayISO(selectedDate));
                            }
                          }}
                          className="mt-0.5 w-4 h-4 rounded text-[#0C7C82] focus:ring-[#0C7C82] border-slate-300 cursor-pointer"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                            <span>โอนรายวิชาที่สอนในวันนี้ของครูทั้งหมดไปจัดสอนในวันที่เปิดเป็นปกติ</span>
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            วัน{selectedDateInfo.naturalDay}มีตารางสอนของครูทั้งหมด{' '}
                            <strong className="text-[#0C7C82]">
                              {selectedDateInfo.naturalAssignments.length} คาบสอน
                            </strong>{' '}
                            (จากครู{' '}
                            {new Set(selectedDateInfo.naturalAssignments.map((a) => a.teacherUsername)).size}{' '}
                            ท่าน)
                          </div>
                        </div>
                      </label>

                      {enableHolidayTransfer && (
                        <div className="pt-3 border-t border-slate-100 space-y-2.5 animate-fade-in">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              เลือกวันที่ปลายทาง (ระบบจะเปิดวันนั้นเป็นวันเรียนปกติให้อัตโนมัติ){' '}
                              <span className="text-red-500">*</span>
                            </label>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <input
                                type="date"
                                value={holidayTransferTargetDate}
                                onChange={(e) => setHolidayTransferTargetDate(e.target.value)}
                                required={enableHolidayTransfer}
                                className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                              />
                              {holidayTransferTargetDate && (
                                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-200">
                                  {formatThaiFullDate(holidayTransferTargetDate)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Open Normal Day & Transfer Schedule Configuration */}
              {modalMode === 'normal' && (
                <div className="space-y-4 p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      ชื่อวัน / หมายเหตุการเปิดเรียนปกติ
                    </label>
                    <input
                      type="text"
                      value={modalTitle}
                      onChange={(e) => setModalTitle(e.target.value)}
                      placeholder="เช่น เปิดเรียนปกติ, สอนชดเชยวันหยุด"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Transfer subjects from another day or holiday */}
                  <div className="p-4 rounded-2xl bg-white border border-emerald-200 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                      <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                      <span>โอนรายวิชาที่สอนของครูทั้งหมดมาจัดสอนในวันนี้</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!selectedDateInfo.status.isWeekend && (
                        <button
                          type="button"
                          onClick={() => setTransferSourceMode('none')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                            transferSourceMode === 'none'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                          }`}
                        >
                          ใช้ตารางปกติของวัน{selectedDateInfo.naturalDay}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setTransferSourceMode('holiday');
                          if (!selectedSourceHolidayDate && weekdayHolidayEntries.length > 0) {
                            setSelectedSourceHolidayDate(weekdayHolidayEntries[0].date);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                          transferSourceMode === 'holiday'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                        }`}
                      >
                        โอนจากวันหยุดราชการที่กำหนด
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferSourceMode('weekday')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                          transferSourceMode === 'weekday'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                        }`}
                      >
                        เลือกตามตารางสอนวัน (จ.-ศ.)
                      </button>
                    </div>

                    {transferSourceMode === 'holiday' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          เลือกวันหยุดต้นทางที่ต้องการโอนรายวิชามาสอน
                        </label>
                        {weekdayHolidayEntries.length === 0 ? (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>ยังไม่มีวันหยุดราชการในวันจันทร์-ศุกร์ กรุณาเลือกแท็บ "เลือกตามตารางสอนวัน (จ.-ศ.)" หรือกำหนดวันหยุดก่อน</span>
                          </div>
                        ) : (
                          <select
                            value={selectedSourceHolidayDate}
                            onChange={(e) => setSelectedSourceHolidayDate(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- เลือกวันหยุดต้นทาง --</option>
                            {weekdayHolidayEntries.map((h) => {
                              const dName = getDayOfWeekFromDate(h.date);
                              const count = getAssignmentsForDay(dName).length;
                              return (
                                <option key={h.id} value={h.date}>
                                  {formatToThaiBE(h.date)} (วัน{dName}) - {h.title} ({count} คาบสอน)
                                </option>
                              );
                            })}
                          </select>
                        )}
                      </div>
                    )}

                    {transferSourceMode === 'weekday' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          เลือกตารางสอนของวัน (ระบบจะดึงรายวิชาของครูทั้งหมดในวันนั้นมาสอน)
                        </label>
                        <select
                          value={selectedTransferDay}
                          onChange={(e) => setSelectedTransferDay(e.target.value as DayOfWeek)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                        >
                          {DAY_ORDER.map((d) => {
                            const count = getAssignmentsForDay(d).length;
                            return (
                              <option key={d} value={d}>
                                วัน{d} ({count} คาบสอนของครูทั้งหมด)
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {/* Preview of all teachers' classes that will be taught on this opened-normal date */}
                    {normalTransferPreview.day && (
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-[#0C7C82]" />
                            <span>
                              รายวิชาที่จะจัดสอนในวันนี้ (ตามตารางวัน{normalTransferPreview.day}):
                            </span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-teal-50 text-[#0C7C82] font-bold text-[11px]">
                            {normalTransferPreview.list.length} คาบ /{' '}
                            {new Set(normalTransferPreview.list.map((a) => a.teacherUsername)).size} ครู
                          </span>
                        </div>

                        {normalTransferPreview.list.length === 0 ? (
                          <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-400 text-center">
                            ยังไม่มีรายวิชาที่มอบหมายสอนในวัน{normalTransferPreview.day}
                          </div>
                        ) : (
                          <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100 text-[11px]">
                            {normalTransferPreview.list.map((a) => (
                              <div
                                key={a.id}
                                className="px-3 py-2 flex items-center justify-between gap-2 bg-slate-50/40"
                              >
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-800">{a.teacherName}</span>
                                  <span className="text-slate-400 mx-1.5">•</span>
                                  <span className="font-mono font-bold text-[#0C7C82]">{a.subjectCode}</span>{' '}
                                  <span className="text-slate-700">{a.subjectName}</span>
                                </div>
                                <div className="shrink-0 flex items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                    {a.className}
                                  </span>
                                  <span className="text-slate-500 font-mono">{a.periodName}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div>
                  {selectedDateInfo.status.entry && (
                    <button
                      type="button"
                      onClick={handleResetDate}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>คืนค่าเริ่มต้นตามระบบ</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl text-white text-xs font-bold bg-[#0C7C82] hover:bg-[#096368] shadow-md shadow-[#0C7C82]/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกปฏิทิน'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
