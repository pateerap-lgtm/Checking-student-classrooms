import React, { useState } from 'react';
import { Users, Plus, Edit2, Trash2, Download, Upload, FileSpreadsheet, KeyRound, Shield, Search, X } from 'lucide-react';
import { AppUser, UserRole } from '../../types';
import { exportToExcel, parseExcelFile, downloadUserTemplate } from '../../utils/excel';

interface UsersViewProps {
  users: AppUser[];
  onAddUser: (newUser: Omit<AppUser, 'id'>) => Promise<void>;
  onUpdateUser: (id: string, updated: Partial<AppUser>) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onDeleteAllUsers: () => Promise<void>;
  onImportUsers: (newUsers: Omit<AppUser, 'id'>[]) => Promise<void>;
  openConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning') => void;
  showToast: (type: 'success' | 'error' | 'warning', message: string) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onDeleteAllUsers,
  onImportUsers,
  openConfirm,
  showToast
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'director' | 'teacher'>('teacher');
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('pass123');
    setFullName('');
    setRole('teacher');
    setIsModalOpen(true);
  };

  const openEditModal = (u: AppUser) => {
    setEditingUser(u);
    setUsername(u.username);
    setPassword(u.password);
    setFullName(u.fullName);
    setRole(u.role);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !fullName.trim()) return;

    setIsSaving(true);
    try {
      if (editingUser) {
        await onUpdateUser(editingUser.id, {
          username: username.trim(),
          password: password.trim(),
          fullName: fullName.trim(),
          role
        });
      } else {
        await onAddUser({
          username: username.trim(),
          password: password.trim(),
          fullName: fullName.trim(),
          role
        });
      }
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (u: AppUser) => {
    openConfirm(
      'ยืนยันการลบผู้ใช้งาน',
      `คุณต้องการลบผู้ใช้งาน "${u.fullName}" (${u.username}) ใช่หรือไม่?`,
      () => onDeleteUser(u.id),
      'danger'
    );
  };

  const handleDeleteAll = () => {
    openConfirm(
      'ยืนยันการลบผู้ใช้งานทั้งหมด',
      'คำเตือน: คุณต้องการลบผู้ใช้งานทั้งหมดในระบบใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้',
      () => onDeleteAllUsers(),
      'danger'
    );
  };

  const handleExportExcel = () => {
    const exportData = users.map((u, idx) => ({
      'ลำดับ': idx + 1,
      'username': u.username,
      'password': u.password,
      'ชื่อ-นามสกุล': u.fullName,
      'บทบาท': u.role === 'admin' ? 'ผู้ดูแลระบบ' : u.role === 'director' ? 'ผู้บริหาร' : 'ครู'
    }));
    exportToExcel(exportData, 'รายชื่อผู้ใช้งานระบบ_บุคลากร', 'ผู้ใช้งาน');
    showToast('success', 'ส่งออกข้อมูลผู้ใช้งานสำเร็จ');
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

      const importedUsers: Omit<AppUser, 'id'>[] = parsedData.map((row: any) => {
        const rawRole = String(row['บทบาท(ผู้ดูแลระบบ/ผู้บริหาร/ครู)'] || row['บทบาท'] || 'ครู');
        let mappedRole: 'admin' | 'director' | 'teacher' = 'teacher';
        if (rawRole.includes('ดูแล') || rawRole.includes('admin')) mappedRole = 'admin';
        else if (rawRole.includes('บริหาร') || rawRole.includes('director')) mappedRole = 'director';

        return {
          username: String(row['username'] || '').trim(),
          password: String(row['password'] || 'pass123').trim(),
          fullName: String(row['ชื่อ-นามสกุล'] || row['ชื่อ'] || '').trim(),
          role: mappedRole
        };
      }).filter((u) => u.username.length > 0 && u.fullName.length > 0);

      await onImportUsers(importedUsers);
      showToast('success', `นำเข้าผู้ใช้งานสำเร็จจำนวน ${importedUsers.length} ท่าน`);
    } catch (err) {
      showToast('error', 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาตรวจสอบรูปแบบไฟล์');
    } finally {
      e.target.value = '';
    }
  };

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (r: 'admin' | 'director' | 'teacher') => {
    switch (r) {
      case 'admin':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">ผู้ดูแลระบบ</span>;
      case 'director':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">ผู้บริหาร</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">ครู</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#0C7C82]" />
            <span>จัดการผู้ใช้งานระบบ (User Management)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            กำหนดบัญชีผู้ดูแลระบบ, ผู้บริหาร, และครูผู้สอน
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadUserTemplate}
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

          {users.length > 0 && (
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
            <span>เพิ่มผู้ใช้งาน</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหาตามชื่อ-นามสกุล หรือ Username..."
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
                <th className="py-4 px-6">ชื่อ-นามสกุล</th>
                <th className="py-4 px-6">Username</th>
                <th className="py-4 px-6">Password</th>
                <th className="py-4 px-6 text-center">บทบาท</th>
                <th className="py-4 px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    ไม่พบข้อมูลผู้ใช้งานตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-center text-xs text-slate-400 font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800">{u.fullName}</td>
                    <td className="py-4 px-6 font-mono text-slate-600 text-xs bg-slate-50/50 px-2 rounded-sm inline-block my-3">
                      {u.username}
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-400 text-xs">••••••••</td>
                    <td className="py-4 px-6 text-center">{getRoleBadge(u.role)}</td>
                    <td className="py-4 px-6 text-right space-x-1">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-2 rounded-xl text-slate-600 hover:text-[#0C7C82] hover:bg-teal-50 transition-colors cursor-pointer"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
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
                {editingUser ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
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
                  ชื่อ-นามสกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="เช่น นายสมชาย ดีเลิศ"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  ชื่อผู้ใช้งาน (Username) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น teacher_somchai"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#0C7C82] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  รหัสผ่าน (Password) <span className="text-red-500">*</span>
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

              {/* Role Radio Group as required: radio บทบาท(ผู้ดูแลระบบ, ผู้บริหาร,และครู) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  บทบาทผู้ใช้งาน (Role) <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="userRole"
                      value="teacher"
                      checked={role === 'teacher'}
                      onChange={() => setRole('teacher')}
                      className="w-4 h-4 text-[#0C7C82] focus:ring-[#0C7C82]"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">ครู (Teacher)</span>
                      <span className="text-[11px] text-slate-500">
                        เข้าใช้งานระบบเช็คชื่อนักเรียน ดูตารางสอน และพิมพ์รายงาน
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-slate-200/60">
                    <input
                      type="radio"
                      name="userRole"
                      value="director"
                      checked={role === 'director'}
                      onChange={() => setRole('director')}
                      className="w-4 h-4 text-[#0C7C82] focus:ring-[#0C7C82]"
                    />
                    <div>
                      <span className="text-xs font-bold text-purple-900 block">ผู้บริหาร (Executive Director)</span>
                      <span className="text-[11px] text-slate-500">
                        เข้าดูแดชบอร์ด รายงานภาพรวมสถิติ และการมาเรียน
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-slate-200/60">
                    <input
                      type="radio"
                      name="userRole"
                      value="admin"
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                      className="w-4 h-4 text-[#0C7C82] focus:ring-[#0C7C82]"
                    />
                    <div>
                      <span className="text-xs font-bold text-emerald-900 block">ผู้ดูแลระบบ (Admin)</span>
                      <span className="text-[11px] text-slate-500">
                        สิทธิ์เต็ม จัดการตั้งค่า ระบบ คาบสอน ชั้นเรียน รายวิชา และผู้ใช้งาน
                      </span>
                    </div>
                  </label>
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
