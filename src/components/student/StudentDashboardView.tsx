import React, { useMemo } from 'react';
import {
  Sparkles,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Award,
  BookOpen,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  GraduationCap
} from 'lucide-react';
import { Student, AttendanceLog, Subject, Classroom, AcademicYear, SystemSettings, AppUser } from '../../types';
import { formatToThaiBE, formatThaiFullDate } from '../../utils/thaiDate';

interface StudentDashboardViewProps {
  currentStudent: Student;
  attendanceLogs: AttendanceLog[];
  subjects: Subject[];
  classes: Classroom[];
  teachers: AppUser[];
  activeYear?: AcademicYear;
  settings: SystemSettings;
  onNavigateTab: (tab: string) => void;
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  currentStudent,
  attendanceLogs,
  subjects,
  classes,
  teachers,
  activeYear,
  settings,
  onNavigateTab
}) => {
  // Filter attendance logs that contain this student or match student's class
  const studentLogs = useMemo(() => {
    return attendanceLogs
      .filter((log) => {
        const hasStudentRecord = log.records?.some(
          (r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name
        );
        return hasStudentRecord;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendanceLogs, currentStudent]);

  // Overall Attendance Metrics
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let sick = 0;
    let leave = 0;
    let total = 0;

    studentLogs.forEach((log) => {
      const rec = log.records?.find(
        (r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name
      );
      if (rec) {
        total++;
        if (rec.status === 'present') present++;
        else if (rec.status === 'absent') absent++;
        else if (rec.status === 'late') late++;
        else if (rec.status === 'sick') sick++;
        else if (rec.status === 'leave') leave++;
      }
    });

    const attendanceRate = total > 0 ? ((present + late) / total) * 100 : 100;
    const purePresentRate = total > 0 ? (present / total) * 100 : 100;

    return {
      total,
      present,
      absent,
      late,
      sick,
      leave,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      purePresentRate: Math.round(purePresentRate * 10) / 10
    };
  }, [studentLogs, currentStudent]);

  // Subject-by-subject attendance statistics
  const subjectStats = useMemo(() => {
    const map = new Map<
      string,
      {
        subjectId: string;
        code: string;
        name: string;
        teacherName: string;
        total: number;
        present: number;
        absent: number;
        late: number;
        sick: number;
        leave: number;
      }
    >();

    studentLogs.forEach((log) => {
      const rec = log.records?.find(
        (r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name
      );
      if (rec) {
        const subId = log.subjectId || log.subjectCode;
        if (!map.has(subId)) {
          map.set(subId, {
            subjectId: subId,
            code: log.subjectCode || '',
            name: log.subjectName || 'รายวิชา',
            teacherName: log.teacherName || '',
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            sick: 0,
            leave: 0
          });
        }
        const item = map.get(subId)!;
        item.total++;
        if (rec.status === 'present') item.present++;
        else if (rec.status === 'absent') item.absent++;
        else if (rec.status === 'late') item.late++;
        else if (rec.status === 'sick') item.sick++;
        else if (rec.status === 'leave') item.leave++;
      }
    });

    return Array.from(map.values()).map((s) => {
      const rate = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 1000) / 10 : 100;
      return {
        ...s,
        rate
      };
    });
  }, [studentLogs, currentStudent]);

  // Recent attendance checks (last 5 sessions)
  const recentLogs = useMemo(() => {
    return studentLogs.slice(0, 5).map((log) => {
      const rec = log.records?.find(
        (r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name
      );
      return {
        id: log.id,
        date: log.date,
        thaiDate: log.thaiDateStr || formatToThaiBE(log.date),
        subjectCode: log.subjectCode,
        subjectName: log.subjectName,
        periodName: log.periodName,
        teacherName: log.teacherName,
        status: rec?.status || 'present',
        note: rec?.note
      };
    });
  }, [studentLogs, currentStudent]);

  // Determine attendance evaluation badge
  const getRateBadge = (rate: number) => {
    if (rate >= 85) {
      return {
        label: 'สถิติการเข้าเรียนดีเยี่ยม (ผ่านเกณฑ์)',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        ringColor: '#10B981',
        icon: Award
      };
    } else if (rate >= 80) {
      return {
        label: 'ผ่านเกณฑ์เวลาเรียน 80%',
        color: 'bg-teal-50 text-teal-700 border-teal-200',
        ringColor: '#0C7C82',
        icon: CheckCircle2
      };
    } else {
      return {
        label: 'เวลาเรียนต่ำกว่า 80% (เสี่ยงหมดสิทธิ์สอบ)',
        color: 'bg-red-50 text-red-700 border-red-200 animate-pulse',
        ringColor: '#EF4444',
        icon: AlertTriangle
      };
    }
  };

  const currentBadge = getRateBadge(stats.attendanceRate);
  const BadgeIcon = currentBadge.icon;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            มาเรียน
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            ขาด
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            สาย
          </span>
        );
      case 'sick':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <AlertCircle className="w-3.5 h-3.5 text-sky-600" />
            ลาป่วย
          </span>
        );
      case 'leave':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            ลากิจ
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">-</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Student Welcome & Profile Banner */}
      <div className="bg-gradient-to-r from-[#0C7C82] via-[#0e8a91] to-[#35B4B0] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-black/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl shadow-inner border border-white/30 shrink-0">
              🎓
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="px-3 py-1 rounded-full bg-white/25 text-white text-xs font-bold backdrop-blur-xs">
                  นักเรียนชั้น {currentStudent.className}
                </span>
                <span className="px-3 py-1 rounded-full bg-teal-900/40 text-teal-100 text-xs font-semibold backdrop-blur-xs">
                  เลขที่ {currentStudent.seq || 1}
                </span>
                {activeYear && (
                  <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                    ปีการศึกษา {activeYear.name}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{currentStudent.name}</h1>
              <p className="text-xs sm:text-sm text-teal-100 font-light">
                รหัสประจำตัว: <span className="font-mono font-bold text-white">{currentStudent.username}</span> • {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}
              </p>
            </div>
          </div>

          {/* Quick Attendance Percentage Box */}
          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shrink-0 shadow-lg text-center sm:text-left">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-teal-100 font-medium">
                ร้อยละเวลาเรียนสะสม
              </div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight text-white mt-0.5">
                {stats.attendanceRate}%
              </div>
              <div className="text-[11px] text-teal-200 mt-0.5">
                {stats.present + stats.late} จาก {stats.total} คาบ
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Evaluation alert badge */}
        <div className="mt-6 pt-4 border-t border-white/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <BadgeIcon className="w-4 h-4 text-teal-200 shrink-0" />
            <span className="font-medium text-teal-50">{currentBadge.label}</span>
          </div>
          <button
            onClick={() => onNavigateTab('student-info')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>ดูข้อมูลนักเรียนฉบับเต็ม</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Warning banner if attendance is below 80% */}
      {stats.attendanceRate < 80 && stats.total > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-5 flex items-start gap-4 text-red-800 shadow-xs">
          <div className="p-2.5 rounded-2xl bg-red-100 text-red-600 shrink-0 mt-0.5">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-base text-red-900">
              แจ้งเตือน: เวลาเรียนต่ำกว่าเกณฑ์ 80% ({stats.attendanceRate}%)
            </h3>
            <p className="text-xs text-red-700 leading-relaxed">
              ตามระเบียบการวัดและประเมินผล นักเรียนต้องมีเวลาเรียนไม่น้อยกว่าร้อยละ 80 ของเวลาเรียนทั้งหมดในรายวิชา จึงจะมีสิทธิ์เข้าสอบปลายภาค กรุณาติดต่อครูประจำชั้นหรือครูผู้สอนเพื่อตรวจสอบ
            </p>
          </div>
        </div>
      )}

      {/* Key Metric Statistics Cards (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Periods */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">คาบทั้งหมด</span>
            <BookOpen className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800">{stats.total}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">คาบที่บันทึกแล้ว</div>
          </div>
        </div>

        {/* Present */}
        <div className="bg-emerald-50/60 rounded-3xl p-4 sm:p-5 border border-emerald-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-bold">มาเรียน</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">{stats.present}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">
              {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}% ของคาบเรียน
            </div>
          </div>
        </div>

        {/* Absent */}
        <div className="bg-red-50/60 rounded-3xl p-4 sm:p-5 border border-red-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-red-600">
            <span className="text-xs font-bold">ขาดเรียน</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-red-700">{stats.absent}</div>
            <div className="text-[11px] text-red-600 mt-0.5 font-medium">
              {stats.total > 0 ? Math.round((stats.absent / stats.total) * 100) : 0}% ของคาบเรียน
            </div>
          </div>
        </div>

        {/* Late */}
        <div className="bg-amber-50/60 rounded-3xl p-4 sm:p-5 border border-amber-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-bold">มาสาย</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-700">{stats.late}</div>
            <div className="text-[11px] text-amber-600 mt-0.5 font-medium">นับเป็นเวลาเรียน</div>
          </div>
        </div>

        {/* Sick */}
        <div className="bg-sky-50/60 rounded-3xl p-4 sm:p-5 border border-sky-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-sky-600">
            <span className="text-xs font-bold">ลาป่วย</span>
            <AlertCircle className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-sky-700">{stats.sick}</div>
            <div className="text-[11px] text-sky-600 mt-0.5 font-medium">มีใบลาป่วย</div>
          </div>
        </div>

        {/* Leave */}
        <div className="bg-purple-50/60 rounded-3xl p-4 sm:p-5 border border-purple-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-xs font-bold">ลากิจ</span>
            <Calendar className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-700">{stats.leave}</div>
            <div className="text-[11px] text-purple-600 mt-0.5 font-medium">มีใบลากิจ</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Subject-by-Subject Progress & Recent Attendance Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Subject Attendance Progress */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-50 text-[#0C7C82]">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">สถิติการเข้าเรียนแยกตามรายวิชา</h3>
                  <p className="text-xs text-slate-500">เปอร์เซ็นต์เวลาเรียนในแต่ละรายวิชาที่ลงทะเบียน</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('monthly-attendance')}
                className="text-xs font-semibold text-[#0C7C82] hover:text-[#096368] flex items-center gap-1 cursor-pointer"
              >
                <span>ดูสรุปรายเดือน</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {subjectStats.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                ยังไม่มีการบันทึกสถิติการเช็คชื่อในรายวิชา
              </div>
            ) : (
              <div className="space-y-4">
                {subjectStats.map((sub) => {
                  const isSafe = sub.rate >= 80;
                  return (
                    <div
                      key={sub.subjectId}
                      className="p-4 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#0C7C82] bg-teal-50 px-2 py-0.5 rounded-md">
                              {sub.code}
                            </span>
                            <span className="font-bold text-slate-800 text-sm truncate">{sub.name}</span>
                          </div>
                          {sub.teacherName && (
                            <p className="text-[11px] text-slate-500 mt-0.5">ครูผู้สอน: {sub.teacherName}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`text-sm font-extrabold ${
                              isSafe ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {sub.rate}%
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {sub.present + sub.late}/{sub.total} คาบ
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isSafe ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, sub.rate)}%` }}
                        />
                      </div>

                      {/* Details row */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100/80">
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-700">มา {sub.present}</span>
                          <span className="text-red-600">ขาด {sub.absent}</span>
                          <span className="text-amber-600">สาย {sub.late}</span>
                          <span className="text-sky-600">ลา {sub.sick + sub.leave}</span>
                        </div>
                        <span className={`font-semibold ${isSafe ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isSafe ? '✓ ผ่านเกณฑ์' : '⚠ เสี่ยงหมดสิทธิ์สอบ'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Recent Attendance Check Sessions */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-50 text-[#0C7C82]">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">การเช็คชื่อล่าสุด</h3>
                  <p className="text-xs text-slate-500">ผลการเข้าเรียนในคาบล่าสุด</p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('daily-attendance')}
                className="text-xs font-semibold text-[#0C7C82] hover:text-[#096368] flex items-center gap-1 cursor-pointer"
              >
                <span>ดูทั้งหมด</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                ยังไม่มีข้อมูลการเช็คชื่อล่าสุด
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{log.subjectName}</span>
                        <span className="text-[11px] text-slate-400 font-mono">({log.subjectCode})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span>{log.thaiDate}</span>
                        <span>•</span>
                        <span>{log.periodName}</span>
                        {log.teacherName && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{log.teacherName}</span>
                          </>
                        )}
                      </div>
                      {log.note && (
                        <p className="text-[11px] text-slate-400 italic">หมายเหตุ: {log.note}</p>
                      )}
                    </div>
                    <div className="shrink-0">{getStatusBadge(log.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shortcut Navigation Cards */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigateTab('daily-attendance')}
              className="p-3 rounded-2xl bg-teal-50/70 hover:bg-teal-50 border border-teal-100 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-[#0C7C82] mb-1">
                <CalendarDays className="w-4 h-4" />
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="font-bold text-xs text-slate-800">เข้าเรียนรายวัน</div>
              <div className="text-[10px] text-slate-500">ตรวจสอบตามวันที่</div>
            </button>

            <button
              onClick={() => onNavigateTab('monthly-attendance')}
              className="p-3 rounded-2xl bg-purple-50/70 hover:bg-purple-50 border border-purple-100 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-purple-600 mb-1">
                <CalendarRange className="w-4 h-4" />
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="font-bold text-xs text-slate-800">เข้าเรียนรายเดือน</div>
              <div className="text-[10px] text-slate-500">สรุปและพิมพ์รายงาน</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
