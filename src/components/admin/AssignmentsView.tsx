import React, { useState, useMemo, useEffect } from 'react';
import { CalendarCheck, Plus, Edit2, Trash2, User, ChevronLeft, ChevronRight, X, Info, Clock } from 'lucide-react';
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
  const [subjectId, setSubjectId] = useState('');
  const [periodId, setPeriodId] = useState(periods.find((p) => !p.isLunchBreak)?.id || '');
  const [endPeriodId, setEndPeriodId] = useState(periods.find((p) => !p.isLunchBreak)?.id || '');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('จันทร์');
  const [color, setColor] = useState('#0C7C82');
  const [isSaving, setIsSaving] = useState(false);

  // Available teaching periods (excluding lunch break)
  const teachingPeriods = useMemo(() => periods.filter((p) => !p.isLunchBreak), [periods]);

  // Filter subjects STRICTLY by selected classroom
  const selectedClass = classes.find((c) => c.id === classId || c.name === classId);

  // Selected subject object
  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s.id === subjectId || s.code === subjectId);
  }, [subjects, subjectId]);

  // Helper to calculate target end period based on start period ID and maximum allowed count
  const calculateEndPeriod = (startPId: string, maxCount: number) => {
    if (teachingPeriods.length === 0) return startPId;
    const startIdx = teachingPeriods.findIndex((p) => p.id === startPId);
    if (startIdx === -1) return teachingPeriods[0]?.id || startPId;
    const targetEndIdx = Math.min(
      teachingPeriods.length - 1,
      startIdx + Math.max(1, maxCount) - 1
    );
    return teachingPeriods[targetEndIdx]?.id || startPId;
  };

  // Helper to calculate how many periods an assignment occupies
  const getAssignmentPeriodSpan = (a: TeachingAssignment): number => {
    if (a.endPeriodId && a.endPeriodId !== a.periodId) {
      const sIdx = teachingPeriods.findIndex((p) => p.id === a.periodId);
      const eIdx = teachingPeriods.findIndex((p) => p.id === a.endPeriodId);
      if (sIdx !== -1 && eIdx !== -1 && eIdx >= sIdx) {
        return eIdx - sIdx + 1;
      }
    }
    if (a.periodName) {
      const match = a.periodName.match(/คาบที่\s*(\d+)\s*ถึง\s*คาบที่\s*(\d+)/);
      if (match) {
        const p1 = parseInt(match[1], 10);
        const p2 = parseInt(match[2], 10);
        if (!isNaN(p1) && !isNaN(p2) && p2 >= p1) {
          return p2 - p1 + 1;
        }
      }
    }
    return 1;
  };

  // Helper to calculate how many periods have been assigned to a subject in this classroom
  const getSubjectAssignedCount = (
    sub: Subject,
    currentEditingId?: string | null
  ): number => {
    return assignments
      .filter((a) => {
        if (currentEditingId && a.id === currentEditingId) return false;
        if (activeYear?.id && a.academicYearId && a.academicYearId !== activeYear.id) return false;

        const matchesSubject =
          (a.subjectId && a.subjectId === sub.id) ||
          (a.subjectCode && a.subjectCode === sub.code);

        const matchesClass =
          (sub.classId && a.classId === sub.classId) ||
          (sub.className && a.className === sub.className) ||
          (classId && (a.classId === classId || a.className === selectedClass?.name));

        return matchesSubject && matchesClass;
      })
      .reduce((sum, a) => sum + getAssignmentPeriodSpan(a), 0);
  };

  // Helper to calculate remaining unassigned periods for a subject
  const getSubjectRemainingPeriods = (
    sub: Subject,
    currentEditingId?: string | null
  ): number => {
    const total = Number(sub.periodsPerWeek) || 1;
    const assigned = getSubjectAssignedCount(sub, currentEditingId);
    return Math.max(0, total - assigned);
  };

  // Helper to find who was assigned to a subject in this classroom (if any)
  const getSubjectAssignedTeacher = (
    sub: Subject,
    currentEditingId?: string | null
  ) => {
    const found = assignments.find((a) => {
      if (currentEditingId && a.id === currentEditingId) return false;
      if (activeYear?.id && a.academicYearId && a.academicYearId !== activeYear.id) return false;

      const matchesSubject =
        (a.subjectId && a.subjectId === sub.id) ||
        (a.subjectCode && a.subjectCode === sub.code);

      const matchesClass =
        (sub.classId && a.classId === sub.classId) ||
        (sub.className && a.className === sub.className) ||
        (classId && (a.classId === classId || a.className === selectedClass?.name));

      return matchesSubject && matchesClass;
    });
    return found ? { username: found.teacherUsername, name: found.teacherName || found.teacherUsername } : null;
  };

  const totalSubjectPeriods = Number(selectedSubject?.periodsPerWeek) || 1;
  const assignedSubjectPeriods = selectedSubject
    ? getSubjectAssignedCount(selectedSubject, editingAssignment?.id)
    : 0;
  const remainingSubjectPeriods = selectedSubject
    ? getSubjectRemainingPeriods(selectedSubject, editingAssignment?.id)
    : 1;

  const startPeriod = useMemo(() => {
    return teachingPeriods.find((p) => p.id === periodId) || periods.find((p) => p.id === periodId);
  }, [teachingPeriods, periods, periodId]);

  const endPeriod = useMemo(() => {
    return teachingPeriods.find((p) => p.id === endPeriodId) || startPeriod;
  }, [teachingPeriods, endPeriodId, startPeriod]);

  // Current span chosen in modal
  const currentSpan = useMemo(() => {
    if (teachingPeriods.length === 0) return 1;
    const startIdx = teachingPeriods.findIndex((p) => p.id === periodId);
    const endIdx = teachingPeriods.findIndex((p) => p.id === endPeriodId);
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return 1;
    return endIdx - startIdx + 1;
  }, [teachingPeriods, periodId, endPeriodId]);

  // All subjects of the selected classroom
  const classSubjects = useMemo(() => {
    if (!classId) return [];
    return subjects.filter(
      (s) =>
        (s.classId && s.classId === classId) ||
        (selectedClass && (s.classId === selectedClass.id || s.className === selectedClass.name))
    );
  }, [subjects, classId, selectedClass]);

  // Filter subjects of the selected classroom:
  // 1. ถ้ารายวิชาใดมีคาบมากกว่า 1 คาบ แต่ยังลงคาบสอนไม่ครบจำนวนคาบ/สัปดาห์ ให้สามารถเลือกรายวิชานั้นได้อีก
  // 2. ถ้ารายวิชาใดลงคาบสอนครบแล้ว (เหลือ 0 คาบ) หรือมอบหมายให้ครูท่านอื่นแล้ว จะไม่แสดงให้เลือกอีก
  const availableClassSubjects = useMemo(() => {
    return classSubjects.filter((s) => {
      // If currently editing this assignment and it matches this subject, keep it available
      if (editingAssignment && (s.id === editingAssignment.subjectId || s.code === editingAssignment.subjectCode)) {
        return true;
      }

      // If already assigned to another teacher, do not show to current teacher
      const assignedTeacher = getSubjectAssignedTeacher(s, editingAssignment?.id);
      if (assignedTeacher && assignedTeacher.username !== teacherUsername) {
        return false;
      }

      // Check remaining periods
      const rem = getSubjectRemainingPeriods(s, editingAssignment?.id);
      return rem > 0;
    });
  }, [classSubjects, assignments, editingAssignment, activeYear, selectedClass, teacherUsername, teachingPeriods]);

  // Handle classroom selection change: recalculate subjects and sync end period
  const handleClassChange = (newClassId: string) => {
    setClassId(newClassId);
    const targetClass = classes.find((c) => c.id === newClassId || c.name === newClassId);
    const classSubs = subjects.filter(
      (s) =>
        (s.classId && s.classId === newClassId) ||
        (targetClass && (s.classId === targetClass.id || s.className === targetClass.name))
    );
    const available = classSubs.filter((s) => {
      const assignedTeacher = getSubjectAssignedTeacher(s, editingAssignment?.id);
      if (assignedTeacher && assignedTeacher.username !== teacherUsername) return false;
      return getSubjectRemainingPeriods(s, editingAssignment?.id) > 0;
    });
    const firstSub = available[0];
    const newSubId = firstSub?.id || '';
    setSubjectId(newSubId);
    const rem = firstSub ? getSubjectRemainingPeriods(firstSub, editingAssignment?.id) : 1;
    setEndPeriodId(calculateEndPeriod(periodId, rem));
  };

  // Handle subject change: adjust end period up to remaining periods of this subject
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    const sub = subjects.find((s) => s.id === newSubjectId);
    const rem = sub ? getSubjectRemainingPeriods(sub, editingAssignment?.id) : 1;
    setEndPeriodId(calculateEndPeriod(periodId, rem));
  };

  // Handle start period change: auto-calculate end period up to remaining periods
  const handleStartPeriodChange = (newStartId: string) => {
    setPeriodId(newStartId);
    setEndPeriodId(calculateEndPeriod(newStartId, remainingSubjectPeriods));
  };

  // Handle teacher selection change
  const handleTeacherChange = (newTeacherUsername: string) => {
    setTeacherUsername(newTeacherUsername);
  };

  // Ensure subjectId is always valid for the selected classroom and teacher when modal is open
  useEffect(() => {
    if (isModalOpen) {
      if (availableClassSubjects.length > 0) {
        const isValid = availableClassSubjects.some((s) => s.id === subjectId || s.code === subjectId);
        if (!isValid) {
          const firstSub = availableClassSubjects[0];
          setSubjectId(firstSub.id);
          const rem = getSubjectRemainingPeriods(firstSub, editingAssignment?.id);
          setEndPeriodId(calculateEndPeriod(periodId, rem));
        }
      } else {
        setSubjectId('');
      }
    }
  }, [isModalOpen, availableClassSubjects, subjectId, teacherUsername]);

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

    const firstTeacherUsername = teachers[0]?.username || '';
    const initialClass = classes[0];
    const initialClassId = initialClass.id;
    const initialClassSubs = subjects.filter(
      (s) =>
        (s.classId && s.classId === initialClassId) ||
        (initialClass && (s.classId === initialClass.id || s.className === initialClass.name))
    );
    // Subjects not fully assigned and not assigned to another teacher
    const availableSubs = initialClassSubs.filter((s) => {
      const assignedTeacher = getSubjectAssignedTeacher(s, null);
      if (assignedTeacher && assignedTeacher.username !== firstTeacherUsername) return false;
      return getSubjectRemainingPeriods(s, null) > 0;
    });

    const firstSub = availableSubs[0];
    const firstPeriodId = teachingPeriods[0]?.id || '';
    const rem = firstSub ? getSubjectRemainingPeriods(firstSub, null) : 1;

    setEditingAssignment(null);
    setTeacherUsername(firstTeacherUsername);
    setClassId(initialClassId);
    setSubjectId(firstSub?.id || '');
    setPeriodId(firstPeriodId);
    setEndPeriodId(calculateEndPeriod(firstPeriodId, rem));
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

    const sub = subjects.find((s) => s.id === a.subjectId || s.code === a.subjectCode);
    const rem = sub ? getSubjectRemainingPeriods(sub, a.id) : 1;

    if (a.endPeriodId) {
      setEndPeriodId(a.endPeriodId);
    } else if (sub && Number(sub.periodsPerWeek) > 1) {
      const match = a.periodName?.match(/ถึง\s+(คาบที่\s*\d+)/);
      if (match) {
        const found = periods.find((p) => p.name.includes(match[1]));
        setEndPeriodId(found?.id || calculateEndPeriod(a.periodId, Math.max(1, rem)));
      } else {
        setEndPeriodId(calculateEndPeriod(a.periodId, Math.max(1, rem)));
      }
    } else {
      setEndPeriodId(a.periodId);
    }

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
      showToast?.('warning', 'กรุณาเลือกรายวิชา หรือไม่มีรายวิชาที่ว่างสำหรับมอบหมายในห้องเรียนนี้');
      return;
    }

    const teacher = teachers.find((t) => t.username === teacherUsername);
    const cls = classes.find((c) => c.id === classId);
    const sub = subjects.find((s) => s.id === subjectId);
    const startPer = teachingPeriods.find((p) => p.id === periodId) || periods.find((p) => p.id === periodId);
    const endPer = teachingPeriods.find((p) => p.id === endPeriodId) || startPer;

    if (!teacher || !cls || !sub || !startPer || !endPer) {
      showToast?.('warning', 'ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบรายวิชาและชั้นเรียน');
      return;
    }

    // Safety check 1: is this subject assigned to another teacher?
    const assignedTeacher = getSubjectAssignedTeacher(sub, editingAssignment?.id);
    if (assignedTeacher && assignedTeacher.username !== teacher.username) {
      showToast?.(
        'error',
        `ไม่สามารถบันทึกได้ เนื่องจากวิชา "${sub.code} ${sub.name}" ถูกเลือก/มอบหมายให้ ${assignedTeacher.name} ไปแล้ว`
      );
      return;
    }

    // Safety check 2: check remaining quota
    const remaining = getSubjectRemainingPeriods(sub, editingAssignment?.id);
    if (remaining <= 0) {
      showToast?.(
        'error',
        `ไม่สามารถบันทึกได้ เนื่องจากวิชา "${sub.code} ${sub.name}" ถูกมอบหมายครบ ${sub.periodsPerWeek} คาบ/สัปดาห์แล้ว`
      );
      return;
    }

    const startIdx = teachingPeriods.findIndex((p) => p.id === startPer.id);
    const endIdx = teachingPeriods.findIndex((p) => p.id === endPer.id);
    const chosenSpan = Math.max(1, endIdx - startIdx + 1);

    if (chosenSpan > remaining) {
      showToast?.(
        'error',
        `ไม่สามารถบันทึกได้ เนื่องจากจำนวนคาบที่เลือก (${chosenSpan} คาบ) เกินจำนวนคาบสอนที่เหลือของวิชานี้ (${remaining} คาบ)`
      );
      return;
    }

    const isMultiPeriod = chosenSpan > 1 && endPer && endPer.id !== startPer.id;
    const computedPeriodName = isMultiPeriod
      ? `${startPer.name} ถึง ${endPer.name} (${startPer.startTime}-${endPer.endTime})`
      : `${startPer.name} (${startPer.startTime}-${startPer.endTime})`;

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
          periodId: startPer.id,
          endPeriodId: endPer?.id || startPer.id,
          periodName: computedPeriodName,
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
          periodId: startPer.id,
          endPeriodId: endPer?.id || startPer.id,
          periodName: computedPeriodName,
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
                  onChange={(e) => handleTeacherChange(e.target.value)}
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

              {/* Select Subject - Filtered: ถ้ารายวิชาใดเลือกไปแล้วจะไม่แสดงให้เลือกอีก */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                  <span>เลือกรายวิชา <span className="text-red-500">*</span></span>
                  <span className="text-[11px] font-normal text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                    ห้อง {selectedClass?.name || '-'}
                  </span>
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm bg-white"
                >
                  {availableClassSubjects.length === 0 ? (
                    <option value="" disabled>
                      {classSubjects.length === 0
                        ? `-- ไม่มีรายวิชาของห้อง ${selectedClass?.name || ''} (กรุณาไปเพิ่มที่เมนูจัดการรายวิชา) --`
                        : `-- รายวิชาทั้งหมดในห้อง ${selectedClass?.name || ''} ถูกเลือก/มอบหมายครบแล้ว --`}
                    </option>
                  ) : (
                    availableClassSubjects.map((s) => {
                      const total = Number(s.periodsPerWeek) || 1;
                      const assigned = getSubjectAssignedCount(s, editingAssignment?.id);
                      const rem = getSubjectRemainingPeriods(s, editingAssignment?.id);
                      let badgeNote = '';
                      if (assigned > 0 && rem > 0) {
                        badgeNote = ` [ลงแล้ว ${assigned}/${total} คาบ • เหลือ ${rem} คาบ]`;
                      } else if (total > 1) {
                        badgeNote = ` [${total} คาบ/สัปดาห์ • ว่างครบ ${rem} คาบ]`;
                      } else {
                        badgeNote = ` [1 คาบ/สัปดาห์]`;
                      }
                      return (
                        <option key={s.id} value={s.id}>
                          {s.code} {s.name} ({s.type}){badgeNote}
                        </option>
                      );
                    })
                  )}
                </select>

                {classSubjects.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>ยังไม่มีรายวิชาที่ผูกกับห้อง {selectedClass?.name} กรุณาเพิ่มรายวิชาในเมนู "จัดการรายวิชา" ก่อน</span>
                  </p>
                )}
                {classSubjects.length > 0 && availableClassSubjects.length === 0 && (
                  <p className="text-[11px] text-teal-700 mt-1.5 flex items-center gap-1 bg-teal-50 p-2 rounded-lg border border-teal-200">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>รายวิชาทั้งหมดของห้อง {selectedClass?.name} ({classSubjects.length} วิชา) ถูกมอบหมายการสอนครบตามจำนวนคาบ/สัปดาห์เรียบร้อยแล้ว</span>
                  </p>
                )}
              </div>

              {/* Select Day of Week and Period(s) */}
              {totalSubjectPeriods > 1 ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      วันในสัปดาห์ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
                    >
                      {DAYS.map((d) => (
                        <option key={d} value={d}>
                          วัน{d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Clock className="w-4 h-4 text-[#0C7C82]" />
                        <span>คาบสอน คาบที่ ถึง คาบที่</span>
                        <span className="text-red-500">*</span>
                      </span>
                      <span className="text-[11px] font-medium text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                        มี {totalSubjectPeriods} คาบ/สัปดาห์ {assignedSubjectPeriods > 0 ? `(ลงแล้ว ${assignedSubjectPeriods} • เหลือ ${remainingSubjectPeriods} คาบ)` : `(เหลือ ${remainingSubjectPeriods} คาบ)`}
                      </span>
                    </label>

                    <div className="grid grid-cols-2 gap-3 items-center">
                      <div>
                        <span className="block text-[11px] text-slate-500 mb-1 font-medium">คาบเริ่มต้น</span>
                        <select
                          value={periodId}
                          onChange={(e) => handleStartPeriodChange(e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
                        >
                          {teachingPeriods.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.startTime}-{p.endTime})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="block text-[11px] text-slate-500 mb-1 font-medium">ถึง คาบที่ (จำกัดตามคาบที่เหลือ)</span>
                        <select
                          value={endPeriodId}
                          onChange={(e) => setEndPeriodId(e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
                        >
                          {teachingPeriods.map((p, idx) => {
                            const startIdx = teachingPeriods.findIndex((tp) => tp.id === periodId);
                            const span = idx - startIdx + 1;
                            const isBeforeStart = idx < startIdx;
                            const exceedsRemaining = span > remainingSubjectPeriods;
                            const isDisabled = isBeforeStart || exceedsRemaining;
                            let spanLabel = '';
                            if (isBeforeStart) {
                              spanLabel = ' (ก่อนคาบเริ่มต้น)';
                            } else if (exceedsRemaining) {
                              spanLabel = ` (เกินโควตาที่เหลือ ${remainingSubjectPeriods} คาบ)`;
                            } else {
                              spanLabel = ` [เลือก ${span} คาบ]`;
                            }
                            return (
                              <option key={p.id} value={p.id} disabled={isDisabled}>
                                {p.name} ({p.startTime}-{p.endTime}){spanLabel}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    <div className="mt-2 p-2.5 rounded-xl bg-teal-50/80 border border-teal-100 text-xs text-teal-900 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[#0C7C82] shrink-0" />
                        <span>
                          คาบสอน: <strong>{startPeriod?.name || 'คาบแรก'}</strong> ถึง <strong>{endPeriod?.name || 'คาบสุดท้าย'}</strong>
                          {' '}(รวม <strong>{currentSpan}</strong> คาบ)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-teal-700 bg-white px-2 py-0.5 rounded border border-teal-200">
                          {startPeriod?.startTime || ''} - {endPeriod?.endTime || ''} น.
                        </span>
                        {remainingSubjectPeriods - currentSpan === 0 ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300">
                            ✓ ครบ {totalSubjectPeriods} คาบพอดี
                          </span>
                        ) : remainingSubjectPeriods - currentSpan > 0 ? (
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300">
                            เหลืออีก {remainingSubjectPeriods - currentSpan} คาบ
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-md">
                            เกินโควตา
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* Select Day of Week */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      วันในสัปดาห์ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
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
                      onChange={(e) => {
                        setPeriodId(e.target.value);
                        setEndPeriodId(e.target.value);
                      }}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
                    >
                      {teachingPeriods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.startTime}-{p.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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
