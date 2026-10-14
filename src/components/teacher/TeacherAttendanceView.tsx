import React, { useState } from 'react';
import {
  ClipboardCheck,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  UserCheck,
  Eye,
  Edit2,
  Trash2,
  Lock,
  Sparkles,
  Info,
  X
} from 'lucide-react';
import {
  TeachingAssignment,
  Period,
  Classroom,
  Subject,
  Student,
  DayOfWeek,
  AttendanceLog,
  AttendanceStatus,
  StudentAttendanceItem,
  AcademicYear
} from '../../types';
import {
  DAY_ORDER,
  formatToThaiBE,
  formatThaiFullDate,
  getDayOfWeekFromDate,
  getTodayISODate
} from '../../utils/thaiDate';

interface TeacherAttendanceViewProps {
  teacherUsername: string;
  teacherFullName: string;
  assignments: TeachingAssignment[];
  periods: Period[];
  classes: Classroom[];
  subjects: Subject[];
  students: Student[];
  attendanceLogs: AttendanceLog[];
  activeYear?: AcademicYear;
  onSaveAttendance: (log: Omit<AttendanceLog, 'id'>) => Promise<void>;
  onUpdateAttendance: (id: string, log: Partial<AttendanceLog>) => Promise<void>;
  onDeleteAttendance: (id: string) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
}

export const TeacherAttendanceView: React.FC<TeacherAttendanceViewProps> = ({
  teacherUsername,
  teacherFullName,
  assignments,
  periods,
  classes,
  subjects,
  students,
  attendanceLogs,
  activeYear,
  onSaveAttendance,
  onUpdateAttendance,
  onDeleteAttendance,
  openConfirm,
  showToast
}) => {
  // Date Picker state (defaults to today's ISO date e.g. 2026-10-14)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISODate());

  // Determine active day of week from selected date
  const selectedDayOfWeek = getDayOfWeekFromDate(selectedDate);

  // Teacher's timetable assignments
  const myAssignments = assignments.filter((a) => a.teacherUsername === teacherUsername);

  // Sorting periods
  const sortedPeriods = [...periods].sort((a, b) => a.order - b.order);

  // Attendance checking modal states
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<TeachingAssignment | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [studentRecords, setStudentRecords] = useState<StudentAttendanceItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // View Attendance Detail Modal
  const [viewingLog, setViewingLog] = useState<AttendanceLog | null>(null);

  // Teacher logs
  const teacherLogs = attendanceLogs.filter((l) => l.teacherUsername === teacherUsername);

  // Open attendance modal for a timetable slot
  const handleSlotClick = (assignment: TeachingAssignment, slotDay: DayOfWeek) => {
    // ENFORCE: "แล้วให้ระบบเลือกวันเช็คชื่อที่ตรงกับวันที่เลือกได้เท่านั้น ถ้าเป็นวันอื่นไม่สามารถเช็คชื่อได้"
    if (slotDay !== selectedDayOfWeek) {
      showToast(
        'warning',
        `วันที่ท่านเลือก (${formatToThaiBE(selectedDate)}) ตรงกับวัน${selectedDayOfWeek || '-'} ไม่สามารถเช็คชื่อตารางสอนของวัน${slotDay}ได้`
      );
      return;
    }

    setActiveAssignment(assignment);

    // Check if an existing log exists for this date, subject, and class
    const existingLog = teacherLogs.find(
      (l) =>
        l.date === selectedDate &&
        l.subjectId === assignment.subjectId &&
        l.classId === assignment.classId &&
        l.periodId === assignment.periodId
    );

    if (existingLog) {
      setEditingLogId(existingLog.id);
      setStudentRecords(existingLog.records);
    } else {
      setEditingLogId(null);
      // Fetch students for this class
      const classStudents = students
        .filter((s) => s.classId === assignment.classId || s.className === assignment.className)
        .sort((a, b) => a.seq - b.seq);

      const initialRecords: StudentAttendanceItem[] = classStudents.map((s, idx) => ({
        studentId: s.id,
        seq: s.seq || idx + 1,
        studentName: s.name,
        status: 'present' as AttendanceStatus,
      }));

      setStudentRecords(initialRecords);
    }

    setIsCheckModalOpen(true);
  };

  // Change individual student status
  const handleStatusChange = (index: number, newStatus: AttendanceStatus) => {
    setStudentRecords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: newStatus };
      return updated;
    });
  };

  // Function to mark all present: "มีฟังก์ชั่นเช็คมาเรียนทั้งหมด"
  const handleMarkAllPresent = () => {
    setStudentRecords((prev) =>
      prev.map((item) => ({ ...item, status: 'present' }))
    );
    showToast('success', 'เช็คมาเรียนให้กับนักเรียนทุกคนเรียบร้อย');
  };

  // Calculate live summary numbers
  const liveSummary = studentRecords.reduce(
    (acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, sick: 0, leave: 0, total: 0 }
  );

  // Save attendance
  const handleSaveAttendance = async () => {
    if (!activeAssignment) return;

    setIsSaving(true);
    try {
      const summaryPayload = {
        present: liveSummary.present,
        absent: liveSummary.absent,
        late: liveSummary.late,
        sick: liveSummary.sick,
        leave: liveSummary.leave,
        total: liveSummary.total,
      };

      if (editingLogId) {
        await onUpdateAttendance(editingLogId, {
          records: studentRecords,
          summary: summaryPayload,
          updatedAt: new Date().toISOString()
        });
        showToast('success', 'อัพเดทข้อมูลการเช็คชื่อเรียบร้อยแล้ว');
      } else {
        await onSaveAttendance({
          academicYearId: activeYear?.id || 'year_2569',
          subjectId: activeAssignment.subjectId,
          subjectCode: activeAssignment.subjectCode,
          subjectName: activeAssignment.subjectName,
          classId: activeAssignment.classId,
          className: activeAssignment.className,
          date: selectedDate,
          thaiDateStr: formatToThaiBE(selectedDate),
          dayOfWeek: selectedDayOfWeek || activeAssignment.dayOfWeek,
          periodId: activeAssignment.periodId,
          periodName: activeAssignment.periodName,
          teacherUsername,
          teacherName: teacherFullName,
          records: studentRecords,
          summary: summaryPayload,
          updatedAt: new Date().toISOString(),
        });
        showToast('success', 'บันทึกการเช็คชื่อนักเรียนสำเร็จแล้ว');
      }
      setIsCheckModalOpen(false);
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete attendance log
  const handleDeleteLog = (log: AttendanceLog) => {
    openConfirm(
      'ยืนยันการลบประวัติการเช็คชื่อ',
      `คุณต้องการลบข้อมูลเช็คชื่อวิชา ${log.subjectName} ประจำวันที่ ${log.thaiDateStr} ใช่หรือไม่?`,
      () => onDeleteAttendance(log.id),
      'danger'
    );
  };

  // Open edit modal directly from logs table
  const handleEditFromLog = (log: AttendanceLog) => {
    const matchedAssignment = myAssignments.find(
      (a) => a.subjectId === log.subjectId && a.classId === log.classId
    ) || {
      id: 'temp',
      teacherUsername: log.teacherUsername,
      teacherName: log.teacherName || teacherFullName,
      classId: log.classId,
      className: log.className,
      subjectId: log.subjectId,
      subjectCode: log.subjectCode,
      subjectName: log.subjectName,
      periodId: log.periodId,
      periodName: log.periodName,
      dayOfWeek: log.dayOfWeek,
      color: '#0C7C82'
    };

    setActiveAssignment(matchedAssignment);
    setEditingLogId(log.id);
    setStudentRecords(log.records);
    setIsCheckModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Date Picker Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full uppercase tracking-wider inline-block mb-1">
            เลือกวันที่เช็คชื่อ (พ.ศ. ภาษาไทย)
          </span>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#0C7C82]" />
            <span>ตารางสอนและการเช็คชื่อนักเรียน</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {formatThaiFullDate(selectedDate)} (ตรงกับวัน{selectedDayOfWeek || '-'})
          </p>
        </div>

        {/* Date Picker Control in Buddhist Era Thai format */}
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <Calendar className="w-5 h-5 text-[#0C7C82] ml-2 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">
              วันที่ในระบบ (พ.ศ.)
            </span>
            <span className="text-xs font-bold text-slate-800">
              {formatToThaiBE(selectedDate)}
            </span>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white cursor-pointer focus:ring-2 focus:ring-[#0C7C82]"
          />
        </div>
      </div>

      {/* Timetable Notice */}
      <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-900 text-xs flex items-center gap-2.5">
        <Info className="w-4 h-4 text-teal-700 shrink-0" />
        <span>
          <strong>เงื่อนไขความถูกต้อง:</strong> วันที่ที่เลือกคือ <strong>{formatToThaiBE(selectedDate)} (วัน{selectedDayOfWeek || '-'})</strong> ระบบจะอนุญาตให้คลิกเช็คชื่อได้เฉพาะคาบสอนของ <strong>วัน{selectedDayOfWeek || '-'}</strong> เท่านั้น คาบของวันอื่นจะถูกล็อคไว้
        </span>
      </div>

      {/* Monday - Friday Timetable (ตารางสอน วันจันทร์-วันศุกร์) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#0C7C82]" />
            <h3 className="font-bold text-slate-800 text-base">
              ตารางสอนประจำสัปดาห์ (วันจันทร์ - วันศุกร์)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            คลิกที่กล่องรายวิชาเพื่อทำการเช็คชื่อ
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-600 border-b border-slate-200">
                <th className="py-4 px-4 w-32 border-r border-slate-200 bg-slate-100/70 text-slate-700 font-extrabold">
                  วัน / คาบ
                </th>
                {sortedPeriods.map((p) => (
                  <th
                    key={p.id}
                    className={`py-3 px-3 border-r border-slate-200 min-w-[130px] ${
                      p.isLunchBreak ? 'bg-amber-50/60 text-amber-900' : ''
                    }`}
                  >
                    <div className="font-bold">{p.name}</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">
                      {p.startTime} - {p.endTime}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {DAY_ORDER.map((day) => {
                const isSelectedDay = day === selectedDayOfWeek;

                return (
                  <tr
                    key={day}
                    className={`transition-colors ${
                      isSelectedDay ? 'bg-teal-50/30' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Left: Monday - Friday */}
                    <td
                      className={`py-5 px-4 font-bold border-r border-slate-200 text-center ${
                        isSelectedDay
                          ? 'bg-[#0C7C82] text-white shadow-xs'
                          : 'bg-slate-50/70 text-slate-700'
                      }`}
                    >
                      <div className="text-sm">วัน{day}</div>
                      {isSelectedDay ? (
                        <span className="inline-block px-2 py-0.5 mt-1 rounded-full text-[10px] bg-white text-[#0C7C82] font-extrabold shadow-2xs">
                          วันปัจจุบัน
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                          ล็อค
                        </span>
                      )}
                    </td>

                    {/* Columns: Periods */}
                    {sortedPeriods.map((period) => {
                      if (period.isLunchBreak) {
                        return (
                          <td
                            key={period.id}
                            className="p-2 border-r border-slate-200 bg-amber-50/30 text-amber-800 text-[11px] font-medium"
                          >
                            <span className="inline-block py-2 px-1 text-slate-400">
                              พักกลางวัน
                            </span>
                          </td>
                        );
                      }

                      // Find assignment for this day and period
                      const assignment = myAssignments.find(
                        (a) => a.dayOfWeek === day && a.periodId === period.id
                      );

                      if (!assignment) {
                        return (
                          <td
                            key={period.id}
                            className="p-2 border-r border-slate-200 text-slate-300 text-center"
                          >
                            -
                          </td>
                        );
                      }

                      // Check if already checked on selectedDate
                      const isAlreadyChecked = teacherLogs.some(
                        (l) =>
                          l.date === selectedDate &&
                          l.subjectId === assignment.subjectId &&
                          l.classId === assignment.classId &&
                          l.periodId === assignment.periodId
                      );

                      return (
                        <td key={period.id} className="p-2 border-r border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleSlotClick(assignment, day)}
                            className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                              isSelectedDay
                                ? 'hover:scale-102 hover:shadow-md border-teal-300 bg-white ring-1 ring-teal-200'
                                : 'opacity-60 bg-slate-50 border-slate-200 hover:opacity-80'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span
                                className="px-2 py-0.5 rounded-md text-[10px] text-white font-bold"
                                style={{ backgroundColor: assignment.color || '#0C7C82' }}
                              >
                                {assignment.className}
                              </span>

                              {isSelectedDay ? (
                                isAlreadyChecked ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>เช็คแล้ว</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-teal-600 font-bold bg-teal-50 px-1.5 py-0.5 rounded-full animate-pulse">
                                    <span>พร้อมเช็ค</span>
                                  </span>
                                )
                              ) : (
                                <Lock className="w-3 h-3 text-slate-400" />
                              )}
                            </div>

                            <div>
                              <div className="font-bold text-slate-800 text-[11px] truncate">
                                {assignment.subjectCode}
                              </div>
                              <div className="text-[10px] text-slate-600 truncate">
                                {assignment.subjectName}
                              </div>
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saved Attendance Logs Section as required:
          "แสดงตารางเป็นรายการตามที่บันทึก เป็นรายวิชา ,
          ประกอบด้วย นักเรียน ,วันที่, มาเรียน,ขาด,สาย,ป่วย,กิจ (แสดงเป็นตัวเลขสรุปประจำวัน),(ดู,แก้ไข,ลบ)" */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base">
              ประวัติการบันทึกการเช็คชื่อของครู
            </h3>
            <p className="text-xs text-slate-500">
              สรุปยอด มาเรียน, ขาด, สาย, ป่วย, กิจ ประจำวันในแต่ละรายวิชา
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-teal-50 text-[#0C7C82] font-bold">
            ทั้งหมด {teacherLogs.length} รายการ
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 px-6">วันที่</th>
                <th className="py-4 px-6">รายวิชา & ชั้นเรียน</th>
                <th className="py-4 px-6">คาบสอน</th>
                <th className="py-4 px-4 text-center text-emerald-700 bg-emerald-50/40">มาเรียน</th>
                <th className="py-4 px-4 text-center text-red-700 bg-red-50/40">ขาด</th>
                <th className="py-4 px-4 text-center text-amber-700 bg-amber-50/40">สาย</th>
                <th className="py-4 px-4 text-center text-sky-700 bg-sky-50/40">ป่วย</th>
                <th className="py-4 px-4 text-center text-orange-700 bg-orange-50/40">กิจ</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {teacherLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    ยังไม่มีรายการบันทึกการเช็คชื่อ คลิกคาบสอนในตารางด้านบนเพื่อเริ่มเช็คชื่อ
                  </td>
                </tr>
              ) : (
                teacherLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-800 text-xs">
                      {log.thaiDateStr || formatToThaiBE(log.date)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <span className="font-mono text-[#0C7C82]">{log.subjectCode}</span>
                        <span>{log.subjectName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        ห้อง {log.className}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-600 font-mono">
                      {log.periodName}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-emerald-600 bg-emerald-50/20">
                      {log.summary?.present || 0}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-red-600 bg-red-50/20">
                      {log.summary?.absent || 0}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-amber-600 bg-amber-50/20">
                      {log.summary?.late || 0}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-sky-600 bg-sky-50/20">
                      {log.summary?.sick || 0}
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-orange-600 bg-orange-50/20">
                      {log.summary?.leave || 0}
                    </td>
                    <td className="py-4 px-6 text-right space-x-1">
                      {/* View Action (ดู) */}
                      <button
                        onClick={() => setViewingLog(log)}
                        className="p-2 rounded-xl text-slate-600 hover:text-[#0C7C82] hover:bg-teal-50 transition-colors cursor-pointer"
                        title="ดูรายละเอียด"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {/* Edit Action (แก้ไข) */}
                      <button
                        onClick={() => handleEditFromLog(log)}
                        className="p-2 rounded-xl text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                        title="แก้ไขการเช็คชื่อ"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {/* Delete Action (ลบ) */}
                      <button
                        onClick={() => handleDeleteLog(log)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Check Modal (เช็คชื่อนักเรียน) */}
      {isCheckModalOpen && activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
              <div>
                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full uppercase">
                  {editingLogId ? 'แก้ไขการเช็คชื่อ' : 'บันทึกการเช็คชื่อประจำวัน'}
                </span>
                <h3 className="text-lg font-bold text-slate-800 mt-1">
                  วิชา {activeAssignment.subjectCode} {activeAssignment.subjectName} ({activeAssignment.className})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  วันที่: <strong>{formatToThaiBE(selectedDate)} (วัน{selectedDayOfWeek || '-'})</strong> • {activeAssignment.periodName}
                </p>
              </div>
              <button
                onClick={() => setIsCheckModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Counters & Mark All Present action button */}
            <div className="p-4 bg-teal-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Button: มีฟังก์ชั่นเช็คมาเรียนทั้งหมด as requested */}
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>เช็คมาเรียนทั้งหมด</span>
                </button>
              </div>

              {/* Status Counters */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">
                  มา: {liveSummary.present}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800">
                  ขาด: {liveSummary.absent}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">
                  สาย: {liveSummary.late}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800">
                  ป่วย: {liveSummary.sick}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800">
                  กิจ: {liveSummary.leave}
                </span>
                <span className="text-slate-500 font-normal">
                  (รวม {liveSummary.total} คน)
                </span>
              </div>
            </div>

            {/* Student List with Status Selection Buttons */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
              {studentRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  ยังไม่มีรายชื่อนักเรียนในห้อง {activeAssignment.className}
                </div>
              ) : (
                studentRecords.map((item, index) => (
                  <div
                    key={item.studentId || index}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50/70 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                        {item.seq || index + 1}
                      </span>
                      <span className="font-semibold text-slate-800 text-sm">
                        {item.studentName}
                      </span>
                    </div>

                    {/* Status Options: มาเรียน, ขาด, สาย, ป่วย, กิจ */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      {/* มาเรียน */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(index, 'present')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.status === 'present'
                            ? 'bg-emerald-600 text-white shadow-xs font-bold scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        มาเรียน
                      </button>

                      {/* ขาด */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(index, 'absent')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.status === 'absent'
                            ? 'bg-red-600 text-white shadow-xs font-bold scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700'
                        }`}
                      >
                        ขาด
                      </button>

                      {/* สาย */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(index, 'late')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.status === 'late'
                            ? 'bg-amber-500 text-white shadow-xs font-bold scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                      >
                        สาย
                      </button>

                      {/* ป่วย */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(index, 'sick')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.status === 'sick'
                            ? 'bg-sky-500 text-white shadow-xs font-bold scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-700'
                        }`}
                      >
                        ป่วย
                      </button>

                      {/* กิจ */}
                      <button
                        type="button"
                        onClick={() => handleStatusChange(index, 'leave')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          item.status === 'leave'
                            ? 'bg-orange-500 text-white shadow-xs font-bold scale-105'
                            : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700'
                        }`}
                      >
                        กิจ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsCheckModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAttendance}
                className="px-6 py-2 rounded-xl text-white text-xs font-semibold bg-[#0C7C82] hover:bg-[#096368] shadow-md shadow-[#0C7C82]/20 cursor-pointer flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>บันทึกการเช็คชื่อ</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">รายละเอียดการเช็คชื่อ</h3>
                <p className="text-xs text-slate-500">
                  วิชา {viewingLog.subjectCode} {viewingLog.subjectName} • {viewingLog.className} • วันที่ {viewingLog.thaiDateStr}
                </p>
              </div>
              <button
                onClick={() => setViewingLog(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex justify-around text-xs font-bold text-center">
              <div>
                <div className="text-emerald-600 text-base">{viewingLog.summary.present}</div>
                <div className="text-slate-500 text-[10px]">มาเรียน</div>
              </div>
              <div>
                <div className="text-red-600 text-base">{viewingLog.summary.absent}</div>
                <div className="text-slate-500 text-[10px]">ขาด</div>
              </div>
              <div>
                <div className="text-amber-600 text-base">{viewingLog.summary.late}</div>
                <div className="text-slate-500 text-[10px]">สาย</div>
              </div>
              <div>
                <div className="text-sky-600 text-base">{viewingLog.summary.sick}</div>
                <div className="text-slate-500 text-[10px]">ป่วย</div>
              </div>
              <div>
                <div className="text-orange-600 text-base">{viewingLog.summary.leave}</div>
                <div className="text-slate-500 text-[10px]">กิจ</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {viewingLog.records.map((r, i) => (
                <div
                  key={r.studentId || i}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-white text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-400 w-5">{r.seq || i + 1}.</span>
                    <span className="font-medium text-slate-800">{r.studentName}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      r.status === 'present'
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.status === 'absent'
                        ? 'bg-red-100 text-red-800'
                        : r.status === 'late'
                        ? 'bg-amber-100 text-amber-800'
                        : r.status === 'sick'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {r.status === 'present'
                      ? 'มาเรียน'
                      : r.status === 'absent'
                      ? 'ขาดเรียน'
                      : r.status === 'late'
                      ? 'มาสาย'
                      : r.status === 'sick'
                      ? 'ลาป่วย'
                      : 'ลากิจ'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
