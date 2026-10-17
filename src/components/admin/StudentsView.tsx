import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Edit2, Trash2, Download, Upload, FileSpreadsheet, Search, Filter, X } from 'lucide-react';
import { Student, Classroom, AcademicYear } from '../../types';
import { exportToExcel, parseExcelFile, downloadStudentTemplate } from '../../utils/excel';
import { Pagination } from '../common/Pagination';

interface StudentsViewProps {
  students: Student[];
  classes: Classroom[];
  activeYear?: AcademicYear;
  onAddStudent: (newStudent: Omit<Student, 'id'>) => Promise<void>;
  onUpdateStudent: (id: string, updated: Partial<Student>) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onDeleteAllStudentsByClass: (classId: string) => Promise<void>;
  onImportStudents: (newStudents: Omit<Student, 'id'>[]) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  classes,
  activeYear,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onDeleteAllStudentsByClass,
  onImportStudents,
  openConfirm,
  showToast
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(
    classes.length > 0 ? classes[0].id : ''
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination states (40 items per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 40;

  // Form fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('pass123');
  const [isSaving, setIsSaving] = useState(false);

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];

  // Students in selected class
  const classStudents = students.filter(
    (s) => s.classId === selectedClassId || (currentClass && s.className === currentClass.name)
  );

  const openAddModal = () => {
    if (!currentClass) {
      showToast('warning', 'กรุณาสร้างชั้นเรียนก่อนเพิ่มนักเรียน');
      return;
    }
    setEditingStudent(null);
    setName('');
    const nextSeq = classStudents.length + 1;
    const padSeq = String(nextSeq).padStart(2, '0');
    setUsername(`std_${currentClass.name.replace(/[^a-zA-Z0-9]/g, '')}_${padSeq}`.toLowerCase());
    setPassword('pass123');
    setIsModalOpen(true);
  };

  const openEditModal = (s: Student) => {
    setEditingStudent(s);
    setName(s.name);
    setUsername(s.username);
    setPassword(s.password);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim() || !currentClass) return;

    setIsSaving(true);
    try {
      if (editingStudent) {
        await onUpdateStudent(editingStudent.id, {
          name: name.trim(),
          username: username.trim(),
          password: password.trim()
        });
      } else {
        await onAddStudent({
          seq: classStudents.length + 1,
          name: name.trim(),
          className: currentClass.name,
          username: username.trim(),
          password: password.trim(),
          classId: currentClass.id,
          academicYearId: activeYear?.id || 'year_2569'
        });
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (s: Student) => {
    openConfirm(
      'ยืนยันการลบนักเรียน',
      `คุณต้องการลบข้อมูล "${s.name}" (ลำดับที่ ${s.seq}) ใช่หรือไม่?`,
      () => onDeleteStudent(s.id),
      'danger'
    );
  };

  const handleDeleteAllInClass = () => {
    if (!currentClass) return;
    openConfirm(
      `ยืนยันการลบนักเรียนทั้งหมดในห้อง ${currentClass.name}`,
      `คำเตือน: คุณต้องการลบนักเรียนทั้งหมดจำนวน ${classStudents.length} คนในห้อง "${currentClass.name}" ใช่หรือไม่?`,
      () => onDeleteAllStudentsByClass(currentClass.id),
      'danger'
    );
  };

  const handleExportExcel = () => {
    if (!currentClass) return;
    const exportData = classStudents.map((s, idx) => ({
      'ลำดับที่': idx + 1,
      'ชื่อนักเรียน': s.name,
      'ชั้นเรียน': s.className,
      'username': s.username,
      'password': s.password
    }));
    exportToExcel(exportData, `รายชื่อนักเรียน_${currentClass.name.replace('/', '-')}_ปี${activeYear?.name || '2569'}`, 'นักเรียน');
    showToast('success', 'ส่งออกข้อมูลนักเรียนสำเร็จ');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentClass) return;

    try {
      const parsedData = await parseExcelFile<any>(file);
      if (!parsedData || parsedData.length === 0) {
        showToast('warning', 'ไม่พบข้อมูลในไฟล์ที่เลือก');
        return;
      }

      const imported: Omit<Student, 'id'>[] = parsedData.map((row: any, i: number) => {
        const studentName = String(row['ชื่อนักเรียน'] || row['ชื่อ'] || '').trim();
        const seqVal = Number(row['ลำดับที่'] || classStudents.length + i + 1);
        const padSeq = String(seqVal).padStart(2, '0');
        const userVal = String(row['username'] || `std_${currentClass.name.replace(/[^a-zA-Z0-9]/g, '')}_${padSeq}`).trim();
        const passVal = String(row['password'] || 'pass123').trim();

        return {
          seq: seqVal,
          name: studentName,
          className: currentClass.name,
          username: userVal,
          password: passVal,
          classId: currentClass.id,
          academicYearId: activeYear?.id || 'year_2569'
        };
      }).filter((s) => s.name.length > 0);

      await onImportStudents(imported);
      showToast('success', `นำเข้านักเรียนสำเร็จจำนวน ${imported.length} คน`);
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาตรวจสอบรูปแบบไฟล์');
    } finally {
      e.target.value = '';
    }
  };

  const filteredStudents = classStudents.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClassId]);

  return (
    <div className="space-y-6">
      {/* Step 1: Select Class First as explicitly required by prompt */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider bg-teal-50 px-2.5 py-1 rounded-full inline-block mb-1">
              ขั้นตอนที่ 1 : เลือกชั้นเรียนก่อน
            </span>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-[#0C7C82]" />
              <span>จัดการรายชื่อนักเรียน (Student Roster)</span>
            </h2>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">ชั้นเรียน:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#0C7C82] bg-white cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({students.filter((s) => s.classId === c.id || s.className === c.name).length} คน)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              ห้อง {currentClass?.name || '-'}:
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
              {classStudents.length} คน
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => downloadStudentTemplate(currentClass?.name || 'ม.1-1')}
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

            {classStudents.length > 0 && (
              <button
                onClick={handleDeleteAllInClass}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>ลบทั้งหมดในห้องนี้</span>
              </button>
            )}

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มนักเรียน</span>
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
          placeholder={`ค้นหาชื่อนักเรียน หรือ Username ในห้อง ${currentClass?.name || ''}...`}
          className="w-full text-sm outline-hidden text-slate-800 placeholder-slate-400"
        />
      </div>

      {/* Students Table with specified columns: ลำดับที่ (สร้างอัตโนมัติ), ชื่อนักเรียน, ชั้นเรียน, username, password */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 px-6 text-center w-24">ลำดับที่</th>
                <th className="py-4 px-6">ชื่อนักเรียน</th>
                <th className="py-4 px-6 text-center">ชั้นเรียน</th>
                <th className="py-4 px-6">username</th>
                <th className="py-4 px-6">password</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    ยังไม่มีข้อมูลนักเรียนในชั้นเรียนนี้ คลิก "เพิ่มนักเรียน" หรือ "นำเข้า Excel"
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s, pageIdx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + pageIdx;
                  return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Auto-sequence column */}
                    <td className="py-4 px-6 text-center font-bold text-slate-500 text-xs">
                      {s.seq || globalIdx + 1}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800">{s.name}</td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white shadow-2xs"
                        style={{ backgroundColor: currentClass?.color || '#0C7C82' }}
                      >
                        {s.className}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-600 text-xs">{s.username}</td>
                    <td className="py-4 px-6 font-mono text-slate-400 text-xs">••••••••</td>
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
          totalItems={filteredStudents.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                {editingStudent ? 'แก้ไขข้อมูลนักเรียน' : `เพิ่มนักเรียนห้อง ${currentClass?.name}`}
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
                  ชื่อ-นามสกุล นักเรียน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น เด็กชายธนภัทร ใจดี"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Username นักเรียน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น std01"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="เช่น pass123"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm font-mono"
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
