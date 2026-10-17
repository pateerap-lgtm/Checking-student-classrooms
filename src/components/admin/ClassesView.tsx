import React, { useState, useEffect } from 'react';
import { GraduationCap, Plus, Edit2, Trash2, Download, Upload, FileSpreadsheet, ArrowUp, ArrowDown, X, Search, CheckSquare } from 'lucide-react';
import { Classroom, AcademicYear } from '../../types';
import { exportToExcel, parseExcelFile, downloadClassTemplate } from '../../utils/excel';
import { Pagination } from '../common/Pagination';

interface ClassesViewProps {
  classes: Classroom[];
  activeYear?: AcademicYear;
  onAddClass: (newClass: Omit<Classroom, 'id'>) => Promise<void>;
  onUpdateClass: (id: string, updated: Partial<Classroom>) => Promise<void>;
  onDeleteClass: (id: string) => Promise<void>;
  onDeleteAllClasses: () => Promise<void>;
  onDeleteSelectedClasses?: (ids: string[]) => Promise<void>;
  onReorderClasses: (reordered: Classroom[]) => Promise<void>;
  onImportClasses: (newClasses: Omit<Classroom, 'id'>[]) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
}

const PRESET_COLORS = [
  '#0C7C82', '#35B4B0', '#26A69A', '#AED581',
  '#FFCA28', '#FF8A65', '#EF5350', '#4A2C6D',
  '#D32F2F', '#F57C00', '#FBC02D', '#0288D1'
];

export const ClassesView: React.FC<ClassesViewProps> = ({
  classes,
  activeYear,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onDeleteAllClasses,
  onDeleteSelectedClasses,
  onReorderClasses,
  onImportClasses,
  openConfirm,
  showToast
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Classroom | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0C7C82');
  const [order, setOrder] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);

  // Search & Batch Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination states (40 items per page as requested)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 40;

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / itemsPerPage));
  const paginatedClasses = filteredClasses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredClasses.length && filteredClasses.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredClasses.map((c) => c.id));
    }
  };

  const openAddModal = () => {
    setEditingClass(null);
    setName('');
    const randomColor = PRESET_COLORS[classes.length % PRESET_COLORS.length];
    setColor(randomColor);
    setOrder(classes.length + 1);
    setIsModalOpen(true);
  };

  const openEditModal = (c: Classroom) => {
    setEditingClass(c);
    setName(c.name);
    setColor(c.color || '#0C7C82');
    setOrder(c.order || 1);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      if (editingClass) {
        await onUpdateClass(editingClass.id, {
          name: name.trim(),
          color,
          order: Number(order)
        });
      } else {
        await onAddClass({
          name: name.trim(),
          color,
          order: Number(order),
          academicYearId: activeYear?.id || 'year_2569'
        });
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (c: Classroom) => {
    openConfirm(
      'ยืนยันการลบชั้นเรียน',
      `คุณต้องการลบชั้นเรียน "${c.name}" ใช่หรือไม่? ข้อมูลนักเรียนและรายวิชาที่อยู่ในห้องนี้อาจได้รับผลกระทบ`,
      async () => {
        await onDeleteClass(c.id);
        setSelectedIds((prev) => prev.filter((id) => id !== c.id));
      },
      'danger'
    );
  };

  const handleDeleteAll = () => {
    if (classes.length === 0) {
      showToast('warning', 'ไม่มีข้อมูลชั้นเรียนให้ลบ');
      return;
    }
    openConfirm(
      'ยืนยันการลบชั้นเรียนทั้งหมด',
      `คำเตือน: คุณต้องการลบชั้นเรียนทั้งหมดจำนวน ${classes.length} ห้องใช่หรือไม่? ข้อมูลชั้นเรียนทั้งหมดจะถูกลบออกจากระบบและไม่สามารถย้อนกลับได้`,
      async () => {
        await onDeleteAllClasses();
        setSelectedIds([]);
      },
      'danger'
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    openConfirm(
      'ยืนยันการลบชั้นเรียนที่เลือก',
      `คุณต้องการลบชั้นเรียนที่เลือกจำนวน ${selectedIds.length} ห้องใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      async () => {
        if (onDeleteSelectedClasses) {
          await onDeleteSelectedClasses(selectedIds);
        } else {
          for (const id of selectedIds) {
            await onDeleteClass(id);
          }
        }
        setSelectedIds([]);
      },
      'danger'
    );
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === classes.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...classes];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // re-assign sequential order
    const resequenced = updated.map((item, idx) => ({
      ...item,
      order: idx + 1
    }));

    await onReorderClasses(resequenced);
    showToast('success', 'ปรับเปลี่ยนลำดับชั้นเรียนเรียบร้อย');
  };

  const handleExportExcel = () => {
    const exportData = classes.map((c, idx) => ({
      'ลำดับที่': c.order || idx + 1,
      'ชื่อชั้นเรียน': c.name,
      'สีHEX': c.color
    }));
    exportToExcel(exportData, `รายชื่อชั้นเรียน_ปี${activeYear?.name || '2569'}`, 'ชั้นเรียน');
    showToast('success', 'ส่งออกข้อมูลชั้นเรียนสำเร็จ');
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

      const importedClasses: Omit<Classroom, 'id'>[] = parsedData.map((row: any, i: number) => {
        return {
          name: String(row['ชื่อชั้นเรียน'] || '').trim(),
          color: row['สีHEX'] || PRESET_COLORS[(classes.length + i) % PRESET_COLORS.length],
          order: classes.length + i + 1,
          academicYearId: activeYear?.id || 'year_2569'
        };
      }).filter((c) => c.name.length > 0);

      await onImportClasses(importedClasses);
      showToast('success', `นำเข้าชั้นเรียนสำเร็จจำนวน ${importedClasses.length} ห้อง`);
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาตรวจสอบรูปแบบไฟล์');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-[#0C7C82]" />
            <span>จัดการชั้นเรียน (Classrooms)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            เพิ่มห้องเรียน กำหนดสีประจำห้อง และจัดลำดับการแสดงผล (ปีการศึกษา {activeYear?.name || '2569'})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadClassTemplate}
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

          <button
            onClick={handleDeleteAll}
            disabled={classes.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
            title={classes.length === 0 ? 'ไม่มีข้อมูลชั้นเรียนให้ลบ' : `ลบชั้นเรียนทั้งหมด (${classes.length} ห้อง)`}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>ลบทั้งหมด {classes.length > 0 ? `(${classes.length})` : ''}</span>
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มชั้นเรียน</span>
          </button>
        </div>
      </div>

      {/* Search & Batch Selection Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อชั้นเรียน..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-xs bg-white shadow-xs"
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-red-50 border border-red-200 rounded-2xl animate-fade-in">
            <span className="text-xs font-semibold text-red-700 px-2.5">
              เลือก {selectedIds.length} จาก {classes.length} ห้อง
            </span>
            <button
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-700 cursor-pointer transition-colors shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ลบที่เลือก ({selectedIds.length})</span>
            </button>
            <button
              onClick={handleDeleteAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
            >
              ลบทั้งหมด
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-white cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 px-4 text-center w-12">
                  <input
                    type="checkbox"
                    checked={filteredClasses.length > 0 && selectedIds.length === filteredClasses.length}
                    onChange={handleToggleSelectAll}
                    disabled={filteredClasses.length === 0}
                    className="w-4 h-4 rounded text-[#0C7C82] focus:ring-[#0C7C82] border-slate-300 cursor-pointer"
                    title="เลือกทั้งหมด"
                  />
                </th>
                <th className="py-4 px-6 text-center w-24">ลำดับที่</th>
                <th className="py-4 px-6">ชื่อชั้นเรียน</th>
                <th className="py-4 px-6 text-center">สีประจำห้อง</th>
                <th className="py-4 px-6 text-center">ปรับลำดับ</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    {classes.length === 0
                      ? 'ยังไม่มีข้อมูลชั้นเรียน คลิก "เพิ่มชั้นเรียน" หรือ "นำเข้า Excel" เพื่อเริ่มต้น'
                      : `ไม่พบชั้นเรียนที่ตรงกับ "${searchTerm}"`}
                  </td>
                </tr>
              ) : (
                paginatedClasses.map((c, pageIdx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + pageIdx;
                  return (
                  <tr key={c.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(c.id) ? 'bg-teal-50/30' : ''}`}>
                    <td className="py-4 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => handleToggleSelect(c.id)}
                        className="w-4 h-4 rounded text-[#0C7C82] focus:ring-[#0C7C82] border-slate-300 cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-slate-500 text-xs">
                      {c.order || globalIdx + 1}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800 flex items-center gap-2.5">
                      <span
                        className="w-4 h-4 rounded-md shrink-0 shadow-2xs"
                        style={{ backgroundColor: c.color || '#0C7C82' }}
                      ></span>
                      <span className="text-base">{c.name}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100">
                        <span
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: c.color || '#0C7C82' }}
                        ></span>
                        <span className="text-xs font-mono text-slate-600">{c.color}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleMove(globalIdx, 'up')}
                          disabled={globalIdx === 0}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          title="เลื่อนขึ้น"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMove(globalIdx, 'down')}
                          disabled={globalIdx === classes.length - 1}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                          title="เลื่อนลง"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right space-x-1">
                      <button
                        onClick={() => openEditModal(c)}
                        className="p-2 rounded-xl text-slate-600 hover:text-[#0C7C82] hover:bg-teal-50 transition-colors cursor-pointer"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
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
          totalItems={filteredClasses.length}
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
                {editingClass ? 'แก้ไขชั้นเรียน' : 'เพิ่มชั้นเรียนใหม่'}
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
                  ชื่อชั้นเรียน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ม.1/1 หรือ ป.6/2"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  ลำดับการแสดงผล
                </label>
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  min={1}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm"
                />
              </div>

              {/* Color Picker */}
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
