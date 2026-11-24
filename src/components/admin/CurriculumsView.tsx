import React, { useState, useEffect, useMemo } from 'react';
import { BookMarked, Plus, Edit2, Trash2, Search, X, BookOpen, Clock } from 'lucide-react';
import { Curriculum, CurriculumSubject, AcademicYear } from '../../types';
import { Pagination } from '../common/Pagination';

interface CurriculumsViewProps {
  curriculums: Curriculum[];
  curriculumSubjects: CurriculumSubject[];
  activeYear?: AcademicYear;
  onAddCurriculum: (newCurriculum: Omit<Curriculum, 'id'>) => Promise<string | void>;
  onUpdateCurriculum: (id: string, updated: Partial<Curriculum>) => Promise<void>;
  onDeleteCurriculum: (id: string) => Promise<void>;
  onAddCurriculumSubject: (newSubject: Omit<CurriculumSubject, 'id'>) => Promise<void>;
  onUpdateCurriculumSubject: (id: string, updated: Partial<CurriculumSubject>) => Promise<void>;
  onDeleteCurriculumSubject: (id: string) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
}

export const CurriculumsView: React.FC<CurriculumsViewProps> = ({
  curriculums,
  curriculumSubjects,
  activeYear,
  onAddCurriculum,
  onUpdateCurriculum,
  onDeleteCurriculum,
  onAddCurriculumSubject,
  onUpdateCurriculumSubject,
  onDeleteCurriculumSubject,
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

  return (
    <div className="space-y-6">
      {/* Section 1: Manage Curriculums */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

          <button
            onClick={openAddCurriculumModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มหลักสูตร</span>
          </button>
        </div>

        {/* Curriculum List Cards */}
        {curriculums.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
            <BookMarked className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">ยังไม่มีข้อมูลหลักสูตร</p>
            <p className="text-xs text-slate-400 mt-1">คลิกปุ่ม "เพิ่มหลักสูตร" เพื่อสร้างหลักสูตรแรก</p>
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

            <button
              onClick={openAddSubjectModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรายวิชาในหลักสูตร</span>
            </button>
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
