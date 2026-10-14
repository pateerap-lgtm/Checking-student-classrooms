import React, { useEffect, useRef } from 'react';
import { BookOpen, GraduationCap, ClipboardCheck, FileText, CheckCircle2, TrendingUp, Calendar, Clock } from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import { TeachingAssignment, Classroom, Subject, Student, AttendanceLog } from '../../types';

Chart.register(...registerables);

interface TeacherDashboardProps {
  teacherUsername: string;
  teacherFullName: string;
  assignments: TeachingAssignment[];
  classes: Classroom[];
  subjects: Subject[];
  students: Student[];
  attendanceLogs: AttendanceLog[];
  onNavigateTab: (tabId: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacherUsername,
  teacherFullName,
  assignments,
  classes,
  subjects,
  students,
  attendanceLogs,
  onNavigateTab
}) => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  // Filter teacher's assigned subjects and classes
  const myAssignments = assignments.filter((a) => a.teacherUsername === teacherUsername);
  
  // Unique subject IDs and class IDs
  const mySubjectIds = Array.from(new Set(myAssignments.map((a) => a.subjectId)));
  const myClassIds = Array.from(new Set(myAssignments.map((a) => a.classId)));

  const mySubjects = subjects.filter((s) => mySubjectIds.includes(s.id));
  const myClasses = classes.filter((c) => myClassIds.includes(c.id));

  // Teacher attendance logs
  const myLogs = attendanceLogs.filter((l) => l.teacherUsername === teacherUsername);

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) chartInstance.current.destroy();

      // Attendance totals across teacher's logs
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

      // Default demo values if no logs recorded yet
      const dataValues = myLogs.length > 0
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
              borderRadius: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 5, font: { family: 'Sarabun' } },
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
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [myLogs]);

  return (
    <div className="space-y-6">
      {/* Mobile-only iPhone-like Quick App Shortcut Icons Grid */}
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
          <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-xs">
            ยินดีต้อนรับคุณครู
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold mt-2">
            สวัสดี, {teacherFullName}
          </h2>
          <p className="text-teal-100 text-xs sm:text-sm mt-1 max-w-xl">
            ท่านได้รับมอบหมายการสอนทั้งหมด {myAssignments.length} คาบต่อสัปดาห์ใน {myClasses.length} ชั้นเรียน สามารถเช็คชื่อนักเรียนได้ทันที
          </p>
        </div>
        <div className="absolute right-4 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl"></div>
      </div>

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
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-50">
            <span>บันทึกสถานะเรียบร้อยในระบบ</span>
          </div>
        </div>
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
          ) : myClasses.map((cls) => {
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
          })}
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
