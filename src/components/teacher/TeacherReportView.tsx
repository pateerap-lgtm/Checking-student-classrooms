import React, { useState } from 'react';
import { FileText, Printer, Filter, Calendar, School, CheckCircle2, Download } from 'lucide-react';
import { AttendanceLog, Classroom, Subject, SystemSettings, AcademicYear } from '../../types';
import { THAI_MONTHS_FULL, formatToThaiBE } from '../../utils/thaiDate';

interface TeacherReportViewProps {
  attendanceLogs: AttendanceLog[];
  classes: Classroom[];
  subjects: Subject[];
  settings: SystemSettings;
  teacherFullName: string;
  activeYear?: AcademicYear;
}

export const TeacherReportView: React.FC<TeacherReportViewProps> = ({
  attendanceLogs,
  classes,
  subjects,
  settings,
  teacherFullName,
  activeYear
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes[0]?.id || ''
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects[0]?.id || ''
  );

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];

  // Filter logs by selected class and subject
  const filteredLogs = attendanceLogs.filter(
    (l) =>
      (!selectedClassId || l.classId === selectedClassId) &&
      (!selectedSubjectId || l.subjectId === selectedSubjectId)
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Aggregate stats
  const totalPresent = filteredLogs.reduce((acc, l) => acc + (l.summary.present || 0), 0);
  const totalAbsent = filteredLogs.reduce((acc, l) => acc + (l.summary.absent || 0), 0);
  const totalLate = filteredLogs.reduce((acc, l) => acc + (l.summary.late || 0), 0);
  const totalSick = filteredLogs.reduce((acc, l) => acc + (l.summary.sick || 0), 0);
  const totalLeave = filteredLogs.reduce((acc, l) => acc + (l.summary.leave || 0), 0);
  const grandTotal = totalPresent + totalAbsent + totalLate + totalSick + totalLeave;
  const attendanceRate = grandTotal > 0 ? ((totalPresent / grandTotal) * 100).toFixed(1) : '100.0';

  const handlePrint = () => {
    window.print();
  };

  // Determine report month
  const currentMonthName = THAI_MONTHS_FULL[new Date().getMonth()];

  return (
    <div className="space-y-6">
      {/* Control Header & Filters (Hidden during print) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4 no-print">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#0C7C82]" />
              <span>รายงานสรุปการเช็คชื่อรายวิชา</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              สร้างรายงานสรุปการเข้าเรียนประจำวัน พิมพ์เป็นเอกสาร PDF พร้อมหัวกระดาษทางการ
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-sm"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์รายงาน / บันทึกเป็น PDF</span>
          </button>
        </div>

        {/* Filter Row: Select Class, Select Subject */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              เลือกชั้นเรียน <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              เลือกรายวิชา <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white"
            >
              {subjects
                .filter((s) => !selectedClassId || s.classId === selectedClassId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} {s.name} ({s.className})
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Official Report Document Container (Formatted for both screen preview and print A4) */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-100 shadow-sm print:p-0 print:border-none print:shadow-none">
        {/* Official Header (หัวกระดาษ: ชื่อโรงเรียน, ชื่อวิชา, ชื่อชั้นเรียน, เดือน) as strictly required */}
        <div className="text-center pb-6 border-b-2 border-slate-800 mb-6 space-y-1">
          <div className="text-lg font-bold text-slate-900 tracking-tight">
            {settings.schoolName || 'โรงเรียนอนุบาลหนองหานวิทยายน'}
          </div>
          <div className="text-xs text-slate-600">
            {settings.affiliationName || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาอุดรธานี เขต 3'}
          </div>
          <div className="text-base font-bold text-[#0C7C82] print:text-black pt-2">
            รายงานสรุปการเช็คชื่อการเข้าเรียนของนักเรียนสำหรับรายวิชา
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-slate-700 font-medium pt-1">
            <span>
              <strong>ชื่อรายวิชา:</strong> {currentSubject ? `${currentSubject.code} ${currentSubject.name}` : '-'}
            </span>
            <span>
              <strong>ชื่อชั้นเรียน:</strong> {currentClass?.name || '-'}
            </span>
            <span>
              <strong>ประจำเดือน:</strong> {currentMonthName}
            </span>
            <span>
              <strong>ปีการศึกษา:</strong> {activeYear?.name || '2569'}
            </span>
          </div>
          <div className="text-xs text-slate-500 pt-0.5">
            <strong>ครูผู้สอน:</strong> {teacherFullName}
          </div>
        </div>

        {/* Report Stats Summary Pills (Screen only) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 no-print">
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
            <span className="text-[11px] text-emerald-700 block font-medium">รวมมาเรียน</span>
            <span className="text-xl font-bold text-emerald-800">{totalPresent}</span>
          </div>
          <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-center">
            <span className="text-[11px] text-red-700 block font-medium">รวมขาด</span>
            <span className="text-xl font-bold text-red-800">{totalAbsent}</span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-center">
            <span className="text-[11px] text-amber-700 block font-medium">รวมสาย</span>
            <span className="text-xl font-bold text-amber-800">{totalLate}</span>
          </div>
          <div className="p-3 rounded-2xl bg-sky-50 border border-sky-100 text-center">
            <span className="text-[11px] text-sky-700 block font-medium">รวมป่วย</span>
            <span className="text-xl font-bold text-sky-800">{totalSick}</span>
          </div>
          <div className="p-3 rounded-2xl bg-orange-50 border border-orange-100 text-center">
            <span className="text-[11px] text-orange-700 block font-medium">รวมกิจ</span>
            <span className="text-xl font-bold text-orange-800">{totalLeave}</span>
          </div>
        </div>

        {/* Attendance Dates Table as required:
            "ให้แสดงตารางวันที่ตามที่เช็คชื่อทั้งหมด วันที่,รายวิชา,มาเรียน,ขาด,สาย,ป่วย,กิจ (แสดงเป็นตัวเลขสรุปประจำวัน)" */}
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-800 text-xs font-bold border-b border-slate-300">
                <th className="py-2.5 px-3 border border-slate-300 text-center w-12">ลำดับ</th>
                <th className="py-2.5 px-3 border border-slate-300">วันที่</th>
                <th className="py-2.5 px-3 border border-slate-300">รายวิชา</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center w-20">มาเรียน</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center w-20">ขาด</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center w-20">สาย</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center w-20">ป่วย</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center w-20">กิจ</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center w-24">รวมนักเรียน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    ยังไม่มีข้อมูลการเช็คชื่อสำหรับรายวิชาและชั้นเรียนที่เลือก
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 border border-slate-300 text-center font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 font-medium">
                      {log.thaiDateStr || formatToThaiBE(log.date)}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300">
                      {log.subjectCode} {log.subjectName} ({log.className})
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 text-center font-bold text-emerald-700">
                      {log.summary?.present || 0}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 text-center font-bold text-red-700">
                      {log.summary?.absent || 0}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 text-center font-bold text-amber-700">
                      {log.summary?.late || 0}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 text-center font-bold text-sky-700">
                      {log.summary?.sick || 0}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 text-center font-bold text-orange-700">
                      {log.summary?.leave || 0}
                    </td>
                    <td className="py-2.5 px-3 border border-slate-300 text-center font-bold">
                      {log.summary?.total || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredLogs.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-xs border-t-2 border-slate-400">
                  <td colSpan={3} className="py-3 px-3 border border-slate-300 text-right">
                    ยอดรวมทั้งหมด ({filteredLogs.length} วัน):
                  </td>
                  <td className="py-3 px-3 border border-slate-300 text-center text-emerald-800">
                    {totalPresent}
                  </td>
                  <td className="py-3 px-3 border border-slate-300 text-center text-red-800">
                    {totalAbsent}
                  </td>
                  <td className="py-3 px-3 border border-slate-300 text-center text-amber-800">
                    {totalLate}
                  </td>
                  <td className="py-3 px-3 border border-slate-300 text-center text-sky-800">
                    {totalSick}
                  </td>
                  <td className="py-3 px-3 border border-slate-300 text-center text-orange-800">
                    {totalLeave}
                  </td>
                  <td className="py-3 px-3 border border-slate-300 text-center">
                    {grandTotal}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Signature Block for Print */}
        <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs text-slate-800">
          <div className="space-y-8">
            <p>ลงชื่อ.......................................................ครูผู้สอน</p>
            <p>({teacherFullName})</p>
            <p>วันที่.........เดือน........................พ.ศ. 2569</p>
          </div>
          <div className="space-y-8">
            <p>ลงชื่อ.......................................................ผู้บริหาร/ผู้ตรวจ</p>
            <p>(..........................................................)</p>
            <p>วันที่.........เดือน........................พ.ศ. 2569</p>
          </div>
        </div>
      </div>
    </div>
  );
};
