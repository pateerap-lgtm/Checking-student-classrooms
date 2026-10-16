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
  CalendarRange
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
import { Classroom, Subject, Student, AppUser, AttendanceLog, AcademicYear } from '../../types';

Chart.register(...registerables);

interface AdminDashboardProps {
  subjects: Subject[];
  classes: Classroom[];
  students: Student[];
  users: AppUser[];
  attendanceLogs: AttendanceLog[];
  onNavigateTab: (tabId: string) => void;
  academicYears?: AcademicYear[];
  activeYear?: AcademicYear;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  subjects,
  classes,
  students,
  users,
  attendanceLogs,
  onNavigateTab,
  academicYears = [],
  activeYear
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

  // Filter Attendance Logs by Year & Semester
  const filteredAttendanceLogs = useMemo(() => {
    return attendanceLogs.filter((log) => {
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
  }, [attendanceLogs, currentSelectedYear, selectedSemester]);

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

  // Categorize subjects
  const coreSubjects = subjects.filter((s) => s.type === 'พื้นฐาน');
  const electiveSubjects = subjects.filter((s) => s.type === 'เพิ่มเติม');
  const activitySubjects = subjects.filter((s) => s.type === 'พัฒนาผู้เรียน');

  const teachersCount = users.filter((u) => u.role === 'teacher').length;

  useEffect(() => {
    // Subject Chart (Donut)
    if (subjectChartRef.current) {
      if (subjectChartInstance.current) {
        subjectChartInstance.current.destroy();
      }

      subjectChartInstance.current = new Chart(subjectChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['วิชาพื้นฐาน', 'วิชาเพิ่มเติม', 'กิจกรรมพัฒนาผู้เรียน'],
          datasets: [
            {
              data: [coreSubjects.length, electiveSubjects.length, activitySubjects.length],
              backgroundColor: ['#0C7C82', '#35B4B0', '#AED581'],
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
  }, [subjects, classes, students, coreSubjects.length, electiveSubjects.length, activitySubjects.length]);

  return (
    <div className="space-y-6">
      {/* Mobile-only iPhone-like Quick App Shortcut Icons Grid */}
      <div className="block lg:hidden bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              เมนูทางลัดด่วน (Quick Launch)
            </span>
          </div>
          <span className="text-[11px] text-slate-400">iOS Style</span>
        </div>

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
      </div>

      {/* Main Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <span>พื้นฐาน {coreSubjects.length}</span>
            <span>• เพิ่มเติม {electiveSubjects.length}</span>
            <span>• พัฒนาผู้เรียน {activitySubjects.length}</span>
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
            <button
              onClick={() => onNavigateTab('classes')}
              className="text-[#0C7C82] hover:underline font-medium text-xs cursor-pointer"
            >
              จัดการชั้นเรียน
            </button>
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

      {/* Recharts Attendance Summary Section for Entire School by Semester */}
      <div className="bg-white rounded-3xl p-6 lg:p-7 border border-slate-100 shadow-xs space-y-6">
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
            <button
              onClick={() => onNavigateTab('attendance')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0C7C82] hover:bg-[#096368] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>ไปที่หน้าบันทึกการเช็คชื่อ</span>
            </button>
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
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart: Subjects by Category */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">สัดส่วนประเภทรายวิชา</h3>
              <p className="text-xs text-slate-500">สัดส่วนตามกลุ่มสาระพื้นฐาน เพิ่มเติม และกิจกรรม</p>
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
    </div>
  );
};
