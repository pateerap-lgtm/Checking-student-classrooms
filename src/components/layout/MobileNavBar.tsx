import React from 'react';
import { LayoutDashboard, ClipboardCheck, BookOpen, User, Menu } from 'lucide-react';
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
        {role === 'teacher' ? (
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

        {/* Report / Assignment */}
        {role === 'teacher' ? (
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
