import React, { useState } from 'react';
import { Calendar, Plus, Edit2, Trash2, CheckCircle2, Star, X } from 'lucide-react';
import { AcademicYear } from '../../types';
import { formatToThaiBE } from '../../utils/thaiDate';

interface AcademicYearsViewProps {
  academicYears: AcademicYear[];
  onAddYear: (year: Omit<AcademicYear, 'id'>) => Promise<void>;
  onUpdateYear: (id: string, year: Partial<AcademicYear>) => Promise<void>;
  onDeleteYear: (id: string) => Promise<void>;
  onSetCurrentYear: (id: string) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
}

const PRESET_COLORS = [
  '#0C7C82', '#35B4B0', '#26A69A', '#AED581',
  '#FFCA28', '#FF8A65', '#EF5350', '#4A2C6D',
  '#D32F2F', '#F57C00', '#FBC02D', '#0288D1'
];

export const AcademicYearsView: React.FC<AcademicYearsViewProps> = ({
  academicYears,
  onAddYear,
  onUpdateYear,
  onDeleteYear,
  onSetCurrentYear,
  openConfirm
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [term1Start, setTerm1Start] = useState('2026-05-16');
  const [term1End, setTerm1End] = useState('2026-10-10');
  const [term2Start, setTerm2Start] = useState('2026-11-01');
  const [term2End, setTerm2End] = useState('2027-03-31');
  const [isCurrent, setIsCurrent] = useState(false);
  const [color, setColor] = useState('#0C7C82');
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingYear(null);
    setName('2570');
    setTerm1Start('2027-05-16');
    setTerm1End('2027-10-10');
    setTerm2Start('2027-11-01');
    setTerm2End('2028-03-31');
    setIsCurrent(false);
    setColor('#0C7C82');
    setIsModalOpen(true);
  };

  const openEditModal = (year: AcademicYear) => {
    setEditingYear(year);
    setName(year.name);
    setTerm1Start(year.term1Start || '2026-05-16');
    setTerm1End(year.term1End || '2026-10-10');
    setTerm2Start(year.term2Start || '2026-11-01');
    setTerm2End(year.term2End || '2027-03-31');
    setIsCurrent(year.isCurrent);
    setColor(year.color || '#0C7C82');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      if (editingYear) {
        await onUpdateYear(editingYear.id, {
          name: name.trim(),
          term1Start,
          term1End,
          term2Start,
          term2End,
          isCurrent,
          color
        });
      } else {
        await onAddYear({
          name: name.trim(),
          term1Start,
          term1End,
          term2Start,
          term2End,
          isCurrent,
          color,
          order: academicYears.length + 1
        });
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (year: AcademicYear) => {
    openConfirm(
      'ยืนยันการลบปีการศึกษา',
      `คุณต้องการลบปีการศึกษา "${year.name}" ใช่หรือไม่? ข้อมูลที่เกี่ยวข้องอาจได้รับผลกระทบ`,
      () => onDeleteYear(year.id),
      'danger'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#0C7C82]" />
            <span>จัดการปีการศึกษา</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            กำหนดช่วงเวลาภาคเรียนที่ 1 และ 2 พร้อมตั้งค่าปีการศึกษาปัจจุบันและธีมสี
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มปีการศึกษา</span>
        </button>
      </div>

      {/* Academic Year Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-4 px-6">ปีการศึกษา</th>
                <th className="py-4 px-6">ภาคเรียนที่ 1</th>
                <th className="py-4 px-6">ภาคเรียนที่ 2</th>
                <th className="py-4 px-6 text-center">สถานะ</th>
                <th className="py-4 px-6 text-center">สีประจำปี</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {academicYears.map((year) => (
                <tr key={year.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-800 flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: year.color || '#0C7C82' }}
                    ></span>
                    <span>{year.name}</span>
                    {year.isCurrent && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <Star className="w-3 h-3 fill-emerald-600" />
                        <span>ปัจจุบัน</span>
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-slate-600 text-xs">
                    {formatToThaiBE(year.term1Start)} - {formatToThaiBE(year.term1End)}
                  </td>
                  <td className="py-4 px-6 text-slate-600 text-xs">
                    {formatToThaiBE(year.term2Start)} - {formatToThaiBE(year.term2End)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {!year.isCurrent ? (
                      <button
                        onClick={() => onSetCurrentYear(year.id)}
                        className="text-xs px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-[#0C7C82] cursor-pointer transition-colors"
                      >
                        ตั้งเป็นปัจจุบัน
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> ใช้งานอยู่
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className="w-5 h-5 rounded-md border border-slate-200 shadow-2xs"
                        style={{ backgroundColor: year.color || '#0C7C82' }}
                      ></span>
                      <span className="text-xs text-slate-500 font-mono">{year.color}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right space-x-1">
                    <button
                      onClick={() => openEditModal(year)}
                      className="p-2 rounded-xl text-slate-600 hover:text-[#0C7C82] hover:bg-teal-50 transition-colors cursor-pointer"
                      title="แก้ไข"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(year)}
                      disabled={year.isCurrent && academicYears.length > 1}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
                      title="ลบ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                {editingYear ? 'แก้ไขปีการศึกษา' : 'เพิ่มปีการศึกษาใหม่'}
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
                  ชื่อปีการศึกษา <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น 2569"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm"
                />
              </div>

              {/* Term 1 */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">ภาคเรียนที่ 1</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">วันที่เริ่มต้น</label>
                    <input
                      type="date"
                      value={term1Start}
                      onChange={(e) => setTerm1Start(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">วันที่สิ้นสุด</label>
                    <input
                      type="date"
                      value={term1End}
                      onChange={(e) => setTerm1End(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Term 2 */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">ภาคเรียนที่ 2</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">วันที่เริ่มต้น</label>
                    <input
                      type="date"
                      value={term2Start}
                      onChange={(e) => setTerm2Start(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">วันที่สิ้นสุด</label>
                    <input
                      type="date"
                      value={term2End}
                      onChange={(e) => setTerm2End(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  ตั้งค่าสีประจำปีการศึกษา (Color Picker)
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

              {/* Is Current Year */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCurrent}
                    onChange={(e) => setIsCurrent(e.target.checked)}
                    className="w-4 h-4 text-[#0C7C82] rounded-sm focus:ring-[#0C7C82]"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    ตั้งเป็นปีการศึกษาปัจจุบันของระบบ
                  </span>
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
