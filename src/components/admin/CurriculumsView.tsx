import React, { useState, useEffect, useMemo } from 'react';
import {
  BookMarked,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  BookOpen,
  Clock,
  FileSpreadsheet,
  Upload,
  Download,
  Copy,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Curriculum, CurriculumSubject, AcademicYear } from '../../types';
import { Pagination } from '../common/Pagination';
import { exportToExcel, parseExcelFile, downloadCurriculumTemplate } from '../../utils/excel';

interface ImportCurriculumsPayload {
  newCurriculums?: { tempKey: string; name: string; academicYearId?: string }[];
  newSubjects?: {
    curriculumId?: string;
    tempKey?: string;
    code: string;
    name: string;
    periodsPerWeek: number;
    academicYearId?: string;
  }[];
}

interface CurriculumsViewProps {
  curriculums: Curriculum[];
  curriculumSubjects: CurriculumSubject[];
  allCurriculums?: Curriculum[];
  allCurriculumSubjects?: CurriculumSubject[];
  academicYears?: AcademicYear[];
  activeYear?: AcademicYear;
  onAddCurriculum: (newCurriculum: Omit<Curriculum, 'id'>) => Promise<string | void>;
  onUpdateCurriculum: (id: string, updated: Partial<Curriculum>) => Promise<void>;
  onDeleteCurriculum: (id: string) => Promise<void>;
  onDeleteAllCurriculums: () => Promise<void>;
  onAddCurriculumSubject: (newSubject: Omit<CurriculumSubject, 'id'>) => Promise<void>;
  onUpdateCurriculumSubject: (id: string, updated: Partial<CurriculumSubject>) => Promise<void>;
  onDeleteCurriculumSubject: (id: string) => Promise<void>;
  onDeleteAllSubjectsInCurriculum: (curriculumId: string) => Promise<void>;
  onImportCurriculumsBatch: (payload: ImportCurriculumsPayload) => Promise<string[]>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
}

export const CurriculumsView: React.FC<CurriculumsViewProps> = ({
  curriculums,
  curriculumSubjects,
  allCurriculums = [],
  allCurriculumSubjects = [],
  academicYears = [],
  activeYear,
  onAddCurriculum,
  onUpdateCurriculum,
  onDeleteCurriculum,
  onDeleteAllCurriculums,
  onAddCurriculumSubject,
  onUpdateCurriculumSubject,
  onDeleteCurriculumSubject,
  onDeleteAllSubjectsInCurriculum,
  onImportCurriculumsBatch,
  openConfirm,
  showToast
}) => {
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string>(
    curriculums.length > 0 ? curriculums[0].id : ''
  );
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination states (40 items per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 40;

  // Curriculum Modal states
  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [editingCurriculum, setEditingCurriculum] = useState<Curriculum | null>(null);
  const [curriculumName, setCurriculumName] = useState('');
  const [isSavingCurriculum, setIsSavingCurriculum] = useState(false);

  // Subject Modal states
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<CurriculumSubject | null>(null);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [periodsPerWeek, setPeriodsPerWeek] = useState<number>(2);
  const [isSavingSubject, setIsSavingSubject] = useState(false);

  // Copy Curriculum Modal states
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copyMode, setCopyMode] = useState<'intra' | 'cross'>('intra');
  const [copySourceCurrId, setCopySourceCurrId] = useState('');
  const [copyDestType, setCopyDestType] = useState<'new' | 'existing'>('new');
  const [copyNewCurrName, setCopyNewCurrName] = useState('');
  const [copyTargetCurrId, setCopyTargetCurrId] = useState('');
  const [copySelectedSubjectIds, setCopySelectedSubjectIds] = useState<string[]>([]);
  const [copySourceYearId, setCopySourceYearId] = useState('');
  const [copySelectedYearCurrIds, setCopySelectedYearCurrIds] = useState<string[]>([]);
  const [isSavingCopy, setIsSavingCopy] = useState(false);

  // Import state
  const [isImporting, setIsImporting] = useState(false);

  // Keep selectedCurriculumId valid when curriculums list changes
  useEffect(() => {
    if (curriculums.length === 0) {
      if (selectedCurriculumId !== '') setSelectedCurriculumId('');
    } else if (!curriculums.some((c) => c.id === selectedCurriculumId)) {
      setSelectedCurriculumId(curriculums[0].id);
    }
  }, [curriculums, selectedCurriculumId]);

  const currentCurriculum = useMemo(
    () => curriculums.find((c) => c.id === selectedCurriculumId) || curriculums[0] || null,
    [curriculums, selectedCurriculumId]
  );

  // Subjects belonging to the selected curriculum
  const subjectsInCurriculum = useMemo(() => {
    if (!currentCurriculum) return [];
    return curriculumSubjects
      .filter((s) => s.curriculumId === currentCurriculum.id)
      .sort((a, b) => a.code.localeCompare(b.code, 'th'));
  }, [curriculumSubjects, currentCurriculum]);

  const filteredSubjects = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return subjectsInCurriculum;
    return subjectsInCurriculum.filter(
      (s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [subjectsInCurriculum, searchTerm]);

  const totalPeriodsInCurriculum = useMemo(
    () => subjectsInCurriculum.reduce((sum, s) => sum + (Number(s.periodsPerWeek) || 0), 0),
    [subjectsInCurriculum]
  );

  const totalPages = Math.max(1, Math.ceil(filteredSubjects.length / itemsPerPage));
  const paginatedSubjects = filteredSubjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCurriculumId]);

  // Other academic years for cross-year copy
  const otherAcademicYears = useMemo(() => {
    const currentId = activeYear?.id || 'year_2569';
    return academicYears.filter((y) => y.id !== currentId);
  }, [academicYears, activeYear]);

  const sourceYearCurriculums = useMemo(() => {
    if (!copySourceYearId) return [];
    return allCurriculums.filter((c) => c.academicYearId === copySourceYearId);
  }, [allCurriculums, copySourceYearId]);

  // Intra-year copy helpers
  const sourceCurrSubjects = useMemo(() => {
    if (!copySourceCurrId) return [];
    return curriculumSubjects
      .filter((s) => s.curriculumId === copySourceCurrId)
      .sort((a, b) => a.code.localeCompare(b.code, 'th'));
  }, [curriculumSubjects, copySourceCurrId]);

  const existingCodesInTargetCurr = useMemo(() => {
    const set = new Set<string>();
    if (copyDestType === 'existing' && copyTargetCurrId) {
      curriculumSubjects
        .filter((s) => s.curriculumId === copyTargetCurrId)
        .forEach((s) => set.add(s.code.trim().toLowerCase()));
    }
    return set;
  }, [curriculumSubjects, copyDestType, copyTargetCurrId]);

  const copyableIntraSubjects = useMemo(
    () =>
      sourceCurrSubjects.filter(
        (s) => !existingCodesInTargetCurr.has(s.code.trim().toLowerCase())
      ),
    [sourceCurrSubjects, existingCodesInTargetCurr]
  );

  // Sync default copy curriculum name and selected subjects in Intra-year mode
  useEffect(() => {
    if (!isCopyModalOpen || copyMode !== 'intra') return;
    const src = curriculums.find((c) => c.id === copySourceCurrId);
    if (src) {
      setCopyNewCurrName(`${src.name} (สำเนา)`);
    }
  }, [isCopyModalOpen, copyMode, copySourceCurrId, curriculums]);

  useEffect(() => {
    if (!isCopyModalOpen || copyMode !== 'intra') return;
    if (copyDestType === 'existing' && copySourceCurrId === copyTargetCurrId) {
      setCopySelectedSubjectIds([]);
      return;
    }
    setCopySelectedSubjectIds(copyableIntraSubjects.map((s) => s.id));
  }, [isCopyModalOpen, copyMode, copyDestType, copySourceCurrId, copyTargetCurrId, copyableIntraSubjects]);

  // Sync selected curriculums when switching source year in Cross-year mode
  useEffect(() => {
    if (!isCopyModalOpen || copyMode !== 'cross') return;
    setCopySelectedYearCurrIds(sourceYearCurriculums.map((c) => c.id));
  }, [isCopyModalOpen, copyMode, copySourceYearId, sourceYearCurriculums]);

  // Curriculum Handlers
  const openAddCurriculumModal = () => {
    setEditingCurriculum(null);
    setCurriculumName('');
    setIsCurriculumModalOpen(true);
  };

  const openEditCurriculumModal = (c: Curriculum, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCurriculum(c);
    setCurriculumName(c.name);
    setIsCurriculumModalOpen(true);
  };

  const handleSubmitCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = curriculumName.trim();
    if (!trimmed) {
      showToast('warning', 'กรุณาระบุชื่อหลักสูตร');
      return;
    }

    setIsSavingCurriculum(true);
    try {
      if (editingCurriculum) {
        await onUpdateCurriculum(editingCurriculum.id, { name: trimmed });
      } else {
        const createdId = await onAddCurriculum({
          name: trimmed,
          academicYearId: activeYear?.id || 'year_2569',
          createdAt: new Date().toISOString()
        });
        if (createdId) {
          setSelectedCurriculumId(createdId);
        }
      }
      setIsCurriculumModalOpen(false);
    } finally {
      setIsSavingCurriculum(false);
    }
  };

  const handleDeleteCurriculum = (c: Curriculum, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const count = curriculumSubjects.filter((s) => s.curriculumId === c.id).length;
    openConfirm(
      'ยืนยันการลบหลักสูตร',
      count > 0
        ? `คุณต้องการลบหลักสูตร "${c.name}" และรายวิชาในหลักสูตรนี้ทั้งหมดจำนวน ${count} วิชาใช่หรือไม่?`
        : `คุณต้องการลบหลักสูตร "${c.name}" ใช่หรือไม่?`,
      () => onDeleteCurriculum(c.id),
      'danger'
    );
  };

  const handleDeleteAllCurriculumsClick = () => {
    if (curriculums.length === 0) return;
    openConfirm(
      'ยืนยันการลบหลักสูตรทั้งหมด',
      `คำเตือน: คุณต้องการลบหลักสูตรทั้งหมดจำนวน ${curriculums.length} หลักสูตร และรายวิชาในหลักสูตรทั้งหมด (${curriculumSubjects.length} รายวิชา) ของปีการศึกษา ${activeYear?.name || '2569'} ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      () => onDeleteAllCurriculums(),
      'danger'
    );
  };

  // Export Excel handler
  const handleExportExcel = () => {
    if (curriculums.length === 0) {
      showToast('warning', 'ยังไม่มีข้อมูลหลักสูตรสำหรับส่งออก');
      return;
    }

    const exportRows: Record<string, any>[] = [];
    let rowOrder = 1;

    curriculums.forEach((curr) => {
      const subList = curriculumSubjects
        .filter((s) => s.curriculumId === curr.id)
        .sort((a, b) => a.code.localeCompare(b.code, 'th'));

      if (subList.length === 0) {
        exportRows.push({
          'ลำดับ': rowOrder++,
          'ชื่อหลักสูตร': curr.name,
          'รหัสวิชา': '',
          'ชื่อวิชา': '',
          'คาบสอนต่อสัปดาห์': ''
        });
      } else {
        subList.forEach((sub) => {
          exportRows.push({
            'ลำดับ': rowOrder++,
            'ชื่อหลักสูตร': curr.name,
            'รหัสวิชา': sub.code,
            'ชื่อวิชา': sub.name,
            'คาบสอนต่อสัปดาห์': sub.periodsPerWeek
          });
        });
      }
    });

    exportToExcel(exportRows, `หลักสูตร_ปี${activeYear?.name || '2569'}`, 'หลักสูตร');
    showToast('success', 'ส่งออกข้อมูลหลักสูตรสำเร็จ');
  };

  // Import Excel handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const parsedData = await parseExcelFile<Record<string, any>>(file);
      if (!parsedData || parsedData.length === 0) {
        showToast('warning', 'ไม่พบข้อมูลในไฟล์ที่เลือก');
        return;
      }

      const targetYearId = activeYear?.id || 'year_2569';

      // Track existing curriculums by lowercase trimmed name
      const existingCurrByName = new Map<string, Curriculum>();
      curriculums.forEach((c) => {
        existingCurrByName.set(c.name.trim().toLowerCase(), c);
      });

      // Track existing subject codes per curriculum key (curriculumId or tempKey)
      const codesByTargetKey = new Map<string, Set<string>>();
      curriculums.forEach((c) => {
        const set = new Set<string>();
        curriculumSubjects
          .filter((s) => s.curriculumId === c.id)
          .forEach((s) => set.add(s.code.trim().toLowerCase()));
        codesByTargetKey.set(c.id, set);
      });

      const newCurriculumsMap = new Map<string, { tempKey: string; name: string; academicYearId: string }>();
      const newSubjects: ImportCurriculumsPayload['newSubjects'] = [];

      let skippedDuplicates = 0;

      parsedData.forEach((row) => {
        const rawCurrName = String(
          row['ชื่อหลักสูตร'] ?? row['หลักสูตร'] ?? row['curriculum'] ?? ''
        ).trim();
        const rawCode = String(row['รหัสวิชา'] ?? row['code'] ?? '').trim();
        const rawSubName = String(row['ชื่อวิชา'] ?? row['name'] ?? '').trim();
        const rawPeriods = Number(
          row['คาบสอนต่อสัปดาห์'] ?? row['คาบสอน'] ?? row['จำนวนคาบ'] ?? row['periodsPerWeek'] ?? 2
        );
        const validPeriods = Math.max(1, Math.floor(isNaN(rawPeriods) ? 2 : rawPeriods));

        let targetCurrId: string | undefined;
        let targetTempKey: string | undefined;

        if (rawCurrName) {
          const normCurr = rawCurrName.toLowerCase();
          const matchedExisting = existingCurrByName.get(normCurr);
          if (matchedExisting) {
            targetCurrId = matchedExisting.id;
          } else {
            let pending = newCurriculumsMap.get(normCurr);
            if (!pending) {
              pending = {
                tempKey: `temp_${newCurriculumsMap.size}`,
                name: rawCurrName,
                academicYearId: targetYearId
              };
              newCurriculumsMap.set(normCurr, pending);
              codesByTargetKey.set(pending.tempKey, new Set<string>());
            }
            targetTempKey = pending.tempKey;
          }
        } else if (currentCurriculum) {
          targetCurrId = currentCurriculum.id;
        }

        if ((!targetCurrId && !targetTempKey) || !rawCode || !rawSubName) {
          return;
        }

        const trackerKey = targetCurrId || targetTempKey!;
        let codeSet = codesByTargetKey.get(trackerKey);
        if (!codeSet) {
          codeSet = new Set<string>();
          codesByTargetKey.set(trackerKey, codeSet);
        }

        const normCode = rawCode.toLowerCase();
        if (codeSet.has(normCode)) {
          skippedDuplicates++;
          return;
        }
        codeSet.add(normCode);

        newSubjects.push({
          curriculumId: targetCurrId,
          tempKey: targetTempKey,
          code: rawCode,
          name: rawSubName,
          periodsPerWeek: validPeriods,
          academicYearId: targetYearId
        });
      });

      const newCurriculumsList = Array.from(newCurriculumsMap.values());
      if (newCurriculumsList.length === 0 && newSubjects.length === 0) {
        if (skippedDuplicates > 0) {
          showToast('warning', `รายวิชาในไฟล์ซ้ำกับที่มีอยู่แล้วทั้งหมด (${skippedDuplicates} รายการ)`);
        } else {
          showToast(
            'warning',
            'ไม่พบข้อมูลที่นำเข้าได้ กรุณาตรวจสอบหัวตาราง (ชื่อหลักสูตร, รหัสวิชา, ชื่อวิชา, คาบสอนต่อสัปดาห์)'
          );
        }
        return;
      }

      const createdIds = await onImportCurriculumsBatch({
        newCurriculums: newCurriculumsList,
        newSubjects
      });

      if (createdIds.length > 0 && !currentCurriculum) {
        setSelectedCurriculumId(createdIds[0]);
      }

      const summaryParts: string[] = [];
      if (newCurriculumsList.length > 0) {
        summaryParts.push(`หลักสูตรใหม่ ${newCurriculumsList.length} หลักสูตร`);
      }
      if (newSubjects.length > 0) {
        summaryParts.push(`รายวิชา ${newSubjects.length} วิชา`);
      }
      if (skippedDuplicates > 0) {
        summaryParts.push(`(ข้ามรายวิชาซ้ำ ${skippedDuplicates} วิชา)`);
      }
      showToast('success', `นำเข้า${summaryParts.join(' ')} สำเร็จ`);
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาตรวจสอบรูปแบบไฟล์');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  // Copy Curriculum Modal Handlers
  const openCopyModal = () => {
    const hasIntraCurriculums = curriculums.length > 0;
    const yearWithCurriculums = otherAcademicYears.find((y) =>
      allCurriculums.some((c) => c.academicYearId === y.id)
    );

    if (!hasIntraCurriculums && !yearWithCurriculums) {
      showToast('warning', 'ยังไม่มีหลักสูตรต้นทางสำหรับคัดลอก กรุณาเพิ่มหลักสูตรก่อน');
      return;
    }

    if (hasIntraCurriculums) {
      setCopyMode('intra');
      const initSrcId = currentCurriculum?.id || curriculums[0]?.id || '';
      setCopySourceCurrId(initSrcId);
      setCopyDestType('new');
      const otherCurr = curriculums.find((c) => c.id !== initSrcId);
      setCopyTargetCurrId(otherCurr?.id || '');
    } else if (yearWithCurriculums) {
      setCopyMode('cross');
    }

    if (yearWithCurriculums) {
      setCopySourceYearId(yearWithCurriculums.id);
    } else if (otherAcademicYears.length > 0) {
      setCopySourceYearId(otherAcademicYears[0].id);
    } else {
      setCopySourceYearId('');
    }

    setIsCopyModalOpen(true);
  };

  const handleToggleIntraSubject = (id: string) => {
    setCopySelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllIntraSubjects = () => {
    const allIds = copyableIntraSubjects.map((s) => s.id);
    const allChecked = allIds.length > 0 && allIds.every((id) => copySelectedSubjectIds.includes(id));
    setCopySelectedSubjectIds(allChecked ? [] : allIds);
  };

  const handleToggleYearCurr = (id: string) => {
    setCopySelectedYearCurrIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleAllYearCurrs = () => {
    const allIds = sourceYearCurriculums.map((c) => c.id);
    const allChecked = allIds.length > 0 && allIds.every((id) => copySelectedYearCurrIds.includes(id));
    setCopySelectedYearCurrIds(allChecked ? [] : allIds);
  };

  const handleSaveCopy = async () => {
    const targetYearId = activeYear?.id || 'year_2569';

    if (copyMode === 'intra') {
      const sourceCurr = curriculums.find((c) => c.id === copySourceCurrId);
      if (!sourceCurr) {
        showToast('warning', 'กรุณาเลือกหลักสูตรต้นทาง');
        return;
      }

      if (copyDestType === 'new') {
        const trimmedName = copyNewCurrName.trim();
        if (!trimmedName) {
          showToast('warning', 'กรุณาระบุชื่อหลักสูตรใหม่');
          return;
        }
        if (curriculums.some((c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
          showToast('warning', `มีชื่อหลักสูตร "${trimmedName}" อยู่ในปีการศึกษานี้แล้ว`);
          return;
        }

        const subjectsToCopy = sourceCurrSubjects.filter((s) => copySelectedSubjectIds.includes(s.id));
        setIsSavingCopy(true);
        try {
          const createdIds = await onImportCurriculumsBatch({
            newCurriculums: [{ tempKey: 'copy_new', name: trimmedName, academicYearId: targetYearId }],
            newSubjects: subjectsToCopy.map((s) => ({
              tempKey: 'copy_new',
              code: s.code,
              name: s.name,
              periodsPerWeek: Number(s.periodsPerWeek) || 1,
              academicYearId: targetYearId
            }))
          });
          if (createdIds[0]) setSelectedCurriculumId(createdIds[0]);
          showToast(
            'success',
            `คัดลอกสูตร "${trimmedName}" พร้อมรายวิชา ${subjectsToCopy.length} วิชาสำเร็จ`
          );
          setIsCopyModalOpen(false);
        } finally {
          setIsSavingCopy(false);
        }
      } else {
        const targetCurr = curriculums.find((c) => c.id === copyTargetCurrId);
        if (!targetCurr) {
          showToast('warning', 'กรุณาเลือกหลักสูตรปลายทาง');
          return;
        }
        if (targetCurr.id === sourceCurr.id) {
          showToast('warning', 'หลักสูตรต้นทางและปลายทางต้องไม่เป็นหลักสูตรเดียวกัน');
          return;
        }
        const subjectsToCopy = copyableIntraSubjects.filter((s) => copySelectedSubjectIds.includes(s.id));
        if (subjectsToCopy.length === 0) {
          showToast('warning', 'กรุณาเลือกรายวิชาที่ต้องการคัดลอกอย่างน้อย 1 วิชา');
          return;
        }

        setIsSavingCopy(true);
        try {
          await onImportCurriculumsBatch({
            newSubjects: subjectsToCopy.map((s) => ({
              curriculumId: targetCurr.id,
              code: s.code,
              name: s.name,
              periodsPerWeek: Number(s.periodsPerWeek) || 1,
              academicYearId: targetYearId
            }))
          });
          setSelectedCurriculumId(targetCurr.id);
          showToast(
            'success',
            `คัดลอกรายวิชาไปยังหลักสูตร "${targetCurr.name}" จำนวน ${subjectsToCopy.length} วิชาสำเร็จ`
          );
          setIsCopyModalOpen(false);
        } finally {
          setIsSavingCopy(false);
        }
      }
      return;
    }

    // Cross-year copy mode
    if (!copySourceYearId) {
      showToast('warning', 'กรุณาเลือกปีการศึกษาต้นทาง');
      return;
    }
    if (copySelectedYearCurrIds.length === 0) {
      showToast('warning', 'กรุณาเลือกหลักสูตรที่ต้องการคัดลอกอย่างน้อย 1 หลักสูตร');
      return;
    }

    const existingCurrByName = new Map<string, Curriculum>();
    curriculums.forEach((c) => existingCurrByName.set(c.name.trim().toLowerCase(), c));

    const newCurriculumsPayload: ImportCurriculumsPayload['newCurriculums'] = [];
    const newSubjectsPayload: ImportCurriculumsPayload['newSubjects'] = [];

    const selectedCurrs = sourceYearCurriculums.filter((c) => copySelectedYearCurrIds.includes(c.id));

    selectedCurrs.forEach((srcCurr, idx) => {
      const srcSubjects = allCurriculumSubjects.filter((s) => s.curriculumId === srcCurr.id);
      const matchedExisting = existingCurrByName.get(srcCurr.name.trim().toLowerCase());

      if (matchedExisting) {
        const existingCodes = new Set(
          curriculumSubjects
            .filter((s) => s.curriculumId === matchedExisting.id)
            .map((s) => s.code.trim().toLowerCase())
        );
        srcSubjects.forEach((s) => {
          if (!existingCodes.has(s.code.trim().toLowerCase())) {
            existingCodes.add(s.code.trim().toLowerCase());
            newSubjectsPayload.push({
              curriculumId: matchedExisting.id,
              code: s.code,
              name: s.name,
              periodsPerWeek: Number(s.periodsPerWeek) || 1,
              academicYearId: targetYearId
            });
          }
        });
      } else {
        const tempKey = `cross_${idx}`;
        newCurriculumsPayload.push({
          tempKey,
          name: srcCurr.name,
          academicYearId: targetYearId
        });
        srcSubjects.forEach((s) => {
          newSubjectsPayload.push({
            tempKey,
            code: s.code,
            name: s.name,
            periodsPerWeek: Number(s.periodsPerWeek) || 1,
            academicYearId: targetYearId
          });
        });
      }
    });

    if (newCurriculumsPayload.length === 0 && newSubjectsPayload.length === 0) {
      showToast('warning', 'หลักสูตรและรายวิชาที่เลือกมีอยู่ในปีการศึกษาปัจจุบันครบแล้ว');
      return;
    }

    setIsSavingCopy(true);
    try {
      const createdIds = await onImportCurriculumsBatch({
        newCurriculums: newCurriculumsPayload,
        newSubjects: newSubjectsPayload
      });
      if (createdIds[0]) setSelectedCurriculumId(createdIds[0]);
      showToast(
        'success',
        `คัดลอกหลักสูตรใหม่ ${newCurriculumsPayload.length} หลักสูตร และรายวิชา ${newSubjectsPayload.length} วิชาสำเร็จ`
      );
      setIsCopyModalOpen(false);
    } finally {
      setIsSavingCopy(false);
    }
  };

  // Curriculum Subject Handlers
  const openAddSubjectModal = () => {
    if (!currentCurriculum) {
      showToast('warning', 'กรุณาเพิ่มและเลือกหลักสูตรก่อนเพิ่มรายวิชา');
      return;
    }
    setEditingSubject(null);
    setSubjectCode('');
    setSubjectName('');
    setPeriodsPerWeek(2);
    setIsSubjectModalOpen(true);
  };

  const openEditSubjectModal = (sub: CurriculumSubject) => {
    setEditingSubject(sub);
    setSubjectCode(sub.code);
    setSubjectName(sub.name);
    setPeriodsPerWeek(Number(sub.periodsPerWeek) || 1);
    setIsSubjectModalOpen(true);
  };

  const handleSubmitSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCurriculum) return;

    const trimmedCode = subjectCode.trim();
    const trimmedName = subjectName.trim();
    const validPeriods = Math.max(1, Math.floor(Number(periodsPerWeek) || 1));

    if (!trimmedCode || !trimmedName) {
      showToast('warning', 'กรุณากรอกรหัสวิชาและชื่อวิชาให้ครบถ้วน');
      return;
    }

    setIsSavingSubject(true);
    try {
      if (editingSubject) {
        await onUpdateCurriculumSubject(editingSubject.id, {
          code: trimmedCode,
          name: trimmedName,
          periodsPerWeek: validPeriods
        });
      } else {
        await onAddCurriculumSubject({
          curriculumId: currentCurriculum.id,
          code: trimmedCode,
          name: trimmedName,
          periodsPerWeek: validPeriods,
          academicYearId: activeYear?.id || 'year_2569'
        });
      }
      setIsSubjectModalOpen(false);
    } finally {
      setIsSavingSubject(false);
    }
  };

  const handleDeleteSubject = (sub: CurriculumSubject) => {
    openConfirm(
      'ยืนยันการลบรายวิชา',
      `คุณต้องการลบรายวิชา "${sub.code} ${sub.name}" ออกจากหลักสูตร "${currentCurriculum?.name || ''}" ใช่หรือไม่?`,
      () => onDeleteCurriculumSubject(sub.id),
      'danger'
    );
  };

  const handleDeleteAllSubjectsInSelected = () => {
    if (!currentCurriculum || subjectsInCurriculum.length === 0) return;
    openConfirm(
      'ยืนยันการลบรายวิชาทั้งหมดในหลักสูตร',
      `คุณต้องการลบรายวิชาทั้งหมดในหลักสูตร "${currentCurriculum.name}" จำนวน ${subjectsInCurriculum.length} วิชาใช่หรือไม่?`,
      () => onDeleteAllSubjectsInCurriculum(currentCurriculum.id),
      'danger'
    );
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Manage Curriculums */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider bg-teal-50 px-2.5 py-1 rounded-full inline-block mb-1">
              ขั้นตอนที่ 1 : จัดการและเลือกหลักสูตร
            </span>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BookMarked className="w-6 h-6 text-[#0C7C82]" />
              <span>จัดการหลักสูตร (Curriculums)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              เพิ่ม แก้ไข หรือลบชื่อหลักสูตร และคลิกเลือกหลักสูตรเพื่อจัดการรายวิชา (ปีการศึกษา {activeYear?.name || '2569'})
            </p>
          </div>
        </div>

        {/* Action Buttons Bar: Template, Import, Export, Copy Curriculum, Delete All, Add Curriculum */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">
            ทั้งหมด {curriculums.length} หลักสูตร • {curriculumSubjects.length} รายวิชา
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadCurriculumTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Template Excel</span>
            </button>

            <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors ${isImporting ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4 text-teal-600" />
              <span>{isImporting ? 'กำลังนำเข้า...' : 'นำเข้า Excel'}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={isImporting}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={curriculums.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 disabled:opacity-50 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>ส่งออก Excel</span>
            </button>

            <button
              type="button"
              onClick={openCopyModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-indigo-700 font-semibold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer text-xs transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>คัดลอกสูตร</span>
            </button>

            {curriculums.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllCurriculumsClick}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>ลบทั้งหมด</span>
              </button>
            )}

            <button
              type="button"
              onClick={openAddCurriculumModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มหลักสูตร</span>
            </button>
          </div>
        </div>

        {/* Curriculum List Cards */}
        {curriculums.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
            <BookMarked className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">ยังไม่มีข้อมูลหลักสูตร</p>
            <p className="text-xs text-slate-400 mt-1">
              คลิกปุ่ม "เพิ่มหลักสูตร", "นำเข้า Excel" หรือ "คัดลอกสูตร" เพื่อเริ่มต้น
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {curriculums.map((c) => {
              const isSelected = currentCurriculum?.id === c.id;
              const subjectCount = curriculumSubjects.filter((s) => s.curriculumId === c.id).length;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCurriculumId(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCurriculumId(c.id);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-teal-50/70 border-[#0C7C82] ring-2 ring-[#0C7C82]/20 shadow-xs'
                      : 'bg-slate-50/60 border-slate-200 hover:border-teal-300 hover:bg-white'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isSelected ? 'bg-[#0C7C82]' : 'bg-slate-300'
                        }`}
                      />
                      <h3
                        className={`font-bold text-sm truncate ${
                          isSelected ? 'text-[#0C7C82]' : 'text-slate-800'
                        }`}
                        title={c.name}
                      >
                        {c.name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 pl-4.5">
                      {subjectCount} รายวิชา
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => openEditCurriculumModal(c, e)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[#0C7C82] hover:bg-white transition-colors cursor-pointer"
                      title="แก้ไขชื่อหลักสูตร"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCurriculum(c, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white transition-colors cursor-pointer"
                      title="ลบหลักสูตร"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Subjects in Selected Curriculum */}
      {currentCurriculum && (
        <div className="space-y-4">
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider bg-teal-50 px-2.5 py-1 rounded-full inline-block mb-1">
                ขั้นตอนที่ 2 : รายวิชาตามหลักสูตรที่เลือก
              </span>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0C7C82]" />
                <span>รายวิชาในหลักสูตร: {currentCurriculum.name}</span>
              </h3>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                  จำนวน {subjectsInCurriculum.length} รายวิชา
                </span>
                <span className="text-slate-300">|</span>
                <span className="inline-flex items-center gap-1 font-medium text-teal-700">
                  <Clock className="w-3.5 h-3.5" />
                  รวม {totalPeriodsInCurriculum} คาบ/สัปดาห์
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {subjectsInCurriculum.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAllSubjectsInSelected}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>ลบรายวิชาทั้งหมดในหลักสูตรนี้</span>
                </button>
              )}
              <button
                type="button"
                onClick={openAddSubjectModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มรายวิชาในหลักสูตร</span>
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`ค้นหารหัสวิชา หรือชื่อวิชาในหลักสูตร "${currentCurriculum.name}"...`}
              className="w-full text-sm outline-hidden text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Curriculum Subjects Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-4 px-6 text-center w-20">ลำดับ</th>
                    <th className="py-4 px-6">รหัสวิชา</th>
                    <th className="py-4 px-6">ชื่อวิชา</th>
                    <th className="py-4 px-6 text-center">จำนวนคาบสอนต่อสัปดาห์</th>
                    <th className="py-4 px-6 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                        {subjectsInCurriculum.length === 0
                          ? `ยังไม่มีรายวิชาในหลักสูตร "${currentCurriculum.name}" คลิก "เพิ่มรายวิชาในหลักสูตร" เพื่อเริ่มต้น`
                          : `ไม่พบรายวิชาที่ตรงกับ "${searchTerm}"`}
                      </td>
                    </tr>
                  ) : (
                    paginatedSubjects.map((sub, pageIdx) => {
                      const globalIdx = (currentPage - 1) * itemsPerPage + pageIdx;
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 text-center text-xs font-bold text-slate-400">
                            {globalIdx + 1}
                          </td>
                          <td className="py-4 px-6 font-mono font-bold text-[#0C7C82]">
                            {sub.code}
                          </td>
                          <td className="py-4 px-6 font-medium text-slate-800">
                            {sub.name}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-[#0C7C82]">
                              {sub.periodsPerWeek} คาบ/สัปดาห์
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right space-x-1">
                            <button
                              onClick={() => openEditSubjectModal(sub)}
                              className="p-2 rounded-xl text-slate-600 hover:text-[#0C7C82] hover:bg-teal-50 transition-colors cursor-pointer"
                              title="แก้ไขรายวิชา"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubject(sub)}
                              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="ลบรายวิชา"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredSubjects.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

      {/* Copy Curriculum Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">คัดลอกสูตร (หลักสูตรและรายวิชา)</h3>
                  <p className="text-xs text-slate-500">
                    คัดลอกโครงสร้างหลักสูตรและรายวิชาเพื่อประหยัดเวลาในการจัดทำหลักสูตรใหม่
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="px-6 pt-4 flex gap-2 border-b border-slate-100 pb-4 bg-white">
              <button
                type="button"
                onClick={() => setCopyMode('intra')}
                disabled={curriculums.length === 0}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  copyMode === 'intra'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 disabled:opacity-40'
                }`}
              >
                คัดลอกในปีการศึกษา {activeYear?.name || '2569'}
              </button>
              <button
                type="button"
                onClick={() => setCopyMode('cross')}
                disabled={otherAcademicYears.length === 0}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  copyMode === 'cross'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 disabled:opacity-40'
                }`}
              >
                คัดลอกสูตรจากปีการศึกษาอื่น ({otherAcademicYears.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {copyMode === 'intra' ? (
                <>
                  {/* Source Curriculum */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      1. เลือกหลักสูตรต้นทาง
                    </label>
                    <select
                      value={copySourceCurrId}
                      onChange={(e) => setCopySourceCurrId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      {curriculums.map((c) => {
                        const cnt = curriculumSubjects.filter((s) => s.curriculumId === c.id).length;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name} ({cnt} รายวิชา)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Destination Type */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700">
                      2. กำหนดหลักสูตรปลายทาง
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setCopyDestType('new')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          copyDestType === 'new'
                            ? 'border-indigo-500 bg-indigo-50/70 text-indigo-800'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">สร้างเป็นหลักสูตรใหม่</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          สร้างหลักสูตรใหม่พร้อมรายวิชาที่เลือก
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCopyDestType('existing');
                          if (!copyTargetCurrId || copyTargetCurrId === copySourceCurrId) {
                            const alt = curriculums.find((c) => c.id !== copySourceCurrId);
                            setCopyTargetCurrId(alt?.id || '');
                          }
                        }}
                        disabled={curriculums.length < 2}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-40 ${
                          copyDestType === 'existing'
                            ? 'border-indigo-500 bg-indigo-50/70 text-indigo-800'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">คัดลอกลงหลักสูตรที่มีอยู่</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          เพิ่มรายวิชาเข้าหลักสูตรเดิม (ข้ามรหัสซ้ำ)
                        </div>
                      </button>
                    </div>

                    {copyDestType === 'new' ? (
                      <input
                        type="text"
                        value={copyNewCurrName}
                        onChange={(e) => setCopyNewCurrName(e.target.value)}
                        placeholder="ระบุชื่อหลักสูตรใหม่ เช่น หลักสูตรแกนกลาง ป.2"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <select
                        value={copyTargetCurrId}
                        onChange={(e) => setCopyTargetCurrId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- เลือกหลักสูตรปลายทาง --</option>
                        {curriculums
                          .filter((c) => c.id !== copySourceCurrId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({curriculumSubjects.filter((s) => s.curriculumId === c.id).length} รายวิชา)
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  {/* Selectable Subjects */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        3. เลือกรายวิชาที่จะคัดลอก ({copyableIntraSubjects.length} รายการ)
                      </span>
                      {copyableIntraSubjects.length > 0 && (
                        <button
                          type="button"
                          onClick={handleToggleAllIntraSubjects}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          {copyableIntraSubjects.every((s) => copySelectedSubjectIds.includes(s.id))
                            ? 'ยกเลิกเลือกทั้งหมด'
                            : 'เลือกทั้งหมด'}
                        </button>
                      )}
                    </div>

                    {sourceCurrSubjects.length === 0 ? (
                      <div className="p-4 text-center rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                        หลักสูตรต้นทางยังไม่มีรายวิชา (สามารถสร้างหลักสูตรใหม่เปล่าๆ ได้)
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
                        {sourceCurrSubjects.map((s) => {
                          const isDup = existingCodesInTargetCurr.has(s.code.trim().toLowerCase());
                          const isChecked = copySelectedSubjectIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center justify-between px-4 py-2.5 text-xs ${
                                isDup ? 'bg-slate-50 text-slate-400' : 'hover:bg-indigo-50/40 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  disabled={isDup}
                                  checked={isChecked}
                                  onChange={() => handleToggleIntraSubject(s.id)}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                />
                                <span className="font-mono font-bold text-[#0C7C82] shrink-0">
                                  {s.code}
                                </span>
                                <span className="font-medium text-slate-800 truncate">{s.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {isDup && (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                                    มีแล้ว
                                  </span>
                                )}
                                <span className="text-slate-500">{s.periodsPerWeek} คาบ</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Cross-Year Copy Mode */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      1. เลือกปีการศึกษาต้นทาง
                    </label>
                    <select
                      value={copySourceYearId}
                      onChange={(e) => setCopySourceYearId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      {otherAcademicYears.map((y) => {
                        const cnt = allCurriculums.filter((c) => c.academicYearId === y.id).length;
                        return (
                          <option key={y.id} value={y.id}>
                            ปีการศึกษา {y.name} ({cnt} หลักสูตร)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 px-3.5 py-2.5 rounded-xl border border-indigo-100">
                    <ArrowRight className="w-4 h-4 shrink-0" />
                    <span>
                      คัดลอกมายังปีการศึกษาปัจจุบัน: <strong>{activeYear?.name || '2569'}</strong> (หากมีชื่อหลักสูตรเดียวกันอยู่แล้ว ระบบจะเพิ่มเฉพาะรายวิชาที่ยังไม่ซ้ำ)
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        2. เลือกหลักสูตรที่ต้องการคัดลอก ({sourceYearCurriculums.length} หลักสูตร)
                      </span>
                      {sourceYearCurriculums.length > 0 && (
                        <button
                          type="button"
                          onClick={handleToggleAllYearCurrs}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          {sourceYearCurriculums.every((c) => copySelectedYearCurrIds.includes(c.id))
                            ? 'ยกเลิกเลือกทั้งหมด'
                            : 'เลือกทั้งหมด'}
                        </button>
                      )}
                    </div>

                    {sourceYearCurriculums.length === 0 ? (
                      <div className="p-6 text-center rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                        ไม่พบข้อมูลหลักสูตรในปีการศึกษาที่เลือก
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
                        {sourceYearCurriculums.map((curr) => {
                          const subCount = allCurriculumSubjects.filter(
                            (s) => s.curriculumId === curr.id
                          ).length;
                          const alreadyExists = curriculums.some(
                            (ec) => ec.name.trim().toLowerCase() === curr.name.trim().toLowerCase()
                          );
                          return (
                            <label
                              key={curr.id}
                              className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50/40 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={copySelectedYearCurrIds.includes(curr.id)}
                                  onChange={() => handleToggleYearCurr(curr.id)}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                />
                                <span className="font-bold text-slate-800 truncate">{curr.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {alreadyExists && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                                    มีชื่อนี้แล้ว (ผสานรายวิชา)
                                  </span>
                                )}
                                <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0C7C82] font-bold">
                                  {subCount} รายวิชา
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {copyMode === 'intra'
                  ? `เลือกคัดลอก ${copySelectedSubjectIds.length} รายวิชา`
                  : `เลือกคัดลอก ${copySelectedYearCurrIds.length} หลักสูตร`}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-white cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveCopy}
                  disabled={isSavingCopy}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-xs font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingCopy ? (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>ยืนยันคัดลอกสูตร</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Curriculum Add/Edit Modal */}
      {isCurriculumModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                {editingCurriculum ? 'แก้ไขชื่อหลักสูตร' : 'เพิ่มหลักสูตรใหม่'}
              </h3>
              <button
                onClick={() => setIsCurriculumModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCurriculum} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  ชื่อหลักสูตร <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={curriculumName}
                  onChange={(e) => setCurriculumName(e.target.value)}
                  placeholder="เช่น หลักสูตรแกนกลาง ป.1-ป.6"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCurriculumModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingCurriculum}
                  className="px-5 py-2 rounded-xl text-white text-xs font-medium bg-[#0C7C82] hover:bg-[#096368] shadow-md shadow-[#0C7C82]/20 cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingCurriculum && (
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

      {/* Curriculum Subject Add/Edit Modal */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {editingSubject ? 'แก้ไขรายวิชาในหลักสูตร' : 'เพิ่มรายวิชาในหลักสูตร'}
                </h3>
                {currentCurriculum && (
                  <p className="text-xs text-[#0C7C82] font-semibold mt-0.5">
                    หลักสูตร: {currentCurriculum.name}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsSubjectModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  รหัสวิชา <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
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
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="เช่น วิทยาศาสตร์ 1"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm"
                />
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
                  max={40}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm font-semibold"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingSubject}
                  className="px-5 py-2 rounded-xl text-white text-xs font-medium bg-[#0C7C82] hover:bg-[#096368] shadow-md shadow-[#0C7C82]/20 cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingSubject && (
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
