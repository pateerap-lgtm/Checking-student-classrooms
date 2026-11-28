import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen,
  GraduationCap,
  Users,
  CheckCircle2,
  Calendar,
  Clock,
  Settings,
  CalendarCheck,
  UserCheck,
  TrendingUp,
  Award,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  Filter,
  ClipboardCheck,
  AlertCircle,
  School,
  CalendarRange,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Eye,
  FileDown,
  Search,
  X,
  ArrowLeft,
  ArrowRight,
  Printer
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import {
  Classroom,
  Subject,
  Student,
  AppUser,
  AttendanceLog,
  AcademicYear,
  SchoolCalendarEntry,
  TeachingAssignment,
  Period,
  SystemSettings
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

Chart.register(...registerables);

type DailyEvaluationStatus = 'present' | 'absent' | 'late' | 'sick' | 'leave';

interface StudentDayDetail {
  date: string;
  dayOfWeek: string;
  isOpenedNormal: boolean;
  totalPeriodsInDay: number;
  attendedPeriodsInDay: number;
  attendancePercentInDay: number;
  isPresentDay: boolean;
  dayResult: DailyEvaluationStatus;
  presentCount: number;
  lateCount: number;
  sickCount: number;
  leaveCount: number;
  absentCount: number;
}

interface StudentAbsenceSummaryRow {
  student: Student;
  className: string;
  evaluatedDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  sickDays: number;
  leaveDays: number;
  attendanceDayPercent: number;
  dayDetails: StudentDayDetail[];
}

interface AdminDashboardProps {
  subjects: Subject[];
  classes: Classroom[];
  students: Student[];
  users: AppUser[];
  attendanceLogs: AttendanceLog[];
  assignments?: TeachingAssignment[];
  periods?: Period[];
  settings?: SystemSettings;
  calendarEntries?: SchoolCalendarEntry[];
  onNavigateTab: (tabId: string) => void;
  academicYears?: AcademicYear[];
  activeYear?: AcademicYear;
  currentUserRole?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  subjects,
  classes,
  students,
  users,
  attendanceLogs,
  assignments = [],
  periods = [],
  settings,
  calendarEntries = [],
  onNavigateTab,
  academicYears = [],
  activeYear,
  currentUserRole = 'admin'
}) => {
  const subjectChartRef = useRef<HTMLCanvasElement | null>(null);
  const attendanceChartRef = useRef<HTMLCanvasElement | null>(null);
  const subjectChartInstance = useRef<Chart | null>(null);
  const attendanceChartInstance = useRef<Chart | null>(null);

  // Attendance Overview Filters
  const [selectedYearId, setSelectedYearId] = useState<string>(
    activeYear?.id || (academicYears.length > 0 ? academicYears[0].id : '')
  );
  const [selectedSemester, setSelectedSemester] = useState<'all' | 'term1' | 'term2'>('all');
  const [chartType, setChartType] = useState<'both' | 'pie' | 'bar'>('both');
  const [barGrouping, setBarGrouping] = useState<'class' | 'status'>('class');

  useEffect(() => {
    if (!selectedYearId && (activeYear?.id || academicYears.length > 0)) {
      setSelectedYearId(activeYear?.id || academicYears[0].id);
    }
  }, [activeYear, academicYears, selectedYearId]);

  // Current Selected Academic Year object
  const currentSelectedYear = useMemo(() => {
    if (!academicYears || academicYears.length === 0) return activeYear;
    return academicYears.find((y) => y.id === selectedYearId) || activeYear || academicYears[0];
  }, [academicYears, selectedYearId, activeYear]);

  // Classroom Monthly Absence Report States (Admin Dashboard)
  const sortedClasses = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name, 'th')),
    [classes]
  );

  const reportMonthOptions = useMemo<YearMonthOption[]>(
    () => getAcademicYearMonths(currentSelectedYear || activeYear),
    [currentSelectedYear, activeYear]
  );

  const defaultReportMonthKey = useMemo(() => {
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const found = reportMonthOptions.find((m) => m.key === curKey);
    return found ? found.key : reportMonthOptions[0]?.key || curKey;
  }, [reportMonthOptions]);

  const [selectedReportClassId, setSelectedReportClassId] = useState<string>('');
  const [selectedReportMonthKey, setSelectedReportMonthKey] = useState<string>(defaultReportMonthKey);
  const [onlyUpToTodayReport, setOnlyUpToTodayReport] = useState<boolean>(true);
  const [reportStudentSearch, setReportStudentSearch] = useState<string>('');
  const [viewingStudentDetail, setViewingStudentDetail] = useState<StudentAbsenceSummaryRow | null>(null);

  useEffect(() => {
    if (sortedClasses.length === 0) {
      if (selectedReportClassId !== 'ALL') setSelectedReportClassId('ALL');
      return;
    }
    if (
      !selectedReportClassId ||
      (selectedReportClassId !== 'ALL' && !sortedClasses.some((c) => c.id === selectedReportClassId))
    ) {
      setSelectedReportClassId(sortedClasses[0].id);
    }
  }, [sortedClasses, selectedReportClassId]);

  useEffect(() => {
    if (reportMonthOptions.length === 0) return;
    const exists = reportMonthOptions.some((m) => m.key === selectedReportMonthKey);
    if (!exists) {
      setSelectedReportMonthKey(defaultReportMonthKey);
    }
  }, [reportMonthOptions, selectedReportMonthKey, defaultReportMonthKey]);

  const selectedReportMonthOption = useMemo(
    () => reportMonthOptions.find((m) => m.key === selectedReportMonthKey) || reportMonthOptions[0],
    [reportMonthOptions, selectedReportMonthKey]
  );

  const todayISODate = getTodayISODate();

  const teachingPeriods = useMemo(
    () => [...periods].filter((p) => !p.isLunchBreak).sort((a, b) => a.order - b.order),
    [periods]
  );

  const openReportDates = useMemo(() => {
    if (!selectedReportMonthOption) return [];
    const { year, monthIndex } = selectedReportMonthOption;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const list: { date: string; dayOfWeek: string; isOpenedNormal: boolean }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (onlyUpToTodayReport && dateStr > todayISODate) continue;
      const calStatus = resolveCalendarDateStatus(dateStr, calendarEntries);
      if (calStatus.isHoliday || !calStatus.effectiveDayOfWeek) continue;
      list.push({
        date: dateStr,
        dayOfWeek: calStatus.effectiveDayOfWeek,
        isOpenedNormal: calStatus.isOpenedNormal
      });
    }
    return list;
  }, [selectedReportMonthOption, onlyUpToTodayReport, todayISODate, calendarEntries]);

  const classAbsenceReport = useMemo(() => {
    const getCoveredPeriodKeys = (
      periodId?: string,
      endPeriodId?: string,
      fallbackName?: string
    ): string[] => {
      if (teachingPeriods.length > 0 && periodId) {
        const startIdx = teachingPeriods.findIndex((p) => p.id === periodId);
        if (startIdx !== -1) {
          const endIdx = endPeriodId ? teachingPeriods.findIndex((p) => p.id === endPeriodId) : startIdx;
          const realEnd = endIdx !== -1 && endIdx >= startIdx ? endIdx : startIdx;
          return teachingPeriods.slice(startIdx, realEnd + 1).map((p) => `pid:${p.id}`);
        }
      }
      if (periodId) return [`pid:${periodId}`];
      if (fallbackName) return [`pname:${fallbackName}`];
      return ['single'];
    };

    const targetClasses =
      selectedReportClassId === 'ALL'
        ? sortedClasses
        : sortedClasses.filter((c) => c.id === selectedReportClassId);

    if (targetClasses.length === 0) {
      return { rows: [] as StudentAbsenceSummaryRow[], checkedDaysCount: 0 };
    }

    // Index logs in selected month
    const monthLogsByDate = new Map<string, AttendanceLog[]>();
    attendanceLogs.forEach((log) => {
      if (!log.date.startsWith(selectedReportMonthKey)) return;
      if (currentSelectedYear && log.academicYearId && log.academicYearId !== currentSelectedYear.id) {
        return;
      }
      if (!monthLogsByDate.has(log.date)) monthLogsByDate.set(log.date, []);
      monthLogsByDate.get(log.date)!.push(log);
    });

    const classMap = new Map<string, Classroom>();
    targetClasses.forEach((c) => classMap.set(c.id, c));

    const rows: StudentAbsenceSummaryRow[] = [];
    const activeDatesAcrossTarget = new Set<string>();

    targetClasses.forEach((cls) => {
      const classStudents = students
        .filter((s) => s.classId === cls.id || s.className === cls.name)
        .sort((a, b) => {
          const seqA = Number(a.seq || 0);
          const seqB = Number(b.seq || 0);
          if (seqA !== seqB) return seqA - seqB;
          return a.name.localeCompare(b.name, 'th');
        });

      // Precompute day evaluations for this classroom
      const dayContexts: {
        date: string;
        dayOfWeek: string;
        isOpenedNormal: boolean;
        totalPeriodsInDay: number;
        logEntries: { log: AttendanceLog; periodKeys: string[] }[];
      }[] = [];

      openReportDates.forEach(({ date, dayOfWeek, isOpenedNormal }) => {
        const dayLogs = (monthLogsByDate.get(date) || []).filter(
          (l) => l.classId === cls.id || l.className === cls.name
        );
        // Evaluate only school days that have at least one attendance record for this classroom
        if (dayLogs.length === 0) return;

        activeDatesAcrossTarget.add(date);

        const dayAssignments = assignments.filter(
          (a) => a.dayOfWeek === dayOfWeek && (a.classId === cls.id || a.className === cls.name)
        );

        const dayPeriodKeys = new Set<string>();
        dayAssignments.forEach((a) => {
          getCoveredPeriodKeys(a.periodId, a.endPeriodId, a.periodName).forEach((k) =>
            dayPeriodKeys.add(k)
          );
        });

        const logEntries = dayLogs.map((log) => {
          const matchedAssign = dayAssignments.find(
            (a) =>
              (log.subjectId === a.subjectId || log.subjectCode === a.subjectCode) &&
              (log.periodId === a.periodId || log.periodName === a.periodName)
          );
          const periodKeys = getCoveredPeriodKeys(
            log.periodId || matchedAssign?.periodId,
            matchedAssign?.endPeriodId,
            log.periodName || matchedAssign?.periodName
          );
          periodKeys.forEach((k) => dayPeriodKeys.add(k));
          return { log, periodKeys };
        });

        const totalPeriodsInDay = dayPeriodKeys.size;
        if (totalPeriodsInDay === 0) return;

        dayContexts.push({
          date,
          dayOfWeek,
          isOpenedNormal,
          totalPeriodsInDay,
          logEntries
        });
      });

      classStudents.forEach((st) => {
        let presentDays = 0;
        let absentDays = 0;
        let lateDays = 0;
        let sickDays = 0;
        let leaveDays = 0;
        const dayDetails: StudentDayDetail[] = [];

        dayContexts.forEach((ctx) => {
          const attendedKeys = new Set<string>();
          let presentCount = 0;
          let lateCount = 0;
          let sickCount = 0;
          let leaveCount = 0;
          let absentCount = 0;

          ctx.logEntries.forEach(({ log, periodKeys }) => {
            const rec = log.records?.find(
              (r) => r.studentId === st.id || r.studentName === st.name
            );
            if (!rec) return;

            const weight = periodKeys.length;
            if (rec.status === 'present') {
              periodKeys.forEach((k) => attendedKeys.add(k));
              presentCount += weight;
            } else if (rec.status === 'late') {
              periodKeys.forEach((k) => attendedKeys.add(k));
              lateCount += weight;
            } else if (rec.status === 'sick') {
              sickCount += weight;
            } else if (rec.status === 'leave') {
              leaveCount += weight;
            } else if (rec.status === 'absent') {
              absentCount += weight;
            }
          });

          const attendedPeriodsInDay = attendedKeys.size;
          const attendancePercentInDay = Math.round(
            (attendedPeriodsInDay / ctx.totalPeriodsInDay) * 100
          );
          // More than 50% of total periods in 1 day -> Present/Late 1 day; otherwise Sick/Leave/Absent 1 day
          const isPresentDay = attendedPeriodsInDay * 2 > ctx.totalPeriodsInDay;

          let dayResult: DailyEvaluationStatus = 'absent';
          if (isPresentDay) {
            if (presentCount * 2 > ctx.totalPeriodsInDay) {
              dayResult = 'present';
              presentDays += 1;
            } else {
              dayResult = 'late';
              lateDays += 1;
            }
          } else {
            if (sickCount >= leaveCount && sickCount >= absentCount && sickCount > 0) {
              dayResult = 'sick';
              sickDays += 1;
            } else if (leaveCount >= sickCount && leaveCount >= absentCount && leaveCount > 0) {
              dayResult = 'leave';
              leaveDays += 1;
            } else {
              dayResult = 'absent';
              absentDays += 1;
            }
          }

          dayDetails.push({
            date: ctx.date,
            dayOfWeek: ctx.dayOfWeek,
            isOpenedNormal: ctx.isOpenedNormal,
            totalPeriodsInDay: ctx.totalPeriodsInDay,
            attendedPeriodsInDay,
            attendancePercentInDay,
            isPresentDay,
            dayResult,
            presentCount,
            lateCount,
            sickCount,
            leaveCount,
            absentCount
          });
        });

        const evaluatedDays = dayDetails.length;
        const attendedDaysTotal = presentDays + lateDays;
        const attendanceDayPercent =
          evaluatedDays > 0 ? Math.round((attendedDaysTotal / evaluatedDays) * 100) : 0;

        rows.push({
          student: st,
          className: cls.name,
          evaluatedDays,
          presentDays,
          absentDays,
          lateDays,
          sickDays,
          leaveDays,
          attendanceDayPercent,
          dayDetails
        });
      });
    });

    const q = reportStudentSearch.trim().toLowerCase();
    const filteredRows = q
      ? rows.filter(
          (r) =>
            r.student.name.toLowerCase().includes(q) ||
            (r.student.username || '').toLowerCase().includes(q) ||
            r.className.toLowerCase().includes(q)
        )
      : rows;

    return {
      rows: filteredRows,
      checkedDaysCount: activeDatesAcrossTarget.size
    };
  }, [
    sortedClasses,
    selectedReportClassId,
    students,
    openReportDates,
    attendanceLogs,
    selectedReportMonthKey,
    currentSelectedYear,
    assignments,
    teachingPeriods,
    reportStudentSearch
  ]);

  const classAbsenceKPI = useMemo(() => {
    const totalStudents = classAbsenceReport.rows.length;
    const totalPresentDays = classAbsenceReport.rows.reduce((acc, r) => acc + r.presentDays, 0);
    const totalLateDays = classAbsenceReport.rows.reduce((acc, r) => acc + r.lateDays, 0);
    const totalSickDays = classAbsenceReport.rows.reduce((acc, r) => acc + r.sickDays, 0);
    const totalLeaveDays = classAbsenceReport.rows.reduce((acc, r) => acc + r.leaveDays, 0);
    const totalAbsentDays = classAbsenceReport.rows.reduce((acc, r) => acc + r.absentDays, 0);
    const studentsWithAbsence = classAbsenceReport.rows.filter((r) => r.absentDays > 0).length;
    const totalEvaluated =
      totalPresentDays + totalLateDays + totalSickDays + totalLeaveDays + totalAbsentDays;
    const avgRate =
      totalEvaluated > 0
        ? (((totalPresentDays + totalLateDays) / totalEvaluated) * 100).toFixed(1)
        : '0.0';
    return {
      totalStudents,
      totalPresentDays,
      totalLateDays,
      totalSickDays,
      totalLeaveDays,
      totalAbsentDays,
      studentsWithAbsence,
      avgRate
    };
  }, [classAbsenceReport.rows]);

  const selectedReportClassLabel = useMemo(() => {
    if (selectedReportClassId === 'ALL') return `ทุกชั้นเรียน (${sortedClasses.length} ห้อง)`;
    return sortedClasses.find((c) => c.id === selectedReportClassId)?.name || '-';
  }, [selectedReportClassId, sortedClasses]);

  const effectiveDirectorName = useMemo(() => {
    if (settings?.directorName?.trim()) return settings.directorName.trim();
    const dir = users.find((u) => u.role === 'director');
    return dir?.fullName?.trim() || 'ผู้อำนวยการสถานศึกษา';
  }, [settings?.directorName, users]);

  const changeReportMonthByOffset = (offset: number) => {
    const idx = reportMonthOptions.findIndex((m) => m.key === selectedReportMonthKey);
    if (idx === -1) return;
    const nextIdx = idx + offset;
    if (nextIdx >= 0 && nextIdx < reportMonthOptions.length) {
      setSelectedReportMonthKey(reportMonthOptions[nextIdx].key);
    }
  };

  const handlePrintClassAbsencePDF = () => {
    window.print();
  };

  const handleExportClassAbsenceExcel = () => {
    const selectedClassObj = sortedClasses.find((c) => c.id === selectedReportClassId);
    const classLabel =
      selectedReportClassId === 'ALL' ? 'ทุกชั้นเรียน' : selectedClassObj?.name || 'ชั้นเรียน';
    const exportRows = classAbsenceReport.rows.map((r, idx) => ({
      'ลำดับ': idx + 1,
      'เลขที่': r.student.seq || idx + 1,
      'รหัสนักเรียน': r.student.username || '-',
      'ชื่อ - นามสกุล': r.student.name,
      'ชั้นเรียน': r.className,
      'วันเรียนที่เช็ค (วัน)': r.evaluatedDays,
      'มา (วัน)': r.presentDays,
      'ขาด (วัน)': r.absentDays,
      'สาย (วัน)': r.lateDays,
      'ป่วย (วัน)': r.sickDays,
      'กิจ (วัน)': r.leaveDays,
      'ร้อยละมาเรียน (%)': `${r.attendanceDayPercent}%`
    }));
    exportToExcel(
      exportRows,
      `สรุปการขาดเรียนรายชั้น_${classLabel}_${selectedReportMonthOption?.label || selectedReportMonthKey}`,
      'สรุปวันขาดเรียน'
    );
  };

  // Filter Attendance Logs by Year & Semester (excluding holiday dates)
  const filteredAttendanceLogs = useMemo(() => {
    return attendanceLogs.filter((log) => {
      if (resolveCalendarDateStatus(log.date, calendarEntries).isHoliday) {
        return false;
      }

      // 1. Year filter
      if (currentSelectedYear) {
        if (log.academicYearId && log.academicYearId !== currentSelectedYear.id) {
          return false;
        }
      }

      // 2. Semester filter
      if (selectedSemester === 'term1') {
        if (currentSelectedYear?.term1Start && currentSelectedYear?.term1End) {
          return log.date >= currentSelectedYear.term1Start && log.date <= currentSelectedYear.term1End;
        }
        const m = parseInt(log.date.split('-')[1], 10);
        return m >= 5 && m <= 10;
      }

      if (selectedSemester === 'term2') {
        if (currentSelectedYear?.term2Start && currentSelectedYear?.term2End) {
          return log.date >= currentSelectedYear.term2Start && log.date <= currentSelectedYear.term2End;
        }
        const m = parseInt(log.date.split('-')[1], 10);
        return m >= 11 || m <= 4;
      }

      return true; // 'all'
    });
  }, [attendanceLogs, currentSelectedYear, selectedSemester, calendarEntries]);

  // Calculate Attendance Metrics for the entire school in selected semester
  const attendanceMetrics = useMemo(() => {
    let present = 0;
    let late = 0;
    let sick = 0;
    let leave = 0;
    let absent = 0;

    filteredAttendanceLogs.forEach((log) => {
      if (log.summary) {
        present += Number(log.summary.present || 0);
        late += Number(log.summary.late || 0);
        sick += Number(log.summary.sick || 0);
        leave += Number(log.summary.leave || 0);
        absent += Number(log.summary.absent || 0);
      } else if (log.records && log.records.length > 0) {
        log.records.forEach((r) => {
          if (r.status === 'present') present++;
          else if (r.status === 'late') late++;
          else if (r.status === 'sick') sick++;
          else if (r.status === 'leave') leave++;
          else if (r.status === 'absent') absent++;
        });
      }
    });

    const totalAttendance = present + late + sick + leave + absent;
    const attendedTotal = present + late;
    const rate = totalAttendance > 0 ? ((attendedTotal / totalAttendance) * 100).toFixed(1) : '0.0';
    const presentRate = totalAttendance > 0 ? ((present / totalAttendance) * 100).toFixed(1) : '0.0';
    const lateRate = totalAttendance > 0 ? ((late / totalAttendance) * 100).toFixed(1) : '0.0';
    const leaveRate = totalAttendance > 0 ? (((sick + leave) / totalAttendance) * 100).toFixed(1) : '0.0';
    const absentRate = totalAttendance > 0 ? ((absent / totalAttendance) * 100).toFixed(1) : '0.0';

    return {
      present,
      late,
      sick,
      leave,
      absent,
      totalAttendance,
      attendedTotal,
      rate,
      presentRate,
      lateRate,
      leaveRate,
      absentRate,
      totalSessions: filteredAttendanceLogs.length
    };
  }, [filteredAttendanceLogs]);

  // Pie chart data for Recharts
  const pieChartData = useMemo(() => {
    const raw = [
      { name: 'มาเรียนปกติ', value: attendanceMetrics.present, color: '#10B981', short: 'มาเรียน' },
      { name: 'มาสาย', value: attendanceMetrics.late, color: '#F59E0B', short: 'มาสาย' },
      { name: 'ลาป่วย', value: attendanceMetrics.sick, color: '#8B5CF6', short: 'ลาป่วย' },
      { name: 'ลากิจ', value: attendanceMetrics.leave, color: '#06B6D4', short: 'ลากิจ' },
      { name: 'ขาดเรียน', value: attendanceMetrics.absent, color: '#EF4444', short: 'ขาดเรียน' },
    ];
    if (attendanceMetrics.totalAttendance === 0) {
      return [{ name: 'ยังไม่มีข้อมูลการเช็คชื่อ', value: 1, color: '#cbd5e1', short: 'ไม่มีข้อมูล' }];
    }
    return raw.filter((item) => item.value > 0);
  }, [attendanceMetrics]);

  // Classroom breakdown for Recharts Bar Chart
  const classBarData = useMemo(() => {
    if (classes.length === 0) return [];
    return classes.map((cls) => {
      const classLogs = filteredAttendanceLogs.filter(
        (l) => l.classId === cls.id || l.className === cls.name
      );
      let p = 0, lt = 0, sk = 0, lv = 0, ab = 0;
      classLogs.forEach((log) => {
        if (log.summary) {
          p += Number(log.summary.present || 0);
          lt += Number(log.summary.late || 0);
          sk += Number(log.summary.sick || 0);
          lv += Number(log.summary.leave || 0);
          ab += Number(log.summary.absent || 0);
        } else if (log.records) {
          log.records.forEach((r) => {
            if (r.status === 'present') p++;
            else if (r.status === 'late') lt++;
            else if (r.status === 'sick') sk++;
            else if (r.status === 'leave') lv++;
            else if (r.status === 'absent') ab++;
          });
        }
      });
      const tot = p + lt + sk + lv + ab;
      const rate = tot > 0 ? Number(((p + lt) / tot * 100).toFixed(1)) : 0;
      return {
        className: cls.name,
        มาเรียน: p,
        มาสาย: lt,
        ลา: sk + lv,
        ขาด: ab,
        ทั้งหมด: tot,
        rate
      };
    });
  }, [classes, filteredAttendanceLogs]);

  // Status breakdown for Recharts Bar Chart
  const statusBarData = useMemo(() => {
    return [
      { status: 'มาเรียน', จำนวน: attendanceMetrics.present, fill: '#10B981' },
      { status: 'มาสาย', จำนวน: attendanceMetrics.late, fill: '#F59E0B' },
      { status: 'ลาป่วย', จำนวน: attendanceMetrics.sick, fill: '#8B5CF6' },
      { status: 'ลากิจ', จำนวน: attendanceMetrics.leave, fill: '#06B6D4' },
      { status: 'ขาดเรียน', จำนวน: attendanceMetrics.absent, fill: '#EF4444' },
    ];
  }, [attendanceMetrics]);

  // Subject totals summary
  const totalWeeklyPeriods = subjects.reduce((sum, s) => sum + (Number(s.periodsPerWeek) || 0), 0);
  const classesWithSubjectsCount = new Set(subjects.map((s) => s.classId).filter(Boolean)).size;

  const teachersCount = users.filter((u) => u.role === 'teacher').length;

  useEffect(() => {
    // Subject Chart (Donut by Classroom)
    if (subjectChartRef.current) {
      if (subjectChartInstance.current) {
        subjectChartInstance.current.destroy();
      }

      const subjectClassLabels = classes.map((c) => c.name);
      const subjectClassCounts = classes.map(
        (c) => subjects.filter((s) => s.classId === c.id || s.className === c.name).length
      );
      const subjectClassColors = classes.map((c) => c.color || '#0C7C82');

      subjectChartInstance.current = new Chart(subjectChartRef.current, {
        type: 'doughnut',
        data: {
          labels: subjectClassLabels.length > 0 ? subjectClassLabels : ['ไม่มีข้อมูล'],
          datasets: [
            {
              data: subjectClassCounts.length > 0 ? subjectClassCounts : [0],
              backgroundColor: subjectClassColors.length > 0 ? subjectClassColors : ['#cbd5e1'],
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                font: { family: 'Sarabun' },
              },
            },
          },
          cutout: '65%',
        },
      });
    }

    // Attendance Bar Chart
    if (attendanceChartRef.current) {
      if (attendanceChartInstance.current) {
        attendanceChartInstance.current.destroy();
      }

      // Group students by class
      const classLabels = classes.map((c) => c.name);
      const studentCounts = classes.map(
        (c) => students.filter((s) => s.classId === c.id || s.className === c.name).length
      );
      const classColors = classes.map((c) => c.color || '#0C7C82');

      attendanceChartInstance.current = new Chart(attendanceChartRef.current, {
        type: 'bar',
        data: {
          labels: classLabels.length > 0 ? classLabels : ['ไม่มีข้อมูล'],
          datasets: [
            {
              label: 'จำนวนนักเรียน (คน)',
              data: studentCounts.length > 0 ? studentCounts : [0],
              backgroundColor: classColors,
              borderRadius: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, font: { family: 'Sarabun' } },
              grid: { color: '#f1f5f9' },
            },
            x: {
              ticks: { font: { family: 'Sarabun' } },
              grid: { display: false },
            },
          },
        },
      });
    }

    return () => {
      if (subjectChartInstance.current) subjectChartInstance.current.destroy();
      if (attendanceChartInstance.current) attendanceChartInstance.current.destroy();
    };
  }, [subjects, classes, students]);

  return (
    <div className="space-y-6">
      {/* Mobile-only iPhone-like Quick App Shortcut Icons Grid */}
      <div className="block lg:hidden bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-xl no-print">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              เมนูทางลัดด่วน (Quick Launch)
            </span>
          </div>
          <span className="text-[11px] text-slate-400">iOS Style</span>
        </div>

        {currentUserRole === 'director' ? (
          <div className="grid grid-cols-4 gap-3 text-center">
            <button
              onClick={() => onNavigateTab('dashboard')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] p-3 text-white shadow-lg flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">แดชบอร์ด</span>
            </button>

            <button
              onClick={() => onNavigateTab('report')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#26A69A] to-[#80CBC4] p-3 text-white shadow-lg flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">รายงานเช็คชื่อ</span>
            </button>

            <button
              onClick={() => onNavigateTab('daily-report')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0288D1] to-[#4FC3F7] p-3 text-white shadow-lg flex items-center justify-center">
                <CalendarDays className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">รายงานรายวัน</span>
            </button>

            <button
              onClick={() => onNavigateTab('monthly-report')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#8E24AA] to-[#BA68C8] p-3 text-white shadow-lg flex items-center justify-center">
                <CalendarRange className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">รายงานรายเดือน</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 text-center">
            <button
              onClick={() => onNavigateTab('classes')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] p-3 text-white shadow-lg flex items-center justify-center">
                <GraduationCap className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">ชั้นเรียน</span>
            </button>

            <button
              onClick={() => onNavigateTab('subjects')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#26A69A] to-[#80CBC4] p-3 text-white shadow-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">รายวิชา</span>
            </button>

            <button
              onClick={() => onNavigateTab('students')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0288D1] to-[#4FC3F7] p-3 text-white shadow-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">นักเรียน</span>
            </button>

            <button
              onClick={() => onNavigateTab('assignments')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#F57C00] to-[#FFB74D] p-3 text-white shadow-lg flex items-center justify-center">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">มอบหมาย</span>
            </button>

            <button
              onClick={() => onNavigateTab('periods')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#4A2C6D] to-[#9575CD] p-3 text-white shadow-lg flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">คาบสอน</span>
            </button>

            <button
              onClick={() => onNavigateTab('years')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#AED581] to-[#7CB342] p-3 text-white shadow-lg flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">ปีการศึกษา</span>
            </button>

            <button
              onClick={() => onNavigateTab('users')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#FF8A65] to-[#FF7043] p-3 text-white shadow-lg flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">ผู้ใช้งาน</span>
            </button>

            <button
              onClick={() => onNavigateTab('settings')}
              className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#607D8B] to-[#90A4AE] p-3 text-white shadow-lg flex items-center justify-center">
                <Settings className="w-6 h-6" />
              </div>
              <span className="text-[11px] text-slate-200 truncate w-full font-medium">ตั้งค่า</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Total Subjects Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              รายวิชาทั้งหมด
            </span>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0C7C82] flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 mb-2">
            {subjects.length} <span className="text-sm font-normal text-slate-500">วิชา</span>
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-50">
            <span>รวม {totalWeeklyPeriods} คาบ/สัปดาห์</span>
            <span>• {classesWithSubjectsCount} ชั้นเรียน</span>
          </div>
        </div>

        {/* Total Classes Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              ชั้นเรียนทั้งหมด
            </span>
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#35B4B0] flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 mb-2">
            {classes.length} <span className="text-sm font-normal text-slate-500">ห้องเรียน</span>
          </div>
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#35B4B0]" />
              <span>ห้องเรียนทั้งหมดในระบบ</span>
            </div>
            {currentUserRole === 'director' ? (
              <button
                onClick={() => onNavigateTab('report')}
                className="text-[#0C7C82] hover:underline font-medium text-xs cursor-pointer"
              >
                ดูรายงานการเช็คชื่อ
              </button>
            ) : (
              <button
                onClick={() => onNavigateTab('classes')}
                className="text-[#0C7C82] hover:underline font-medium text-xs cursor-pointer"
              >
                จัดการชั้นเรียน
              </button>
            )}
          </div>
        </div>

        {/* Total Students Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              นักเรียนทั้งหมด
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 mb-2">
            {students.length} <span className="text-sm font-normal text-slate-500">คน</span>
          </div>
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-50 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>มีรหัสประจำตัวครบถ้วนในระบบ</span>
          </div>
        </div>

        {/* Teachers Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              ครูผู้สอน
            </span>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 mb-2">
            {teachersCount} <span className="text-sm font-normal text-slate-500">ท่าน</span>
          </div>
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-50 flex items-center justify-between">
            <span>ผู้ดูแลระบบ {users.filter((u) => u.role === 'admin').length}</span>
            <span>• ผู้อำนวยการสถานศึกษา {users.filter((u) => u.role === 'director').length}</span>
          </div>
        </div>
      </div>

      {/* Admin Monthly Classroom Absence Report Section */}
      {currentUserRole === 'admin' && (
        <div className="bg-white rounded-3xl p-6 lg:p-7 border border-slate-100 shadow-xs space-y-5 print:border-none print:shadow-none print:rounded-none print:p-0">
          {/* Official Print Header */}
          <div className="hidden print:block p-4 border-b-2 border-slate-800 text-center space-y-2 mb-4">
            <div className="flex items-center justify-center gap-3">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-14 h-14 object-contain" />
              ) : (
                <School className="w-12 h-12 text-slate-800" />
              )}
              <div className="text-left">
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  {settings?.schoolName || 'โรงเรียน'}
                </h1>
                <p className="text-xs text-slate-700">
                  {settings?.affiliationName || 'สำนักงานเขตพื้นที่การศึกษา'}
                </p>
              </div>
            </div>
            <div className="pt-1">
              <h2 className="text-base font-bold text-slate-900">
                รายงานสรุปจำนวนวันมาเรียน - ขาดเรียนรายชั้นเรียน ประจำเดือน
              </h2>
              <p className="text-xs text-slate-800 mt-0.5">
                ชั้นเรียน: <strong>{selectedReportClassLabel}</strong> | ประจำเดือน:{' '}
                <strong>{selectedReportMonthOption?.label}</strong> | ปีการศึกษา:{' '}
                <strong>{currentSelectedYear?.name || activeYear?.name || '2569'}</strong>
              </p>
              <p className="text-[11px] text-slate-700 mt-0.5">
                จำนวนนักเรียน: {classAbsenceKPI.totalStudents} คน | วันเปิดเรียนที่เช็คชื่อ:{' '}
                {classAbsenceReport.checkedDaysCount} วัน | อัตรามาเรียนเฉลี่ย: {classAbsenceKPI.avgRate}%
              </p>
            </div>
          </div>

          {/* Section Header (No Print) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 no-print">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#0C7C82]/20">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-800">
                    รายงานสรุปจำนวนวันขาดเรียนรายชั้นเรียน ประจำเดือน
                  </h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0C7C82] font-semibold border border-teal-100">
                    {selectedReportMonthOption?.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  เกณฑ์การคำนวณ: 1 วัน = จำนวนคาบเรียนทั้งหมดในวันนั้น หากมาเรียน (มา/สาย) เกิน 50% ของจำนวนคาบทั้งหมดใน 1 วัน คิดเป็นมาเรียน 1 วัน (ไม่เกิน 50% แยกเป็น ขาด/ป่วย/กิจ 1 วัน)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
              <button
                type="button"
                onClick={handleExportClassAbsenceExcel}
                disabled={classAbsenceReport.rows.length === 0}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 font-semibold text-xs shadow-2xs transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-emerald-600" />
                <span>ส่งออก Excel</span>
              </button>
              <button
                type="button"
                onClick={handlePrintClassAbsencePDF}
                disabled={classAbsenceReport.rows.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white font-semibold text-xs shadow-md shadow-[#0C7C82]/20 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ PDF</span>
              </button>
            </div>
          </div>

          {/* Filters: Classroom Dropdown List, Month Picker, Search (No Print) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end no-print">
            {/* Classroom Dropdown List */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                ชั้นเรียน (Dropdown List)
              </label>
              <select
                value={selectedReportClassId}
                onChange={(e) => setSelectedReportClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
              >
                {sortedClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
                <option value="ALL">ทุกชั้นเรียน ({sortedClasses.length} ห้อง)</option>
              </select>
            </div>

            {/* Month Picker */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">เลือกเดือน</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => changeReportMonthByOffset(-1)}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  title="เดือนก่อนหน้า"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <select
                  value={selectedReportMonthKey}
                  onChange={(e) => setSelectedReportMonthKey(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
                >
                  {reportMonthOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => changeReportMonthByOffset(1)}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  title="เดือนถัดไป"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Student */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">ค้นหานักเรียน</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={reportStudentSearch}
                  onChange={(e) => setReportStudentSearch(e.target.value)}
                  placeholder="ชื่อนักเรียน / รหัสนักเรียน..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
                />
              </div>
            </div>
          </div>

          {/* Sub-option + Formula Info (No Print) */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs no-print">
            <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyUpToTodayReport}
                onChange={(e) => setOnlyUpToTodayReport(e.target.checked)}
                className="w-4 h-4 rounded text-[#0C7C82] focus:ring-[#0C7C82] border-slate-300 cursor-pointer"
              />
              <span>
                ประมวลผลถึงวันที่ปัจจุบัน ({formatToThaiBE(todayISODate)}) ไม่รวมวันหยุดและวันเปิดเรียนที่ยังไม่มีการเช็คชื่อ
              </span>
            </label>
            <span className="text-[11px] font-semibold text-slate-500">
              วันเปิดเรียนที่เช็คชื่อในเดือน: <strong className="text-slate-800">{classAbsenceReport.checkedDaysCount}</strong> วัน
            </span>
          </div>

          {/* Mini KPI Summary (No Print) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-600">จำนวนนักเรียน</div>
              <div className="text-xl font-extrabold text-slate-800 mt-0.5">
                {classAbsenceKPI.totalStudents} <span className="text-xs font-medium text-slate-500">คน</span>
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-100">
              <div className="text-[11px] font-bold text-teal-800">อัตราการมาเรียนเฉลี่ย</div>
              <div className="text-xl font-extrabold text-[#0C7C82] mt-0.5">
                {classAbsenceKPI.avgRate}%
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <div className="text-[11px] font-bold text-emerald-800">รวมวันมาเรียน (มา / สาย)</div>
              <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
                {(classAbsenceKPI.totalPresentDays + classAbsenceKPI.totalLateDays).toLocaleString()}{' '}
                <span className="text-xs font-medium text-emerald-600">
                  คน-วัน (มา {classAbsenceKPI.totalPresentDays} • สาย {classAbsenceKPI.totalLateDays})
                </span>
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100">
              <div className="text-[11px] font-bold text-rose-800">
                รวมวันขาด/ลา ({classAbsenceKPI.studentsWithAbsence} คนที่มีขาด)
              </div>
              <div className="text-xl font-extrabold text-rose-700 mt-0.5">
                {classAbsenceKPI.totalAbsentDays.toLocaleString()}{' '}
                <span className="text-xs font-medium text-rose-600">
                  ขาด (ป่วย {classAbsenceKPI.totalSickDays} • กิจ {classAbsenceKPI.totalLeaveDays})
                </span>
              </div>
            </div>
          </div>

          {/* Student Absence Summary Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 print:border-slate-800 print:rounded-none">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px] print:bg-slate-100 print:text-black print:border-slate-800">
                  <th className="py-3 px-2.5 text-center w-11 border-r border-slate-200 print:border-slate-800">ลำดับ</th>
                  <th className="py-3 px-2.5 text-center w-12 border-r border-slate-200 print:border-slate-800">เลขที่</th>
                  <th className="py-3 px-2.5 border-r border-slate-200 print:border-slate-800 w-24">รหัสนักเรียน</th>
                  <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[160px]">ชื่อ - นามสกุล</th>
                  {selectedReportClassId === 'ALL' && (
                    <th className="py-3 px-2.5 border-r border-slate-200 print:border-slate-800 w-24">ชั้นเรียน</th>
                  )}
                  <th className="py-3 px-2 text-center w-20 border-r border-slate-200 print:border-slate-800">
                    วันเรียน (วัน)
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-emerald-700 border-r border-slate-200 print:border-slate-800">
                    มา
                  </th>
                  <th className="py-3 px-2 text-center w-14 text-rose-600 border-r border-slate-200 print:border-slate-800">
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
                  <th className="py-3 px-2.5 text-center w-24 border-r border-slate-200 print:border-slate-800 print:border-r-0">
                    ร้อยละมาเรียน
                  </th>
                  <th className="py-3 px-2.5 text-center w-24 no-print">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-800">
                {classAbsenceReport.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selectedReportClassId === 'ALL' ? 13 : 12}
                      className="py-10 text-center text-slate-400"
                    >
                      <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600 text-sm">
                        ไม่พบข้อมูลนักเรียนในชั้นเรียนหรือเดือนที่เลือก
                      </p>
                    </td>
                  </tr>
                ) : (
                  classAbsenceReport.rows.map((row, idx) => (
                    <tr
                      key={row.student.id}
                      className={
                        row.absentDays > 0
                          ? 'bg-rose-50/20 hover:bg-rose-50/40 print:bg-white'
                          : 'bg-white hover:bg-slate-50/70'
                      }
                    >
                      <td className="py-2.5 px-2.5 text-center font-bold text-slate-500 border-r border-slate-100 print:border-slate-800">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-slate-600 border-r border-slate-100 print:border-slate-800">
                        {row.student.seq || idx + 1}
                      </td>
                      <td className="py-2.5 px-2.5 font-mono text-slate-600 border-r border-slate-100 print:border-slate-800">
                        {row.student.username || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 border-r border-slate-100 print:border-slate-800">
                        {row.student.name}
                      </td>
                      {selectedReportClassId === 'ALL' && (
                        <td className="py-2.5 px-2.5 font-semibold text-[#0C7C82] border-r border-slate-100 print:border-slate-800 print:text-black">
                          {row.className}
                        </td>
                      )}
                      <td className="py-2.5 px-2 text-center font-bold text-slate-700 border-r border-slate-100 print:border-slate-800">
                        {row.evaluatedDays}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-emerald-700 border-r border-slate-100 print:border-slate-800">
                        {row.presentDays}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold border-r border-slate-100 print:border-slate-800">
                        {row.absentDays > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-extrabold print:bg-transparent print:text-black">
                            {row.absentDays}
                          </span>
                        ) : (
                          <span className="text-slate-400 print:text-black">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-amber-600 border-r border-slate-100 print:border-slate-800 print:text-black">
                        {row.lateDays}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-sky-600 border-r border-slate-100 print:border-slate-800 print:text-black">
                        {row.sickDays}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-orange-600 border-r border-slate-100 print:border-slate-800 print:text-black">
                        {row.leaveDays}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-bold border-r border-slate-100 print:border-slate-800 print:border-r-0">
                        <span
                          className={
                            row.evaluatedDays === 0
                              ? 'text-slate-400'
                              : row.attendanceDayPercent >= 80
                              ? 'text-emerald-700'
                              : row.attendanceDayPercent >= 60
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }
                        >
                          {row.evaluatedDays > 0 ? `${row.attendanceDayPercent}%` : '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-center no-print">
                        <button
                          type="button"
                          onClick={() => setViewingStudentDetail(row)}
                          disabled={row.evaluatedDays === 0}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-teal-50 text-[#0C7C82] hover:bg-teal-100 disabled:opacity-40 cursor-pointer"
                          title="ดูรายละเอียดรายวัน"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ดูรายวัน</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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
      )}

      {/* Recharts Attendance Summary Section for Entire School by Semester */}
      <div className="bg-white rounded-3xl p-6 lg:p-7 border border-slate-100 shadow-xs space-y-6 no-print">
        {/* Section Header and Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0C7C82] flex items-center justify-center shrink-0 shadow-xs">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">
                  สรุปข้อมูลการมาเรียนของนักเรียนทั้งโรงเรียน
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-[#0C7C82] font-semibold border border-teal-100/50">
                  Recharts
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ภาพรวมสถิติการมาเรียน ขาด ลา มาสาย ของนักเรียนทั้งโรงเรียนในแต่ละภาคเรียน
              </p>
            </div>
          </div>

          {/* Filters: Year & Semester & Chart Type */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Year Selector */}
            {academicYears && academicYears.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <School className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      ปีการศึกษา {y.name} {y.isCurrent ? '(ปัจจุบัน)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Semester Selector */}
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setSelectedSemester('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedSemester === 'all'
                    ? 'bg-white text-[#0C7C82] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                ทุกภาคเรียน
              </button>
              <button
                type="button"
                onClick={() => setSelectedSemester('term1')}
                className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedSemester === 'term1'
                    ? 'bg-white text-[#0C7C82] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                ภาคเรียนที่ 1
              </button>
              <button
                type="button"
                onClick={() => setSelectedSemester('term2')}
                className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  selectedSemester === 'term2'
                    ? 'bg-white text-[#0C7C82] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                ภาคเรียนที่ 2
              </button>
            </div>

            {/* Chart Type Selector */}
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setChartType('both')}
                title="แสดงทั้งสองรูปแบบ"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'both'
                    ? 'bg-white text-[#0C7C82] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('pie')}
                title="แสดงเฉพาะกราฟวงกลม"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'pie'
                    ? 'bg-white text-[#0C7C82] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <PieChartIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                title="แสดงเฉพาะกราฟแท่ง"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'bar'
                    ? 'bg-white text-[#0C7C82] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Rate */}
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50/60 p-4 rounded-2xl border border-teal-100/70">
            <span className="text-[11px] font-semibold text-teal-800 block mb-1">
              อัตราการมาเรียนรวม
            </span>
            <div className="text-2xl font-black text-[#0C7C82]">
              {attendanceMetrics.rate}%
            </div>
            <span className="text-[10px] text-teal-600 block mt-1">
              (มาเรียนปกติ + มาสาย)
            </span>
          </div>

          {/* Present */}
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-emerald-800">มาเรียนปกติ</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="text-xl font-black text-emerald-700">
              {attendanceMetrics.present.toLocaleString()}{' '}
              <span className="text-xs font-normal text-emerald-600">คน-ครั้ง</span>
            </div>
            <span className="text-[10px] text-emerald-600 block mt-1">
              {attendanceMetrics.presentRate}% ของทั้งหมด
            </span>
          </div>

          {/* Late */}
          <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-amber-800">มาสาย</span>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            </div>
            <div className="text-xl font-black text-amber-700">
              {attendanceMetrics.late.toLocaleString()}{' '}
              <span className="text-xs font-normal text-amber-600">คน-ครั้ง</span>
            </div>
            <span className="text-[10px] text-amber-600 block mt-1">
              {attendanceMetrics.lateRate}% ของทั้งหมด
            </span>
          </div>

          {/* Sick */}
          <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-purple-800">ลาป่วย</span>
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            </div>
            <div className="text-xl font-black text-purple-700">
              {attendanceMetrics.sick.toLocaleString()}{' '}
              <span className="text-xs font-normal text-purple-600">คน-ครั้ง</span>
            </div>
            <span className="text-[10px] text-purple-600 block mt-1">
              {attendanceMetrics.totalAttendance > 0
                ? ((attendanceMetrics.sick / attendanceMetrics.totalAttendance) * 100).toFixed(1)
                : '0.0'}% ของทั้งหมด
            </span>
          </div>

          {/* Leave */}
          <div className="bg-cyan-50/70 p-4 rounded-2xl border border-cyan-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-cyan-800">ลากิจ</span>
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
            </div>
            <div className="text-xl font-black text-cyan-700">
              {attendanceMetrics.leave.toLocaleString()}{' '}
              <span className="text-xs font-normal text-cyan-600">คน-ครั้ง</span>
            </div>
            <span className="text-[10px] text-cyan-600 block mt-1">
              {attendanceMetrics.totalAttendance > 0
                ? ((attendanceMetrics.leave / attendanceMetrics.totalAttendance) * 100).toFixed(1)
                : '0.0'}% ของทั้งหมด
            </span>
          </div>

          {/* Absent */}
          <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-rose-800">ขาดเรียน</span>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            </div>
            <div className="text-xl font-black text-rose-700">
              {attendanceMetrics.absent.toLocaleString()}{' '}
              <span className="text-xs font-normal text-rose-600">คน-ครั้ง</span>
            </div>
            <span className="text-[10px] text-rose-600 block mt-1">
              {attendanceMetrics.absentRate}% ของทั้งหมด
            </span>
          </div>
        </div>

        {/* Recharts Charts Container */}
        {filteredAttendanceLogs.length === 0 ? (
          <div className="bg-slate-50/80 rounded-2xl p-8 text-center border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CalendarRange className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 mb-1">
              ยังไม่มีข้อมูลการเช็คชื่อใน{' '}
              {selectedSemester === 'term1'
                ? 'ภาคเรียนที่ 1'
                : selectedSemester === 'term2'
                ? 'ภาคเรียนที่ 2'
                : 'ช่วงเวลานี้'}{' '}
              ปีการศึกษา {currentSelectedYear?.name || ''}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              เมื่อครูผู้สอนบันทึกการเช็คชื่อนักเรียนในรายวิชา ระบบจะสรุปและแสดงกราฟวิเคราะห์ภาพรวมการมาเรียนทั้งโรงเรียนอัตโนมัติ
            </p>
            {currentUserRole === 'director' ? (
              <button
                onClick={() => onNavigateTab('report')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0C7C82] hover:bg-[#096368] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>ไปที่หน้ารายงานการเช็คชื่อ</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigateTab('attendance')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0C7C82] hover:bg-[#096368] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>ไปที่หน้าบันทึกการเช็คชื่อ</span>
              </button>
            )}
          </div>
        ) : (
          <div className={`grid gap-6 ${chartType === 'both' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
            {/* Pie Chart Card */}
            {(chartType === 'both' || chartType === 'pie') && (
              <div
                className={`bg-slate-50/60 rounded-2xl p-5 border border-slate-100 flex flex-col ${
                  chartType === 'both' ? 'lg:col-span-5' : 'col-span-1'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      สัดส่วนการมาเรียนทั้งโรงเรียน (กราฟวงกลม)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      แสดงสัดส่วนร้อยละของแต่ละสถานะการมาเรียน
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                    อัตรามาเรียน {attendanceMetrics.rate}%
                  </span>
                </div>

                <div className="w-full h-72 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={3}
                        label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0];
                            const percent =
                              attendanceMetrics.totalAttendance > 0
                                ? ((Number(data.value) / attendanceMetrics.totalAttendance) * 100).toFixed(1)
                                : '0';
                            return (
                              <div className="bg-slate-900/95 text-white text-xs rounded-xl p-3 shadow-xl border border-slate-700 pointer-events-none">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: data.payload.color }}
                                  />
                                  <span className="font-bold text-sm">{data.name}</span>
                                </div>
                                <div className="text-slate-300">
                                  จำนวน: <span className="font-semibold text-white">{Number(data.value).toLocaleString()} คน-ครั้ง</span>
                                </div>
                                <div className="text-slate-300">
                                  สัดส่วน: <span className="font-semibold text-emerald-400">{percent}%</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <RechartsLegend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie Chart Legend Table */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-200/70 text-center">
                  <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block">มาเรียน</span>
                    <span className="text-xs font-bold text-emerald-600">{attendanceMetrics.presentRate}%</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block">มาสาย</span>
                    <span className="text-xs font-bold text-amber-600">{attendanceMetrics.lateRate}%</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block">ลาป่วย</span>
                    <span className="text-xs font-bold text-purple-600">
                      {attendanceMetrics.totalAttendance > 0
                        ? ((attendanceMetrics.sick / attendanceMetrics.totalAttendance) * 100).toFixed(1)
                        : '0'}%
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block">ลากิจ</span>
                    <span className="text-xs font-bold text-cyan-600">
                      {attendanceMetrics.totalAttendance > 0
                        ? ((attendanceMetrics.leave / attendanceMetrics.totalAttendance) * 100).toFixed(1)
                        : '0'}%
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block">ขาดเรียน</span>
                    <span className="text-xs font-bold text-rose-600">{attendanceMetrics.absentRate}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bar Chart Card */}
            {(chartType === 'both' || chartType === 'bar') && (
              <div
                className={`bg-slate-50/60 rounded-2xl p-5 border border-slate-100 flex flex-col ${
                  chartType === 'both' ? 'lg:col-span-7' : 'col-span-1'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                      {barGrouping === 'class'
                        ? 'สถิติการมาเรียนเปรียบเทียบแต่ละชั้นเรียน (กราฟแท่ง)'
                        : 'สถิติจำนวนคนแยกตามสถานะการมาเรียน (กราฟแท่ง)'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {barGrouping === 'class'
                        ? 'เปรียบเทียบสัดส่วน มาเรียน สาย ลา ขาด ของแต่ละห้อง'
                        : 'เปรียบเทียบจำนวนนักเรียน-ครั้งในแต่ละสถานะ'}
                    </p>
                  </div>

                  {/* Toggle bar view mode */}
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-200/70 text-[11px] self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setBarGrouping('class')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                        barGrouping === 'class'
                          ? 'bg-white text-[#0C7C82] shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      แยกตามชั้นเรียน
                    </button>
                    <button
                      type="button"
                      onClick={() => setBarGrouping('status')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                        barGrouping === 'status'
                          ? 'bg-white text-[#0C7C82] shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ตามสถานะ
                    </button>
                  </div>
                </div>

                <div className="w-full h-72 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    {barGrouping === 'class' ? (
                      <BarChart data={classBarData} margin={{ top: 20, right: 20, left: -10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="className"
                          stroke="#64748b"
                          tick={{ fontSize: 11, fill: '#475569' }}
                        />
                        <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: '#475569' }} />
                        <RechartsTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const matchingClass = classBarData.find((c) => c.className === label);
                              return (
                                <div className="bg-slate-900/95 text-white text-xs rounded-xl p-3 shadow-xl border border-slate-700 pointer-events-none min-w-[150px]">
                                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2">
                                    <span className="font-bold text-slate-100">{label}</span>
                                    {matchingClass && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                                        มาเรียน {matchingClass.rate}%
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    {payload.map((entry: any, index: number) => (
                                      <div key={`item-${index}`} className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-1.5 text-slate-300">
                                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                          {entry.name}:
                                        </span>
                                        <span className="font-semibold text-white">
                                          {entry.value} คน
                                        </span>
                                      </div>
                                    ))}
                                    {matchingClass && (
                                      <div className="pt-1 mt-1 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
                                        <span>เช็คชื่อทั้งหมด:</span>
                                        <span className="text-slate-200 font-semibold">{matchingClass.ทั้งหมด} ครั้ง</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <RechartsLegend verticalAlign="top" align="right" height={30} iconType="circle" />
                        <Bar dataKey="มาเรียน" fill="#10B981" stackId="a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="มาสาย" fill="#F59E0B" stackId="a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="ลา" fill="#8B5CF6" stackId="a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="ขาด" fill="#EF4444" stackId="a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : (
                      <BarChart data={statusBarData} margin={{ top: 20, right: 20, left: -10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="status"
                          stroke="#64748b"
                          tick={{ fontSize: 11, fill: '#475569' }}
                        />
                        <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: '#475569' }} />
                        <RechartsTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const val = payload[0].value;
                              const percent =
                                attendanceMetrics.totalAttendance > 0
                                  ? ((Number(val) / attendanceMetrics.totalAttendance) * 100).toFixed(1)
                                  : '0';
                              return (
                                <div className="bg-slate-900/95 text-white text-xs rounded-xl p-3 shadow-xl border border-slate-700 pointer-events-none">
                                  <div className="font-bold text-slate-100 mb-1">{label}</div>
                                  <div className="text-slate-300">
                                    จำนวน: <span className="font-semibold text-white">{Number(val).toLocaleString()} คน-ครั้ง</span>
                                  </div>
                                  <div className="text-slate-300">
                                    สัดส่วน: <span className="font-semibold text-emerald-400">{percent}%</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="จำนวน" radius={[8, 8, 0, 0]}>
                          {statusBarData.map((entry, index) => (
                            <Cell key={`status-bar-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress fill for each class type / class list */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs no-print">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#0C7C82]" />
          <span>สัดส่วนและจำนวนนักเรียนแยกตามแต่ละชั้นเรียน</span>
        </h3>

        <div className="space-y-4">
          {classes.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              ยังไม่มีข้อมูลชั้นเรียนในระบบ เริ่มต้นสร้างห้องเรียนได้ที่เมนู "จัดการชั้นเรียน"
            </div>
          ) : classes.map((cls) => {
              const classStudentCount = students.filter(
                (s) => s.classId === cls.id || s.className === cls.name
              ).length;
              const percentage = students.length > 0 ? Math.round((classStudentCount / students.length) * 100) : 0;
              const classSubjectCount = subjects.filter(
                (s) => s.classId === cls.id || s.className === cls.name
              ).length;

            return (
              <div key={cls.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: cls.color || '#0C7C82' }}
                    ></span>
                    <span className="font-bold text-slate-700">{cls.name}</span>
                    <span className="text-slate-400">({classSubjectCount} รายวิชา)</span>
                  </div>
                  <div className="font-semibold text-slate-700">
                    {classStudentCount} คน <span className="text-slate-400 font-normal">({percentage}%)</span>
                  </div>
                </div>
                {/* Progress bar fill */}
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: cls.color || '#0C7C82'
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Section with <div><canvas></div> as required */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        {/* Donut Chart: Subjects by Category */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">จำนวนรายวิชาในแต่ละชั้นเรียน</h3>
              <p className="text-xs text-slate-500">สัดส่วนจำนวนรายวิชาที่เปิดสอนจำแนกตามชั้นเรียน</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-[#0C7C82] font-semibold">
              Chart.js
            </span>
          </div>
          <div className="w-full h-64 relative flex items-center justify-center">
            <canvas ref={subjectChartRef}></canvas>
          </div>
        </div>

        {/* Bar Chart: Students Per Class */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">จำนวนนักเรียนในแต่ละชั้นเรียน</h3>
              <p className="text-xs text-slate-500">จำแนกตามสีประจำชั้นเรียน</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-50 text-[#35B4B0] font-semibold">
              Chart.js
            </span>
          </div>
          <div className="w-full h-64 relative">
            <canvas ref={attendanceChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Student Monthly Day-by-Day Absence Detail Modal */}
      {viewingStudentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  รายละเอียดการมาเรียนรายวัน: {viewingStudentDetail.student.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ชั้นเรียน <strong>{viewingStudentDetail.className}</strong> • เดือน{' '}
                  <strong>{selectedReportMonthOption?.label}</strong> • มา{' '}
                  <strong className="text-emerald-700">{viewingStudentDetail.presentDays}</strong> • ขาด{' '}
                  <strong className="text-rose-700">{viewingStudentDetail.absentDays}</strong> • สาย{' '}
                  <strong className="text-amber-600">{viewingStudentDetail.lateDays}</strong> • ป่วย{' '}
                  <strong className="text-sky-600">{viewingStudentDetail.sickDays}</strong> • กิจ{' '}
                  <strong className="text-orange-600">{viewingStudentDetail.leaveDays}</strong> วัน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingStudentDetail(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 bg-teal-50/70 border-b border-teal-100 text-[11px] text-teal-900 font-medium">
              เกณฑ์: หากคาบที่มาเรียน (มา/สาย) มากกว่า 50% ของจำนวนคาบทั้งหมดในวันนั้น คิดเป็น <strong>มา/สาย 1 วัน</strong> (ไม่เกิน 50% แยกเป็น <strong>ขาด/ป่วย/กิจ 1 วัน</strong>)
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <table className="w-full text-left text-xs border-collapse border border-slate-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                    <th className="py-2.5 px-3 border-r border-slate-200">วันที่</th>
                    <th className="py-2.5 px-2.5 text-center border-r border-slate-200 w-24">คาบทั้งหมด</th>
                    <th className="py-2.5 px-2 text-center text-emerald-700 border-r border-slate-200 w-14">มา</th>
                    <th className="py-2.5 px-2 text-center text-rose-600 border-r border-slate-200 w-14">ขาด</th>
                    <th className="py-2.5 px-2 text-center text-amber-600 border-r border-slate-200 w-14">สาย</th>
                    <th className="py-2.5 px-2 text-center text-sky-600 border-r border-slate-200 w-14">ป่วย</th>
                    <th className="py-2.5 px-2 text-center text-orange-600 w-14">กิจ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingStudentDetail.dayDetails.map((d) => (
                    <tr key={d.date} className={d.isPresentDay ? 'bg-white' : 'bg-rose-50/40'}>
                      <td className="py-2.5 px-3 border-r border-slate-100">
                        <div className="font-semibold text-slate-800">{formatThaiFullDate(d.date)}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.dayResult === 'present'
                                ? 'bg-emerald-100 text-emerald-800'
                                : d.dayResult === 'late'
                                ? 'bg-amber-100 text-amber-800'
                                : d.dayResult === 'sick'
                                ? 'bg-sky-100 text-sky-800'
                                : d.dayResult === 'leave'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {d.dayResult === 'present'
                              ? 'มา 1 วัน'
                              : d.dayResult === 'late'
                              ? 'สาย 1 วัน'
                              : d.dayResult === 'sick'
                              ? 'ป่วย 1 วัน'
                              : d.dayResult === 'leave'
                              ? 'กิจ 1 วัน'
                              : 'ขาด 1 วัน'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            (มาเรียน {d.attendancePercentInDay}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-bold text-slate-700 border-r border-slate-100">
                        {d.totalPeriodsInDay}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-emerald-700 border-r border-slate-100">
                        {d.presentCount}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-rose-600 border-r border-slate-100">
                        {d.absentCount}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-amber-600 border-r border-slate-100">
                        {d.lateCount}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-sky-600 border-r border-slate-100">
                        {d.sickCount}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-orange-600">
                        {d.leaveCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingStudentDetail(null)}
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
