import React from 'react';
import {
  LayoutDashboard,
  Settings,
  Calendar,
  Clock,
  GraduationCap,
  Users,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  UserCheck,
  CalendarDays,
  CalendarRange,
  LogOut,
  X,
  School,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { UserRole, SystemSettings, AcademicYear } from '../../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  role: UserRole;
  userFullName: string;
  settings: SystemSettings;
  activeYear?: AcademicYear;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onLogoutClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  role,
  userFullName,
  settings,
  activeYear,
  isOpenMobile,
  onCloseMobile,
  onLogoutClick
}) => {
  const adminMenuItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard, color: 'text-[#0C7C82]' },
    { id: 'settings', label: 'ตั้งค่าระบบ', icon: Settings, color: 'text-[#35B4B0]' },
    { id: 'years', label: 'จัดการปีการศึกษา', icon: Calendar, color: 'text-[#26A69A]' },
    { id: 'periods', label: 'คาบสอน/ชั่วโมงสอน', icon: Clock, color: 'text-[#AED581]' },
    { id: 'classes', label: 'จัดการชั้นเรียน', icon: GraduationCap, color: 'text-[#FFCA28]' },
    { id: 'users', label: 'จัดการผู้ใช้งาน', icon: Users, color: 'text-[#FF8A65]' },
    { id: 'students', label: 'จัดการนักเรียน', icon: UserCheck, color: 'text-[#0288D1]' },
    { id: 'subjects', label: 'จัดการรายวิชา', icon: BookOpen, color: 'text-[#4A2C6D]' },
    { id: 'assignments', label: 'มอบหมายชั้นเรียนที่สอน', icon: CalendarCheck, color: 'text-[#F57C00]' },
    { id: 'report', label: 'รายงานการเช็คชื่อ', icon: FileText, color: 'text-[#26A69A]' },
    { id: 'daily-report', label: 'รายงานรายวัน', icon: CalendarDays, color: 'text-[#0288D1]' },
    { id: 'monthly-report', label: 'รายงานรายเดือน', icon: CalendarRange, color: 'text-[#8E24AA]' },
  ];

  const directorMenuItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard, color: 'text-[#0C7C82]' },
    { id: 'report', label: 'รายงานการเช็คชื่อ', icon: FileText, color: 'text-[#26A69A]' },
    { id: 'daily-report', label: 'รายงานรายวัน', icon: CalendarDays, color: 'text-[#0288D1]' },
    { id: 'monthly-report', label: 'รายงานรายเดือน', icon: CalendarRange, color: 'text-[#8E24AA]' },
  ];

  const teacherMenuItems = [
    { id: 'dashboard', label: 'แดชบอร์ดการสอน', icon: LayoutDashboard, color: 'text-[#0C7C82]' },
    { id: 'attendance', label: 'เช็คชื่อนักเรียน', icon: ClipboardCheck, color: 'text-[#35B4B0]' },
    { id: 'report', label: 'รายงานการเช็คชื่อ', icon: FileText, color: 'text-[#26A69A]' },
    { id: 'profile', label: 'แก้ไขข้อมูลส่วนตัว', icon: Settings, color: 'text-[#0288D1]' },
  ];

  const studentMenuItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard, color: 'text-[#0C7C82]' },
    { id: 'student-info', label: 'ข้อมูลนักเรียน', icon: UserCheck, color: 'text-[#0288D1]' },
    { id: 'daily-attendance', label: 'เข้าเรียนรายวัน', icon: CalendarDays, color: 'text-[#26A69A]' },
    { id: 'monthly-attendance', label: 'เข้าเรียนรายเดือน', icon: CalendarRange, color: 'text-[#8E24AA]' },
  ];

  const menuItems = role === 'admin'
    ? adminMenuItems
    : role === 'director'
    ? directorMenuItems
    : role === 'teacher'
    ? teacherMenuItems
    : studentMenuItems;

  const roleBadge = () => {
    switch (role) {
      case 'admin':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">ผู้ดูแลระบบ</span>;
      case 'director':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">ผู้อำนวยการสถานศึกษา</span>;
      case 'teacher':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">ครูผู้สอน</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">นักเรียน</span>;
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-100">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] p-0.5 shadow-md flex items-center justify-center shrink-0">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-2xl bg-white p-1" />
            ) : (
              <School className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-slate-800 text-base leading-tight truncate">
              {settings.schoolName || 'โรงเรียน'}
            </h1>
            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <span>ปีการศึกษา {activeYear ? activeYear.name : '2569'}</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </p>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User Info Bar */}
      <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="overflow-hidden">
          <p className="text-xs text-slate-500">ผู้ใช้งานปัจจุบัน</p>
          <p className="text-sm font-semibold text-slate-800 truncate">{userFullName}</p>
        </div>
        {roleBadge()}
      </div>

      {/* Nav Menu Items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          เมนูหลัก ({role === 'admin' ? 'ผู้ดูแลระบบ' : role === 'director' ? 'ผู้อำนวยการสถานศึกษา' : role === 'teacher' ? 'อาจารย์' : 'นักเรียน'})
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white shadow-sm shadow-[#0C7C82]/20 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-[#0C7C82]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 ' + item.color + ' group-hover:bg-[#0C7C82]/10 group-hover:text-[#0C7C82]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span>{item.label}</span>
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
                  isActive ? 'text-white' : 'text-slate-300 group-hover:text-[#0C7C82]'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Logout button */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={onLogoutClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors border border-red-100 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden lg:block w-72 shrink-0 h-screen sticky top-0 no-print z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Slide-out with backdrop) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={onCloseMobile}
          />
          {/* Slide Drawer */}
          <div className="relative w-80 max-w-[85vw] h-full shadow-2xl z-10 animate-slide-right">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
