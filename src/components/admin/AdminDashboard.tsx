import React, { useEffect, useRef } from 'react';
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
  Award
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import { Classroom, Subject, Student, AppUser, AttendanceLog } from '../../types';

Chart.register(...registerables);

interface AdminDashboardProps {
  subjects: Subject[];
  classes: Classroom[];
  students: Student[];
  users: AppUser[];
  attendanceLogs: AttendanceLog[];
  onNavigateTab: (tabId: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  subjects,
  classes,
  students,
  users,
  attendanceLogs,
  onNavigateTab
}) => {
  const subjectChartRef = useRef<HTMLCanvasElement | null>(null);
  const attendanceChartRef = useRef<HTMLCanvasElement | null>(null);
  const subjectChartInstance = useRef<Chart | null>(null);
  const attendanceChartInstance = useRef<Chart | null>(null);

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
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-50">
            {classes.slice(0, 4).map((c) => (
              <span
                key={c.id}
                className="px-2 py-0.5 rounded-full text-[10px] text-white font-medium shadow-2xs"
                style={{ backgroundColor: c.color || '#0C7C82' }}
              >
                {c.name}
              </span>
            ))}
            {classes.length > 4 && (
              <span className="text-[10px] text-slate-400 self-center">+{classes.length - 4} ห้อง</span>
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
            <span>• ผู้บริหาร {users.filter((u) => u.role === 'director').length}</span>
          </div>
        </div>
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
