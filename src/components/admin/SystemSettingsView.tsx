import React, { useState } from 'react';
import { School, Upload, Save, Building, Image as ImageIcon, Check, UserCheck, KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';
import { SystemSettings } from '../../types';

interface SystemSettingsViewProps {
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => Promise<void>;
  onPurgeDatabase?: () => void;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  settings,
  onSaveSettings,
  onPurgeDatabase
}) => {
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [affiliationName, setAffiliationName] = useState(settings.affiliationName);
  const [directorName, setDirectorName] = useState(settings.directorName || 'ดร.สุรัตน์ มีเกียรติ');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');
  const [previewUrl, setPreviewUrl] = useState(settings.logoUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Admin PIN management state
  const currentPin = settings.adminPin || '000000';
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [isSavingPin, setIsSavingPin] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Str = reader.result as string;
        setPreviewUrl(base64Str);
        setLogoUrl(base64Str);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setPreviewUrl('');
    setLogoUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      await onSaveSettings({
        schoolName: schoolName.trim(),
        affiliationName: affiliationName.trim(),
        directorName: directorName.trim(),
        logoUrl: logoUrl,
        adminPin: settings.adminPin || '000000',
        updatedAt: new Date().toISOString()
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    const cleanNewPin = newPin.trim();
    const cleanConfirmPin = confirmPin.trim();

    if (!/^\d{6}$/.test(cleanNewPin)) {
      setPinError('รหัส PIN ต้องเป็นตัวเลข 6 หลักเท่านั้น (0-9)');
      return;
    }

    if (cleanNewPin !== cleanConfirmPin) {
      setPinError('รหัส PIN ใหม่ และการยืนยันรหัส PIN ไม่ตรงกัน');
      return;
    }

    setIsSavingPin(true);
    try {
      await onSaveSettings({
        ...settings,
        schoolName: schoolName.trim(),
        affiliationName: affiliationName.trim(),
        directorName: directorName.trim(),
        logoUrl: logoUrl,
        adminPin: cleanNewPin,
        updatedAt: new Date().toISOString()
      });
      setPinSuccess('เปลี่ยนรหัส PIN ผู้ดูแลระบบเป็น ' + cleanNewPin + ' สำเร็จแล้ว');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => setPinSuccess(null), 4000);
    } catch {
      setPinError('เกิดข้อผิดพลาดในการบันทึกรหัส PIN กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleResetPinDefault = async () => {
    setPinError(null);
    setPinSuccess(null);
    setIsSavingPin(true);
    try {
      await onSaveSettings({
        ...settings,
        schoolName: schoolName.trim(),
        affiliationName: affiliationName.trim(),
        directorName: directorName.trim(),
        logoUrl: logoUrl,
        adminPin: '000000',
        updatedAt: new Date().toISOString()
      });
      setPinSuccess('รีเซ็ตรหัส PIN กลับเป็นค่าเริ่มต้น (000000) เรียบร้อยแล้ว');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => setPinSuccess(null), 4000);
    } catch {
      setPinError('เกิดข้อผิดพลาดในการรีเซ็ตรหัส PIN');
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0C7C82] flex items-center justify-center">
            <School className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">ตั้งค่าข้อมูลโรงเรียนและระบบ</h2>
            <p className="text-xs text-slate-500">
              กำหนดชื่อโรงเรียน สังกัด และตราสัญลักษณ์เพื่อแสดงในทุกหน้าจอและหัวรายงาน
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-600" />
            <span className="font-medium">บันทึกข้อมูลการตั้งค่าระบบเรียบร้อยแล้ว</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo Section */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              ตราสัญลักษณ์โรงเรียน (Logo)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80">
              <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-slate-300" />
                )}
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <p className="text-xs text-slate-600">
                  อัพโหลดรูปภาพโลโก้โรงเรียน (PNG, JPG, SVG) เพื่อแสดงในหน้าแรกและส่วนหัวของระบบ
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-[#0C7C82] text-white hover:bg-[#096368] cursor-pointer transition-colors shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์รูปภาพ (Preview)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 cursor-pointer"
                    >
                      ลบโลโก้
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* School Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              ชื่อโรงเรียน <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <School className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="เช่น โรงเรียนอนุบาลหนองหานวิทยายน"
                required
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Affiliation */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              ชื่อสังกัด <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Building className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={affiliationName}
                onChange={(e) => setAffiliationName(e.target.value)}
                placeholder="เช่น สำนักงานเขตพื้นที่การศึกษาประถมศึกษาอุดรธานี เขต 3"
                required
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Director Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center justify-between">
              <span>ชื่อผู้อำนวยการสถานศึกษา</span>
              <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-normal">
                แสดงในช่องลงนามรายงาน PDF และแบบ ปพ.5
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserCheck className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={directorName}
                onChange={(e) => setDirectorName(e.target.value)}
                placeholder="เช่น ดร.สุรัตน์ มีเกียรติ หรือ นายสมศักดิ์ สุขใจ"
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm text-slate-800 bg-white"
              />
            </div>
          </div>

            {/* Submit */}
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer disabled:opacity-60 transition-all text-sm"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>บันทึกการตั้งค่า</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Admin PIN Settings Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xs">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0C7C82] flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">ตั้งค่ารหัส PIN ผู้ดูแลระบบ (Admin PIN)</h2>
              <p className="text-xs text-slate-500">
                สำหรับใช้กดเข้าสู่ระบบผู้ดูแลระบบผ่านไอคอนลอยมุมล่างขวา (PIN 6 หลัก)
              </p>
            </div>
          </div>

          {/* Current Status Pill */}
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100/60 text-[#0C7C82] flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500">สถานะรหัส PIN ปัจจุบัน</div>
                <div className="text-sm font-bold font-mono tracking-widest text-slate-800 flex items-center gap-2">
                  <span>●●●●●●</span>
                  <span className="text-[11px] font-sans font-normal text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                    {currentPin === '000000' ? 'ใช้รหัสเริ่มต้น (000000)' : 'กำหนดรหัสเฉพาะแล้ว'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetPinDefault}
              disabled={isSavingPin || currentPin === '000000'}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              รีเซ็ตเป็นค่าเริ่มต้น (000000)
            </button>
          </div>

          {/* Alert Messages */}
          {pinSuccess && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3 animate-fade-in">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-medium">{pinSuccess}</span>
            </div>
          )}

          {pinError && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span className="font-medium">{pinError}</span>
            </div>
          )}

          <form onSubmit={handleChangePin} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  รหัส PIN ใหม่ (ตัวเลข 6 หลัก) <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="เช่น 123456"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm text-slate-800 font-mono tracking-widest bg-white"
                />
                <span className="text-[11px] text-slate-400">กรอกตัวเลข 0-9 ความยาว 6 หลัก</span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  ยืนยันรหัส PIN ใหม่อีกครั้ง <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="ยืนยันรหัส PIN 6 หลัก"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm text-slate-800 font-mono tracking-widest bg-white"
                />
                <span className="text-[11px] text-slate-400">ต้องตรงกับรหัส PIN ใหม่ด้านซ้าย</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingPin || newPin.length !== 6 || confirmPin.length !== 6}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium bg-gradient-to-r from-[#0C7C82] to-[#35B4B0] hover:from-[#096368] hover:to-[#2ba09c] shadow-md shadow-[#0C7C82]/20 cursor-pointer disabled:opacity-50 transition-all text-sm"
              >
                {isSavingPin ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>บันทึกเปลี่ยนรหัส PIN</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Danger Zone: Purge All Sample Data */}
        {onPurgeDatabase && (
          <div className="bg-red-50/70 border border-red-200 rounded-3xl p-6 sm:p-8 space-y-3">
            <h3 className="text-base font-bold text-red-900 flex items-center gap-2">
              <span>⚠️ ลบข้อมูลตัวอย่างและล้างฐานข้อมูลทั้งหมด</span>
            </h3>
            <p className="text-xs text-red-700 leading-relaxed">
              ฟังก์ชั่นนี้จะลบข้อมูลตัวอย่างทั้งหมดในฐานข้อมูล Firestore (นักเรียน, รายวิชา, คาบสอน, ชั้นเรียน, ตารางมอบหมาย, ประวัติการเช็คชื่อ) ให้กลายเป็นระบบว่างเปล่าพร้อมสำหรับการบันทึกข้อมูลจริงของโรงเรียน (จะคงไว้เฉพาะบัญชีผู้ดูแลระบบ admin เพื่อให้สามารถเข้าสู่ระบบได้)
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onPurgeDatabase}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <span>ลบข้อมูลตัวอย่างทั้งหมดออกจากระบบและฐานข้อมูล</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
