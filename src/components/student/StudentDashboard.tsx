import React from 'react';
import { Sparkles, Clock, Calendar, CheckCircle2, Award, BookOpen } from 'lucide-react';
import { Student, AttendanceLog } from '../../types';

interface StudentDashboardProps {
  currentStudent: Student;
  attendanceLogs: AttendanceLog[];
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentStudent,
  attendanceLogs
}) => {
  // Find attendance logs where this student was present / absent
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let sickCount = 0;
  let leaveCount = 0;

  attendanceLogs.forEach((log) => {
    const studentItem = log.records?.find(
      (r) => r.studentId === currentStudent.id || r.studentName === currentStudent.name
    );
    if (studentItem) {
      if (studentItem.status === 'present') presentCount++;
      else if (studentItem.status === 'absent') absentCount++;
      else if (studentItem.status === 'late') lateCount++;
      else if (studentItem.status === 'sick') sickCount++;
      else if (studentItem.status === 'leave') leaveCount++;
    }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Student Profile Card */}
      <div className="bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-3xl font-bold shadow-md shrink-0">
          🎒
        </div>
        <div className="text-center sm:text-left space-y-1">
          <div className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs">
            นักเรียนชั้น {currentStudent.className}
          </div>
          <h2 className="text-2xl font-bold">{currentStudent.name}</h2>
          <p className="text-xs text-teal-100">
            รหัสประจำตัว: {currentStudent.username} • ลำดับที่: {currentStudent.seq || 1}
          </p>
        </div>
      </div>

      {/* Feature Announcement / Waiting Note as strictly requested */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xs text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-teal-50 text-[#0C7C82] flex items-center justify-center mx-auto shadow-inner">
          <Clock className="w-8 h-8 animate-spin" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-800">
            หน้าสำหรับนักเรียน รอพัฒนาระบบต่อไป..
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            ระบบกำลังเตรียมพร้อมฟีเจอร์สำหรับนักเรียน เช่น การดูผลการเช็คชื่อย้อนหลัง ส่งใบลาออนไลน์ และรับแจ้งเตือนการบ้าน
          </p>
        </div>

        {/* Attendance stats preview */}
        <div className="pt-6 border-t border-slate-100 max-w-xl mx-auto">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            สถิติการเข้าเรียนของคุณในระบบ
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800">
              <span className="text-[10px] block text-emerald-600 font-medium">มาเรียน</span>
              <span className="text-lg font-bold">{presentCount}</span>
            </div>
            <div className="p-3 rounded-2xl bg-red-50 text-red-800">
              <span className="text-[10px] block text-red-600 font-medium">ขาด</span>
              <span className="text-lg font-bold">{absentCount}</span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 text-amber-800">
              <span className="text-[10px] block text-amber-600 font-medium">สาย</span>
              <span className="text-lg font-bold">{lateCount}</span>
            </div>
            <div className="p-3 rounded-2xl bg-sky-50 text-sky-800">
              <span className="text-[10px] block text-sky-600 font-medium">ลา</span>
              <span className="text-lg font-bold">{sickCount + leaveCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
