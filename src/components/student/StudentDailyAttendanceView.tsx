import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  BookOpen,
  User,
  Printer,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowRight,
  School,
  Check
} from 'lucide-react';
import { Student, AttendanceLog, Subject, Period, Classroom, AcademicYear, SystemSettings } from '../../types';
import { formatToThaiBE, formatThaiFullDate, getDayOfWeekFromDate, getTodayISODate } from '../../utils/thaiDate';

interface StudentDailyAttendanceViewProps {
  currentStudent: Student;
  attendanceLogs: AttendanceLog[];
  subjects: Subject[];
  periods: Period[];
  classes: Classroom[];
  activeYear?: AcademicYear;
  settings: SystemSettings;
}

export const StudentDailyAttendanceView: React.FC<StudentDailyAttendanceViewProps> = ({
  currentStudent,
  attendanceLogs,
  subjects,
  periods,
  classes,
  activeYear,
  settings
}) => {
  // Find all logs containing this student
  const studentLogs = useMemo(() => {
    return attendanceLogs.filter((log) =>
      log.records?.some((r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name)
    );
  }, [attendanceLogs, currentStudent]);

  // All distinct recorded dates sorted descending
  const recordedDates = useMemo(() => {
    const dates = Array.from(new Set(studentLogs.map((l) => l.date))).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
    return dates;
  }, [studentLogs]);

  // Selected date defaults to today or latest recorded date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = getTodayISODate();
    if (studentLogs.some((l) => l.date === today)) {
      return today;
    }
    return recordedDates[0] || today;
  });

  // Filter state for status
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late' | 'leave'>('all');

  // Logs for the selected date
  const dayLogs = useMemo(() => {
    return studentLogs
      .filter((log) => log.date === selectedDate)
      .sort((a, b) => {
        const pA = periods.find((p) => p.name === a.periodName)?.order || 0;
        const pB = periods.find((p) => p.name === b.periodName)?.order || 0;
        return pA - pB;
      });
  }, [studentLogs, selectedDate, periods]);

  // Day summary statistics
  const dayStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let sick = 0;
    let leave = 0;

    dayLogs.forEach((log) => {
      const rec = log.records?.find(
        (r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name
      );
      if (rec) {
        if (rec.status === 'present') present++;
        else if (rec.status === 'absent') absent++;
        else if (rec.status === 'late') late++;
        else if (rec.status === 'sick') sick++;
        else if (rec.status === 'leave') leave++;
      }
    });

    const total = dayLogs.length;
    return {
      total,
      present,
      absent,
      late,
      sick,
      leave,
      attended: present + late
    };
  }, [dayLogs, currentStudent]);

  // Shift date helper
  const handleShiftDate = (days: number) => {
    const cur = new Date(selectedDate);
    if (!isNaN(cur.getTime())) {
      cur.setDate(cur.getDate() + days);
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${d}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            มาเรียน
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-4 h-4 text-red-600" />
            ขาด
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-4 h-4 text-amber-600" />
            สาย
          </span>
        );
      case 'sick':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <AlertCircle className="w-4 h-4 text-sky-600" />
            ลาป่วย
          </span>
        );
      case 'leave':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Calendar className="w-4 h-4 text-purple-600" />
            ลากิจ
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">-</span>;
    }
  };

  // Filter day logs if a specific status filter is active
  const filteredDayLogs = useMemo(() => {
    if (statusFilter === 'all') return dayLogs;
    return dayLogs.filter((log) => {
      const rec = log.records?.find(
        (r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name
      );
      if (!rec) return false;
      if (statusFilter === 'leave') return rec.status === 'sick' || rec.status === 'leave';
      return rec.status === statusFilter;
    });
  }, [dayLogs, statusFilter, currentStudent]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] text-white flex items-center justify-center shadow-lg shadow-[#0C7C82]/20 shrink-0">
            <CalendarDays className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">เข้าเรียนรายวัน</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              ตรวจสอบผลการเช็คชื่อรายวิชาตามคาบเรียนในแต่ละวันของนักเรียน
            </p>
          </div>
        </div>

        {/* Date Selector & Jump Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => handleShiftDate(-1)}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="วันก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] bg-slate-50/50 hover:bg-white cursor-pointer"
          />

          <button
            onClick={() => handleShiftDate(1)}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="วันถัดไป"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedDate(getTodayISODate())}
            className="px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#0C7C82] text-xs font-bold transition-colors cursor-pointer"
          >
            วันนี้
          </button>

          <button
            onClick={() => window.print()}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="พิมพ์รายงานประจำวัน"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selected Day Status Banner */}
      <div className="bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="space-y-1.5 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs">
              <Calendar className="w-3.5 h-3.5 text-teal-200" />
              <span>{formatThaiFullDate(selectedDate)}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {currentStudent.name} (ชั้น {currentStudent.className} เลขที่ {currentStudent.seq || 1})
            </h2>
            <p className="text-xs sm:text-sm text-teal-100">
              {dayStats.total > 0
                ? dayStats.absent === 0 && dayStats.sick === 0 && dayStats.leave === 0
                  ? '✨ เข้าเรียนครบถ้วนสมบูรณ์ทุกคาบในวันนี้'
                  : `บันทึกเวลาเรียนแล้ว ${dayStats.total} คาบ (มา ${dayStats.present}, ขาด ${dayStats.absent}, สาย ${dayStats.late}, ลา ${dayStats.sick + dayStats.leave})`
                : 'ไม่มีข้อมูลการเช็คชื่อสำหรับวันที่เลือก'}
            </p>
          </div>

          {/* Quick Counter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="px-4 py-2.5 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/20 text-center min-w-[70px]">
              <span className="text-[10px] block text-teal-100">คาบทั้งหมด</span>
              <span className="text-xl font-black">{dayStats.total}</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/30 backdrop-blur-xs border border-emerald-300/30 text-center min-w-[70px]">
              <span className="text-[10px] block text-emerald-100">มาเรียน</span>
              <span className="text-xl font-black">{dayStats.present}</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-red-500/30 backdrop-blur-xs border border-red-300/30 text-center min-w-[70px]">
              <span className="text-[10px] block text-red-100">ขาด</span>
              <span className="text-xl font-black">{dayStats.absent}</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-amber-500/30 backdrop-blur-xs border border-amber-300/30 text-center min-w-[70px]">
              <span className="text-[10px] block text-amber-100">สาย</span>
              <span className="text-xl font-black">{dayStats.late}</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-sky-500/30 backdrop-blur-xs border border-sky-300/30 text-center min-w-[70px]">
              <span className="text-[10px] block text-sky-100">ลา</span>
              <span className="text-xl font-black">{dayStats.sick + dayStats.leave}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Day Content: Period Attendance Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">
              ตารางการเข้าเรียนประจำวัน ({formatToThaiBE(selectedDate)})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงรายละเอียดผลการเช็คชื่อตามคาบเรียนและครูผู้สอน
            </p>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ทั้งหมด ({dayLogs.length})
            </button>
            <button
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'present' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              มาเรียน ({dayStats.present})
            </button>
            <button
              onClick={() => setStatusFilter('absent')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'absent' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ขาด ({dayStats.absent})
            </button>
            <button
              onClick={() => setStatusFilter('leave')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'leave' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ลา ({dayStats.sick + dayStats.leave})
            </button>
          </div>
        </div>

        {/* Timetable / Period Attendance Cards or Table */}
        {filteredDayLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-300">
              <CalendarDays className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-600">ไม่มีข้อมูลการเช็คชื่อในวันที่ {formatToThaiBE(selectedDate)}</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                อาจเป็นวันหยุดราชการ วันเสาร์-อาทิตย์ หรือยังไม่มีการบันทึกการเช็คชื่อจากครูผู้สอน
              </p>
            </div>
            {recordedDates.length > 0 && (
              <div className="pt-2">
                <span className="text-xs text-slate-500 block mb-2">วันที่มีการบันทึกข้อมูลล่าสุด:</span>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {recordedDates.slice(0, 5).map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDate(d)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-[#0C7C82] hover:bg-teal-100 transition-colors cursor-pointer"
                    >
                      {formatToThaiBE(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 text-center">คาบที่</th>
                  <th className="py-3 px-4">รหัสวิชา</th>
                  <th className="py-3 px-4">ชื่อรายวิชา</th>
                  <th className="py-3 px-4">ครูผู้สอน</th>
                  <th className="py-3 px-4 text-center">สถานะการเข้าเรียน</th>
                  <th className="py-3 px-4">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredDayLogs.map((log) => {
                  const rec = log.records?.find(
                    (r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name
                  );
                  const status = rec?.status || 'present';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 text-center font-bold text-slate-800">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                          {log.periodName || 'คาบเรียน'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-[#0C7C82] text-xs">
                        {log.subjectCode}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-800">
                        {log.subjectName}
                      </td>
                      <td className="py-4 px-4 text-slate-600 text-xs">
                        {log.teacherName || '-'}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {getStatusBadge(status)}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-500 italic">
                        {rec?.note || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historical Dates Activity Table (All Recorded Days) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[#0C7C82]" />
            <h3 className="font-bold text-slate-800 text-base">ประวัติวันที่บันทึกการเช็คชื่อทั้งหมด</h3>
          </div>
          <span className="text-xs text-slate-500">รวม {recordedDates.length} วันเรียน</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {recordedDates.map((dateStr) => {
            const dateLogs = studentLogs.filter((l) => l.date === dateStr);
            const isSelected = selectedDate === dateStr;
            let pCount = 0;
            let aCount = 0;
            dateLogs.forEach((l) => {
              const r = l.records?.find(
                (rec) => rec.studentId === currentStudent.id || rec.studentName === currentStudent.name
              );
              if (r?.status === 'present') pCount++;
              else if (r?.status === 'absent') aCount++;
            });

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#0C7C82] bg-teal-50/50 ring-2 ring-[#0C7C82]/20'
                    : 'border-slate-100 hover:border-slate-200 bg-slate-50/30 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">{formatToThaiBE(dateStr)}</span>
                  <span className="text-[10px] text-slate-400">
                    {getDayOfWeekFromDate(dateStr) || ''}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-500">{dateLogs.length} คาบ</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-emerald-600">มา {pCount}</span>
                    {aCount > 0 && <span className="text-red-600">ขาด {aCount}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
