import React, { useState, useMemo } from 'react';
import {
  CalendarRange,
  GraduationCap,
  Printer,
  FileDown,
  School,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Users,
  CheckCircle2
} from 'lucide-react';
import {
  Classroom,
  Subject,
  AttendanceLog,
  Student,
  AppUser,
  SystemSettings,
  AcademicYear
} from '../../types';
import {
  getAcademicYearMonths,
  YearMonthOption
} from '../../utils/thaiDate';

interface DirectorMonthlyReportViewProps {
  classes: Classroom[];
  subjects: Subject[];
  attendanceLogs: AttendanceLog[];
  students: Student[];
  teachers: AppUser[];
  allUsers: AppUser[];
  settings: SystemSettings;
  activeYear?: AcademicYear;
}

export const DirectorMonthlyReportView: React.FC<DirectorMonthlyReportViewProps> = ({
  classes,
  subjects,
  attendanceLogs,
  students,
  teachers,
  allUsers,
  settings,
  activeYear
}) => {
  // Available Months for Selection (Thai BE e.g. "พฤษภาคม 2569")
  const monthOptions = useMemo<YearMonthOption[]>(() => {
    return getAcademicYearMonths(activeYear);
  }, [activeYear]);

  // Default month: pick current calendar month key if present, otherwise first available
  const initialMonthKey = useMemo(() => {
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const found = monthOptions.find((m) => m.key === curKey);
    return found ? found.key : monthOptions[0]?.key || curKey;
  }, [monthOptions]);

  // 1. Filter States: Selected Month & Selected Classroom
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(initialMonthKey);
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');

  // Selected Month Option Object
  const selectedMonthOption = useMemo(() => {
    return monthOptions.find((m) => m.key === selectedMonthKey) || monthOptions[0];
  }, [monthOptions, selectedMonthKey]);

  // Active Classroom
  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Students in selected classroom
  const classStudents = useMemo(() => {
    if (!currentClass) return [];
    return students
      .filter((s) => s.classId === currentClass.id)
      .sort((a, b) => a.seq - b.seq);
  }, [students, currentClass]);

  // Effective Director Name
  const effectiveDirectorName = useMemo(() => {
    if (settings.directorName?.trim()) {
      return settings.directorName.trim();
    }
    const directorUser = (allUsers || []).find((u) => u.role === 'director');
    if (directorUser?.fullName?.trim()) {
      return directorUser.fullName.trim();
    }
    return 'นายสมศักดิ์ รักเรียน';
  }, [settings.directorName, allUsers]);

  // All subjects assigned to this classroom
  const classSubjects = useMemo(() => {
    if (!currentClass) return [];
    return subjects.filter((s) => s.classId === currentClass.id);
  }, [subjects, currentClass]);

  // Attendance logs for this class in selected month
  const monthlyLogs = useMemo(() => {
    if (!currentClass || !selectedMonthKey) return [];
    return attendanceLogs.filter(
      (l) => l.classId === currentClass.id && l.date.startsWith(selectedMonthKey)
    );
  }, [attendanceLogs, currentClass, selectedMonthKey]);

  // Compute aggregated summary per subject for the monthly table
  interface MonthlySubjectRow {
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    teacherName: string;
    sessionsCount: number; // จำนวนครั้งที่เช็คชื่อในเดือนนี้
    presentCount: number; // มาเรียน
    absentCount: number; // ขาด
    leaveCount: number; // ลา (รวมลา = ป่วย + กิจ)
    sickCount: number; // ป่วย
    errandCount: number; // กิจ
    totalRecorded: number;
    percentAttendance: number;
  }

  const tableRows = useMemo<MonthlySubjectRow[]>(() => {
    if (!currentClass) return [];

    // Group logs by subject
    const subjectMap = new Map<string, AttendanceLog[]>();

    monthlyLogs.forEach((log) => {
      const key = log.subjectId || log.subjectCode;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, []);
      }
      subjectMap.get(key)!.push(log);
    });

    const rows: MonthlySubjectRow[] = [];

    // 1. Process known class subjects
    classSubjects.forEach((sub) => {
      const logs = subjectMap.get(sub.id) || subjectMap.get(sub.code) || [];
      const sessionsCount = logs.length;

      let presentCount = 0;
      let absentCount = 0;
      let sickCount = 0;
      let errandCount = 0;

      logs.forEach((log) => {
        presentCount += log.summary?.present ?? log.records.filter((r) => r.status === 'present').length;
        absentCount += log.summary?.absent ?? log.records.filter((r) => r.status === 'absent').length;
        sickCount += log.summary?.sick ?? log.records.filter((r) => r.status === 'sick').length;
        errandCount += log.summary?.leave ?? log.records.filter((r) => r.status === 'leave').length;
      });

      const leaveCount = sickCount + errandCount;
      const totalRecorded = presentCount + absentCount + leaveCount;
      const percentAttendance = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 0;

      const teacherName = logs[0]?.teacherName || 'ครูประจำวิชา';

      rows.push({
        subjectId: sub.id,
        subjectCode: sub.code,
        subjectName: sub.name,
        teacherName,
        sessionsCount,
        presentCount,
        absentCount,
        leaveCount,
        sickCount,
        errandCount,
        totalRecorded,
        percentAttendance
      });

      // Mark processed
      subjectMap.delete(sub.id);
      subjectMap.delete(sub.code);
    });

    // 2. Process any remaining subjects in logs not in classSubjects
    subjectMap.forEach((logs, key) => {
      if (logs.length === 0) return;
      const sample = logs[0];
      let presentCount = 0;
      let absentCount = 0;
      let sickCount = 0;
      let errandCount = 0;

      logs.forEach((log) => {
        presentCount += log.summary?.present ?? log.records.filter((r) => r.status === 'present').length;
        absentCount += log.summary?.absent ?? log.records.filter((r) => r.status === 'absent').length;
        sickCount += log.summary?.sick ?? log.records.filter((r) => r.status === 'sick').length;
        errandCount += log.summary?.leave ?? log.records.filter((r) => r.status === 'leave').length;
      });

      const leaveCount = sickCount + errandCount;
      const totalRecorded = presentCount + absentCount + leaveCount;
      const percentAttendance = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 0;

      rows.push({
        subjectId: key,
        subjectCode: sample.subjectCode || key,
        subjectName: sample.subjectName || 'วิชาเรียน',
        teacherName: sample.teacherName || 'ครูผู้สอน',
        sessionsCount: logs.length,
        presentCount,
        absentCount,
        leaveCount,
        sickCount,
        errandCount,
        totalRecorded,
        percentAttendance
      });
    });

    // Sort by subjectCode
    return rows.sort((a, b) => a.subjectCode.localeCompare(b.subjectCode, 'th'));
  }, [currentClass, classSubjects, monthlyLogs]);

  // Grand Totals for the Month
  const summaryTotals = useMemo(() => {
    const totalPresent = tableRows.reduce((acc, r) => acc + r.presentCount, 0);
    const totalAbsent = tableRows.reduce((acc, r) => acc + r.absentCount, 0);
    const totalSick = tableRows.reduce((acc, r) => acc + r.sickCount, 0);
    const totalErrand = tableRows.reduce((acc, r) => acc + r.errandCount, 0);
    const totalLeave = totalSick + totalErrand;
    const totalRecorded = tableRows.reduce((acc, r) => acc + r.totalRecorded, 0);
    const totalSessions = tableRows.reduce((acc, r) => acc + r.sessionsCount, 0);

    const overallAttendancePercent = totalRecorded > 0 ? Math.round((totalPresent / totalRecorded) * 100) : 0;

    return {
      totalSubjects: tableRows.length,
      totalSessions,
      totalPresent,
      totalAbsent,
      totalLeave,
      totalSick,
      totalErrand,
      totalRecorded,
      overallAttendancePercent
    };
  }, [tableRows]);

  // Navigate month by offset
  const changeMonthByOffset = (offset: number) => {
    const currentIndex = monthOptions.findIndex((m) => m.key === selectedMonthKey);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + offset;
    if (nextIndex >= 0 && nextIndex < monthOptions.length) {
      setSelectedMonthKey(monthOptions[nextIndex].key);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          SCREEN UI: Top Header & Filters (Hidden during print)
      ========================================================================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8E24AA] to-[#BA68C8] flex items-center justify-center text-white shadow-md shadow-[#8E24AA]/20 shrink-0">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                  ผู้อำนวยการสถานศึกษา
                </span>
                <span className="text-xs text-slate-400 font-medium">Monthly Attendance Report</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-0.5">
                รายงานการเช็คชื่อรายเดือน
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                สรุปสถิติการมาเรียน ขาด ลา ป่วย กิจ ประจำเดือน แยกตามห้องเรียนและรายวิชา
              </p>
            </div>
          </div>

          {/* Action Buttons: Print / PDF */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8E24AA] to-[#BA68C8] text-white font-semibold text-xs shadow-md shadow-[#8E24AA]/20 hover:scale-102 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์เอกสาร (window.print())</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-xs shadow-2xs transition-all cursor-pointer"
              title="พิมพ์เอกสาร / ส่งออก PDF"
            >
              <FileDown className="w-4 h-4 text-slate-500" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Controls: Month Picker & Classroom Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 pt-5 items-end">
          {/* Month Selector (7 cols) */}
          <div className="lg:col-span-7 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              เลือกเดือน:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeMonthByOffset(-1)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="relative flex-1">
                <select
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#8E24AA]/30 focus:border-[#8E24AA] transition-all bg-slate-50/50 cursor-pointer"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => changeMonthByOffset(1)}
                className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                title="เดือนถัดไป"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs font-semibold text-[#8E24AA] flex items-center gap-1.5 pt-0.5">
              <CalendarRange className="w-3.5 h-3.5" />
              <span>
                ประจำเดือน: <strong>{selectedMonthOption?.label || '-'}</strong> | บันทึกเช็คชื่อ: {monthlyLogs.length} คาบ
              </span>
            </div>
          </div>

          {/* Classroom Selector (5 cols) */}
          <div className="lg:col-span-5 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              เลือกห้องเรียน:
            </label>
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#8E24AA]/30 focus:border-[#8E24AA] transition-all bg-slate-50/50 cursor-pointer"
              >
                {classes.map((cls) => {
                  const stdCount = students.filter((s) => s.classId === cls.id).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} (นักเรียน {stdCount} คน)
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
              <span>
                ห้องเรียน: <strong className="text-slate-800">{currentClass?.name || '-'}</strong> |
                นักเรียนทั้งหมด: <strong className="text-slate-800">{classStudents.length} คน</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Monthly Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6 border-t border-slate-100 mt-5">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500">รายวิชาทั้งหมด</div>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {tableRows.length} <span className="text-xs font-normal text-slate-500">วิชา</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-100">
            <div className="text-[11px] font-medium text-teal-700">เช็คชื่อรวมทั้งเดือน</div>
            <div className="text-xl font-bold text-teal-700 mt-1">
              {summaryTotals.totalSessions} <span className="text-xs font-normal text-teal-600">ครั้ง</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100">
            <div className="text-[11px] font-medium text-emerald-700">มาเรียนรวม</div>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {summaryTotals.totalPresent} <span className="text-xs font-normal text-emerald-600">คน/ครั้ง</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-100">
            <div className="text-[11px] font-medium text-red-700">ขาดเรียนรวม</div>
            <div className="text-xl font-bold text-red-700 mt-1">
              {summaryTotals.totalAbsent} <span className="text-xs font-normal text-red-600">คน/ครั้ง</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100">
            <div className="text-[11px] font-medium text-amber-700">ลา รวม (ป่วย+กิจ)</div>
            <div className="text-xl font-bold text-amber-700 mt-1">
              {summaryTotals.totalLeave} <span className="text-xs font-normal text-amber-600">คน/ครั้ง</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100">
            <div className="text-[11px] font-medium text-purple-700">มาเรียนเฉลี่ย</div>
            <div className="text-xl font-bold text-purple-700 mt-1">
              {summaryTotals.overallAttendancePercent}%
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SCREEN UI: Monthly Summary Table (Also printable with official header)
      ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Printable Official Header (Only shown during window.print()) */}
        <div className="hidden print:block p-4 border-b border-slate-800 text-center space-y-2 mb-4">
          <div className="flex items-center justify-center gap-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-14 h-14 object-contain" />
            ) : (
              <School className="w-12 h-12 text-slate-800" />
            )}
            <div className="text-left">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {settings.schoolName || 'โรงเรียน'}
              </h1>
              <p className="text-xs text-slate-700 leading-snug">
                {settings.affiliationName || 'สำนักงานเขตพื้นที่การศึกษา / สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน'}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <h2 className="text-base font-bold text-slate-900">
              แบบรายงานสรุปการเช็คชื่อเข้าเรียนรายเดือน (รายวิชา)
            </h2>
            <p className="text-xs text-slate-800 mt-0.5">
              ประจำเดือน: <strong>{selectedMonthOption?.label}</strong> | ห้องเรียน: <strong>{currentClass?.name}</strong> |{' '}
              ปีการศึกษา: <strong>{activeYear?.name || '2569'}</strong>
            </p>
            <p className="text-[11px] text-slate-700 mt-0.5">
              จำนวนนักเรียนทั้งหมดในห้อง: {classStudents.length} คน | จำนวนรายวิชา: {tableRows.length} วิชา | รวมบันทึกเช็คชื่อ: {summaryTotals.totalSessions} ครั้ง
            </p>
          </div>
        </div>

        {/* Screen Table Header Bar (Hidden in print) */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <span>ตารางสรุปการเช็คชื่อรายเดือน</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800 font-semibold">
                {selectedMonthOption?.label}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ห้องเรียน {currentClass?.name} (แสดงสรุปรายวิชา คอลัมน์ ลำดับ, วิชา, มาเรียน, ขาด, ลา, ป่วย, กิจ)
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            มาเรียนเฉลี่ย: <span className="text-emerald-600 font-bold">{summaryTotals.overallAttendancePercent}%</span>
          </div>
        </div>

        {/* Table Content: Exact Columns (ลำดับ, วิชา, มาเรียน, ขาด, ลา, ป่วย, กิจ) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-[11px] print:bg-slate-100 print:text-black">
                {/* 1. ลำดับ */}
                <th className="py-3 px-3 text-center w-12 border-r border-slate-200 print:border-slate-800">
                  ลำดับ
                </th>
                {/* 2. วิชา */}
                <th className="py-3 px-3 border-r border-slate-200 print:border-slate-800 min-w-[200px]">
                  วิชา
                </th>
                {/* 3. มาเรียน */}
                <th className="py-3 px-3 text-center w-24 text-emerald-700 border-r border-slate-200 print:border-slate-800 font-bold">
                  มาเรียน
                </th>
                {/* 4. ขาด */}
                <th className="py-3 px-3 text-center w-24 text-red-600 border-r border-slate-200 print:border-slate-800 font-bold">
                  ขาด
                </th>
                {/* 5. ลา */}
                <th className="py-3 px-3 text-center w-24 text-amber-600 border-r border-slate-200 print:border-slate-800 font-bold">
                  ลา
                </th>
                {/* 6. ป่วย */}
                <th className="py-3 px-3 text-center w-24 text-sky-600 border-r border-slate-200 print:border-slate-800 font-bold">
                  ป่วย
                </th>
                {/* 7. กิจ */}
                <th className="py-3 px-3 text-center w-24 text-orange-600 border-r border-slate-200 print:border-slate-800 font-bold">
                  กิจ
                </th>
                {/* Optional context column on screen: % มาเรียน & ครั้งที่สอน */}
                <th className="py-3 px-3 text-center w-24 no-print text-slate-600">
                  ร้อยละ (%)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-800">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600 text-sm">
                      ไม่มีข้อมูลการเช็คชื่อในเดือน {selectedMonthOption?.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      ยังไม่มีการบันทึกการเช็คชื่อของห้องเรียน {currentClass?.name} ในช่วงเดือนนี้
                    </p>
                  </td>
                </tr>
              ) : (
                tableRows.map((row, index) => (
                  <tr
                    key={row.subjectId || index}
                    className="hover:bg-slate-50/70 transition-colors bg-white"
                  >
                    {/* 1. ลำดับ */}
                    <td className="py-3 px-3 text-center font-bold text-slate-700 border-r border-slate-100 print:border-slate-800">
                      {index + 1}
                    </td>

                    {/* 2. วิชา */}
                    <td className="py-3 px-3 border-r border-slate-100 print:border-slate-800">
                      <div className="font-bold text-slate-800">
                        {row.subjectCode} {row.subjectName}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 print:text-slate-700">
                        <span>ครู: {row.teacherName}</span>
                        {row.sessionsCount > 0 && (
                          <span className="text-[10px] text-teal-600 font-medium">
                            (เช็ค {row.sessionsCount} ครั้ง)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. มาเรียน */}
                    <td className="py-3 px-3 text-center font-bold text-emerald-700 border-r border-slate-100 print:border-slate-800">
                      {row.sessionsCount > 0 ? row.presentCount : '-'}
                    </td>

                    {/* 4. ขาด */}
                    <td className="py-3 px-3 text-center font-bold text-red-600 border-r border-slate-100 print:border-slate-800">
                      {row.sessionsCount > 0 ? (
                        row.absentCount > 0 ? (
                          <span className="text-red-600">{row.absentCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 5. ลา (รวมลา = ป่วย + กิจ) */}
                    <td className="py-3 px-3 text-center font-bold text-amber-600 border-r border-slate-100 print:border-slate-800">
                      {row.sessionsCount > 0 ? (
                        row.leaveCount > 0 ? (
                          <span className="text-amber-600">{row.leaveCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 6. ป่วย */}
                    <td className="py-3 px-3 text-center font-bold text-sky-600 border-r border-slate-100 print:border-slate-800">
                      {row.sessionsCount > 0 ? (
                        row.sickCount > 0 ? (
                          <span className="text-sky-600">{row.sickCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 7. กิจ */}
                    <td className="py-3 px-3 text-center font-bold text-orange-600 border-r border-slate-100 print:border-slate-800">
                      {row.sessionsCount > 0 ? (
                        row.errandCount > 0 ? (
                          <span className="text-orange-600">{row.errandCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* ร้อยละ (%) on Screen */}
                    <td className="py-3 px-3 text-center no-print">
                      {row.sessionsCount > 0 ? (
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-slate-800">{row.percentAttendance}%</span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${row.percentAttendance}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Bottom Summary Row */}
            {tableRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-800 text-[11px] print:bg-slate-100 print:border-slate-800">
                  <td colSpan={2} className="py-3.5 px-3 text-right border-r border-slate-200 print:border-slate-800">
                    รวมทั้งสิ้น ({tableRows.length} รายวิชา, รวมเช็ค {summaryTotals.totalSessions} ครั้ง):
                  </td>
                  <td className="py-3.5 px-3 text-center text-emerald-800 border-r border-slate-200 print:border-slate-800">
                    {summaryTotals.totalPresent}
                  </td>
                  <td className="py-3.5 px-3 text-center text-red-700 border-r border-slate-200 print:border-slate-800">
                    {summaryTotals.totalAbsent}
                  </td>
                  <td className="py-3.5 px-3 text-center text-amber-700 border-r border-slate-200 print:border-slate-800">
                    {summaryTotals.totalLeave}
                  </td>
                  <td className="py-3.5 px-3 text-center text-sky-700 border-r border-slate-200 print:border-slate-800">
                    {summaryTotals.totalSick}
                  </td>
                  <td className="py-3.5 px-3 text-center text-orange-700 border-r border-slate-200 print:border-slate-800">
                    {summaryTotals.totalErrand}
                  </td>
                  <td className="py-3.5 px-3 text-center no-print text-emerald-700 font-bold">
                    เฉลี่ย {summaryTotals.overallAttendancePercent}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* =========================================================================
            PRINT ONLY: Signatures Section (Displayed at bottom of printed document)
        ========================================================================= */}
        <div className="hidden print:block pt-8 px-4 text-center text-xs text-slate-800 print:break-inside-avoid">
          <div className="grid grid-cols-3 gap-6">
            {/* Signature 1: Homeroom Teacher */}
            <div className="space-y-4">
              <p className="leading-relaxed">ลงชื่อ........................................................</p>
              <p className="font-semibold">(........................................................)</p>
              <p className="text-[11px] text-slate-600">ครูที่ปรึกษา / ครูประจำชั้น</p>
              <p className="text-[10px] text-slate-500">
                วันที่ ...... เดือน ..................... พ.ศ. ...........
              </p>
            </div>

            {/* Signature 2: Academic Head */}
            <div className="space-y-4">
              <p className="leading-relaxed">ลงชื่อ........................................................</p>
              <p className="font-semibold">(........................................................)</p>
              <p className="text-[11px] text-slate-600">หัวหน้าฝ่ายวิชาการ</p>
              <p className="text-[10px] text-slate-500">
                วันที่ ...... เดือน ..................... พ.ศ. ...........
              </p>
            </div>

            {/* Signature 3: School Director */}
            <div className="space-y-4">
              <p className="leading-relaxed">ลงชื่อ........................................................</p>
              <p className="font-semibold">({effectiveDirectorName})</p>
              <p className="text-[11px] text-slate-800 font-bold">ผู้อำนวยการสถานศึกษา</p>
              <p className="text-[10px] text-slate-500">
                วันที่ ...... เดือน ..................... พ.ศ. ...........
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
