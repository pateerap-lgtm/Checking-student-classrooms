import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  FileText,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Clock,
  AlertTriangle,
  Bell,
  AlertCircle,
  UserX,
  Award,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import { TeachingAssignment, Classroom, Subject, Student, AttendanceLog, Period, AcademicYear } from '../../types';
import { getTodayISODate, getDayOfWeekFromDate, formatToThaiBE, formatThaiFullDate } from '../../utils/thaiDate';

Chart.register(...registerables);

interface TeacherDashboardProps {
  teacherUsername: string;
  teacherFullName: string;
  assignments: TeachingAssignment[];
  periods?: Period[];
  classes: Classroom[];
  subjects: Subject[];
  students: Student[];
  attendanceLogs: AttendanceLog[];
  activeYear?: AcademicYear;
  onNavigateTab: (tabId: string) => void;
  onSelectAssignmentForAttendance?: (assignment: TeachingAssignment) => void;
  onSelectStudentForReport?: (studentId: string, classId: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacherUsername,
  teacherFullName,
  assignments,
  periods = [],
  classes,
  subjects,
  students,
  attendanceLogs,
  activeYear,
  onNavigateTab,
  onSelectAssignmentForAttendance,
  onSelectStudentForReport
}) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  // Filter teacher's assigned subjects and classes
  const myAssignments = useMemo(
    () => assignments.filter((a) => a.teacherUsername === teacherUsername),
    [assignments, teacherUsername]
  );

  // Unique subject IDs and class IDs
  const mySubjectIds = useMemo(
    () => Array.from(new Set(myAssignments.map((a) => a.subjectId))),
    [myAssignments]
  );
  const myClassIds = useMemo(
    () => Array.from(new Set(myAssignments.map((a) => a.classId))),
    [myAssignments]
  );

  const mySubjects = useMemo(
    () => subjects.filter((s) => mySubjectIds.includes(s.id)),
    [subjects, mySubjectIds]
  );
  const myClasses = useMemo(
    () => classes.filter((c) => myClassIds.includes(c.id)),
    [classes, myClassIds]
  );

  // Teacher attendance logs
  const myLogs = useMemo(
    () => attendanceLogs.filter((l) => l.teacherUsername === teacherUsername),
    [attendanceLogs, teacherUsername]
  );

  // Current real-time clock (updates every 30s)
  const [currentTime, setCurrentTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Today's date and day of week
  const todayISODate = getTodayISODate();
  const todayDayOfWeek = getDayOfWeekFromDate(todayISODate);

  // Teaching periods scheduled for TODAY
  const todayAssignments = useMemo(() => {
    if (!todayDayOfWeek) return [];
    return myAssignments.filter((a) => a.dayOfWeek === todayDayOfWeek);
  }, [myAssignments, todayDayOfWeek]);

  // Status for each of today's periods (Checked vs Unchecked Overdue vs Upcoming)
  const todayScheduleItems = useMemo(() => {
    return todayAssignments.map((a) => {
      const startPer = periods.find((p) => p.id === a.periodId);
      const endPer = a.endPeriodId ? periods.find((p) => p.id === a.endPeriodId) : startPer;

      // Check if attendance already recorded today for this slot
      const isChecked = myLogs.some(
        (l) =>
          l.date === todayISODate &&
          (l.classId === a.classId || l.className === a.className) &&
          (l.subjectId === a.subjectId || l.subjectCode === a.subjectCode) &&
          (l.periodId === a.periodId || l.periodName === a.periodName)
      );

      // Has this period's start time arrived?
      const isDue = startPer ? currentTime >= startPer.startTime : false;
      // Is currently in this time window?
      const isNow = startPer && endPer ? currentTime >= startPer.startTime && currentTime <= endPer.endTime : false;
      // Is past period end time?
      const isPassed = endPer ? currentTime > endPer.endTime : false;

      // Overdue: start time reached/passed today, but NOT checked yet!
      const isOverdue = isDue && !isChecked;

      return {
        assignment: a,
        startPeriod: startPer,
        endPeriod: endPer,
        isChecked,
        isDue,
        isNow,
        isPassed,
        isOverdue
      };
    });
  }, [todayAssignments, periods, myLogs, todayISODate, currentTime]);

  // Overdue items that require urgent attendance check
  const overdueItems = useMemo(() => {
    return todayScheduleItems.filter((item) => item.isOverdue);
  }, [todayScheduleItems]);

  // TOP 10 MOST ABSENT STUDENTS (เรียงลำดับจากมากไปน้อย)
  const topAbsentStudents = useMemo(() => {
    // 1. Gather all students belonging to classes taught by this teacher
    const relevantStudents = students.filter(
      (s) => myClassIds.includes(s.classId) || myClasses.some((c) => c.name === s.className)
    );

    // Map to aggregate attendance stats per student
    const statsMap = new Map<
      string,
      {
        student: Student;
        absentCount: number;
        lateCount: number;
        sickCount: number;
        leaveCount: number;
        presentCount: number;
        totalCounted: number;
      }
    >();

    // Pre-populate students in teacher's classes
    relevantStudents.forEach((std) => {
      statsMap.set(std.id, {
        student: std,
        absentCount: 0,
        lateCount: 0,
        sickCount: 0,
        leaveCount: 0,
        presentCount: 0,
        totalCounted: 0
      });
    });

    // Tally attendance records across all logs recorded by this teacher
    myLogs.forEach((log) => {
      log.records?.forEach((rec) => {
        let entry = statsMap.get(rec.studentId);
        if (!entry) {
          const matched = relevantStudents.find((s) => s.name === rec.studentName);
          if (matched) {
            entry = statsMap.get(matched.id);
          } else {
            // Student record outside predefined list
            const fallbackStudent: Student = {
              id: rec.studentId || `std_${rec.studentName}`,
              seq: rec.seq || 999,
              name: rec.studentName,
              className: log.className,
              username: rec.studentId || '',
              password: '',
              classId: log.classId
            };
            entry = {
              student: fallbackStudent,
              absentCount: 0,
              lateCount: 0,
              sickCount: 0,
              leaveCount: 0,
              presentCount: 0,
              totalCounted: 0
            };
            statsMap.set(entry.student.id, entry);
          }
        }

        if (entry) {
          entry.totalCounted += 1;
          if (rec.status === 'absent') entry.absentCount += 1;
          else if (rec.status === 'late') entry.lateCount += 1;
          else if (rec.status === 'sick') entry.sickCount += 1;
          else if (rec.status === 'leave') entry.leaveCount += 1;
          else if (rec.status === 'present') entry.presentCount += 1;
        }
      });
    });

    // Filter only students with at least 1 absence, then sort DESCENDING:
    // 1) absentCount DESC
    // 2) lateCount DESC
    // 3) student.seq ASC
    const absentList = Array.from(statsMap.values())
      .filter((item) => item.absentCount > 0)
      .sort((a, b) => {
        if (b.absentCount !== a.absentCount) {
          return b.absentCount - a.absentCount;
        }
        if (b.lateCount !== a.lateCount) {
          return b.lateCount - a.lateCount;
        }
        return a.student.seq - b.student.seq;
      });

    return absentList.slice(0, 10);
  }, [students, myClassIds, myClasses, myLogs]);

  // Highest absent count for calculating proportional bars
  const maxAbsenceCount = topAbsentStudents[0]?.absentCount || 1;

  // Chart.js Setup
  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) chartInstance.current.destroy();

      let presentTotal = 0;
      let absentTotal = 0;
      let lateTotal = 0;
      let sickTotal = 0;
      let leaveTotal = 0;

      myLogs.forEach((log) => {
        presentTotal += log.summary.present || 0;
        absentTotal += log.summary.absent || 0;
        lateTotal += log.summary.late || 0;
        sickTotal += log.summary.sick || 0;
        leaveTotal += log.summary.leave || 0;
      });

      const dataValues =
        myLogs.length > 0
          ? [presentTotal, absentTotal, lateTotal, sickTotal, leaveTotal]
          : [85, 3, 4, 5, 3];

      chartInstance.current = new Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels: ['มาเรียน', 'ขาดเรียน', 'มาสาย', 'ลาป่วย', 'ลากิจ'],
          datasets: [
            {
              label: 'จำนวนรวม (ครั้ง)',
              data: dataValues,
              backgroundColor: ['#0C7C82', '#EF5350', '#FFCA28', '#35B4B0', '#FF8A65'],
              borderRadius: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 5, font: { family: 'Sarabun' } },
              grid: { color: '#f1f5f9' }
            },
            x: {
              ticks: { font: { family: 'Sarabun' } },
              grid: { display: false }
            }
          }
        }
      });
    }

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [myLogs]);

  // Handle immediate check action
  const handleCheckNow = (assignment: TeachingAssignment) => {
    if (onSelectAssignmentForAttendance) {
      onSelectAssignmentForAttendance(assignment);
    } else {
      onNavigateTab('attendance');
    }
  };

  // Handle navigate to student report
  const handleViewStudentReport = (student: Student) => {
    if (onSelectStudentForReport) {
      onSelectStudentForReport(student.id, student.classId);
    } else {
      onNavigateTab('report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Mobile-only Quick App Shortcut Icons Grid */}
      <div className="block lg:hidden bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              เมนูทางลัดด่วน (Teacher Quick Launch)
            </span>
          </div>
          <span className="text-[11px] text-slate-400">iOS Style</span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <button
            onClick={() => onNavigateTab('attendance')}
            className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] p-3.5 text-white shadow-lg flex items-center justify-center">
              <ClipboardCheck className="w-7 h-7" />
            </div>
            <span className="text-xs text-slate-200 font-medium">เช็คชื่อนักเรียน</span>
          </button>

          <button
            onClick={() => onNavigateTab('report')}
            className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#26A69A] to-[#80CBC4] p-3.5 text-white shadow-lg flex items-center justify-center">
              <FileText className="w-7 h-7" />
            </div>
            <span className="text-xs text-slate-200 font-medium">รายงานสรุป</span>
          </button>

          <button
            onClick={() => onNavigateTab('profile')}
            className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0288D1] to-[#4FC3F7] p-3.5 text-white shadow-lg flex items-center justify-center">
              <TrendingUp className="w-7 h-7" />
            </div>
            <span className="text-xs text-slate-200 font-medium">ข้อมูลส่วนตัว</span>
          </button>
        </div>
      </div>

      {/* Greeting Banner */}
      <div className="bg-gradient-to-r from-[#0C7C82] via-[#108c93] to-[#35B4B0] rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs">
              ยินดีต้อนรับคุณครู
            </span>
            <span className="px-3 py-1 rounded-full bg-white/10 text-xs text-teal-100 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatThaiFullDate(todayISODate)}</span>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-xs text-teal-100 flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>{currentTime} น.</span>
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold mt-2">
            สวัสดี, {teacherFullName}
          </h2>
          <p className="text-teal-100 text-xs sm:text-sm mt-1 max-w-xl">
            ท่านได้รับมอบหมายการสอนทั้งหมด {myAssignments.length} คาบต่อสัปดาห์ใน {myClasses.length} ชั้นเรียน
            {todayAssignments.length > 0
              ? ` • วันนี้มีตารางสอน ${todayAssignments.length} คาบ`
              : ' • วันนี้ไม่มีตารางสอนตามกำหนด'}
          </p>
        </div>
        <div className="absolute right-4 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl"></div>
      </div>

      {/* FEATURE 2: ระบบแจ้งเตือนคาบเรียนที่ถึงกำหนดแล้วแต่ยังไม่ได้เช็คชื่อวันนี้ */}
      {overdueItems.length > 0 ? (
        <div className="bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 rounded-3xl p-5 sm:p-6 text-white shadow-xl shadow-red-500/15 animate-fade-in relative overflow-hidden border border-red-300">
          <div className="relative z-10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                  <Bell className="w-6 h-6 text-white animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white text-red-600 text-[11px] font-extrabold uppercase tracking-wide">
                      แจ้งเตือนสำคัญ
                    </span>
                    <span className="text-xs text-red-100 font-medium">
                      ถึงกำหนดเวลาสอนวันนี้แล้ว
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold mt-0.5">
                    ยังไม่ได้ทำการเช็คชื่อในคาบเรียนที่ถึงกำหนดแล้ว ({overdueItems.length} คาบ)
                  </h3>
                </div>
              </div>

              <button
                onClick={() => handleCheckNow(overdueItems[0].assignment)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-red-700 hover:bg-red-50 font-bold text-xs shadow-md transition-all cursor-pointer shrink-0 active:scale-95"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>เช็คชื่อทันที ({overdueItems.length} คาบที่ค้าง)</span>
              </button>
            </div>

            {/* List of Overdue Classes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {overdueItems.map((item) => {
                const a = item.assignment;
                const timeLabel = item.startPeriod
                  ? `${item.startPeriod.startTime} - ${item.endPeriod?.endTime || item.startPeriod.endTime} น.`
                  : '';

                return (
                  <div
                    key={a.id}
                    className="bg-white/95 text-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between border border-red-100"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{a.periodName} ({timeLabel})</span>
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                          {a.className}
                        </span>
                      </div>

                      <div className="font-bold text-sm text-slate-900 leading-snug">
                        {a.subjectCode} {a.subjectName}
                      </div>
                      <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>เลยเวลาเริ่มคาบ ({item.startPeriod?.startTime || ''} น.) ยังไม่ได้เช็คชื่อ</span>
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">วัน{a.dayOfWeek}</span>
                      <button
                        onClick={() => handleCheckNow(a)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C7C82] hover:bg-[#096368] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>เช็คชื่อ</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : todayAssignments.length > 0 && todayScheduleItems.some((i) => i.isChecked) ? (
        /* Positive Banner: Checked all today's due periods */
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-emerald-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-sm text-emerald-900">
                สถานะการเช็คชื่อวันนี้เป็นปัจจุบันเรียบร้อยแล้ว
              </div>
              <div className="text-xs text-emerald-700">
                ท่านได้บันทึกการเช็คชื่อครบถ้วนทุกคาบที่ถึงกำหนดในวันนี้แล้ว ({todayScheduleItems.filter((i) => i.isChecked).length}/{todayAssignments.length} คาบ)
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('attendance')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs cursor-pointer shadow-xs shrink-0"
          >
            <span>ดูตารางเช็คชื่อ</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card: Total Subjects Taught */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              รายวิชาที่สอน
            </span>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0C7C82] flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 mb-2">
            {mySubjects.length} <span className="text-sm font-normal text-slate-500">วิชา</span>
          </div>
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-50 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span>{myAssignments.length} คาบสอนที่ได้รับมอบหมาย</span>
          </div>
        </div>

        {/* Card: Total Classes Taught */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              ชั้นเรียนที่สอน
            </span>
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#35B4B0] flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 mb-2">
            {myClasses.length} <span className="text-sm font-normal text-slate-500">ห้องเรียน</span>
          </div>
          <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-50">
            {myClasses.map((c) => (
              <span
                key={c.id}
                className="px-2 py-0.5 rounded-full text-[10px] text-white font-medium"
                style={{ backgroundColor: c.color || '#0C7C82' }}
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>

        {/* Card: Attendance Checked */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              บันทึกการเช็คชื่อแล้ว
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800 mb-2">
            {myLogs.length} <span className="text-sm font-normal text-slate-500">ครั้ง</span>
          </div>
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-50 flex items-center justify-between">
            <span>บันทึกสถานะเรียบร้อยในระบบ</span>
            <span className="text-[#0C7C82] font-semibold">เทอม {activeYear?.name || '2569'}</span>
          </div>
        </div>
      </div>

      {/* FEATURE 3: ระบบสถิติการขาดเรียนของนักเรียนบ่อยที่สุด 10 อันดับแรก ผ่านหน้า Dashboard ของครูผู้สอน */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <UserX className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                สถิติการขาดเรียนของนักเรียนบ่อยที่สุด 10 อันดับแรก
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              จัดอันดับตามจำนวนครั้งการขาดเรียน (เรียงลำดับจากมากไปน้อย) ในรายวิชาที่ครูรับผิดชอบสอน
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
              พบ {topAbsentStudents.length} คนที่มีประวัติขาดเรียน
            </span>
          </div>
        </div>

        {topAbsentStudents.length === 0 ? (
          <div className="py-10 text-center space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="font-bold text-slate-700 text-sm">
              ยอดเยี่ยมมาก! ไม่มีนักเรียนขาดเรียนในวิชาที่ท่านสอน
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              นักเรียนในชั้นเรียนที่ท่านรับผิดชอบมาเรียนครบถ้วน หรือยังไม่มีข้อมูลบันทึกการขาดเรียนในระบบ
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topAbsentStudents.map((item, index) => {
                const rank = index + 1;
                const std = item.student;
                const ratio = Math.min(100, Math.round((item.absentCount / maxAbsenceCount) * 100));

                // Risk level calculation
                let riskBadge = {
                  label: 'ติดตามพฤติกรรม',
                  color: 'bg-amber-50 text-amber-800 border-amber-200'
                };
                if (item.absentCount >= 5) {
                  riskBadge = {
                    label: '🚨 เสี่ยงสูง (ขาดเกิน 5 ครั้ง)',
                    color: 'bg-red-50 text-red-800 border-red-200 font-bold'
                  };
                } else if (item.absentCount >= 3) {
                  riskBadge = {
                    label: '⚠️ เฝ้าระวัง (ขาด 3-4 ครั้ง)',
                    color: 'bg-orange-50 text-orange-800 border-orange-200 font-medium'
                  };
                }

                return (
                  <div
                    key={std.id || index}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-[#0C7C82]/40 bg-white hover:bg-slate-50/50 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {/* Rank Badge */}
                        <div
                          className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-extrabold text-xs shadow-xs ${
                            rank === 1
                              ? 'bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-950 ring-2 ring-amber-300'
                              : rank === 2
                              ? 'bg-gradient-to-tr from-slate-300 to-slate-200 text-slate-800 ring-2 ring-slate-300'
                              : rank === 3
                              ? 'bg-gradient-to-tr from-amber-600 to-orange-400 text-white ring-2 ring-amber-500'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm">
                              {std.name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              (เลขที่ {std.seq || '-'})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 text-[10px] font-semibold">
                              ห้อง {std.className}
                            </span>
                            {std.username && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                รหัส: {std.username}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Prominent Absent Count Badge */}
                      <div className="text-right shrink-0">
                        <div className="px-3 py-1 rounded-xl bg-red-500 text-white font-extrabold text-sm shadow-xs flex items-center gap-1">
                          <span>ขาด {item.absentCount} ครั้ง</span>
                        </div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] border ${riskBadge.color}`}>
                          {riskBadge.label}
                        </span>
                      </div>
                    </div>

                    {/* Severity Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-amber-500 to-red-500"
                          style={{ width: `${ratio}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-700 font-medium">มา {item.presentCount}</span>
                          <span>•</span>
                          <span className="text-amber-700 font-medium">สาย {item.lateCount}</span>
                          <span>•</span>
                          <span className="text-sky-700 font-medium">ลา {item.sickCount + item.leaveCount}</span>
                        </div>
                        <span className="text-slate-600 font-semibold">
                          เช็คทั้งหมด {item.totalCounted} คาบ
                        </span>
                      </div>
                    </div>

                    {/* Action button to view this student's report */}
                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => handleViewStudentReport(std)}
                        className="inline-flex items-center gap-1.5 text-xs text-[#0C7C82] hover:text-[#096368] font-semibold cursor-pointer group"
                      >
                        <span>ดูประวัติและ Export PDF รายบุคคล</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Progress fill for each class taught */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#0C7C82]" />
          <span>ความคืบหน้าการสอนและนักเรียนในชั้นเรียนที่รับผิดชอบ</span>
        </h3>

        <div className="space-y-4">
          {myClasses.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              ยังไม่มีชั้นเรียนที่ได้รับมอบหมายการสอนในระบบ
            </div>
          ) : (
            myClasses.map((cls) => {
              const classStudentCount = students.filter(
                (s) => s.classId === cls.id || s.className === cls.name
              ).length;
              const classAssignments = myAssignments.filter((a) => a.classId === cls.id);
              const percentage = Math.min(100, classAssignments.length * 25);

              return (
                <div key={cls.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: cls.color || '#0C7C82' }}
                      ></span>
                      <span className="font-bold text-slate-800">{cls.name}</span>
                      <span className="text-slate-500">
                        ({classAssignments.length} คาบสอน • นักเรียน {classStudentCount} คน)
                      </span>
                    </div>
                    <div className="font-semibold text-slate-700">
                      {percentage}% สัดส่วนคาบสอน
                    </div>
                  </div>
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
            })
          )}
        </div>
      </div>

      {/* Chart.js Canvas */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base">สถิติการมาเรียนของนักเรียนในรายวิชา</h3>
            <p className="text-xs text-slate-500">ภาพรวมสถานะ มาเรียน, ขาด, สาย, ป่วย, กิจ</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-[#0C7C82] font-semibold">
            Chart.js
          </span>
        </div>
        <div className="w-full h-64 relative">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  );
};
