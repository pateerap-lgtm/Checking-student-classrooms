import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarCheck,
  Plus,
  Edit2,
  Trash2,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  LayoutGrid,
  ListFilter,
  Layers,
  Printer,
  BookOpen,
  GraduationCap,
  Sparkles
} from 'lucide-react';
import {
  TeachingAssignment,
  AppUser,
  Classroom,
  Subject,
  Period,
  DayOfWeek,
  AcademicYear,
  SystemSettings
} from '../../types';

interface AssignmentsViewProps {
  assignments: TeachingAssignment[];
  teachers: AppUser[];
  classes: Classroom[];
  subjects: Subject[];
  periods: Period[];
  activeYear?: AcademicYear;
  systemSettings?: SystemSettings;
  onAddAssignment: (assignment: Omit<TeachingAssignment, 'id'>) => Promise<void>;
  onUpdateAssignment: (id: string, updated: Partial<TeachingAssignment>) => Promise<void>;
  onDeleteAssignment: (id: string) => Promise<void>;
  onDeleteAllAssignments?: (targetIds?: string[]) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast?: (type: 'success' | 'error' | 'warning', message: string) => void;
}

const DAYS: DayOfWeek[] = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

const DAY_CONFIG: Record<
  DayOfWeek,
  { label: string; bg: string; text: string; border: string; badge: string; accentColor: string }
> = {
  จันทร์: {
    label: 'วันจันทร์',
    bg: 'bg-amber-50/70',
    text: 'text-amber-900',
    border: 'border-amber-200',
    badge: 'bg-amber-500 text-white',
    accentColor: '#F59E0B'
  },
  อังคาร: {
    label: 'วันอังคาร',
    bg: 'bg-pink-50/70',
    text: 'text-pink-900',
    border: 'border-pink-200',
    badge: 'bg-pink-500 text-white',
    accentColor: '#EC4899'
  },
  พุธ: {
    label: 'วันพุธ',
    bg: 'bg-emerald-50/70',
    text: 'text-emerald-900',
    border: 'border-emerald-200',
    badge: 'bg-emerald-600 text-white',
    accentColor: '#10B981'
  },
  พฤหัสบดี: {
    label: 'วันพฤหัสบดี',
    bg: 'bg-orange-50/70',
    text: 'text-orange-900',
    border: 'border-orange-200',
    badge: 'bg-orange-500 text-white',
    accentColor: '#F97316'
  },
  ศุกร์: {
    label: 'วันศุกร์',
    bg: 'bg-sky-50/70',
    text: 'text-sky-900',
    border: 'border-sky-200',
    badge: 'bg-sky-600 text-white',
    accentColor: '#0284C7'
  }
};

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
  systemSettings,
  onAddAssignment,
  onUpdateAssignment,
  onDeleteAssignment,
  onDeleteAllAssignments,
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

  // View mode when teacher filter is active: both | timetable | list
  const [viewMode, setViewMode] = useState<'both' | 'timetable' | 'list'>('both');

  // Form states
  const [teacherUsername, setTeacherUsername] = useState(teachers[0]?.username || '');
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [subjectId, setSubjectId] = useState('');
  const [periodId, setPeriodId] = useState(periods.find((p) => !p.isLunchBreak)?.id || '');
  const [endPeriodId, setEndPeriodId] = useState(periods.find((p) => !p.isLunchBreak)?.id || '');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('จันทร์');
  const [color, setColor] = useState('#0C7C82');
  const [isSaving, setIsSaving] = useState(false);

  // All periods sorted chronologically by order
  const sortedPeriods = useMemo(() => [...periods].sort((a, b) => a.order - b.order), [periods]);

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

  // Selected period index span in teachingPeriods
  const selectedStartIdx = useMemo(() => {
    return teachingPeriods.findIndex((p) => p.id === periodId);
  }, [teachingPeriods, periodId]);

  const selectedEndIdx = useMemo(() => {
    if (totalSubjectPeriods <= 1) return selectedStartIdx;
    const eIdx = teachingPeriods.findIndex((p) => p.id === endPeriodId);
    return eIdx !== -1 && eIdx >= selectedStartIdx ? eIdx : selectedStartIdx;
  }, [teachingPeriods, endPeriodId, selectedStartIdx, totalSubjectPeriods]);

  // Helper to determine the period range an assignment spans in teachingPeriods
  const getAssignmentPeriodRange = (a: TeachingAssignment) => {
    const sIdx = teachingPeriods.findIndex((p) => p.id === a.periodId);
    if (sIdx === -1) {
      return { startIdx: -1, endIdx: -1, periodIds: [], periodNames: [] };
    }
    let eIdx = a.endPeriodId ? teachingPeriods.findIndex((p) => p.id === a.endPeriodId) : sIdx;
    if (eIdx === -1 || eIdx < sIdx) {
      const span = getAssignmentPeriodSpan(a);
      eIdx = Math.min(teachingPeriods.length - 1, sIdx + span - 1);
    }
    const slice = teachingPeriods.slice(sIdx, eIdx + 1);
    return {
      startIdx: sIdx,
      endIdx: eIdx,
      periodIds: slice.map((p) => p.id),
      periodNames: slice.map((p) => p.name)
    };
  };

  // All existing assignments for this classroom on the selected day
  const classroomDayAssignments = useMemo(() => {
    if (!classId) return [];
    return assignments.filter((a) => {
      if (editingAssignment && a.id === editingAssignment.id) return false;
      if (activeYear?.id && a.academicYearId && a.academicYearId !== activeYear.id) return false;
      if (a.dayOfWeek !== dayOfWeek) return false;

      const isSameClass =
        (a.classId && a.classId === classId) ||
        (selectedClass && (a.classId === selectedClass.id || a.className === selectedClass.name));

      return isSameClass;
    });
  }, [assignments, editingAssignment, activeYear, dayOfWeek, classId, selectedClass]);

  // Classroom period conflicts: another subject/teacher already assigned to these periods in this classroom
  const classroomConflicts = useMemo(() => {
    if (selectedStartIdx === -1) return [];
    return classroomDayAssignments
      .filter((a) => {
        const aRange = getAssignmentPeriodRange(a);
        if (aRange.startIdx === -1) return false;
        return Math.max(selectedStartIdx, aRange.startIdx) <= Math.min(selectedEndIdx, aRange.endIdx);
      })
      .map((a) => {
        const aRange = getAssignmentPeriodRange(a);
        const overlapStart = Math.max(selectedStartIdx, aRange.startIdx);
        const overlapEnd = Math.min(selectedEndIdx, aRange.endIdx);
        const overlappingNames = teachingPeriods.slice(overlapStart, overlapEnd + 1).map((p) => p.name).join(', ');
        return {
          ...a,
          overlappingNames
        };
      });
  }, [classroomDayAssignments, selectedStartIdx, selectedEndIdx, teachingPeriods]);

  // Teacher timetable conflicts: teacher is scheduled in another classroom during overlapping periods
  const teacherDayAssignments = useMemo(() => {
    if (!teacherUsername) return [];
    return assignments.filter((a) => {
      if (editingAssignment && a.id === editingAssignment.id) return false;
      if (activeYear?.id && a.academicYearId && a.academicYearId !== activeYear.id) return false;
      if (a.dayOfWeek !== dayOfWeek) return false;
      if (a.teacherUsername !== teacherUsername) return false;
      return true;
    });
  }, [assignments, editingAssignment, activeYear, dayOfWeek, teacherUsername]);

  const teacherConflicts = useMemo(() => {
    if (selectedStartIdx === -1) return [];
    return teacherDayAssignments
      .filter((a) => {
        const isSameClass =
          (a.classId && a.classId === classId) ||
          (selectedClass && (a.classId === selectedClass.id || a.className === selectedClass.name));
        if (isSameClass) return false; // Handled as classroom conflict

        const aRange = getAssignmentPeriodRange(a);
        if (aRange.startIdx === -1) return false;
        return Math.max(selectedStartIdx, aRange.startIdx) <= Math.min(selectedEndIdx, aRange.endIdx);
      })
      .map((a) => {
        const aRange = getAssignmentPeriodRange(a);
        const overlapStart = Math.max(selectedStartIdx, aRange.startIdx);
        const overlapEnd = Math.min(selectedEndIdx, aRange.endIdx);
        const overlappingNames = teachingPeriods.slice(overlapStart, overlapEnd + 1).map((p) => p.name).join(', ');
        return {
          ...a,
          overlappingNames
        };
      });
  }, [teacherDayAssignments, selectedStartIdx, selectedEndIdx, teachingPeriods, classId, selectedClass]);

  // Helper to check if a specific period in teachingPeriods is already occupied in this classroom on this day
  const getPeriodAssignmentInClass = (pId: string) => {
    const pIdx = teachingPeriods.findIndex((p) => p.id === pId);
    if (pIdx === -1) return null;
    return classroomDayAssignments.find((a) => {
      const aRange = getAssignmentPeriodRange(a);
      return aRange.startIdx !== -1 && pIdx >= aRange.startIdx && pIdx <= aRange.endIdx;
    });
  };

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

  const openAddModal = (
    initialTeacherUsername?: string,
    initialDay?: DayOfWeek,
    initialPeriodId?: string
  ) => {
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

    const selectedTeacher =
      initialTeacherUsername ||
      (filterTeacher !== 'all' ? filterTeacher : (teachers[0]?.username || ''));
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
      if (assignedTeacher && assignedTeacher.username !== selectedTeacher) return false;
      return getSubjectRemainingPeriods(s, null) > 0;
    });

    const firstSub = availableSubs[0];
    const targetPeriodId = initialPeriodId || (teachingPeriods[0]?.id || '');
    const rem = firstSub ? getSubjectRemainingPeriods(firstSub, null) : 1;

    setEditingAssignment(null);
    setTeacherUsername(selectedTeacher);
    setClassId(initialClassId);
    setSubjectId(firstSub?.id || '');
    setPeriodId(targetPeriodId);
    setEndPeriodId(calculateEndPeriod(targetPeriodId, rem));
    setDayOfWeek(initialDay || 'จันทร์');
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

    // Safety check 0: Duplicate period in classroom check
    if (classroomConflicts.length > 0) {
      const first = classroomConflicts[0];
      showToast?.(
        'error',
        `ไม่สามารถบันทึกได้! คาบเรียนซ้ำซ้อนกับวิชา "${first.subjectCode} ${first.subjectName}" (ครู${first.teacherName}) ในห้อง ${selectedClass?.name || cls.name} วัน${dayOfWeek}`
      );
      return;
    }

    // Safety check 0.5: Teacher timetable conflict check
    if (teacherConflicts.length > 0) {
      const first = teacherConflicts[0];
      showToast?.(
        'error',
        `ไม่สามารถบันทึกได้! ครู "${teacher.fullName}" ติดตารางสอนวิชา "${first.subjectCode}" ที่ห้อง ${first.className} ในช่วงเวลาดังกล่าวแล้ว`
      );
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

  const handleDeleteAll = () => {
    if (assignments.length === 0) {
      showToast?.('warning', 'ไม่มีข้อมูลการมอบหมายสอนให้ลบ');
      return;
    }

    if (filterTeacher !== 'all') {
      const teacherObj = teachers.find((t) => t.username === filterTeacher);
      const teacherName = teacherObj?.fullName || filterTeacher;
      openConfirm(
        'ยืนยันการลบการมอบหมายสอนของครูท่านนี้',
        `คุณต้องการลบข้อมูลการมอบหมายสอนของ "${teacherName}" ทั้งหมด ${filteredAssignments.length} รายการ ใช่หรือไม่? (หากต้องการลบทั้งหมดทุกครูในระบบ ให้เปลี่ยนตัวกรองเป็น "ครูผู้สอนทุกคน")`,
        () => {
          onDeleteAllAssignments?.(filteredAssignments.map((a) => a.id));
        },
        'danger'
      );
    } else {
      openConfirm(
        'ยืนยันการลบการมอบหมายสอนทั้งหมด',
        `คำเตือน: คุณต้องการลบข้อมูลการมอบหมายชั้นเรียนที่สอนทั้งหมดในระบบจำนวน ${assignments.length} รายการ ใช่หรือไม่? ข้อมูลตารางสอนและการมอบหมายครูผู้สอนทั้งหมดจะถูกลบออกจากฐานข้อมูล และไม่สามารถย้อนกลับได้`,
        () => {
          onDeleteAllAssignments?.();
        },
        'danger'
      );
    }
  };

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (filterTeacher === 'all') return true;
      return a.teacherUsername === filterTeacher;
    });
  }, [assignments, filterTeacher]);

  const selectedTeacherObj = useMemo(() => {
    if (filterTeacher === 'all') return null;
    return teachers.find((t) => t.username === filterTeacher) || null;
  }, [teachers, filterTeacher]);

  const teacherTotalPeriods = useMemo(() => {
    if (!selectedTeacherObj) return 0;
    return filteredAssignments.reduce((acc, a) => acc + getAssignmentPeriodSpan(a), 0);
  }, [selectedTeacherObj, filteredAssignments, teachingPeriods]);

  const teacherClassesCount = useMemo(() => {
    if (!selectedTeacherObj) return 0;
    return new Set(filteredAssignments.map((a) => a.classId || a.className)).size;
  }, [selectedTeacherObj, filteredAssignments]);

  const teacherSubjectsCount = useMemo(() => {
    if (!selectedTeacherObj) return 0;
    return new Set(filteredAssignments.map((a) => a.subjectId || a.subjectCode)).size;
  }, [selectedTeacherObj, filteredAssignments]);

  // Handle printing timetable
  const handlePrintTimetable = () => {
    window.print();
  };

  // Pagination calculation: max 10 records per page
  const totalPages = Math.ceil(filteredAssignments.length / itemsPerPage) || 1;
  const paginatedAssignments = filteredAssignments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Print CSS styles for clean A4 printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #teacher-timetable-print-area, #teacher-timetable-print-area * {
            visibility: visible;
          }
          #teacher-timetable-print-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 12px;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            z-index: 99999;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Filter and Controls Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4 no-print">
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
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white shadow-2xs focus:ring-2 focus:ring-[#0C7C82]"
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

        {/* Action Button & View Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">
              แสดง {paginatedAssignments.length} จากทั้งหมด {filteredAssignments.length} รายการ
            </span>

            {/* View Mode Switcher when filtered by teacher */}
            {selectedTeacherObj && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('both')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'both'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="แสดงทั้งตารางสอนและรายการตารางข้อมูล"
                >
                  <Layers className="w-3.5 h-3.5 text-[#0C7C82]" />
                  <span>ทั้งสองแบบ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('timetable')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'timetable'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="แสดงเฉพาะตารางสอน"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#0C7C82]" />
                  <span>ตารางสอน</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="แสดงเฉพาะรายการข้อมูล"
                >
                  <ListFilter className="w-3.5 h-3.5 text-[#0C7C82]" />
                  <span>รายการ</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedTeacherObj && (
              <button
                type="button"
                onClick={handlePrintTimetable}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                title="พิมพ์ตารางสอนประจำสัปดาห์ของครูท่านนี้"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">พิมพ์ตารางสอน</span>
              </button>
            )}

            {assignments.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-700 font-medium bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer text-xs shadow-2xs"
                title={filterTeacher !== 'all' ? 'ลบข้อมูลการมอบหมายสอนของครูท่านนี้ทั้งหมด' : 'ลบข้อมูลการมอบหมายสอนทั้งหมด'}
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>ลบทั้งหมด</span>
                {filterTeacher !== 'all' ? (
                  <span className="text-[10px] bg-rose-200/80 text-rose-800 px-1.5 py-0.5 rounded-md font-semibold">
                    ครูนี้ ({filteredAssignments.length})
                  </span>
                ) : (
                  <span className="text-[10px] bg-rose-200/80 text-rose-800 px-1.5 py-0.5 rounded-md font-semibold">
                    ({assignments.length})
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => openAddModal(filterTeacher !== 'all' ? filterTeacher : undefined)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>มอบหมายการสอน</span>
            </button>
          </div>
        </div>
      </div>

      {/* FEATURE: เมื่อกรองตามครูผู้สอน ให้แสดงเป็นตารางสอนด้วย (Weekly Timetable Grid) */}
      {selectedTeacherObj && (viewMode === 'timetable' || viewMode === 'both') && (
        <div
          id="teacher-timetable-print-area"
          className="bg-white rounded-3xl border border-slate-100 shadow-xs p-6 space-y-4"
        >
          {/* Print Only Header (Visible exclusively when printing) */}
          <div className="hidden print:block text-center border-b border-slate-300 pb-3 mb-2">
            <h1 className="text-xl font-bold text-slate-900">
              {systemSettings?.schoolName || 'ระบบบริหารจัดการสถานศึกษา'}
            </h1>
            <h2 className="text-base font-semibold text-slate-800 mt-0.5">
              ตารางสอนประจำสัปดาห์ (Teaching Timetable)
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              ครูผู้สอน: <strong>{selectedTeacherObj.fullName}</strong> • ภาคเรียน/ปีการศึกษา: <strong>{activeYear?.name || '2569'}</strong> • รวม {teacherTotalPeriods} คาบ/สัปดาห์
            </p>
          </div>

          {/* Timetable Card Header on Screen */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 no-print">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0C7C82] to-[#35B4B0] text-white flex items-center justify-center shadow-md shadow-[#0C7C82]/20 shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-[#0C7C82] border border-teal-200">
                    ตารางสอนรายสัปดาห์ (Weekly Timetable)
                  </span>
                  <span className="text-xs text-slate-400">
                    ปีการศึกษา {activeYear?.name || '2569'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mt-0.5 flex items-center gap-2">
                  <span>คุณครู{selectedTeacherObj.fullName}</span>
                  <span className="text-xs font-normal text-slate-500 font-mono">
                    (@{selectedTeacherObj.username})
                  </span>
                </h3>
              </div>
            </div>

            {/* Teaching Stats summary */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200/80 text-xs text-slate-700">
                <span className="flex items-center gap-1.5 font-bold text-[#0C7C82]">
                  <Clock className="w-4 h-4 text-[#0C7C82]" />
                  <span>รวม <strong>{teacherTotalPeriods}</strong> คาบ/สัปดาห์</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 font-medium">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  <span>{teacherClassesCount} ชั้นเรียน</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1 font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  <span>{teacherSubjectsCount} รายวิชา</span>
                </span>
              </div>
            </div>
          </div>

          {/* Timetable Weekly Table Grid */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 text-[11px] font-bold text-slate-700 border-b border-slate-200">
                  <th className="py-3.5 px-3 w-28 border-r border-slate-200 bg-slate-100/90 text-slate-800 font-black">
                    วัน / คาบ
                  </th>
                  {sortedPeriods.map((p) => (
                    <th
                      key={p.id}
                      className={`py-3 px-2 border-r border-slate-200 min-w-[130px] ${
                        p.isLunchBreak ? 'bg-amber-50/80 text-amber-900 font-black' : ''
                      }`}
                    >
                      <div className="font-extrabold">{p.isLunchBreak ? '🍽️ พักกลางวัน' : p.name}</div>
                      <div className="text-[10px] font-mono font-normal text-slate-500 mt-0.5">
                        {p.startTime} - {p.endTime} น.
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {DAYS.map((day) => {
                  const dayConfig = DAY_CONFIG[day];
                  const dayAssignments = filteredAssignments.filter((a) => a.dayOfWeek === day);
                  const dayTotalPeriods = dayAssignments.reduce(
                    (acc, a) => acc + getAssignmentPeriodSpan(a),
                    0
                  );

                  const cells: React.ReactNode[] = [];
                  let skipCount = 0;

                  for (let i = 0; i < sortedPeriods.length; i++) {
                    if (skipCount > 0) {
                      skipCount--;
                      continue;
                    }

                    const period = sortedPeriods[i];

                    if (period.isLunchBreak) {
                      cells.push(
                        <td
                          key={period.id}
                          className="p-2 border-r border-slate-200 bg-amber-50/40 text-amber-900 text-[11px] font-semibold text-center align-middle"
                        >
                          <div className="py-3 px-1 text-slate-400 font-medium">
                            พักกลางวัน
                          </div>
                        </td>
                      );
                      continue;
                    }

                    // Check assignment starting at this period
                    const assignment = dayAssignments.find((a) => a.periodId === period.id);

                    if (assignment) {
                      let span = 1;
                      if (assignment.endPeriodId && assignment.endPeriodId !== assignment.periodId) {
                        const sIdx = sortedPeriods.findIndex((p) => p.id === assignment.periodId);
                        const eIdx = sortedPeriods.findIndex((p) => p.id === assignment.endPeriodId);
                        if (sIdx !== -1 && eIdx >= sIdx) {
                          span = eIdx - sIdx + 1;
                        }
                      } else {
                        const computedSpan = getAssignmentPeriodSpan(assignment);
                        if (computedSpan > 1) {
                          span = Math.min(computedSpan, sortedPeriods.length - i);
                        }
                      }
                      skipCount = span - 1;

                      const startP = sortedPeriods.find((p) => p.id === assignment.periodId) || period;
                      const endP = assignment.endPeriodId
                        ? sortedPeriods.find((p) => p.id === assignment.endPeriodId) || startP
                        : sortedPeriods[Math.min(sortedPeriods.length - 1, i + span - 1)] || startP;

                      cells.push(
                        <td
                          key={period.id}
                          colSpan={span}
                          className="p-1.5 border-r border-slate-200 align-top"
                        >
                          <div
                            className="group relative h-full min-h-[102px] rounded-2xl p-2.5 border transition-all hover:shadow-md cursor-pointer flex flex-col justify-between"
                            style={{
                              backgroundColor: `${assignment.color || '#0C7C82'}12`,
                              borderColor: `${assignment.color || '#0C7C82'}50`
                            }}
                            onClick={() => openEditModal(assignment)}
                            title="คลิกเพื่อแก้ไขการมอบหมายสอน"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <span
                                  className="px-2 py-0.5 rounded-md text-[11px] font-black shadow-2xs"
                                  style={{
                                    backgroundColor: assignment.color || '#0C7C82',
                                    color: '#ffffff'
                                  }}
                                >
                                  {assignment.className}
                                </span>

                                {span > 1 && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs font-mono">
                                    {span} คาบ
                                  </span>
                                )}
                              </div>

                              <div className="text-left mt-1">
                                <div className="font-extrabold text-xs text-slate-900 leading-snug">
                                  {assignment.subjectCode}
                                </div>
                                <div className="text-[11px] text-slate-700 font-medium line-clamp-2 leading-tight mt-0.5">
                                  {assignment.subjectName}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-1 mt-2 pt-1 border-t border-slate-200/60 text-[10px]">
                              <span className="font-mono text-slate-500 font-medium">
                                {startP.startTime} - {endP.endTime}
                              </span>

                              <div
                                className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity no-print"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => openEditModal(assignment)}
                                  className="p-1 rounded-md bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs cursor-pointer"
                                  title="แก้ไข"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(assignment)}
                                  className="p-1 rounded-md bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs cursor-pointer"
                                  title="ลบ"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    } else {
                      cells.push(
                        <td
                          key={period.id}
                          className="p-1.5 border-r border-slate-200 align-middle text-center group transition-colors hover:bg-teal-50/30 cursor-pointer"
                          onClick={() => openAddModal(filterTeacher, day, period.id)}
                          title={`คลิกเพื่อมอบหมายการสอน วัน${day} ${period.name} (${period.startTime}-${period.endTime})`}
                        >
                          <div className="h-full min-h-[102px] py-3 px-1 rounded-2xl border-2 border-dashed border-slate-200 group-hover:border-[#0C7C82] group-hover:bg-white flex flex-col items-center justify-center gap-1 transition-all">
                            <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-[#0C7C82] flex items-center justify-center transition-colors">
                              <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
                            </div>
                            <span className="text-[10px] text-slate-400 group-hover:text-[#0C7C82] font-semibold">
                              ว่าง
                            </span>
                          </div>
                        </td>
                      );
                    }
                  }

                  return (
                    <tr key={day} className="hover:bg-slate-50/30 transition-colors">
                      <td
                        className={`p-3 border-r border-slate-200 text-center align-middle font-bold ${dayConfig.bg}`}
                      >
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-black shadow-2xs ${dayConfig.badge}`}
                          >
                            {dayConfig.label}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">
                            {dayTotalPeriods} คาบ
                          </span>
                        </div>
                      </td>
                      {cells}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 pt-1 gap-2 no-print">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#0C7C82] shrink-0" />
              <span>คลิกที่กล่องรายวิชาเพื่อแก้ไข หรือคลิกที่ช่อง "ว่าง" เพื่อมอบหมายการสอนในคาบนั้นทันที</span>
            </span>
            <span className="font-mono text-slate-400 text-[11px]">
              มีทั้งหมด {teachingPeriods.length} คาบสอนต่อวัน (ไม่รวมพักกลางวัน)
            </span>
          </div>
        </div>
      )}

      {/* Tip Banner when "All Teachers" is selected */}
      {filterTeacher === 'all' && (
        <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200 text-teal-900 text-xs flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0C7C82] shrink-0" />
            <span>
              <strong>คำแนะนำ:</strong> เลือกครูผู้สอนจากตัวกรองด้านบน หรือคลิกที่ชื่อครูในตารางด้านล่าง เพื่อเปิดดูตารางสอนประจำสัปดาห์ (Timetable) เฉพาะบุคคล
            </span>
          </div>
          <span className="text-[11px] font-semibold text-teal-700 bg-white px-2 py-0.5 rounded-md border border-teal-200 shrink-0 hidden sm:inline">
            รองรับการพิมพ์ตารางสอน
          </span>
        </div>
      )}

      {/* Report Table by Teacher (แสดงรายงานเป็นตารางตามชื่อครูผู้สอน) */}
      {(viewMode !== 'timetable' || filterTeacher === 'all') && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden no-print">
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
                    <td className="py-4 px-6 font-bold text-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterTeacher(a.teacherUsername);
                          setCurrentPage(1);
                        }}
                        className="flex items-center gap-2 hover:text-[#0C7C82] transition-colors cursor-pointer text-left group"
                        title="คลิกเพื่อกรองและเปิดดูตารางสอนของครูท่านนี้"
                      >
                        <div className="w-7 h-7 rounded-full bg-teal-50 text-[#0C7C82] group-hover:bg-[#0C7C82] group-hover:text-white flex items-center justify-center text-xs transition-colors">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <span className="group-hover:underline">{a.teacherName}</span>
                      </button>
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
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
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
                          {teachingPeriods.map((p) => {
                            const occ = getPeriodAssignmentInClass(p.id);
                            const occNote = occ ? ` [⚠️ ซ้ำ: ${occ.subjectCode} (${occ.teacherName})]` : '';
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.startTime}-{p.endTime}){occNote}
                              </option>
                            );
                          })}
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
                            const occ = getPeriodAssignmentInClass(p.id);
                            let spanLabel = '';
                            if (isBeforeStart) {
                              spanLabel = ' (ก่อนคาบเริ่มต้น)';
                            } else if (exceedsRemaining) {
                              spanLabel = ` (เกินโควตาที่เหลือ ${remainingSubjectPeriods} คาบ)`;
                            } else if (occ) {
                              spanLabel = ` [⚠️ ซ้ำ: ${occ.subjectCode}]`;
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
                      {teachingPeriods.map((p) => {
                        const occ = getPeriodAssignmentInClass(p.id);
                        const occNote = occ ? ` [⚠️ ซ้ำ: ${occ.subjectCode} (${occ.teacherName})]` : '';
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.startTime}-{p.endTime}){occNote}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}

              {/* Classroom Period Duplication & Schedule Preview System */}
              <div className="space-y-2.5 pt-1">
                {/* Conflict Alert: Classroom duplicate period */}
                {classroomConflicts.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 text-xs space-y-2 shadow-xs animate-shake">
                    <div className="flex items-center gap-2 font-bold text-rose-700 text-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>พบข้อมูลคาบเรียนซ้ำซ้อนในชั้นเรียน!</span>
                    </div>
                    <p className="text-slate-700 text-xs leading-relaxed">
                      ห้อง <strong>{selectedClass?.name}</strong> ใน <strong>วัน{dayOfWeek}</strong> มีวิชาที่ลงตารางสอนในช่วงเวลานี้แล้ว:
                    </p>
                    <div className="space-y-1.5">
                      {classroomConflicts.map((c) => (
                        <div
                          key={c.id}
                          className="p-2.5 bg-white/95 rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 shadow-2xs"
                        >
                          <div>
                            <div className="font-bold text-rose-900 flex items-center gap-1.5">
                              <span className="font-mono bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[11px]">
                                {c.subjectCode}
                              </span>
                              <span>{c.subjectName}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              ผู้สอน: <span className="font-semibold text-slate-700">{c.teacherName}</span>
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-800 font-mono text-[11px] font-bold self-start sm:self-auto shrink-0">
                            {c.overlappingNames ? `ซ้ำ: ${c.overlappingNames}` : c.periodName}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-rose-700 font-semibold flex items-center gap-1 pt-0.5">
                      <span>⛔ ไม่สามารถบันทึกได้เนื่องจากเวลาเรียนชนกัน กรุณาเลือกคาบสอนอื่นหรือวันอื่น</span>
                    </p>
                  </div>
                )}

                {/* Conflict Alert: Teacher timetable conflict (in another classroom) */}
                {teacherConflicts.length > 0 && classroomConflicts.length === 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>คำเตือน: ครูผู้สอนติดตารางสอนห้องอื่นในช่วงเวลานี้</span>
                    </div>
                    <div className="space-y-1">
                      {teacherConflicts.map((tc) => (
                        <div key={tc.id} className="text-slate-700">
                          ครู <strong>{tc.teacherName}</strong> มีตารางสอนวิชา <strong>{tc.subjectCode} {tc.subjectName}</strong> ที่ห้อง <strong>{tc.className}</strong> ({tc.periodName})
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-amber-700 font-medium">
                      * กรุณาเปลี่ยนคาบสอนเพื่อป้องกันครูมีตารางสอนชนกัน
                    </p>
                  </div>
                )}

                {/* All-Clear Badge */}
                {classroomConflicts.length === 0 && teacherConflicts.length === 0 && periodId && (
                  <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>คาบเรียนว่าง ไม่ซ้ำซ้อน:</strong> ห้อง {selectedClass?.name || '-'} วัน{dayOfWeek} ช่วงเวลาที่เลือกสามารถลงตารางได้
                    </span>
                  </div>
                )}

                {/* Visual Day-Schedule Strip for Classroom */}
                <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                    <span>ตารางคาบสอนห้อง {selectedClass?.name} (วัน{dayOfWeek})</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {classroomDayAssignments.length > 0
                        ? `ลงตารางแล้ว ${classroomDayAssignments.length} วิชา`
                        : 'ยังไม่มีวิชาใดลงตารางในวันนี้'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-center">
                    {teachingPeriods.map((p, idx) => {
                      const isCurrent = idx >= selectedStartIdx && idx <= selectedEndIdx;
                      const existingAssigned = getPeriodAssignmentInClass(p.id);
                      const isConflict = isCurrent && existingAssigned;

                      let bgClass = 'bg-white border-slate-200 text-slate-600';
                      if (isConflict) {
                        bgClass = 'bg-rose-100 border-rose-400 text-rose-900 ring-2 ring-rose-400 font-bold';
                      } else if (isCurrent) {
                        bgClass = 'bg-teal-100 border-[#0C7C82] text-teal-900 ring-2 ring-[#0C7C82] font-bold';
                      } else if (existingAssigned) {
                        bgClass = 'bg-slate-200/90 border-slate-300 text-slate-700 font-medium';
                      }

                      return (
                        <div
                          key={p.id}
                          className={`p-1 rounded-xl border text-[10px] flex flex-col justify-between min-h-[50px] transition-all ${bgClass}`}
                          title={
                            existingAssigned
                              ? `${existingAssigned.subjectCode} ${existingAssigned.subjectName} (${existingAssigned.teacherName})`
                              : `${p.name} ว่าง`
                          }
                        >
                          <span className="font-bold truncate">{p.name.replace('คาบที่ ', 'คาบ ')}</span>
                          <span className="text-[9px] font-mono opacity-75">{p.startTime}</span>
                          {isConflict ? (
                            <span className="text-[9px] text-rose-700 font-bold">ซ้ำซ้อน!</span>
                          ) : isCurrent ? (
                            <span className="text-[9px] text-teal-800 font-bold">เลือก</span>
                          ) : existingAssigned ? (
                            <span className="text-[9px] text-slate-600 truncate font-semibold" title={existingAssigned.subjectCode}>
                              {existingAssigned.subjectCode}
                            </span>
                          ) : (
                            <span className="text-[9px] text-emerald-600 font-medium">ว่าง</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
                  disabled={isSaving || classroomConflicts.length > 0 || teacherConflicts.length > 0}
                  className="px-5 py-2 rounded-xl text-white text-xs font-medium bg-[#0C7C82] hover:bg-[#096368] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#0C7C82]/20 cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  {isSaving && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {classroomConflicts.length > 0 ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>คาบเรียนซ้ำซ้อน (ไม่สามารถบันทึก)</span>
                    </span>
                  ) : teacherConflicts.length > 0 ? (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>ครูติดสอนห้องอื่น (ไม่สามารถบันทึก)</span>
                    </span>
                  ) : (
                    <span>บันทึกข้อมูล</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
