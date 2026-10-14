import React, { useState, useEffect } from 'react';
import { Clock, Plus, Edit2, Trash2, Download, Upload, FileSpreadsheet, Utensils, X } from 'lucide-react';
import { Period, AcademicYear } from '../../types';
import { exportToExcel, parseExcelFile, downloadPeriodTemplate } from '../../utils/excel';

interface PeriodsViewProps {
  periods: Period[];
  activeYear?: AcademicYear;
  onAddPeriod: (period: Omit<Period, 'id'>) => Promise<void>;
  onUpdatePeriod: (id: string, period: Partial<Period>) => Promise<void>;
  onDeletePeriod: (id: string) => Promise<void>;
  onDeleteAllPeriods: () => Promise<void>;
  onImportPeriods: (newPeriods: Omit<Period, 'id'>[]) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
}

export const PeriodsView: React.FC<PeriodsViewProps> = ({
  periods,
  activeYear,
  onAddPeriod,
  onUpdatePeriod,
  onDeletePeriod,
  onDeleteAllPeriods,
  onImportPeriods,
  openConfirm,
  showToast
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('09:20');
  const [isLunchBreak, setIsLunchBreak] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-normalize any existing periods in the database where isLunchBreak is true but name is still "คาบที่..."
  useEffect(() => {
    periods.forEach((p) => {
      if (p.isLunchBreak && p.name !== 'พักกลางวัน') {
        onUpdatePeriod(p.id, { name: 'พักกลางวัน' });
      } else if (!p.isLunchBreak && (p.name === 'พักกลางวัน' || p.name === 'พักเที่ยง')) {
        onUpdatePeriod(p.id, { name: 'พักกลางวัน', isLunchBreak: true });
      }
    });
  }, [periods, onUpdatePeriod]);

  const openAddModal = () => {
    setEditingPeriod(null);
    const teachingCount = periods.filter((p) => !p.isLunchBreak).length;
    setName(`คาบที่ ${teachingCount + 1}`);
    setStartTime('08:30');
    setEndTime('09:20');
    setIsLunchBreak(false);
    setIsModalOpen(true);
  };

  const openEditModal = (period: Period) => {
    setEditingPeriod(period);
    setName(period.isLunchBreak ? 'พักกลางวัน' : period.name);
    setStartTime(period.startTime);
    setEndTime(period.endTime);
    setIsLunchBreak(period.isLunchBreak);
    setIsModalOpen(true);
  };

  const handleLunchBreakChange = (checked: boolean) => {
    setIsLunchBreak(checked);
    if (checked) {
      setName('พักกลางวัน');
    } else {
      if (name === 'พักกลางวัน' || !name.trim()) {
        const teachingCount = periods.filter(
          (p) => !p.isLunchBreak && (!editingPeriod || p.id !== editingPeriod.id)
        ).length;
        setName(`คาบที่ ${editingPeriod ? editingPeriod.order : teachingCount + 1}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = isLunchBreak ? 'พักกลางวัน' : name.trim();
    if (!finalName) return;

    setIsSaving(true);
    try {
      if (editingPeriod) {
        await onUpdatePeriod(editingPeriod.id, {
          name: finalName,
          startTime,
          endTime,
          isLunchBreak
        });
      } else {
        await onAddPeriod({
          name: finalName,
          startTime,
          endTime,
          isLunchBreak,
          order: periods.length + 1,
          academicYearId: activeYear?.id || 'year_2569'
        });
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (p: Period) => {
    openConfirm(
      'ยืนยันการลบคาบสอน',
      `คุณต้องการลบ "${p.isLunchBreak ? 'พักกลางวัน' : p.name}" (${p.startTime} - ${p.endTime}) ใช่หรือไม่?`,
      () => onDeletePeriod(p.id),
      'danger'
    );
  };

  const handleDeleteAll = () => {
    openConfirm(
      'ยืนยันการลบคาบสอนทั้งหมด',
      'คำเตือน: คุณต้องการลบคาบสอนทั้งหมดของปีการศึกษานี้ใช่หรือไม่? ข้อมูลตารางสอนที่ผูกไว้จะได้รับผลกระทบ',
      () => onDeleteAllPeriods(),
      'danger'
    );
  };

  const handleExportExcel = () => {
    const exportData = periods.map((p, idx) => ({
      'ลำดับ': idx + 1,
      'ชื่อคาบ': p.isLunchBreak ? 'พักกลางวัน' : p.name,
      'เวลาเริ่มต้น': p.startTime,
      'เวลาสิ้นสุด': p.endTime,
      'ประเภท': p.isLunchBreak ? 'พักกลางวัน (ไม่นับเป็นคาบสอน)' : 'คาบเรียนปกติ',
      'พักเที่ยง(ใช่/ไม่ใช่)': p.isLunchBreak ? 'ใช่' : 'ไม่ใช่'
    }));
    exportToExcel(exportData, `รายการคาบสอน_ปี${activeYear?.name || '2569'}`, 'คาบสอน');
    showToast('success', 'ส่งออกข้อมูลคาบสอนเป็นไฟล์ Excel เรียบร้อยแล้ว');
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

      const importedPeriods: Omit<Period, 'id'>[] = parsedData.map((row: any, i: number) => {
        const isLunch = row['พักเที่ยง(ใช่/ไม่ใช่)'] === 'ใช่' || 
                        row['ประเภท']?.includes('พัก') || 
                        String(row['ชื่อคาบ'] || '').includes('พัก');
        const defaultName = isLunch ? 'พักกลางวัน' : `คาบที่ ${periods.length + i + 1}`;
        const finalName = isLunch ? 'พักกลางวัน' : (row['ชื่อคาบ'] || defaultName);
        return {
          name: finalName,
          startTime: row['เวลาเริ่มต้น'] || '08:30',
          endTime: row['เวลาสิ้นสุด'] || '09:20',
          isLunchBreak: !!isLunch,
          order: periods.length + i + 1,
          academicYearId: activeYear?.id || 'year_2569'
        };
      });

      await onImportPeriods(importedPeriods);
      showToast('success', `นำเข้าคาบสอนสำเร็จจำนวน ${importedPeriods.length} รายการ`);
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาตรวจสอบรูปแบบไฟล์');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#0C7C82]" />
            <span>จัดการคาบสอนและชั่วโมงสอน</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            กำหนดตารางเวลาคาบเรียนและเวลาพักกลางวัน (ปีการศึกษา {activeYear?.name || '2569'})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Template */}
          <button
            onClick={downloadPeriodTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Template Excel</span>
          </button>

          {/* Import Excel */}
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

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>ส่งออก Excel</span>
          </button>

          {/* Delete All */}
          {periods.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>ลบทั้งหมด</span>
            </button>
          )}

          {/* Add Period */}
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มคาบสอน</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 px-6 text-center w-16">ลำดับ</th>
                <th className="py-4 px-6">ชื่อคาบสอน</th>
                <th className="py-4 px-6">เวลาเริ่มต้น</th>
                <th className="py-4 px-6">เวลาสิ้นสุด</th>
                <th className="py-4 px-6 text-center">ประเภท</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    ยังไม่มีข้อมูลคาบสอน คลิก "เพิ่มคาบสอน" หรือ "นำเข้า Excel" เพื่อเริ่มต้น
                  </td>
                </tr>
              ) : (
                periods.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-center font-bold text-slate-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800 flex items-center gap-2">
                      {p.isLunchBreak ? (
                        <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                          <Utensils className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="p-1.5 rounded-lg bg-teal-50 text-[#0C7C82]">
                          <Clock className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span>{p.isLunchBreak ? 'พักกลางวัน' : p.name}</span>
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-600 text-xs">{p.startTime}</td>
                    <td className="py-4 px-6 font-mono text-slate-600 text-xs">{p.endTime}</td>
                    <td className="py-4 px-6 text-center">
                      {p.isLunchBreak ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <Utensils className="w-3 h-3" /> พักกลางวัน (ไม่นับเป็นคาบ)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800">
                          คาบเรียนปกติ
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right space-x-1">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-2 rounded-xl text-slate-600 hover:text-[#0C7C82] hover:bg-teal-50 transition-colors cursor-pointer"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
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
                {editingPeriod ? 'แก้ไขคาบสอน' : 'เพิ่มคาบสอน'}
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
                  ชื่อคาบสอน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={isLunchBreak ? 'พักกลางวัน' : name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLunchBreak}
                  placeholder="เช่น คาบที่ 1 หรือ พักกลางวัน"
                  required
                  className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm ${
                    isLunchBreak
                      ? 'bg-amber-50/70 text-amber-900 font-semibold cursor-not-allowed border-amber-200'
                      : 'focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82]'
                  }`}
                />
                {isLunchBreak && (
                  <p className="text-[11px] text-amber-700 mt-1 font-medium">
                    * พักกลางวันจะไม่แสดงเป็นคาบที่ โดยจะแสดงชื่อเป็น "พักกลางวัน"
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    เวลาเริ่มต้น <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    เวลาสิ้นสุด <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Lunch Break Toggle */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLunchBreak}
                    onChange={(e) => handleLunchBreakChange(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded-sm focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-amber-900 block">
                      เวลาพักกลางวัน (ไม่นับเป็นคาบสอน)
                    </span>
                    <span className="text-[11px] text-amber-700">
                      ช่วงเวลานี้จะไม่แสดงให้เลือกสำหรับจัดรายวิชาสอน และแสดงชื่อเป็น "พักกลางวัน"
                    </span>
                  </div>
                </label>
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
