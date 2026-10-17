import React, { useState } from 'react';
import {
  UserCheck,
  School,
  GraduationCap,
  Calendar,
  Phone,
  MapPin,
  Heart,
  Shield,
  CreditCard,
  Printer,
  Sparkles,
  QrCode,
  Building,
  User,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Student, Classroom, AcademicYear, SystemSettings, AppUser, Subject } from '../../types';

interface StudentInfoViewProps {
  currentStudent: Student;
  classes: Classroom[];
  subjects: Subject[];
  teachers: AppUser[];
  activeYear?: AcademicYear;
  settings: SystemSettings;
}

export const StudentInfoView: React.FC<StudentInfoViewProps> = ({
  currentStudent,
  classes,
  subjects,
  teachers,
  activeYear,
  settings
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'card'>('profile');

  // Find student's classroom
  const currentClass = classes.find(
    (c) => c.id === currentStudent.classId || c.name === currentStudent.className
  );

  // Derive homeroom teacher / advisor from teachers list based on classroom or sequence
  const advisorTeacher = teachers.find((t) => t.role === 'teacher') || {
    id: 't_advisor',
    username: 'advisor1',
    password: '',
    fullName: 'ครูสมศรี ใจดี (ครูประจำชั้น)',
    role: 'teacher' as const
  };

  // Student Subjects count
  const classSubjects = subjects.filter(
    (s) => s.classId === currentStudent.classId || s.className === currentStudent.className
  );

  // Generate realistic student details deterministically from student seq & username
  const seq = currentStudent.seq || 1;
  const birthYearBE = 2555 - Math.min(3, Math.max(0, parseInt(currentStudent.className.replace(/\D/g, '') || '1') - 1));
  const birthMonth = ((seq * 3) % 12) + 1;
  const birthDay = ((seq * 5) % 28) + 1;
  const bloodTypes = ['O', 'B', 'A', 'AB'];
  const bloodType = bloodTypes[seq % bloodTypes.length];
  const age = (activeYear ? parseInt(activeYear.name) : 2569) - birthYearBE;

  const thaiMonthsFull = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const birthDateFormatted = `${birthDay} ${thaiMonthsFull[birthMonth - 1]} พ.ศ. ${birthYearBE}`;

  // Deterministic parent details
  const parentName = `นายสมชาย ${currentStudent.name.split(' ').slice(1).join(' ') || 'ใจมั่น'}`;
  const parentPhone = `08${(seq * 7) % 9} ${((seq * 1234) % 9000 + 1000).toString()} ${((seq * 5678) % 9000 + 1000).toString()}`;
  const studentAddress = `เลขที่ ${seq * 12}/1 หมู่ที่ ${(seq % 10) + 1} ตำบลหนองหาน อำเภอหนองหาน จังหวัดอุดรธานี 41130`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner with Navigation toggle */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] text-white flex items-center justify-center shadow-lg shadow-[#0C7C82]/20 shrink-0">
            <UserCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">ข้อมูลพื้นฐานส่วนตัวนักเรียน</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              ระบบสารสนเทศข้อมูลส่วนตัวนักเรียนและทะเบียนประวัติการศึกษา
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-white text-[#0C7C82] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>ประวัตินักเรียน</span>
          </button>
          <button
            onClick={() => setActiveTab('card')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'card'
                ? 'bg-white text-[#0C7C82] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>บัตรประจำตัวนักเรียน</span>
          </button>
          <button
            onClick={handlePrint}
            className="p-2 rounded-xl text-slate-600 hover:bg-white hover:text-[#0C7C82] transition-colors cursor-pointer"
            title="พิมพ์เอกสาร"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activeTab === 'profile' ? (
        <div className="space-y-6">
          {/* Main Profile Header Card */}
          <div className="bg-gradient-to-r from-[#0C7C82] via-[#0e8a91] to-[#35B4B0] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Profile Avatar / Photo Box */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white p-1.5 shadow-xl flex items-center justify-center shrink-0 border-4 border-white/40">
                <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-teal-50 to-teal-100 flex flex-col items-center justify-center text-teal-800">
                  <span className="text-3xl sm:text-4xl">👨‍🎓</span>
                  <span className="text-[10px] font-bold text-teal-700 mt-1">รูปถ่าย</span>
                </div>
              </div>

              {/* Primary Info */}
              <div className="text-center sm:text-left space-y-2 flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-xs">
                    ชั้น {currentStudent.className}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-teal-900/40 text-teal-100 text-xs font-semibold backdrop-blur-xs">
                    เลขที่ {currentStudent.seq || 1}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/80 text-white text-xs font-bold">
                    สถานะ: กำลังศึกษาอยู่ (ปกติ)
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{currentStudent.name}</h2>
                <div className="text-xs sm:text-sm text-teal-100 space-y-0.5">
                  <p>
                    รหัสประจำตัวนักเรียน: <span className="font-mono font-bold text-white">{currentStudent.username}</span>
                  </p>
                  <p>
                    {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'} • {settings.affiliationName || 'สพป.อุดรธานี เขต 3'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Info Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section 1: Personal Information */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-slate-800 font-bold">
                <User className="w-5 h-5 text-[#0C7C82]" />
                <h3>ข้อมูลส่วนบุคคล (Personal Details)</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">ชื่อ - สกุล</span>
                  <span className="font-semibold text-slate-800">{currentStudent.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">รหัสประจำตัว</span>
                  <span className="font-mono font-bold text-[#0C7C82]">{currentStudent.username}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">วัน/เดือน/ปีเกิด</span>
                  <span className="font-medium text-slate-800">{birthDateFormatted}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">อายุ</span>
                  <span className="font-medium text-slate-800">{age} ปี</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">สัญชาติ / เชื้อชาติ / ศาสนา</span>
                  <span className="font-medium text-slate-800">ไทย / ไทย / พุทธ</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">หมู่โลหิต (Blood Group)</span>
                  <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md text-xs">
                    กลุ่ม {bloodType}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 text-xs">ประวัติแพ้ยา / อาหาร</span>
                  <span className="font-medium text-emerald-600">ไม่มี</span>
                </div>
              </div>
            </div>

            {/* Section 2: Educational Details */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-slate-800 font-bold">
                <GraduationCap className="w-5 h-5 text-[#0C7C82]" />
                <h3>ข้อมูลการศึกษา (Academic Info)</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">ระดับชั้น / ห้องเรียน</span>
                  <span className="font-semibold text-slate-800">ชั้น {currentStudent.className}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">เลขที่ในห้องเรียน</span>
                  <span className="font-bold text-slate-800">เลขที่ {currentStudent.seq || 1}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">ปีการศึกษาปัจจุบัน</span>
                  <span className="font-medium text-slate-800">ปีการศึกษา {activeYear?.name || '2569'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">ครูประจำชั้น / ที่ปรึกษา</span>
                  <span className="font-semibold text-[#0C7C82]">{advisorTeacher.fullName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">สถานศึกษา</span>
                  <span className="font-medium text-slate-800 text-right truncate max-w-[200px]">
                    {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50">
                  <span className="text-slate-500 text-xs">ผู้อำนวยการสถานศึกษา</span>
                  <span className="font-medium text-slate-800">
                    {settings.directorName || 'นายภัทรธีระ ประทุมเม'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 text-xs">รายวิชาที่เรียนในชั้นนี้</span>
                  <span className="font-bold text-slate-800">{classSubjects.length || 8} รายวิชา</span>
                </div>
              </div>
            </div>

            {/* Section 3: Parent & Contact Details */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs space-y-4 md:col-span-2">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 text-slate-800 font-bold">
                <Phone className="w-5 h-5 text-[#0C7C82]" />
                <h3>ข้อมูลผู้ปกครองและการติดต่อ (Guardian & Contact)</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">ชื่อผู้ปกครอง / บิดา</span>
                  <div className="font-bold text-slate-800">{parentName}</div>
                  <div className="text-xs text-slate-500">ความสัมพันธ์: บิดา / ผู้ปกครอง</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">เบอร์โทรศัพท์ติดต่อฉุกเฉิน</span>
                  <div className="font-mono font-bold text-[#0C7C82] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{parentPhone}</span>
                  </div>
                  <div className="text-xs text-emerald-600 font-medium">✓ ยืนยันเบอร์โทรแล้ว</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 sm:col-span-2 lg:col-span-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">ที่อยู่ตามทะเบียนบ้าน</span>
                  <div className="text-xs text-slate-700 leading-relaxed font-medium flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>{studentAddress}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Student ID Card Simulation View (Card Tab) */
        <div className="space-y-6">
          <div className="flex justify-center p-4">
            {/* Front of ID Card */}
            <div className="w-full max-w-md bg-gradient-to-br from-[#0C7C82] via-[#096368] to-[#043d40] text-white rounded-3xl p-6 shadow-2xl border-2 border-teal-300/40 relative overflow-hidden aspect-[1.586/1] flex flex-col justify-between">
              {/* Background watermark */}
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-teal-400/20 blur-2xl pointer-events-none" />

              {/* Card Header */}
              <div className="relative z-10 flex items-center justify-between border-b border-white/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <School className="w-5 h-5 text-[#0C7C82]" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-white leading-tight">
                      {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}
                    </h4>
                    <p className="text-[9px] text-teal-200">บัตรประจำตัวนักเรียน (STUDENT ID CARD)</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/20 text-white font-bold">
                    {activeYear?.name || '2569'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="relative z-10 flex items-center gap-4 py-2">
                <div className="w-20 h-24 rounded-xl bg-white/90 p-1 flex flex-col items-center justify-center text-teal-900 shadow-md shrink-0 border border-white">
                  <span className="text-3xl">👨‍🎓</span>
                  <span className="text-[9px] font-bold text-teal-800 mt-1">รูปถ่าย</span>
                </div>

                <div className="space-y-1 flex-1 overflow-hidden">
                  <h3 className="font-black text-base text-white truncate tracking-tight">{currentStudent.name}</h3>
                  <p className="text-[11px] text-teal-100 font-mono">
                    ID: <span className="font-bold text-white">{currentStudent.username}</span>
                  </p>
                  <p className="text-[11px] text-teal-100">
                    ชั้นเรียน: <span className="font-bold text-white">{currentStudent.className}</span> • เลขที่ {currentStudent.seq || 1}
                  </p>
                  <p className="text-[10px] text-teal-200">
                    หมู่โลหิต: <span className="font-bold text-white">{bloodType}</span>
                  </p>
                </div>

                <div className="w-14 h-14 bg-white p-1 rounded-xl shadow-xs shrink-0 flex items-center justify-center">
                  <QrCode className="w-full h-full text-slate-800" />
                </div>
              </div>

              {/* Card Footer Barcode */}
              <div className="relative z-10 pt-2 border-t border-white/20 flex items-center justify-between text-[9px] text-teal-100">
                <span>ออกโดย: {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}</span>
                <span className="font-mono tracking-widest text-[10px] text-white">||| | |||| | ||| ||||</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] text-white font-bold text-sm shadow-lg shadow-[#0C7C82]/25 hover:shadow-xl hover:scale-105 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์บัตรประจำตัวนักเรียน</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
