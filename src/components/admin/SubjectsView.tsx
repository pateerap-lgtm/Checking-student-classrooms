import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  BookMarked,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
  Search,
  X,
  Check,
  Copy
} from 'lucide-react';
import { Subject, SubjectType, Classroom, AcademicYear, Curriculum, CurriculumSubject } from '../../types';
import { exportToExcel, parseExcelFile, downloadSubjectTemplate } from '../../utils/excel';
import { Pagination } from '../common/Pagination';

interface SubjectsViewProps {
  subjects: Subject[];
  classes: Classroom[];
  curriculums: Curriculum[];
  curriculumSubjects: CurriculumSubject[];
  activeYear?: AcademicYear;
  onAddSubject: (newSubject: Omit<Subject, 'id'>) => Promise<void>;
  onUpdateSubject: (id: string, updated: Partial<Subject>) => Promise<void>;
  onDeleteSubject: (id: string) => Promise<void>;
  onDeleteAllSubjects: () => Promise<void>;
  onImportSubjects: (newSubjects: Omit<Subject, 'id'>[]) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
}

export const SubjectsView: React.FC<SubjectsViewProps> = ({
  subjects,
  classes,
  curriculums,
  curriculumSubjects,
  activeYear,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
  onDeleteAllSubjects,
  onImportSubjects,
  openConfirm,
  showToast
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination states (40 items per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 40;

  // Form fields (single add/edit modal)
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<SubjectType>('พื้นฐาน');
  const [periodsPerWeek, setPeriodsPerWeek] = useState<number>(2);
  const [targetClassId, setTargetClassId] = useState<string>(classes[0]?.id || '');
  const [modalCurriculumId, setModalCurriculumId] = useState<string>('');
  const [modalCurrSubjectId, setModalCurrSubjectId] = useState<string>('');
  const [modalSelectAll, setModalSelectAll] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  // Copy Subjects Between Classes Modal states
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceClassId, setCopySourceClassId] = useState<string>('');
  const [copyTargetClassId, setCopyTargetClassId] = useState<string>('');
  const [copySelectedSubjectIds, setCopySelectedSubjectIds] = useState<string[]>([]);
  const [isSavingCopy, setIsSavingCopy] = useState(false);

  // Curriculum Batch Picker Modal states
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerClassId, setPickerClassId] = useState<string>(classes[0]?.id || '');
  const [pickerCurriculumId, setPickerCurriculumId] = useState<string>(curriculums[0]?.id || '');
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedCurrSubIds, setSelectedCurrSubIds] = useState<string[]>([]);
  const [pickerSubjectTypes, setPickerSubjectTypes] = useState<Record<string, SubjectType>>({});
  const [pickerDefaultType, setPickerDefaultType] = useState<SubjectType>('พื้นฐาน');
  const [isSavingPicker, setIsSavingPicker] = useState(false);

  const openAddModal = () => {
    setEditingSubject(null);
    setCode('');
    setName('');
    setType('พื้นฐาน');
    setPeriodsPerWeek(2);
    setTargetClassId(selectedClassId !== 'all' ? selectedClassId : classes[0]?.id || '');
    setModalCurriculumId(curriculums[0]?.id || '');
    setModalCurrSubjectId('');
    setModalSelectAll(false);
    setIsModalOpen(true);
  };

  const openEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setCode(sub.code);
    setName(sub.name);
    setType(sub.type);
    setPeriodsPerWeek(sub.periodsPerWeek);
    setTargetClassId(sub.classId);
    setModalCurriculumId(curriculums[0]?.id || '');
    setModalCurrSubjectId('');
    setModalSelectAll(false);
    setIsModalOpen(true);
  };

  // Single modal curriculum subject quick-fill
  const modalCurriculumSubjects = useMemo(() => {
    if (!modalCurriculumId) return [];
    return curriculumSubjects
      .filter((cs) => cs.curriculumId === modalCurriculumId)
      .sort((a, b) => a.code.localeCompare(b.code, 'th'));
  }, [curriculumSubjects, modalCurriculumId]);

  const existingCodesInModalTargetClass = useMemo(() => {
    const set = new Set<string>();
    subjects
      .filter((s) => s.classId === targetClassId)
      .forEach((s) => set.add(s.code.trim().toLowerCase()));
    return set;
  }, [subjects, targetClassId]);

  const modalNewCurriculumSubjects = useMemo(
    () =>
      modalCurriculumSubjects.filter(
        (cs) => !existingCodesInModalTargetClass.has(cs.code.trim().toLowerCase())
      ),
    [modalCurriculumSubjects, existingCodesInModalTargetClass]
  );

  const selectedModalCurrSubject = useMemo(
    () => curriculumSubjects.find((cs) => cs.id === modalCurrSubjectId) || null,
    [curriculumSubjects, modalCurrSubjectId]
  );

  const handleSelectSingleCurriculumSubject = (currSubId: string) => {
    setModalCurrSubjectId(currSubId);
    const found = curriculumSubjects.find((cs) => cs.id === currSubId);
    if (found) {
      setCode(found.code);
      setName(found.name);
      setPeriodsPerWeek(Number(found.periodsPerWeek) || 1);
    }
  };

  // Copy subjects between classes helpers
  const sourceClassSubjects = useMemo(() => {
    if (!copySourceClassId) return [];
    return subjects
      .filter((s) => s.classId === copySourceClassId)
      .sort((a, b) => a.code.localeCompare(b.code, 'th'));
  }, [subjects, copySourceClassId]);

  const existingCodesInCopyTargetClass = useMemo(() => {
    const set = new Set<string>();
    subjects
      .filter((s) => s.classId === copyTargetClassId)
      .forEach((s) => set.add(s.code.trim().toLowerCase()));
    return set;
  }, [subjects, copyTargetClassId]);

  const copyableSourceSubjects = useMemo(
    () =>
      sourceClassSubjects.filter(
        (s) => !existingCodesInCopyTargetClass.has(s.code.trim().toLowerCase())
      ),
    [sourceClassSubjects, existingCodesInCopyTargetClass]
  );

  const openCopyModal = () => {
    if (classes.length < 2) {
      showToast('warning', 'ต้องมีชั้นเรียนอย่างน้อย 2 ชั้นเรียนจึงจะคัดลอกรายวิชาได้');
      return;
    }
    const defaultTargetId = selectedClassId !== 'all' ? selectedClassId : classes[1]?.id || classes[0]?.id || '';
    const classWithSubjects = classes.find(
      (c) => c.id !== defaultTargetId && subjects.some((s) => s.classId === c.id)
    );
    const fallbackSource = classes.find((c) => c.id !== defaultTargetId) || classes[0];
    const initSourceId = classWithSubjects?.id || fallbackSource?.id || '';
    setCopyTargetClassId(defaultTargetId);
    setCopySourceClassId(initSourceId);
    setIsCopyModalOpen(true);
  };

  // Auto-select copyable subjects whenever source or target class changes in Copy modal
  useEffect(() => {
    if (!isCopyModalOpen) return;
    if (!copySourceClassId || copySourceClassId === copyTargetClassId) {
      setCopySelectedSubjectIds([]);
      return;
    }
    setCopySelectedSubjectIds(copyableSourceSubjects.map((s) => s.id));
  }, [isCopyModalOpen, copySourceClassId, copyTargetClassId, copyableSourceSubjects]);

  const handleToggleCopyItem = (id: string) => {
    setCopySelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllCopyItems = () => {
    const allIds = copyableSourceSubjects.map((s) => s.id);
    const allChecked = allIds.length > 0 && allIds.every((id) => copySelectedSubjectIds.includes(id));
    setCopySelectedSubjectIds(allChecked ? [] : allIds);
  };

  const handleSaveCopySubjects = async () => {
    const sourceClass = classes.find((c) => c.id === copySourceClassId);
    const targetClass = classes.find((c) => c.id === copyTargetClassId);
    if (!sourceClass || !targetClass) {
      showToast('warning', 'กรุณาเลือกชั้นเรียนต้นทางและปลายทาง');
      return;
    }
    if (sourceClass.id === targetClass.id) {
      showToast('warning', 'ชั้นเรียนต้นทางและปลายทางต้องไม่เป็นชั้นเรียนเดียวกัน');
      return;
    }
    if (copySelectedSubjectIds.length === 0) {
      showToast('warning', 'กรุณาเลือกรายวิชาที่ต้องการคัดลอกอย่างน้อย 1 วิชา');
      return;
    }

    const toCreate: Omit<Subject, 'id'>[] = copySelectedSubjectIds
      .map((id) => sourceClassSubjects.find((s) => s.id === id))
      .filter((s): s is Subject => Boolean(s))
      .filter((s) => !existingCodesInCopyTargetClass.has(s.code.trim().toLowerCase()))
      .map((s) => ({
        code: s.code.trim(),
        name: s.name.trim(),
        type: s.type,
        periodsPerWeek: Math.max(1, Number(s.periodsPerWeek) || 1),
        classId: targetClass.id,
        className: targetClass.name,
        academicYearId: activeYear?.id || 'year_2569'
      }));

    if (toCreate.length === 0) {
      showToast('warning', `รายวิชาที่เลือกมีอยู่ในชั้นเรียน ${targetClass.name} แล้ว`);
      return;
    }

    setIsSavingCopy(true);
    try {
      await onImportSubjects(toCreate);
      showToast(
        'success',
        `คัดลอกรายวิชาจากห้อง ${sourceClass.name} ไปยังห้อง ${targetClass.name} จำนวน ${toCreate.length} วิชาสำเร็จ`
      );
      setIsCopyModalOpen(false);
    } finally {
      setIsSavingCopy(false);
    }
  };

  // Batch curriculum picker helpers
  const existingCodesInPickerClass = useMemo(() => {
    const set = new Set<string>();
    subjects
      .filter((s) => s.classId === pickerClassId)
      .forEach((s) => set.add(s.code.trim().toLowerCase()));
    return set;
  }, [subjects, pickerClassId]);

  const pickerCurriculumSubjects = useMemo(() => {
    if (!pickerCurriculumId) return [];
    const q = pickerSearch.toLowerCase().trim();
    return curriculumSubjects
      .filter((cs) => cs.curriculumId === pickerCurriculumId)
      .filter((cs) => !q || cs.code.toLowerCase().includes(q) || cs.name.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code, 'th'));
  }, [curriculumSubjects, pickerCurriculumId, pickerSearch]);

  const selectablePickerSubjects = useMemo(
    () =>
      pickerCurriculumSubjects.filter(
        (cs) => !existingCodesInPickerClass.has(cs.code.trim().toLowerCase())
      ),
    [pickerCurriculumSubjects, existingCodesInPickerClass]
  );

  const openPickerModal = () => {
    if (classes.length === 0) {
      showToast('warning', 'กรุณาสร้างชั้นเรียนก่อนเลือกรายวิชา');
      return;
    }
    if (curriculums.length === 0) {
      showToast('warning', 'ยังไม่มีข้อมูลหลักสูตร กรุณาเพิ่มหลักสูตรและรายวิชาในเมนู "หลักสูตร" ก่อน');
      return;
    }
    const initClassId = selectedClassId !== 'all' ? selectedClassId : classes[0]?.id || '';
    const initCurrId = curriculums[0]?.id || '';
    setPickerClassId(initClassId);
    setPickerCurriculumId(initCurrId);
    setPickerSearch('');
    setSelectedCurrSubIds([]);
    setPickerSubjectTypes({});
    setPickerDefaultType('พื้นฐาน');
    setIsPickerOpen(true);
  };

  // Clear selection of items that already exist when switching class or curriculum in picker
  useEffect(() => {
    setSelectedCurrSubIds((prev) =>
      prev.filter((id) => {
        const cs = curriculumSubjects.find((item) => item.id === id);
        return (
          cs &&
          cs.curriculumId === pickerCurriculumId &&
          !existingCodesInPickerClass.has(cs.code.trim().toLowerCase())
        );
      })
    );
  }, [pickerClassId, pickerCurriculumId, curriculumSubjects, existingCodesInPickerClass]);

  const handleTogglePickerItem = (id: string) => {
    setSelectedCurrSubIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllPickerItems = () => {
    const allSelectableIds = selectablePickerSubjects.map((cs) => cs.id);
    const allSelected =
      allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedCurrSubIds.includes(id));

    if (allSelected) {
      setSelectedCurrSubIds((prev) => prev.filter((id) => !allSelectableIds.includes(id)));
    } else {
      setSelectedCurrSubIds((prev) => Array.from(new Set([...prev, ...allSelectableIds])));
    }
  };

  const handleApplyDefaultTypeToAll = (newType: SubjectType) => {
    setPickerDefaultType(newType);
    const updated: Record<string, SubjectType> = { ...pickerSubjectTypes };
    pickerCurriculumSubjects.forEach((cs) => {
      updated[cs.id] = newType;
    });
    setPickerSubjectTypes(updated);
  };

  const handleSaveFromCurriculum = async () => {
    const classObj = classes.find((c) => c.id === pickerClassId);
    if (!classObj) {
      showToast('warning', 'กรุณาเลือกชั้นเรียน');
      return;
    }
    if (selectedCurrSubIds.length === 0) {
      showToast('warning', 'กรุณาเลือกรายวิชาอย่างน้อย 1 วิชา');
      return;
    }

    const toCreate: Omit<Subject, 'id'>[] = selectedCurrSubIds
      .map((id) => curriculumSubjects.find((cs) => cs.id === id))
      .filter((cs): cs is CurriculumSubject => Boolean(cs))
      .filter((cs) => !existingCodesInPickerClass.has(cs.code.trim().toLowerCase()))
      .map((cs) => ({
        code: cs.code.trim(),
        name: cs.name.trim(),
        type: pickerSubjectTypes[cs.id] || pickerDefaultType,
        periodsPerWeek: Math.max(1, Number(cs.periodsPerWeek) || 1),
        classId: classObj.id,
        className: classObj.name,
        academicYearId: activeYear?.id || 'year_2569'
      }));

    if (toCreate.length === 0) {
      showToast('warning', 'รายวิชาที่เลือกมีอยู่ในชั้นเรียนนี้แล้ว');
      return;
    }

    setIsSavingPicker(true);
    try {
      await onImportSubjects(toCreate);
      showToast('success', `เพิ่มรายวิชาจากหลักสูตรให้ห้อง ${classObj.name} จำนวน ${toCreate.length} วิชาสำเร็จ`);
      setIsPickerOpen(false);
    } finally {
      setIsSavingPicker(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const classObj = classes.find((c) => c.id === targetClassId) || classes[0];
    if (!classObj) {
      showToast('warning', 'กรุณาสร้างชั้นเรียนก่อนเพิ่มวิชา');
      return;
    }

    if (editingSubject) {
      if (!code.trim() || !name.trim()) return;
      setIsSaving(true);
      try {
        await onUpdateSubject(editingSubject.id, {
          code: code.trim(),
          name: name.trim(),
          type,
          periodsPerWeek: Number(periodsPerWeek),
          classId: classObj.id,
          className: classObj.name
        });
        setIsModalOpen(false);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Add mode: select from curriculum (single subject or all subjects in selected curriculum)
    if (!modalCurriculumId) {
      showToast('warning', 'กรุณาเลือกหลักสูตรก่อน');
      return;
    }

    if (modalSelectAll) {
      if (modalCurriculumSubjects.length === 0) {
        showToast('warning', 'หลักสูตรที่เลือกยังไม่มีรายวิชา');
        return;
      }
      if (modalNewCurriculumSubjects.length === 0) {
        showToast('warning', `รายวิชาทั้งหมดในหลักสูตรนี้มีอยู่ในห้อง ${classObj.name} แล้ว`);
        return;
      }
      const toAdd: Omit<Subject, 'id'>[] = modalNewCurriculumSubjects.map((cs) => ({
        code: cs.code.trim(),
        name: cs.name.trim(),
        type: 'พื้นฐาน',
        periodsPerWeek: Math.max(1, Number(cs.periodsPerWeek) || 1),
        classId: classObj.id,
        className: classObj.name,
        academicYearId: activeYear?.id || 'year_2569'
      }));

      setIsSaving(true);
      try {
        await onImportSubjects(toAdd);
        showToast('success', `เพิ่มรายวิชาทั้งหมดจากหลักสูตรให้ห้อง ${classObj.name} จำนวน ${toAdd.length} วิชาสำเร็จ`);
        setIsModalOpen(false);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!selectedModalCurrSubject) {
      showToast('warning', 'กรุณาเลือกรายวิชาจากหลักสูตร หรือเลือก "เลือกรายวิชาทั้งหมดในหลักสูตรที่เลือก"');
      return;
    }

    if (existingCodesInModalTargetClass.has(selectedModalCurrSubject.code.trim().toLowerCase())) {
      showToast('warning', `รายวิชา ${selectedModalCurrSubject.code} ${selectedModalCurrSubject.name} มีอยู่ในห้อง ${classObj.name} แล้ว`);
      return;
    }

    setIsSaving(true);
    try {
      await onAddSubject({
        code: selectedModalCurrSubject.code.trim(),
        name: selectedModalCurrSubject.name.trim(),
        type: 'พื้นฐาน',
        periodsPerWeek: Math.max(1, Number(selectedModalCurrSubject.periodsPerWeek) || 1),
        classId: classObj.id,
        className: classObj.name,
        academicYearId: activeYear?.id || 'year_2569'
      });
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (s: Subject) => {
    openConfirm(
      'ยืนยันการลบรายวิชา',
      `คุณต้องการลบวิชา "${s.code} ${s.name}" (${s.className}) ใช่หรือไม่?`,
      () => onDeleteSubject(s.id),
      'danger'
    );
  };

  const handleDeleteAll = () => {
    openConfirm(
      'ยืนยันการลบรายวิชาทั้งหมด',
      'คำเตือน: คุณต้องการลบรายวิชาทั้งหมดของปีการศึกษานี้ใช่หรือไม่? ตารางสอนและการเช็คชื่อที่เชื่อมโยงจะได้รับผลกระทบ',
      () => onDeleteAllSubjects(),
      'danger'
    );
  };

  const handleExportExcel = () => {
    const exportData = subjects.map((s, idx) => ({
      'ลำดับ': idx + 1,
      'รหัสวิชา': s.code,
      'ชื่อวิชา': s.name,
      'ประเภทวิชา': s.type,
      'คาบสอนต่อสัปดาห์': s.periodsPerWeek,
      'ชั้นเรียน': s.className
    }));
    exportToExcel(exportData, `รายวิชา_ปี${activeYear?.name || '2569'}`, 'รายวิชา');
    showToast('success', 'ส่งออกข้อมูลรายวิชาสำเร็จ');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedData = await parseExcelFile<any>(file);
      if (!parsedData || parsedData.length === 0) {
        showToast('warning', 'ไม่พบข้อมูลในไฟล์ที่เลือก');
        return;
      }

      const defaultClass = classes[0];
      const imported: Omit<Subject, 'id'>[] = parsedData.map((row: any) => {
        const rawType = String(row['ประเภทวิชา(พื้นฐาน/เพิ่มเติม/พัฒนาผู้เรียน)'] || row['ประเภทวิชา'] || 'พื้นฐาน');
        let mappedType: SubjectType = 'พื้นฐาน';
        if (rawType.includes('เพิ่ม')) mappedType = 'เพิ่มเติม';
        else if (rawType.includes('พัฒนา') || rawType.includes('กิจกรรม')) mappedType = 'พัฒนาผู้เรียน';

        const rowClassName = String(row['ชั้นเรียน'] || '').trim();
        const matchedClass = classes.find((c) => c.name === rowClassName) || defaultClass;

        return {
          code: String(row['รหัสวิชา'] || '').trim(),
          name: String(row['ชื่อวิชา'] || '').trim(),
          type: mappedType,
          periodsPerWeek: Number(row['คาบสอนต่อสัปดาห์'] || row['คาบสอน'] || 2),
          classId: matchedClass?.id || 'c1',
          className: matchedClass?.name || 'ม.1/1',
          academicYearId: activeYear?.id || 'year_2569'
        };
      }).filter((s) => s.code.length > 0 && s.name.length > 0);

      await onImportSubjects(imported);
      showToast('success', `นำเข้ารายวิชาสำเร็จจำนวน ${imported.length} วิชา`);
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาตรวจสอบรูปแบบไฟล์');
    } finally {
      e.target.value = '';
    }
  };

  const filteredSubjects = subjects.filter((s) => {
    const matchesClass = selectedClassId === 'all' || s.classId === selectedClassId;
    const matchesSearch =
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.className.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSubjects.length / itemsPerPage));
  const paginatedSubjects = filteredSubjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClassId]);

  const getTypeBadge = (t: SubjectType) => {
    switch (t) {
      case 'พื้นฐาน':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">พื้นฐาน</span>;
      case 'เพิ่มเติม':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">เพิ่มเติม</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-lime-100 text-lime-800">พัฒนาผู้เรียน</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[#0C7C82]" />
              <span>จัดการรายวิชา (Curriculum Subjects)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              กำหนดรหัสวิชา ชื่อวิชา ประเภท (พื้นฐาน, เพิ่มเติม, พัฒนาผู้เรียน) และจำนวนคาบสอน
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">กรองตามชั้นเรียน:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white"
            >
              <option value="all">ทุกชั้นเรียน ({subjects.length})</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({subjects.filter((s) => s.classId === c.id).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">
            แสดงทั้งหมด {filteredSubjects.length} วิชา
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadSubjectTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Template Excel</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-teal-600" />
              <span>นำเข้า Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>ส่งออก Excel</span>
            </button>

            {subjects.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>ลบทั้งหมด</span>
              </button>
            )}

            <button
              onClick={openCopyModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-indigo-700 font-semibold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer text-xs transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>คัดลอกรายวิชาจากชั้นอื่น</span>
            </button>

            <button
              onClick={openPickerModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[#0C7C82] font-semibold bg-teal-50 hover:bg-teal-100 border border-teal-200 cursor-pointer text-xs transition-colors"
            >
              <BookMarked className="w-4 h-4" />
              <span>เลือกรายวิชาจากหลักสูตร</span>
            </button>

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรายวิชา</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหาตามรหัสวิชา หรือชื่อวิชา..."
          className="w-full text-sm outline-hidden text-slate-800 placeholder-slate-400"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 px-6 text-center w-16">ลำดับ</th>
                <th className="py-4 px-6">รหัสวิชา</th>
                <th className="py-4 px-6">ชื่อวิชา</th>
                <th className="py-4 px-6 text-center">ชั้นเรียน</th>
                <th className="py-4 px-6 text-center">ประเภทวิชา</th>
                <th className="py-4 px-6 text-center">คาบสอน/สัปดาห์</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    ไม่พบรายวิชาตามเงื่อนไขที่เลือก คลิก "เพิ่มรายวิชา" เพื่อเพิ่มข้อมูล
                  </td>
                </tr>
              ) : (
                paginatedSubjects.map((s, pageIdx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + pageIdx;
                  return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-center text-xs text-slate-400 font-bold">
                      {globalIdx + 1}
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-[#0C7C82]">{s.code}</td>
                    <td className="py-4 px-6 font-medium text-slate-800">{s.name}</td>
                    <td className="py-4 px-6 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {s.className}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">{getTypeBadge(s.type)}</td>
                    <td className="py-4 px-6 text-center font-bold text-slate-700">
                      {s.periodsPerWeek} คาบ
                    </td>
                    <td className="py-4 px-6 text-right space-x-1">
                      <button
                        onClick={() => openEditModal(s)}
                        className="p-2 rounded-xl text-slate-600 hover:text-[#0C7C82] hover:bg-teal-50 transition-colors cursor-pointer"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );})
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls (40 items per page) */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredSubjects.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal: Select Subjects From Curriculum for a Classroom */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <BookMarked className="w-5 h-5 text-[#0C7C82]" />
                  <span>เลือกรายวิชาจากหลักสูตรเข้าชั้นเรียน</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เลือกชั้นเรียนและหลักสูตร จากนั้นเลือกรายวิชาที่ต้องการเปิดสอนในชั้นเรียนนั้น
                </p>
              </div>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selection Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 shrink-0">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  1. เลือกชั้นเรียน <span className="text-red-500">*</span>
                </label>
                <select
                  value={pickerClassId}
                  onChange={(e) => setPickerClassId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm font-semibold bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (มีแล้ว {subjects.filter((s) => s.classId === c.id).length} วิชา)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  2. เลือกหลักสูตร <span className="text-red-500">*</span>
                </label>
                <select
                  value={pickerCurriculumId}
                  onChange={(e) => setPickerCurriculumId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm font-semibold bg-white"
                >
                  {curriculums.map((curr) => (
                    <option key={curr.id} value={curr.id}>
                      {curr.name} ({curriculumSubjects.filter((cs) => cs.curriculumId === curr.id).length} วิชา)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  ประเภทวิชาเริ่มต้น
                </label>
                <select
                  value={pickerDefaultType}
                  onChange={(e) => handleApplyDefaultTypeToAll(e.target.value as SubjectType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm bg-white"
                >
                  <option value="พื้นฐาน">รายวิชาพื้นฐาน</option>
                  <option value="เพิ่มเติม">รายวิชาเพิ่มเติม</option>
                  <option value="พัฒนาผู้เรียน">กิจกรรมพัฒนาผู้เรียน</option>
                </select>
              </div>
            </div>

            {/* Search & Select All Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="ค้นหารหัสวิชา หรือชื่อวิชาในหลักสูตร..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
                />
              </div>

              <button
                type="button"
                onClick={handleToggleAllPickerItems}
                disabled={selectablePickerSubjects.length === 0}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#0C7C82] bg-teal-50 hover:bg-teal-100 border border-teal-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {selectablePickerSubjects.length > 0 &&
                  selectablePickerSubjects.every((cs) => selectedCurrSubIds.includes(cs.id))
                    ? 'ยกเลิกเลือกทั้งหมด'
                    : `เลือกทั้งหมด (${selectablePickerSubjects.length})`}
                </span>
              </button>
            </div>

            {/* Curriculum Subjects List Table */}
            <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="py-3 px-4 text-center w-12">เลือก</th>
                    <th className="py-3 px-4">รหัสวิชา</th>
                    <th className="py-3 px-4">ชื่อวิชา</th>
                    <th className="py-3 px-4 text-center">คาบ/สัปดาห์</th>
                    <th className="py-3 px-4 text-center">ประเภทวิชา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {pickerCurriculumSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                        ไม่พบรายวิชาในหลักสูตรที่เลือก กรุณาเพิ่มรายวิชาในเมนู "หลักสูตร"
                      </td>
                    </tr>
                  ) : (
                    pickerCurriculumSubjects.map((cs) => {
                      const alreadyAdded = existingCodesInPickerClass.has(cs.code.trim().toLowerCase());
                      const isChecked = selectedCurrSubIds.includes(cs.id);
                      const rowType = pickerSubjectTypes[cs.id] || pickerDefaultType;
                      return (
                        <tr
                          key={cs.id}
                          onClick={() => {
                            if (!alreadyAdded) handleTogglePickerItem(cs.id);
                          }}
                          className={`transition-colors ${
                            alreadyAdded
                              ? 'bg-slate-50/70 opacity-60 cursor-not-allowed'
                              : isChecked
                              ? 'bg-teal-50/60 cursor-pointer'
                              : 'hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={alreadyAdded || isChecked}
                              disabled={alreadyAdded}
                              onChange={() => handleTogglePickerItem(cs.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded text-[#0C7C82] focus:ring-[#0C7C82] border-slate-300 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#0C7C82]">
                            {cs.code}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{cs.name}</span>
                              {alreadyAdded && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                  เพิ่มในห้องนี้แล้ว
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">
                            {cs.periodsPerWeek} คาบ
                          </td>
                          <td
                            className="py-3 px-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              value={rowType}
                              disabled={alreadyAdded}
                              onChange={(e) =>
                                setPickerSubjectTypes((prev) => ({
                                  ...prev,
                                  [cs.id]: e.target.value as SubjectType
                                }))
                              }
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white disabled:bg-slate-100"
                            >
                              <option value="พื้นฐาน">พื้นฐาน</option>
                              <option value="เพิ่มเติม">เพิ่มเติม</option>
                              <option value="พัฒนาผู้เรียน">พัฒนาผู้เรียน</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-600 font-medium">
                เลือกแล้ว <span className="font-bold text-[#0C7C82]">{selectedCurrSubIds.length}</span> วิชา
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveFromCurriculum}
                  disabled={isSavingPicker || selectedCurrSubIds.length === 0}
                  className="px-5 py-2 rounded-xl text-white text-xs font-semibold bg-[#0C7C82] hover:bg-[#096368] shadow-md shadow-[#0C7C82]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSavingPicker && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  <span>เพิ่มรายวิชาที่เลือก ({selectedCurrSubIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Copy Subjects Between Classes */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Copy className="w-5 h-5 text-indigo-600" />
                  <span>คัดลอกรายวิชาข้ามชั้นเรียน</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เลือกรายวิชาจากชั้นเรียนต้นทางเพื่อคัดลอกไปยังชั้นเรียนปลายทาง
                </p>
              </div>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 shrink-0">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  จากชั้นเรียน (ต้นทาง) <span className="text-red-500">*</span>
                </label>
                <select
                  value={copySourceClassId}
                  onChange={(e) => setCopySourceClassId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm font-semibold bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({subjects.filter((s) => s.classId === c.id).length} วิชา)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  ไปยังชั้นเรียน (ปลายทาง) <span className="text-red-500">*</span>
                </label>
                <select
                  value={copyTargetClassId}
                  onChange={(e) => setCopyTargetClassId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm font-semibold bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (มีอยู่ {subjects.filter((s) => s.classId === c.id).length} วิชา)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {copySourceClassId === copyTargetClassId ? (
              <div className="py-10 text-center rounded-2xl border border-dashed border-amber-200 bg-amber-50/70 text-xs text-amber-800 font-medium">
                กรุณาเลือกชั้นเรียนต้นทางและชั้นเรียนปลายทางให้แตกต่างกัน
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                  <div className="text-xs text-slate-600">
                    พบ <span className="font-bold text-slate-800">{sourceClassSubjects.length}</span> รายวิชาในห้องต้นทาง
                    {copyableSourceSubjects.length < sourceClassSubjects.length && (
                      <span className="text-emerald-700 ml-1">
                        (คัดลอกได้ {copyableSourceSubjects.length} วิชา)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAllCopyItems}
                    disabled={copyableSourceSubjects.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {copyableSourceSubjects.length > 0 &&
                      copyableSourceSubjects.every((s) => copySelectedSubjectIds.includes(s.id))
                        ? 'ยกเลิกเลือกทั้งหมด'
                        : `เลือกทั้งหมด (${copyableSourceSubjects.length})`}
                    </span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="py-3 px-4 text-center w-12">เลือก</th>
                        <th className="py-3 px-4">รหัสวิชา</th>
                        <th className="py-3 px-4">ชื่อวิชา</th>
                        <th className="py-3 px-4 text-center">ประเภท</th>
                        <th className="py-3 px-4 text-center">คาบ/สัปดาห์</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {sourceClassSubjects.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                            ชั้นเรียนต้นทางยังไม่มีรายวิชา
                          </td>
                        </tr>
                      ) : (
                        sourceClassSubjects.map((s) => {
                          const alreadyInTarget = existingCodesInCopyTargetClass.has(
                            s.code.trim().toLowerCase()
                          );
                          const isChecked = copySelectedSubjectIds.includes(s.id);
                          return (
                            <tr
                              key={s.id}
                              onClick={() => {
                                if (!alreadyInTarget) handleToggleCopyItem(s.id);
                              }}
                              className={`transition-colors ${
                                alreadyInTarget
                                  ? 'bg-slate-50/70 opacity-60 cursor-not-allowed'
                                  : isChecked
                                  ? 'bg-indigo-50/50 cursor-pointer'
                                  : 'hover:bg-slate-50 cursor-pointer'
                              }`}
                            >
                              <td className="py-3 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={alreadyInTarget || isChecked}
                                  disabled={alreadyInTarget}
                                  onChange={() => handleToggleCopyItem(s.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-[#0C7C82]">{s.code}</td>
                              <td className="py-3 px-4 font-medium text-slate-800">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{s.name}</span>
                                  {alreadyInTarget && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                      มีในห้องปลายทางแล้ว
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">{getTypeBadge(s.type)}</td>
                              <td className="py-3 px-4 text-center font-bold text-slate-700">
                                {s.periodsPerWeek} คาบ
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="pt-4 mt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-600 font-medium">
                เลือกคัดลอก <span className="font-bold text-indigo-700">{copySelectedSubjectIds.length}</span> วิชา
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveCopySubjects}
                  disabled={
                    isSavingCopy ||
                    copySelectedSubjectIds.length === 0 ||
                    copySourceClassId === copyTargetClassId
                  }
                  className="px-5 py-2 rounded-xl text-white text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSavingCopy && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  <span>คัดลอกรายวิชา ({copySelectedSubjectIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Single Add (Curriculum-only) / Edit Subject */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                {editingSubject ? 'แก้ไขรายวิชา' : 'เพิ่มรายวิชาใหม่'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  เลือกชั้นเรียน <span className="text-red-500">*</span>
                </label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
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

              {!editingSubject ? (
                /* Add Mode: Select from curriculum only (single subject or all subjects in selected curriculum) */
                curriculums.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    ยังไม่มีข้อมูลหลักสูตร กรุณาไปเพิ่มหลักสูตรและรายวิชาในเมนู <strong>"หลักสูตร"</strong> ก่อน
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0C7C82]">
                      <BookMarked className="w-4 h-4" />
                      <span>เลือกรายวิชาจากหลักสูตร (กรอกข้อมูลอัตโนมัติ)</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        เลือกหลักสูตร <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={modalCurriculumId}
                        onChange={(e) => {
                          setModalCurriculumId(e.target.value);
                          setModalCurrSubjectId('');
                        }}
                        required
                        className="w-full px-3 py-2.5 rounded-xl border border-teal-200 text-xs font-medium bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]"
                      >
                        <option value="">-- เลือกหลักสูตร --</option>
                        {curriculums.map((curr) => (
                          <option key={curr.id} value={curr.id}>
                            {curr.name} ({curriculumSubjects.filter((cs) => cs.curriculumId === curr.id).length} วิชา)
                          </option>
                        ))}
                      </select>
                    </div>

                    {modalCurriculumId && (
                      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-teal-200 cursor-pointer hover:bg-teal-50/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={modalSelectAll}
                          onChange={(e) => setModalSelectAll(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-[#0C7C82] focus:ring-[#0C7C82] border-slate-300 cursor-pointer"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-slate-800">
                            เลือกรายวิชาทั้งหมดในหลักสูตรที่เลือก
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            ทั้งหมด {modalCurriculumSubjects.length} วิชา (เพิ่มใหม่ได้ {modalNewCurriculumSubjects.length} วิชา)
                          </div>
                        </div>
                      </label>
                    )}

                    {!modalSelectAll && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          เลือกรายวิชา <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={modalCurrSubjectId}
                          onChange={(e) => handleSelectSingleCurriculumSubject(e.target.value)}
                          disabled={!modalCurriculumId || modalCurriculumSubjects.length === 0}
                          required={!modalSelectAll}
                          className="w-full px-3 py-2.5 rounded-xl border border-teal-200 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] disabled:bg-slate-100"
                        >
                          <option value="">
                            {modalCurriculumSubjects.length === 0
                              ? '-- ไม่มีรายวิชาในหลักสูตรนี้ --'
                              : '-- เลือกรายวิชาจากหลักสูตร --'}
                          </option>
                          {modalCurriculumSubjects.map((cs) => {
                            const exists = existingCodesInModalTargetClass.has(cs.code.trim().toLowerCase());
                            return (
                              <option key={cs.id} value={cs.id}>
                                {cs.code} - {cs.name} ({cs.periodsPerWeek} คาบ/สัปดาห์){exists ? ' [เพิ่มแล้ว]' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {/* Read-only preview of selected curriculum subject(s) */}
                    {modalSelectAll && modalCurriculumId && (
                      <div className="p-3 rounded-xl bg-white border border-teal-100 text-xs text-slate-700 space-y-1">
                        <div className="font-semibold text-[#0C7C82]">
                          สรุปรายการที่จะเพิ่มเข้าห้อง {classes.find((c) => c.id === targetClassId)?.name}:
                        </div>
                        {modalNewCurriculumSubjects.length === 0 ? (
                          <div className="text-amber-700">
                            รายวิชาทั้งหมดในหลักสูตรนี้ถูกเพิ่มในชั้นเรียนนี้แล้ว
                          </div>
                        ) : (
                          <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                            {modalNewCurriculumSubjects.map((cs) => (
                              <div key={cs.id} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-50 last:border-0">
                                <span className="truncate">
                                  <strong className="font-mono text-[#0C7C82]">{cs.code}</strong> {cs.name}
                                </span>
                                <span className="text-slate-500 shrink-0 ml-2">{cs.periodsPerWeek} คาบ</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!modalSelectAll && selectedModalCurrSubject && (
                      <div className="p-3 rounded-xl bg-white border border-teal-100 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">รหัสวิชา:</span>
                          <span className="font-mono font-bold text-[#0C7C82]">{selectedModalCurrSubject.code}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">ชื่อวิชา:</span>
                          <span className="font-semibold text-slate-800">{selectedModalCurrSubject.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">จำนวนคาบสอนต่อสัปดาห์:</span>
                          <span className="font-bold text-slate-800">{selectedModalCurrSubject.periodsPerWeek} คาบ/สัปดาห์</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* Edit Mode: keep editable fields for existing subject */
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      รหัสวิชา <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="เช่น ว21101"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      ชื่อวิชา <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="เช่น วิทยาศาสตร์ 1"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      ประเภทวิชา <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as SubjectType)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm bg-white"
                    >
                      <option value="พื้นฐาน">รายวิชาพื้นฐาน</option>
                      <option value="เพิ่มเติม">รายวิชาเพิ่มเติม</option>
                      <option value="พัฒนาผู้เรียน">กิจกรรมพัฒนาผู้เรียน</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      จำนวนคาบสอนต่อสัปดาห์ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={periodsPerWeek}
                      onChange={(e) => setPeriodsPerWeek(Number(e.target.value))}
                      min={1}
                      max={20}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm"
                    />
                  </div>
                </>
              )}

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
                  disabled={isSaving || (!editingSubject && curriculums.length === 0)}
                  className="px-5 py-2 rounded-xl text-white text-xs font-medium bg-[#0C7C82] hover:bg-[#096368] shadow-md shadow-[#0C7C82]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSaving && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  <span>
                    {!editingSubject && modalSelectAll
                      ? `บันทึกทั้งหมด (${modalNewCurriculumSubjects.length} วิชา)`
                      : 'บันทึกข้อมูล'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
