import React, { useState } from 'react';
import { CalendarCheck, Plus, Edit2, Trash2, User, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { TeachingAssignment, AppUser, Classroom, Subject, Period, DayOfWeek, AcademicYear } from '../../types';

interface AssignmentsViewProps {
  assignments: TeachingAssignment[];
  teachers: AppUser[];
  classes: Classroom[];
  subjects: Subject[];
  periods: Period[];
  activeYear?: AcademicYear;
  onAddAssignment: (assignment: Omit<TeachingAssignment, 'id'>) => Promise<void>;
  onUpdateAssignment: (id: string, updated: Partial<TeachingAssignment>) => Promise<void>;
  onDeleteAssignment: (id: string) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast?: (type: 'success' | 'error' | 'warning', message: string) => void;
}

const DAYS: DayOfWeek[] = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

const PRESET_COLORS = [
  '#0C7C82', '#35B4B0', '#26A69A', '#AED581',
  '#FFCA28', '#FF8A65', '#EF5350', '#4A2C6D',
  '#D32F2F', '#F57C00', '#FBC02D', '#0288D1'
];

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  assignments,
  teachers,
  classes,
  subjects,
  periods,
  activeYear,
  onAddAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  openConfirm,
  showToast
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<TeachingAssignment | null>(null);

  // Pagination (max 10 teachers/items per page as required)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter teacher
  const [filterTeacher, setFilterTeacher] = useState<string>('all');

  // Form states
  const [teacherUsername, setTeacherUsername] = useState(teachers[0]?.username || '');
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [periodId, setPeriodId] = useState(periods.find((p) => !p.isLunchBreak)?.id || '');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('จันทร์');
  const [color, setColor] = useState('#0C7C82');
  const [isSaving, setIsSaving] = useState(false);

  // Available teaching periods (excluding lunch break)
  const teachingPeriods = periods.filter((p) => !p.isLunchBreak);

  // Filter subjects by selected classroom
  const selectedClass = classes.find((c) => c.id === classId);
  const classSubjects = subjects.filter(
    (s) => s.classId === classId || (selectedClass && s.className === selectedClass.name)
  );

  const handleClassChange = (newClassId: string) => {
    setClassId(newClassId);
    const targetClass = classes.find((c) => c.id === newClassId);
    const availableSubs = subjects.filter(
      (s) => s.classId === newClassId || (targetClass && s.className === targetClass.name)
    );
    setSubjectId(availableSubs[0]?.id || '');
  };

  const openAddModal = () => {
    if (teachers.length === 0) {
      showToast?.('warning', 'กรุณาสร้างบัญชีครูผู้สอนก่อนมอบหมายการสอน');
      return;
    }
    if (classes.length === 0) {
      showToast?.('warning', 'กรุณาสร้างชั้นเรียนก่อนมอบหมายการสอน');
      return;
    }
    if (subjects.length === 0) {
      showToast?.('warning', 'กรุณาสร้างรายวิชาก่อนมอบหมายการสอน');
      return;
    }
    if (teachingPeriods.length === 0) {
      showToast?.('warning', 'กรุณาสร้างคาบสอนก่อนมอบหมายการสอน');
      return;
    }

    const initialClassId = classes[0]?.id || '';
    const initialClass = classes[0];
    const initialClassSubs = subjects.filter(
      (s) => s.classId === initialClassId || (initialClass && s.className === initialClass.name)
    );

    setEditingAssignment(null);
    setTeacherUsername(teachers[0]?.username || '');
    setClassId(initialClassId);
    setSubjectId(initialClassSubs[0]?.id || '');
    setPeriodId(teachingPeriods[0]?.id || '');
    setDayOfWeek('จันทร์');
    setColor('#0C7C82');
    setIsModalOpen(true);
  };

  const openEditModal = (a: TeachingAssignment) => {
    setEditingAssignment(a);
    setTeacherUsername(a.teacherUsername);
    setClassId(a.classId);
    setSubjectId(a.subjectId);
    setPeriodId(a.periodId);
    setDayOfWeek(a.dayOfWeek);
    setColor(a.color || '#0C7C82');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) {
      showToast?.('warning', 'กรุณาเลือกชั้นเรียน');
      return;
    }
    if (!subjectId) {
      showToast?.('warning', 'กรุณาเลือกรายวิชาของชั้นเรียนนี้ หากยังไม่มีวิชา ให้ไปเพิ่มวิชาที่เมนูจัดการรายวิชาก่อน');
      return;
    }

    const teacher = teachers.find((t) => t.username === teacherUsername);
    const cls = classes.find((c) => c.id === classId);
    const sub = subjects.find((s) => s.id === subjectId);
    const per = periods.find((p) => p.id === periodId);

    if (!teacher || !cls || !sub || !per) {
      showToast?.('warning', 'ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบรายวิชาและชั้นเรียน');
      return;
    }

    setIsSaving(true);
    try {
      if (editingAssignment) {
        await onUpdateAssignment(editingAssignment.id, {
          teacherUsername: teacher.username,
          teacherName: teacher.fullName,
          classId: cls.id,
          className: cls.name,
          subjectId: sub.id,
          subjectCode: sub.code,
          subjectName: sub.name,
          periodId: per.id,
          periodName: `${per.name} (${per.startTime}-${per.endTime})`,
          dayOfWeek,
          color
        });
      } else {
        await onAddAssignment({
          teacherUsername: teacher.username,
          teacherName: teacher.fullName,
          classId: cls.id,
          className: cls.name,
          subjectId: sub.id,
          subjectCode: sub.code,
          subjectName: sub.name,
          periodId: per.id,
          periodName: `${per.name} (${per.startTime}-${per.endTime})`,
          dayOfWeek,
          color,
          academicYearId: activeYear?.id || 'year_2569'
        });
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (a: TeachingAssignment) => {
    openConfirm(
      'ยืนยันการลบการมอบหมายสอน',
      `คุณต้องการลบการสอนวิชา "${a.subjectCode} ${a.subjectName}" ของ ${a.teacherName} ใช่หรือไม่?`,
      () => onDeleteAssignment(a.id),
      'danger'
    );
  };

  // Filtered assignments
  const filteredAssignments = assignments.filter((a) => {
    if (filterTeacher === 'all') return true;
    return a.teacherUsername === filterTeacher;
  });

  // Pagination calculation: max 10 records per page
  const totalPages = Math.ceil(filteredAssignments.length / itemsPerPage) || 1;
  const paginatedAssignments = filteredAssignments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-[#0C7C82]" />
              <span>มอบหมายชั้นเรียนที่สอน (Teaching Assignments)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              จัดตารางสอน มอบหมายครูผู้สอน ชั้นเรียน รายวิชา คาบสอน และวันในสัปดาห์ (ปีการศึกษา {activeYear?.name || '2569'})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">กรองตามครูผู้สอน:</span>
            <select
              value={filterTeacher}
              onChange={(e) => {
                setFilterTeacher(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white"
            >
              <option value="all">ครูผู้สอนทุกคน ({assignments.length} คาบ)</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.username}>
                  {t.fullName} ({assignments.filter((a) => a.teacherUsername === t.username).length} คาบ)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            แสดง {paginatedAssignments.length} จากทั้งหมด {filteredAssignments.length} รายการ (จำกัด 10 รายการต่อหน้า)
          </span>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>มอบหมายการสอน</span>
          </button>
        </div>
      </div>

      {/* Report Table by Teacher (แสดงรายงานเป็นตารางตามชื่อครูผู้สอน) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 px-6 text-center w-16">ลำดับ</th>
                <th className="py-4 px-6">ชื่อครูผู้สอน</th>
                <th className="py-4 px-6">วันในสัปดาห์</th>
                <th className="py-4 px-6">คาบสอน/เวลา</th>
                <th className="py-4 px-6">ชั้นเรียน</th>
                <th className="py-4 px-6">รหัสและชื่อวิชา</th>
                <th className="py-4 px-6 text-center">สีป้ายกำกับ</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedAssignments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    ยังไม่มีข้อมูลการมอบหมายสอน คลิก "มอบหมายการสอน" เพื่อเริ่มต้น
                  </td>
                </tr>
              ) : (
                paginatedAssignments.map((a, idx) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-center text-xs text-slate-400 font-bold">
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-teal-50 text-[#0C7C82] flex items-center justify-center text-xs">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span>{a.teacherName}</span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-700">
                      วัน{a.dayOfWeek}
                    </td>
                    <td className="py-4 px-6 text-xs font-mono text-slate-600">
                      {a.periodName}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-800">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {a.className}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-800">
                      <span className="font-mono font-bold text-[#0C7C82] mr-1.5">{a.subjectCode}</span>
                      <span>{a.subjectName}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className="inline-block w-4 h-4 rounded-md shadow-2xs border border-white"
                        style={{ backgroundColor: a.color || '#0C7C82' }}
                      ></span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-1">
                      <button
                        onClick={() => openEditModal(a)}
                        className="p-2 rounded-xl text-slate-600 hover:text-[#0C7C82] hover:bg-teal-50 transition-colors cursor-pointer"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
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

        {/* Pagination controls (Max 10 per page as required) */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div>
              หน้า {currentPage} จากทั้งหมด {totalPages} หน้า
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>ก่อนหน้า</span>
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 cursor-pointer flex items-center gap-1"
              >
                <span>ถัดไป</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                {editingAssignment ? 'แก้ไขการมอบหมายสอน' : 'มอบหมายชั้นเรียนที่สอน'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Select Teacher */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  เลือกชื่อครูผู้สอน <span className="text-red-500">*</span>
                </label>
                <select
                  value={teacherUsername}
                  onChange={(e) => setTeacherUsername(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm bg-white"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.username}>
                      {t.fullName} ({t.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Class */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  เลือกชั้นเรียน <span className="text-red-500">*</span>
                </label>
                <select
                  value={classId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Subject - Filtered to show only subjects of the chosen class */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                  <span>เลือกรายวิชา <span className="text-red-500">*</span></span>
                  <span className="text-[11px] font-normal text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                    เฉพาะห้อง {selectedClass?.name || '-'}
                  </span>
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm bg-white"
                >
                  {classSubjects.length === 0 ? (
                    <option value="" disabled>
                      -- ไม่มีรายวิชาของห้อง {selectedClass?.name || ''} (กรุณาไปเพิ่มที่เมนูจัดการรายวิชา) --
                    </option>
                  ) : (
                    classSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} {s.name} ({s.type}) - {s.periodsPerWeek} คาบ/สัปดาห์
                      </option>
                    ))
                  )}
                </select>
                {classSubjects.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                    <span>⚠️ ยังไม่มีรายวิชาที่ผูกกับห้อง {selectedClass?.name} กรุณาเพิ่มรายวิชาในเมนู "จัดการรายวิชา" ก่อน</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Select Day of Week */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    วันในสัปดาห์ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        วัน{d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select Period */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    คาบสอน <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={periodId}
                    onChange={(e) => setPeriodId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {teachingPeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.startTime}-{p.endTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  ตั้งค่าสี color picker
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-md cursor-pointer border transition-transform ${
                        color === c ? 'scale-110 ring-2 ring-slate-400' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-white text-xs font-medium bg-[#0C7C82] hover:bg-[#096368] shadow-md shadow-[#0C7C82]/20 cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  <span>บันทึกข้อมูล</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
