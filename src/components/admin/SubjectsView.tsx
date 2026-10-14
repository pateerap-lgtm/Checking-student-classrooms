import React, { useState } from 'react';
import { BookOpen, Plus, Edit2, Trash2, Download, Upload, FileSpreadsheet, Search, Tag, X } from 'lucide-react';
import { Subject, SubjectType, Classroom, AcademicYear } from '../../types';
import { exportToExcel, parseExcelFile, downloadSubjectTemplate } from '../../utils/excel';

interface SubjectsViewProps {
  subjects: Subject[];
  classes: Classroom[];
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

  // Form fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<SubjectType>('พื้นฐาน');
  const [periodsPerWeek, setPeriodsPerWeek] = useState<number>(2);
  const [targetClassId, setTargetClassId] = useState<string>(classes[0]?.id || '');
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingSubject(null);
    setCode('');
    setName('');
    setType('พื้นฐาน');
    setPeriodsPerWeek(2);
    setTargetClassId(selectedClassId !== 'all' ? selectedClassId : classes[0]?.id || '');
    setIsModalOpen(true);
  };

  const openEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setCode(sub.code);
    setName(sub.name);
    setType(sub.type);
    setPeriodsPerWeek(sub.periodsPerWeek);
    setTargetClassId(sub.classId);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    const classObj = classes.find((c) => c.id === targetClassId) || classes[0];
    if (!classObj) {
      showToast('warning', 'กรุณาสร้างชั้นเรียนก่อนเพิ่มวิชา');
      return;
    }

    setIsSaving(true);
    try {
      if (editingSubject) {
        await onUpdateSubject(editingSubject.id, {
          code: code.trim(),
          name: name.trim(),
          type,
          periodsPerWeek: Number(periodsPerWeek),
          classId: classObj.id,
          className: classObj.name
        });
      } else {
        await onAddSubject({
          code: code.trim(),
          name: name.trim(),
          type,
          periodsPerWeek: Number(periodsPerWeek),
          classId: classObj.id,
          className: classObj.name,
          academicYearId: activeYear?.id || 'year_2569'
        });
      }
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
                filteredSubjects.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-center text-xs text-slate-400 font-bold">
                      {idx + 1}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
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
