import React from 'react';
import { LayoutDashboard, ClipboardCheck, BookOpen, User, Menu, FileText, CalendarDays, CalendarRange, UserCheck } from 'lucide-react';
import { UserRole } from '../../types';

interface MobileNavBarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  role: UserRole;
  onOpenSidebar: () => void;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
  currentTab,
  onSelectTab,
  role,
  onOpenSidebar
}) => {
  if (role === 'student') {
    return (
      <div className="fixed bottom-4 inset-x-4 z-40 lg:hidden no-print">
        <nav className="bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-2xl rounded-2xl px-2 py-2 flex items-center justify-around">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer ${
              currentTab === 'dashboard' ? 'text-[#0C7C82] font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-[#0C7C82] text-white shadow-md scale-105'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-[10px]">แดชบอร์ด</span>
          </button>

          <button
            onClick={() => onSelectTab('student-info')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer ${
              currentTab === 'student-info' ? 'text-[#0288D1] font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                currentTab === 'student-info'
                  ? 'bg-[#0288D1] text-white shadow-md scale-105'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px]">ข้อมูล</span>
          </button>

          <button
            onClick={() => onSelectTab('daily-attendance')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer ${
              currentTab === 'daily-attendance' ? 'text-[#26A69A] font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                currentTab === 'daily-attendance'
                  ? 'bg-[#26A69A] text-white shadow-md scale-105'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-[10px]">รายวัน</span>
          </button>

          <button
            onClick={() => onSelectTab('monthly-attendance')}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer ${
              currentTab === 'monthly-attendance' ? 'text-[#8E24AA] font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                currentTab === 'monthly-attendance'
                  ? 'bg-[#8E24AA] text-white shadow-md scale-105'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <CalendarRange className="w-5 h-5" />
            </div>
            <span className="text-[10px]">รายเดือน</span>
          </button>

          <button
            onClick={onOpenSidebar}
            className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-slate-500 hover:text-slate-700 transition-all cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200">
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px]">เมนู</span>
          </button>
        </nav>
      </div>
    );
  }
  return (
    <div className="fixed bottom-4 inset-x-4 z-40 lg:hidden no-print">
      <nav className="bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-2xl rounded-2xl px-3 py-2 flex items-center justify-around">
        {/* Dashboard */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
            currentTab === 'dashboard' ? 'text-[#0C7C82] font-semibold' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              currentTab === 'dashboard'
                ? 'bg-[#0C7C82] text-white shadow-md shadow-[#0C7C82]/30 scale-105'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px]">แดชบอร์ด</span>
        </button>

        {/* Dynamic Center Action button */}
        {role === 'director' ? (
          <button
            onClick={() => onSelectTab('report')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
              currentTab === 'report' ? 'text-[#0C7C82] font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                currentTab === 'report'
                  ? 'bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] text-white shadow-md scale-105'
                  : 'bg-teal-50 text-[#0C7C82]'
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px]">รายงานเช็คชื่อ</span>
          </button>
        ) : role === 'teacher' ? (
          <button
            onClick={() => onSelectTab('attendance')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
              currentTab === 'attendance' ? 'text-[#0C7C82] font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                currentTab === 'attendance'
                  ? 'bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] text-white shadow-md scale-105'
                  : 'bg-teal-50 text-[#0C7C82]'
              }`}
            >
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px]">เช็คชื่อ</span>
          </button>
        ) : (
          <button
            onClick={() => onSelectTab('classes')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
              currentTab === 'classes' ? 'text-[#0C7C82] font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                currentTab === 'classes'
                  ? 'bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] text-white shadow-md scale-105'
                  : 'bg-teal-50 text-[#0C7C82]'
              }`}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[10px]">ชั้นเรียน</span>
          </button>
        )}

        {/* Director Daily and Monthly Report Buttons on Mobile */}
        {role === 'director' && (
          <>
            <button
              onClick={() => onSelectTab('daily-report')}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
                currentTab === 'daily-report' ? 'text-[#0288D1] font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  currentTab === 'daily-report'
                    ? 'bg-[#0288D1] text-white shadow-md scale-105'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <CalendarDays className="w-5 h-5" />
              </div>
              <span className="text-[10px]">รายวัน</span>
            </button>

            <button
              onClick={() => onSelectTab('monthly-report')}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
                currentTab === 'monthly-report' ? 'text-[#8E24AA] font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  currentTab === 'monthly-report'
                    ? 'bg-[#8E24AA] text-white shadow-md scale-105'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <CalendarRange className="w-5 h-5" />
              </div>
              <span className="text-[10px]">รายเดือน</span>
            </button>
          </>
        )}

        {/* Report / Subjects (For teacher and admin) */}
        {role !== 'director' && (
          role === 'teacher' ? (
            <button
              onClick={() => onSelectTab('report')}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
                currentTab === 'report' ? 'text-[#0C7C82] font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  currentTab === 'report'
                    ? 'bg-[#0C7C82] text-white shadow-md scale-105'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <User className="w-5 h-5" />
              </div>
              <span className="text-[10px]">รายงาน</span>
            </button>
          ) : (
            <button
              onClick={() => onSelectTab('subjects')}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
                currentTab === 'subjects' ? 'text-[#0C7C82] font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  currentTab === 'subjects'
                    ? 'bg-[#0C7C82] text-white shadow-md scale-105'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[10px]">วิชา</span>
            </button>
          )
        )}

        {/* Open Drawer / All Menus */}
        <button
          onClick={onOpenSidebar}
          className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-500 hover:text-slate-700 transition-all cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px]">เมนูทั้งหมด</span>
        </button>
      </nav>
    </div>
  );
};
