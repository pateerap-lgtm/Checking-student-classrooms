import React, { useState } from 'react';
import { School, Lock, User, ArrowRight, ShieldCheck, CheckCircle2, Sparkles, BookOpen, Calendar } from 'lucide-react';
import { SystemSettings, AppUser, Student, UserRole, AcademicYear } from '../../types';

interface LoginPageProps {
  settings: SystemSettings;
  users: AppUser[];
  students: Student[];
  currentAcademicYear?: AcademicYear | null;
  onLoginSuccess: (user: { username: string; fullName: string; role: UserRole; data?: any }) => void;
  isLoadingData: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  settings,
  users,
  students,
  currentAcademicYear,
  onLoginSuccess,
  isLoadingData
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้งาน (Username)');
      return;
    }
    if (!password.trim()) {
      setError('กรุณากรอกรหัสผ่าน (Password)');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const trimmedUser = username.trim();
      const trimmedPass = password.trim();

      // Check app users (Admin, Director, Teacher)
      const foundUser = users.find(
        (u) => u.username.toLowerCase() === trimmedUser.toLowerCase() && u.password === trimmedPass
      );

      if (foundUser) {
        setIsSubmitting(false);
        onLoginSuccess({
          username: foundUser.username,
          fullName: foundUser.fullName,
          role: foundUser.role,
          data: foundUser
        });
        return;
      }

      // Check students
      const foundStudent = students.find(
        (s) => s.username.toLowerCase() === trimmedUser.toLowerCase() && s.password === trimmedPass
      );

      if (foundStudent) {
        setIsSubmitting(false);
        onLoginSuccess({
          username: foundStudent.username,
          fullName: foundStudent.name,
          role: 'student',
          data: foundStudent
        });
        return;
      }

      setIsSubmitting(false);
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50/40 to-slate-100 flex items-center justify-center p-2 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col md:flex-row max-h-[95vh]">
        {/* Left Side: School Branding & Details (Horizontal Card Left Part) */}
        <div className="md:w-5/12 bg-gradient-to-br from-[#0C7C82] via-[#0e8a91] to-[#35B4B0] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-black/10 blur-2xl pointer-events-none" />

          <div className="relative z-10">
            {/* School Logo */}
            <div className="w-20 h-20 rounded-2xl bg-white p-2 shadow-xl flex items-center justify-center mb-6">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="School Logo" className="w-full h-full object-contain rounded-xl" />
              ) : (
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#0C7C82] to-[#35B4B0] flex items-center justify-center text-white">
                  <School className="w-10 h-10" />
                </div>
              )}
            </div>

            {currentAcademicYear && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-900/40 border border-teal-300/30 text-teal-100 text-xs font-semibold backdrop-blur-xs mb-4">
                <Calendar className="w-3.5 h-3.5 text-teal-200" />
                <span>ปีการศึกษา {currentAcademicYear.name}</span>
              </div>
            )}

            <div className="space-y-2 mb-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                ระบบเช็คชื่อนักเรียนสำหรับรายวิชา
              </h1>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-teal-100 leading-tight">
                {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}
              </h2>
            </div>
            <p className="text-sm text-teal-100/90 leading-relaxed font-light">
              {settings.affiliationName || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาอุดรธานี เขต 3'}
            </p>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-white/20 space-y-2 text-xs text-teal-50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-200" />
              <span>ตรวจเช็คชื่อรายวิชาตามตารางสอนแบบ Real-time</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-200" />
              <span>บันทึกข้อมูลจัดเก็บปลอดภัยบน Firebase Firestore</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-200" />
              <span>ออกรายงานสรุปการมาเรียนและพิมพ์ PDF ทันใจ</span>
            </div>
          </div>
        </div>

        {/* Right Side: Horizontal Card Form Part */}
        <div className="md:w-7/12 p-6 sm:p-10 flex flex-col justify-center overflow-y-auto">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">เข้าสู่ระบบ</h2>
              <p className="text-sm text-slate-500 mt-1">
                เข้าใช้งานสำหรับผู้ดูแลระบบ, ผู้อำนวยการสถานศึกษา, ครูผู้สอน และนักเรียน
              </p>
            </div>
            {currentAcademicYear && (
              <div className="shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-[#0C7C82] text-xs font-bold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <Calendar className="w-3.5 h-3.5 text-[#0C7C82]" />
                <span>ปีการศึกษา {currentAcademicYear.name}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2.5 animate-shake">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น admin, teacher1, std01"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] focus:border-transparent text-sm text-slate-800 transition-all bg-slate-50/50 hover:bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] focus:border-transparent text-sm text-slate-800 transition-all bg-slate-50/50 hover:bg-white"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isLoadingData}
                className="w-full py-3 px-4 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-lg shadow-[#0C7C82]/25 focus:ring-4 focus:ring-[#0C7C82]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>กำลังเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <>
                    <span>เข้าสู่ระบบ</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
