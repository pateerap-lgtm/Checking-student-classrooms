import React, { useState, useMemo } from 'react';
import {
  CalendarRange,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Printer,
  BookOpen,
  Award,
  AlertTriangle,
  FileDown,
  School,
  User,
  GraduationCap,
  TrendingUp,
  ChevronDown
} from 'lucide-react';
import { Student, AttendanceLog, Subject, Classroom, AcademicYear, SystemSettings, AppUser } from '../../types';
import { getAcademicYearMonths, YearMonthOption, THAI_MONTHS_FULL, formatToThaiBE } from '../../utils/thaiDate';

interface StudentMonthlyAttendanceViewProps {
  currentStudent: Student;
  attendanceLogs: AttendanceLog[];
  subjects: Subject[];
  classes: Classroom[];
  teachers: AppUser[];
  activeYear?: AcademicYear;
  settings: SystemSettings;
}

export const StudentMonthlyAttendanceView: React.FC<StudentMonthlyAttendanceViewProps> = ({
  currentStudent,
  attendanceLogs,
  subjects,
  classes,
  teachers,
  activeYear,
  settings
}) => {
  // Available Months for Selection
  const monthOptions = useMemo<YearMonthOption[]>(() => {
    return getAcademicYearMonths(activeYear);
  }, [activeYear]);

  // Initial month key: pick current month or first option
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const found = monthOptions.find((m) => m.key === curKey);
    return found ? found.key : monthOptions[0]?.key || curKey;
  });

  // Find month label
  const selectedMonthObj = monthOptions.find((m) => m.key === selectedMonthKey);
  const selectedMonthLabel = selectedMonthObj?.label || 'ประจำเดือน';

  // Find homeroom teacher
  const advisorTeacher = teachers.find((t) => t.role === 'teacher') || {
    id: 't_advisor',
    username: 'advisor1',
    password: '',
    fullName: 'ครูประจำชั้น / ครูที่ปรึกษา',
    role: 'teacher' as const
  };

  // Filter logs for this student and this month (or whole semester if 'all')
  const monthlyLogs = useMemo(() => {
    return attendanceLogs.filter((log) => {
      const matchStudent = log.records?.some(
        (r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name
      );
      if (!matchStudent) return false;
      if (selectedMonthKey === 'all') return true;
      return log.date.startsWith(selectedMonthKey);
    });
  }, [attendanceLogs, currentStudent, selectedMonthKey]);

  // Unique days with recorded attendance in this month
  const uniqueRecordedDays = useMemo(() => {
    return Array.from(new Set(monthlyLogs.map((l) => l.date))).sort();
  }, [monthlyLogs]);

  // Overall monthly statistics
  const monthlyStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let sick = 0;
    let leave = 0;
    let total = 0;

    monthlyLogs.forEach((log) => {
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

    const attended = present + late;
    const rate = total > 0 ? Math.round((attended / total) * 1000) / 10 : 100;

    return {
      total,
      present,
      absent,
      late,
      sick,
      leave,
      attended,
      rate
    };
  }, [monthlyLogs, currentStudent]);

  // Subject-by-Subject Monthly Breakdown
  const subjectMonthlyStats = useMemo(() => {
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

    // First populate from registered class subjects if available
    subjects
      .filter((s) => s.classId === currentStudent.classId || s.className === currentStudent.className)
      .forEach((s) => {
        map.set(s.id, {
          subjectId: s.id,
          code: s.code,
          name: s.name,
          teacherName: '',
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          sick: 0,
          leave: 0
        });
      });

    // Populate from actual monthly logs
    monthlyLogs.forEach((log) => {
      const rec = log.records?.find(
        (r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name
      );
      if (rec) {
        const subKey = log.subjectId || log.subjectCode;
        if (!map.has(subKey)) {
          map.set(subKey, {
            subjectId: subKey,
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
        const item = map.get(subKey)!;
        item.total++;
        if (log.teacherName && !item.teacherName) item.teacherName = log.teacherName;
        if (rec.status === 'present') item.present++;
        else if (rec.status === 'absent') item.absent++;
        else if (rec.status === 'late') item.late++;
        else if (rec.status === 'sick') item.sick++;
        else if (rec.status === 'leave') item.leave++;
      }
    });

    return Array.from(map.values()).map((s) => {
      const attended = s.present + s.late;
      const rate = s.total > 0 ? Math.round((attended / s.total) * 1000) / 10 : 100;
      return {
        ...s,
        attended,
        rate
      };
    });
  }, [monthlyLogs, subjects, currentStudent]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header Card (Hidden on Print) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] text-white flex items-center justify-center shadow-lg shadow-[#0C7C82]/20 shrink-0">
            <CalendarRange className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">เข้าเรียนรายเดือน</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              สรุปสถิติเวลาเรียนรายวิชาประจำเดือนและพิมพ์รายงานสรุป
            </p>
          </div>
        </div>

        {/* Month Selector & Print Button */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="relative">
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-slate-50/50 hover:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] cursor-pointer"
            >
              <option value="all">ทั้งปีการศึกษา (สะสมทั้งหมด)</option>
              {monthOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white text-sm font-bold shadow-md shadow-[#0C7C82]/25 hover:shadow-lg hover:scale-105 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์รายงาน (PDF)</span>
          </button>
        </div>
      </div>

      {/* Monthly Summary Banner (Hidden on Print) */}
      <div className="bg-gradient-to-r from-[#0C7C82] via-[#0e8a91] to-[#35B4B0] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden no-print">
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs">
              <Calendar className="w-3.5 h-3.5 text-teal-200" />
              <span>สรุปผลการเข้าเรียน {selectedMonthLabel}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {currentStudent.name} (ชั้น {currentStudent.className} เลขที่ {currentStudent.seq || 1})
            </h2>
            <p className="text-xs sm:text-sm text-teal-100">
              {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'} • ปีการศึกษา {activeYear?.name || '2569'}
            </p>
          </div>

          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-4 sm:p-5 flex items-center gap-4 text-center sm:text-left shrink-0">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-teal-100 font-medium">
                ร้อยละเวลาเรียนประจำเดือน
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white mt-0.5">
                {monthlyStats.rate}%
              </div>
              <span className="text-[11px] text-teal-200 mt-0.5 block">
                {monthlyStats.rate >= 80 ? '✓ ผ่านเกณฑ์ 80%' : '⚠ ต่ำกว่าเกณฑ์ 80%'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Award className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 5 KPI Mini Counters */}
        <div className="mt-6 pt-5 border-t border-white/20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs text-center">
            <span className="text-[11px] block text-teal-100">วันเรียนที่บันทึก</span>
            <span className="text-xl font-bold">{uniqueRecordedDays.length} วัน</span>
          </div>
          <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs text-center">
            <span className="text-[11px] block text-teal-100">คาบเรียนทั้งหมด</span>
            <span className="text-xl font-bold">{monthlyStats.total} คาบ</span>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/25 backdrop-blur-xs text-center">
            <span className="text-[11px] block text-emerald-100">มาเรียน</span>
            <span className="text-xl font-bold">{monthlyStats.present} คาบ</span>
          </div>
          <div className="p-3 rounded-2xl bg-red-500/25 backdrop-blur-xs text-center">
            <span className="text-[11px] block text-red-100">ขาดเรียน</span>
            <span className="text-xl font-bold">{monthlyStats.absent} คาบ</span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/25 backdrop-blur-xs text-center">
            <span className="text-[11px] block text-amber-100">มาสาย</span>
            <span className="text-xl font-bold">{monthlyStats.late} คาบ</span>
          </div>
          <div className="p-3 rounded-2xl bg-sky-500/25 backdrop-blur-xs text-center">
            <span className="text-[11px] block text-sky-100">ลาป่วย/ลากิจ</span>
            <span className="text-xl font-bold">{monthlyStats.sick + monthlyStats.leave} คาบ</span>
          </div>
        </div>
      </div>

      {/* Subject Monthly Table Section (Screen & Print) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xs space-y-6 print:p-0 print:border-none print:shadow-none">
        {/* Printable Official Header (Visible on Print Only) */}
        <div className="hidden print:block text-center space-y-2 mb-6 pb-4 border-b-2 border-slate-800">
          <div className="flex items-center justify-center gap-3">
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt="Logo" className="w-14 h-14 object-contain inline-block" />
            )}
            <div>
              <h2 className="text-xl font-black text-slate-900">{settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}</h2>
              <p className="text-xs text-slate-700">{settings.affiliationName || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาอุดรธานี เขต 3'}</p>
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-2">
            แบบรายงานสรุปสถิติเวลาเรียนรายวิชาของนักเรียน (รายเดือน)
          </h3>
          <p className="text-xs text-slate-700">
            {selectedMonthLabel} • ปีการศึกษา {activeYear?.name || '2569'}
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs text-slate-800 pt-2 font-medium">
            <div className="text-left">ชื่อ-สกุล: <span className="font-bold">{currentStudent.name}</span></div>
            <div>รหัสประจำตัว: <span className="font-bold font-mono">{currentStudent.username}</span></div>
            <div className="text-right">ชั้น: <span className="font-bold">{currentStudent.className}</span> เลขที่: <span className="font-bold">{currentStudent.seq || 1}</span></div>
          </div>
        </div>

        <div className="flex items-center justify-between no-print">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">
              สรุปสถิติการเข้าเรียนแยกตามรายวิชา ({selectedMonthLabel})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ร้อยละเวลาเรียนของแต่ละวิชา และผลการประเมินสิทธิ์เข้าสอบ (เกณฑ์ 80%)
            </p>
          </div>
        </div>

        {subjectMonthlyStats.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <BookOpen className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
            <p className="font-bold text-slate-600">ไม่มีข้อมูลการเช็คชื่อในเดือนนี้</p>
            <p className="text-xs text-slate-400">กรุณาเลือกเดือนอื่นที่มีการบันทึกข้อมูลการเข้าเรียน</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print:text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/70 print:bg-slate-100">
                  <th className="py-3 px-3 text-center w-12">ลำดับ</th>
                  <th className="py-3 px-3">รหัสวิชา</th>
                  <th className="py-3 px-4">ชื่อรายวิชา</th>
                  <th className="py-3 px-3">ครูผู้สอน</th>
                  <th className="py-3 px-3 text-center">คาบรวม</th>
                  <th className="py-3 px-3 text-center text-emerald-700">มา</th>
                  <th className="py-3 px-3 text-center text-red-600">ขาด</th>
                  <th className="py-3 px-3 text-center text-amber-600">สาย</th>
                  <th className="py-3 px-3 text-center text-sky-600">ลา</th>
                  <th className="py-3 px-3 text-center font-black">% เวลาเรียน</th>
                  <th className="py-3 px-4 text-center">การประเมิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm print:text-xs">
                {subjectMonthlyStats.map((sub, idx) => {
                  const isSafe = sub.rate >= 80;
                  return (
                    <tr key={sub.subjectId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-3 text-center text-slate-400 font-bold text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-[#0C7C82] text-xs">
                        {sub.code}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {sub.name}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 text-xs">
                        {sub.teacherName || '-'}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-700">
                        {sub.total}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-emerald-700 bg-emerald-50/30">
                        {sub.present}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-red-600 bg-red-50/30">
                        {sub.absent}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-amber-600 bg-amber-50/30">
                        {sub.late}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-sky-600 bg-sky-50/30">
                        {sub.sick + sub.leave}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`font-black text-sm ${
                            isSafe ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {sub.rate}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isSafe ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ ผ่านเกณฑ์
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                            ⚠ ต่ำกว่าเกณฑ์
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-bold bg-slate-50 text-slate-800 text-sm print:text-xs">
                  <td colSpan={4} className="py-3 px-4 text-right">รวมสถิติทั้งสิ้น:</td>
                  <td className="py-3 px-3 text-center">{monthlyStats.total}</td>
                  <td className="py-3 px-3 text-center text-emerald-700">{monthlyStats.present}</td>
                  <td className="py-3 px-3 text-center text-red-600">{monthlyStats.absent}</td>
                  <td className="py-3 px-3 text-center text-amber-600">{monthlyStats.late}</td>
                  <td className="py-3 px-3 text-center text-sky-600">{monthlyStats.sick + monthlyStats.leave}</td>
                  <td className="py-3 px-3 text-center font-black text-[#0C7C82]">{monthlyStats.rate}%</td>
                  <td className="py-3 px-4 text-center">
                    {monthlyStats.rate >= 80 ? (
                      <span className="text-emerald-700">ผ่านเกณฑ์รวม</span>
                    ) : (
                      <span className="text-red-600">ต้องปรับปรุง</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Printable Signature Section (Visible on Print Only) */}
        <div className="hidden print:grid grid-cols-3 gap-6 pt-12 text-center text-xs text-slate-800">
          <div className="space-y-6">
            <p>ลงชื่อ .....................................................</p>
            <p>({currentStudent.name})</p>
            <p className="font-bold">นักเรียน</p>
          </div>
          <div className="space-y-6">
            <p>ลงชื่อ .....................................................</p>
            <p>({advisorTeacher.fullName})</p>
            <p className="font-bold">ครูประจำชั้น / ครูที่ปรึกษา</p>
          </div>
          <div className="space-y-6">
            <p>ลงชื่อ .....................................................</p>
            <p>({settings.directorName || 'นายภัทรธีระ ประทุมเม'})</p>
            <p className="font-bold">ผู้อำนวยการสถานศึกษา</p>
          </div>
        </div>
      </div>
    </div>
  );
};
