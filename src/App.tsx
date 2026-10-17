import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  getDocs
} from 'firebase/firestore';
import {
  db,
  testConnection,
  initSystem,
  purgeAllSampleData,
  DEFAULT_SETTINGS,
  DEFAULT_ACADEMIC_YEARS,
  DEFAULT_PERIODS,
  DEFAULT_CLASSES,
  DEFAULT_USERS,
  DEFAULT_STUDENTS,
  DEFAULT_SUBJECTS,
  DEFAULT_ASSIGNMENTS,
  handleFirestoreError,
  OperationType
} from './lib/firebase';
import {
  SystemSettings,
  AcademicYear,
  Period,
  Classroom,
  AppUser,
  Student,
  Subject,
  TeachingAssignment,
  AttendanceLog,
  UserRole
} from './types';
import { LoginPage } from './components/auth/LoginPage';
import { AdminPinModal, FloatingAdminLoginButton } from './components/auth/AdminPinModal';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNavBar } from './components/layout/MobileNavBar';
import { Footer } from './components/layout/Footer';
import { SweetConfirmModal, ToastContainer, ToastAlert } from './components/common/SweetAlertModal';
import { CardSkeleton, TableSkeleton } from './components/common/SkeletonLoader';

// Admin Views
import { AdminDashboard } from './components/admin/AdminDashboard';
import { SystemSettingsView } from './components/admin/SystemSettingsView';
import { AcademicYearsView } from './components/admin/AcademicYearsView';
import { PeriodsView } from './components/admin/PeriodsView';
import { ClassesView } from './components/admin/ClassesView';
import { UsersView } from './components/admin/UsersView';
import { StudentsView } from './components/admin/StudentsView';
import { SubjectsView } from './components/admin/SubjectsView';
import { AssignmentsView } from './components/admin/AssignmentsView';

// Teacher Views
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { TeacherAttendanceView } from './components/teacher/TeacherAttendanceView';
import { TeacherReportView } from './components/teacher/TeacherReportView';
import { TeacherProfileView } from './components/teacher/TeacherProfileView';

// Director Views
import { DirectorDailyReportView } from './components/director/DirectorDailyReportView';
import { DirectorMonthlyReportView } from './components/director/DirectorMonthlyReportView';

// Student Views
import { StudentDashboardView } from './components/student/StudentDashboardView';
import { StudentInfoView } from './components/student/StudentInfoView';
import { StudentDailyAttendanceView } from './components/student/StudentDailyAttendanceView';
import { StudentMonthlyAttendanceView } from './components/student/StudentMonthlyAttendanceView';

import { Menu, LogOut, School, Sparkles, User, Bell } from 'lucide-react';

export default function App() {
  // Authentication & Session
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    fullName: string;
    role: UserRole;
    data?: any;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('school_attendance_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Current Active Tab
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Firestore Data Collections
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(DEFAULT_ACADEMIC_YEARS);
  const [periods, setPeriods] = useState<Period[]>(DEFAULT_PERIODS);
  const [classes, setClasses] = useState<Classroom[]>(DEFAULT_CLASSES);
  const [users, setUsers] = useState<AppUser[]>(DEFAULT_USERS);
  const [students, setStudents] = useState<Student[]>(DEFAULT_STUDENTS);
  const [subjects, setSubjects] = useState<Subject[]>(DEFAULT_SUBJECTS);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>(DEFAULT_ASSIGNMENTS);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);

  // Teacher navigation state
  const [pendingAttendanceAssignment, setPendingAttendanceAssignment] = useState<TeachingAssignment | null>(null);
  const [pendingReportStudent, setPendingReportStudent] = useState<{ studentId: string; classId?: string } | null>(null);

  // Loading indicator
  const [isLoading, setIsLoading] = useState(true);

  // Mobile drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // SweetAlert Modal & Toasts
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info' | 'logout';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [toasts, setToasts] = useState<ToastAlert[]>([]);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const openConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'danger' | 'warning' | 'logout' = 'warning'
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await onConfirm();
        } catch (error) {
          showToast('error', 'เกิดข้อผิดพลาดในการดำเนินการ');
        }
      },
    });
  };

  // Admin PIN Login Modal state
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);

  // Active Academic Year with selector support
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const activeYear = (selectedYearId ? academicYears.find((y) => y.id === selectedYearId) : null)
    || academicYears.find((y) => y.isCurrent)
    || academicYears[0];

  const activeYearId = activeYear?.id || 'year_2569';

  // Filter all system data collections strictly according to active academic year
  const currentYearClasses = useMemo(() => {
    return classes.filter(
      (c) => c.academicYearId === activeYearId || (!c.academicYearId && (activeYear?.isCurrent || activeYearId === 'year_2569'))
    );
  }, [classes, activeYearId, activeYear]);

  const currentYearStudents = useMemo(() => {
    return students.filter(
      (s) => s.academicYearId === activeYearId || (!s.academicYearId && (activeYear?.isCurrent || activeYearId === 'year_2569'))
    );
  }, [students, activeYearId, activeYear]);

  const currentYearSubjects = useMemo(() => {
    return subjects.filter(
      (s) => s.academicYearId === activeYearId || (!s.academicYearId && (activeYear?.isCurrent || activeYearId === 'year_2569'))
    );
  }, [subjects, activeYearId, activeYear]);

  const currentYearAssignments = useMemo(() => {
    return assignments.filter(
      (a) => a.academicYearId === activeYearId || (!a.academicYearId && (activeYear?.isCurrent || activeYearId === 'year_2569'))
    );
  }, [assignments, activeYearId, activeYear]);

  const currentYearPeriods = useMemo(() => {
    return periods.filter(
      (p) => !p.academicYearId || p.academicYearId === activeYearId || (activeYear?.isCurrent || activeYearId === 'year_2569')
    );
  }, [periods, activeYearId, activeYear]);

  const currentYearAttendanceLogs = useMemo(() => {
    return attendanceLogs.filter(
      (l) => l.academicYearId === activeYearId || (!l.academicYearId && (activeYear?.isCurrent || activeYearId === 'year_2569'))
    );
  }, [attendanceLogs, activeYearId, activeYear]);

  // Initialize and attach Firestore real-time listeners
  useEffect(() => {
    testConnection();
    // Initialize system settings and admin account safely without modifying existing database data
    initSystem();

    // Listen to Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as SystemSettings);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/config'));

    // Listen to Academic Years
    const unsubYears = onSnapshot(collection(db, 'academicYears'), (snap) => {
      const list: AcademicYear[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as AcademicYear));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      setAcademicYears(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'academicYears'));

    // Listen to Periods
    const unsubPeriods = onSnapshot(collection(db, 'periods'), (snap) => {
      const list: Period[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Period));
      list.sort((a, b) => a.order - b.order);
      setPeriods(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'periods'));

    // Listen to Classes
    const unsubClasses = onSnapshot(collection(db, 'classes'), (snap) => {
      const list: Classroom[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Classroom));
      list.sort((a, b) => (a.order || 0) - (b.order || 0));
      setClasses(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'classes'));

    // Listen to App Users
    const unsubUsers = onSnapshot(collection(db, 'appUsers'), (snap) => {
      const list: AppUser[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as AppUser));
      setUsers(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'appUsers'));

    // Listen to Students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const list: Student[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Student));
      list.sort((a, b) => a.seq - b.seq);
      setStudents(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'students'));

    // Listen to Subjects
    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => {
      const list: Subject[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Subject));
      setSubjects(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'subjects'));

    // Listen to Teaching Assignments
    const unsubAssignments = onSnapshot(collection(db, 'assignments'), (snap) => {
      const list: TeachingAssignment[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as TeachingAssignment));
      setAssignments(list);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'assignments'));

    // Listen to Attendance Logs
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      const list: AttendanceLog[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as AttendanceLog));
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAttendanceLogs(list);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'attendance');
      setIsLoading(false);
    });

    return () => {
      unsubSettings();
      unsubYears();
      unsubPeriods();
      unsubClasses();
      unsubUsers();
      unsubStudents();
      unsubSubjects();
      unsubAssignments();
      unsubAttendance();
    };
  }, []);

  // Guard tab for director: dashboard, report, daily-report, monthly-report are accessible
  useEffect(() => {
    if (currentUser?.role === 'director') {
      const allowedDirectorTabs = ['dashboard', 'report', 'daily-report', 'monthly-report'];
      if (!allowedDirectorTabs.includes(currentTab)) {
        setCurrentTab('dashboard');
      }
    }
  }, [currentUser, currentTab]);

  // Login handler
  const handleLoginSuccess = (userObj: { username: string; fullName: string; role: UserRole; data?: any }) => {
    setCurrentUser(userObj);
    localStorage.setItem('school_attendance_user', JSON.stringify(userObj));
    setCurrentTab('dashboard');
    showToast('success', `ยินดีต้อนรับ ${userObj.fullName}`);
  };

  // Logout handler
  const handleLogout = () => {
    openConfirm(
      'ยืนยันการออกจากระบบ',
      'คุณต้องการออกจากระบบเช็คชื่อนักเรียน ใช่หรือไม่?',
      () => {
        setCurrentUser(null);
        localStorage.removeItem('school_attendance_user');
        setCurrentTab('dashboard');
        showToast('info', 'ออกจากระบบเรียบร้อยแล้ว');
      },
      'logout'
    );
  };

  // Firestore DB mutations
  const handleSaveSettings = async (newSettings: SystemSettings) => {
    await setDoc(doc(db, 'settings', 'config'), newSettings);
    showToast('success', 'บันทึกการตั้งค่าระบบเรียบร้อย');
  };

  // Academic Year mutations
  const handleAddYear = async (newYear: Omit<AcademicYear, 'id'>) => {
    const id = `year_${Date.now()}`;
    await setDoc(doc(db, 'academicYears', id), newYear);
    showToast('success', `เพิ่มปีการศึกษา ${newYear.name} เรียบร้อยแล้ว`);
  };

  const handleUpdateYear = async (id: string, updated: Partial<AcademicYear>) => {
    await updateDoc(doc(db, 'academicYears', id), updated);
    showToast('success', 'อัพเดทปีการศึกษาเรียบร้อยแล้ว');
  };

  const handleDeleteYear = async (id: string) => {
    await deleteDoc(doc(db, 'academicYears', id));
    showToast('success', 'ลบปีการศึกษาเรียบร้อยแล้ว');
  };

  const handleSetCurrentYear = async (id: string) => {
    const batch = writeBatch(db);
    academicYears.forEach((y) => {
      batch.update(doc(db, 'academicYears', y.id), { isCurrent: y.id === id });
    });
    await batch.commit();
    showToast('success', 'ตั้งเป็นปีการศึกษาปัจจุบันเรียบร้อยแล้ว');
  };

  // Periods mutations
  const handleAddPeriod = async (newPeriod: Omit<Period, 'id'>) => {
    const id = `p_${Date.now()}`;
    await setDoc(doc(db, 'periods', id), newPeriod);
    showToast('success', 'เพิ่มคาบสอนสำเร็จ');
  };

  const handleUpdatePeriod = async (id: string, updated: Partial<Period>) => {
    await updateDoc(doc(db, 'periods', id), updated);
    showToast('success', 'อัพเดทคาบสอนเรียบร้อย');
  };

  const handleDeletePeriod = async (id: string) => {
    await deleteDoc(doc(db, 'periods', id));
    showToast('success', 'ลบคาบสอนสำเร็จ');
  };

  const handleDeleteAllPeriods = async () => {
    const batch = writeBatch(db);
    periods.forEach((p) => batch.delete(doc(db, 'periods', p.id)));
    await batch.commit();
    showToast('success', 'ลบคาบสอนทั้งหมดเรียบร้อยแล้ว');
  };

  const handleImportPeriods = async (newPeriods: Omit<Period, 'id'>[]) => {
    const batch = writeBatch(db);
    newPeriods.forEach((p, idx) => {
      const id = `p_imp_${Date.now()}_${idx}`;
      batch.set(doc(db, 'periods', id), p);
    });
    await batch.commit();
  };

  // Classes mutations
  const handleAddClass = async (newClass: Omit<Classroom, 'id'>) => {
    const id = `c_${Date.now()}`;
    await setDoc(doc(db, 'classes', id), {
      ...newClass,
      academicYearId: newClass.academicYearId || activeYear?.id || 'year_2569'
    });
    showToast('success', `เพิ่มชั้นเรียน ${newClass.name} สำเร็จ`);
  };

  const handleUpdateClass = async (id: string, updated: Partial<Classroom>) => {
    await updateDoc(doc(db, 'classes', id), updated);
    showToast('success', 'อัพเดทชั้นเรียนสำเร็จ');
  };

  const handleDeleteClass = async (id: string) => {
    await deleteDoc(doc(db, 'classes', id));
    showToast('success', 'ลบชั้นเรียนสำเร็จ');
  };

  const handleDeleteAllClasses = async () => {
    try {
      const snap = await getDocs(collection(db, 'classes'));
      if (snap.empty && classes.length === 0) {
        showToast('warning', 'ไม่มีข้อมูลชั้นเรียนให้ลบ');
        return;
      }

      const docsToDelete = snap.docs;
      for (let i = 0; i < docsToDelete.length; i += 400) {
        const batch = writeBatch(db);
        docsToDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      setClasses([]);
      showToast('success', `ลบชั้นเรียนทั้งหมดจำนวน ${docsToDelete.length || classes.length} ห้องเรียบร้อยแล้ว`);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, 'classes');
      showToast('error', 'เกิดข้อผิดพลาดในการลบชั้นเรียนทั้งหมด');
    }
  };

  const handleDeleteSelectedClasses = async (ids: string[]) => {
    try {
      if (ids.length === 0) return;
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db);
        ids.slice(i, i + 400).forEach((id) => batch.delete(doc(db, 'classes', id)));
        await batch.commit();
      }
      setClasses((prev) => prev.filter((c) => !ids.includes(c.id)));
      showToast('success', `ลบชั้นเรียนที่เลือกจำนวน ${ids.length} ห้องเรียบร้อยแล้ว`);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, 'classes');
      showToast('error', 'เกิดข้อผิดพลาดในการลบชั้นเรียน');
    }
  };

  const handleReorderClasses = async (reordered: Classroom[]) => {
    const batch = writeBatch(db);
    reordered.forEach((c) => {
      batch.update(doc(db, 'classes', c.id), { order: c.order });
    });
    await batch.commit();
  };

  const handleImportClasses = async (newClasses: Omit<Classroom, 'id'>[]) => {
    const batch = writeBatch(db);
    newClasses.forEach((c, idx) => {
      const id = `c_imp_${Date.now()}_${idx}`;
      batch.set(doc(db, 'classes', id), {
        ...c,
        academicYearId: c.academicYearId || activeYear?.id || 'year_2569'
      });
    });
    await batch.commit();
  };

  // User mutations
  const handleAddUser = async (newUser: Omit<AppUser, 'id'>) => {
    const id = `u_${Date.now()}`;
    await setDoc(doc(db, 'appUsers', id), newUser);
    showToast('success', `เพิ่มผู้ใช้งาน ${newUser.fullName} สำเร็จ`);
  };

  const handleUpdateUser = async (id: string, updated: Partial<AppUser>) => {
    await updateDoc(doc(db, 'appUsers', id), updated);
    showToast('success', 'อัพเดทข้อมูลผู้ใช้งานสำเร็จ');
  };

  const handleDeleteUser = async (id: string) => {
    await deleteDoc(doc(db, 'appUsers', id));
    showToast('success', 'ลบผู้ใช้งานสำเร็จ');
  };

  const handleDeleteAllUsers = async () => {
    const batch = writeBatch(db);
    users.forEach((u) => batch.delete(doc(db, 'appUsers', u.id)));
    await batch.commit();
    showToast('success', 'ลบผู้ใช้งานทั้งหมดเรียบร้อยแล้ว');
  };

  const handleImportUsers = async (newUsers: Omit<AppUser, 'id'>[]) => {
    const batch = writeBatch(db);
    newUsers.forEach((u, idx) => {
      const id = `u_imp_${Date.now()}_${idx}`;
      batch.set(doc(db, 'appUsers', id), u);
    });
    await batch.commit();
  };

  // Students mutations
  const handleAddStudent = async (newStudent: Omit<Student, 'id'>) => {
    const id = `s_${Date.now()}`;
    await setDoc(doc(db, 'students', id), {
      ...newStudent,
      academicYearId: newStudent.academicYearId || activeYear?.id || 'year_2569'
    });
    showToast('success', `เพิ่มนักเรียน ${newStudent.name} สำเร็จ`);
  };

  const handleUpdateStudent = async (id: string, updated: Partial<Student>) => {
    await updateDoc(doc(db, 'students', id), updated);
    showToast('success', 'อัพเดทข้อมูลนักเรียนสำเร็จ');
  };

  const handleDeleteStudent = async (id: string) => {
    await deleteDoc(doc(db, 'students', id));
    showToast('success', 'ลบนักเรียนสำเร็จ');
  };

  const handleDeleteAllStudentsByClass = async (classId: string) => {
    const targetStudents = students.filter((s) => s.classId === classId);
    const batch = writeBatch(db);
    targetStudents.forEach((s) => batch.delete(doc(db, 'students', s.id)));
    await batch.commit();
    showToast('success', `ลบนักเรียนห้องนี้ทั้งหมด ${targetStudents.length} คนเรียบร้อยแล้ว`);
  };

  const handleImportStudents = async (newStudents: Omit<Student, 'id'>[]) => {
    const batch = writeBatch(db);
    newStudents.forEach((s, idx) => {
      const id = `s_imp_${Date.now()}_${idx}`;
      batch.set(doc(db, 'students', id), {
        ...s,
        academicYearId: s.academicYearId || activeYear?.id || 'year_2569'
      });
    });
    await batch.commit();
  };

  // Subjects mutations
  const handleAddSubject = async (newSubject: Omit<Subject, 'id'>) => {
    const id = `sub_${Date.now()}`;
    await setDoc(doc(db, 'subjects', id), {
      ...newSubject,
      academicYearId: newSubject.academicYearId || activeYear?.id || 'year_2569'
    });
    showToast('success', `เพิ่มรายวิชา ${newSubject.code} ${newSubject.name} สำเร็จ`);
  };

  const handleUpdateSubject = async (id: string, updated: Partial<Subject>) => {
    await updateDoc(doc(db, 'subjects', id), updated);
    showToast('success', 'อัพเดทรายวิชาสำเร็จ');
  };

  const handleDeleteSubject = async (id: string) => {
    await deleteDoc(doc(db, 'subjects', id));
    showToast('success', 'ลบรายวิชาสำเร็จ');
  };

  const handleDeleteAllSubjects = async () => {
    const batch = writeBatch(db);
    subjects.forEach((s) => batch.delete(doc(db, 'subjects', s.id)));
    await batch.commit();
    showToast('success', 'ลบรายวิชาทั้งหมดเรียบร้อยแล้ว');
  };

  const handleImportSubjects = async (newSubjects: Omit<Subject, 'id'>[]) => {
    const batch = writeBatch(db);
    newSubjects.forEach((s, idx) => {
      const id = `sub_imp_${Date.now()}_${idx}`;
      batch.set(doc(db, 'subjects', id), {
        ...s,
        academicYearId: s.academicYearId || activeYear?.id || 'year_2569'
      });
    });
    await batch.commit();
  };

  // Assignments mutations
  const handleAddAssignment = async (newAssignment: Omit<TeachingAssignment, 'id'>) => {
    const id = `a_${Date.now()}`;
    await setDoc(doc(db, 'assignments', id), {
      ...newAssignment,
      academicYearId: newAssignment.academicYearId || activeYear?.id || 'year_2569'
    });
    showToast('success', 'มอบหมายการสอนสำเร็จ');
  };

  const handleUpdateAssignment = async (id: string, updated: Partial<TeachingAssignment>) => {
    await updateDoc(doc(db, 'assignments', id), updated);
    showToast('success', 'อัพเดทการมอบหมายสอนสำเร็จ');
  };

  const handleDeleteAssignment = async (id: string) => {
    await deleteDoc(doc(db, 'assignments', id));
    showToast('success', 'ลบการมอบหมายสอนสำเร็จ');
  };

  const handleDeleteAllAssignments = async (targetIds?: string[]) => {
    const toDelete = targetIds && targetIds.length > 0
      ? assignments.filter((a) => targetIds.includes(a.id))
      : assignments;

    if (toDelete.length === 0) {
      showToast('warning', 'ไม่มีข้อมูลการมอบหมายสอนให้ลบ');
      return;
    }

    // Process in batches of 400 to respect Firestore limit
    for (let i = 0; i < toDelete.length; i += 400) {
      const chunk = toDelete.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((a) => batch.delete(doc(db, 'assignments', a.id)));
      await batch.commit();
    }
    showToast('success', `ลบการมอบหมายชั้นเรียนทั้งหมด (${toDelete.length} รายการ) เรียบร้อยแล้ว`);
  };

  // Attendance mutations
  const handleSaveAttendance = async (log: Omit<AttendanceLog, 'id'>) => {
    const id = `att_${Date.now()}`;
    await setDoc(doc(db, 'attendance', id), log);
  };

  const handleUpdateAttendance = async (id: string, updated: Partial<AttendanceLog>) => {
    await updateDoc(doc(db, 'attendance', id), updated);
  };

  const handleDeleteAttendance = async (id: string) => {
    await deleteDoc(doc(db, 'attendance', id));
    showToast('success', 'ลบประวัติการเช็คชื่อสำเร็จ');
  };

  // Purge all sample data
  const handlePurgeAllData = () => {
    openConfirm(
      'ยืนยันลบข้อมูลตัวอย่างทั้งหมด',
      'คำเตือน: คุณต้องการลบข้อมูลตัวอย่างทั้งหมดออกจากระบบและฐานข้อมูลใช่หรือไม่? ข้อมูลนักเรียน รายวิชา คาบสอน ชั้นเรียน และประวัติเช็คชื่อจะถูกลบทั้งหมด (คงไว้เฉพาะบัญชีผู้ดูแลระบบ)',
      async () => {
        await purgeAllSampleData();
        showToast('success', 'ลบข้อมูลตัวอย่างทั้งหมดออกจากระบบและฐานข้อมูลเรียบร้อยแล้ว');
      },
      'danger'
    );
  };

  // Teacher Profile mutation
  const handleUpdateTeacherProfile = async (updated: { username: string; password?: string; fullName: string }) => {
    if (!currentUser) return;
    const userDoc = users.find((u) => u.username === currentUser.username);
    if (userDoc) {
      await updateDoc(doc(db, 'appUsers', userDoc.id), {
        fullName: updated.fullName,
        username: updated.username,
        password: updated.password || userDoc.password
      });
      const newObj = {
        ...currentUser,
        username: updated.username,
        fullName: updated.fullName
      };
      setCurrentUser(newObj);
      localStorage.setItem('school_attendance_user', JSON.stringify(newObj));
    }
  };

  // If not logged in, render LoginPage with floating Admin PIN button
  if (!currentUser) {
    return (
      <div className="font-['Sarabun',sans-serif] relative min-h-screen flex flex-col justify-between">
        <LoginPage
          settings={settings}
          users={users}
          students={students}
          currentAcademicYear={activeYear}
          onLoginSuccess={handleLoginSuccess}
          isLoadingData={isLoading}
        />
        {/* Floating Admin PIN button at bottom-right corner as required */}
        <FloatingAdminLoginButton onClick={() => setIsAdminPinModalOpen(true)} />
        <AdminPinModal
          isOpen={isAdminPinModalOpen}
          onClose={() => setIsAdminPinModalOpen(false)}
          expectedPin={settings.adminPin || '000000'}
          onLoginSuccess={handleLoginSuccess}
        />
        <Footer schoolName={settings.schoolName} />
        <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      </div>
    );
  }

  // Teacher object for current user
  const teacherUser = users.find((u) => u.username === currentUser.username) || {
    id: 't_curr',
    username: currentUser.username,
    password: 'password',
    fullName: currentUser.fullName,
    role: 'teacher' as const
  };

  // Student object if current user is student
  const studentUser = students.find((s) => s.username === currentUser.username) || {
    id: 's_curr',
    seq: 1,
    name: currentUser.fullName,
    className: 'ม.1/1',
    username: currentUser.username,
    password: 'password',
    classId: 'c1'
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Sarabun',sans-serif]">
      {/* Top Application Header (Visible on Desktop & Mobile) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-2xs no-print">
        <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger button for mobile drawer */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="เปิดเมนู"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* School Logo & Title */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0C7C82] to-[#35B4B0] p-0.5 flex items-center justify-center text-white shadow-xs">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl bg-white p-0.5" />
                ) : (
                  <School className="w-4 h-4" />
                )}
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-slate-800 leading-tight">
                  ระบบเช็คชื่อนักเรียนสำหรับรายวิชา
                </h1>
                <p className="text-[11px] text-slate-500 truncate max-w-xs">
                  {settings.schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Header items: Active Academic Year, User Info, Logout */}
          <div className="flex items-center gap-3">
            {/* Active Academic Year selector */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-900 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="text-teal-700 hidden sm:inline">ปีการศึกษา:</span>
              <select
                value={activeYear?.id || ''}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="bg-transparent text-teal-900 font-bold focus:outline-hidden cursor-pointer"
                title="เลือกปีการศึกษาเพื่อดูและจัดการข้อมูล"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id} className="text-slate-800">
                    {y.name} {y.isCurrent ? '(ปีปัจจุบัน)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* User Info Chip */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
              <div className="w-8 h-8 rounded-full bg-[#0C7C82]/10 text-[#0C7C82] font-bold text-xs flex items-center justify-center">
                {currentUser.fullName.charAt(0) || 'U'}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {currentUser.fullName}
                </div>
                <div className="text-[10px] text-slate-400 capitalize">
                  {currentUser.role === 'admin'
                    ? 'ผู้ดูแลระบบ'
                    : currentUser.role === 'director'
                    ? 'ผู้อำนวยการสถานศึกษา'
                    : currentUser.role === 'teacher'
                    ? 'ครูผู้สอน'
                    : 'นักเรียน'}
                </div>
              </div>
            </div>

            {/* Logout Icon Button */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Container with Sidebar and Content */}
      <div className="flex-1 flex w-full">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          role={currentUser.role}
          userFullName={currentUser.fullName}
          settings={settings}
          activeYear={activeYear}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onLogoutClick={handleLogout}
        />

        {/* Dynamic Main View Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-28 lg:pb-12 print:p-0 print:m-0 print:max-w-none print:w-full">
          {isLoading ? (
            <div className="space-y-6">
              <CardSkeleton count={4} />
              <TableSkeleton rows={6} cols={5} />
            </div>
          ) : (
            <>
              {/* Director Views (Only Dashboard and Report as requested) */}
              {currentUser.role === 'director' && (
                <>
                  {currentTab === 'dashboard' && (
                    <AdminDashboard
                      subjects={currentYearSubjects}
                      classes={currentYearClasses}
                      students={currentYearStudents}
                      users={users}
                      attendanceLogs={currentYearAttendanceLogs}
                      onNavigateTab={(tab) => {
                        if (tab === 'report' || tab === 'dashboard' || tab === 'daily-report' || tab === 'monthly-report') {
                          setCurrentTab(tab);
                        } else {
                          setCurrentTab('report');
                        }
                      }}
                      academicYears={academicYears}
                      activeYear={activeYear}
                      currentUserRole="director"
                    />
                  )}
                  {currentTab === 'report' && (
                    <TeacherReportView
                      attendanceLogs={currentYearAttendanceLogs}
                      assignments={currentYearAssignments}
                      allAttendanceLogs={currentYearAttendanceLogs}
                      allAssignments={currentYearAssignments}
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      students={currentYearStudents}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      allUsers={users}
                      periods={currentYearPeriods}
                      settings={settings}
                      teacherUsername={currentUser.username}
                      teacherFullName={currentUser.fullName}
                      currentUserRole={currentUser.role}
                      activeYear={activeYear}
                      initialStudentId={pendingReportStudent?.studentId}
                      initialClassId={pendingReportStudent?.classId}
                      onClearInitialStudent={() => setPendingReportStudent(null)}
                      onUpdateAttendance={handleUpdateAttendance}
                      onSaveAttendance={handleSaveAttendance}
                      onNavigateTab={setCurrentTab}
                      onSelectAssignmentForAttendance={(assignment) => {
                        setPendingAttendanceAssignment(assignment);
                        setCurrentTab('attendance');
                      }}
                    />
                  )}
                  {currentTab === 'daily-report' && (
                    <DirectorDailyReportView
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      assignments={currentYearAssignments}
                      attendanceLogs={currentYearAttendanceLogs}
                      periods={currentYearPeriods}
                      students={currentYearStudents}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      allUsers={users}
                      settings={settings}
                      activeYear={activeYear}
                    />
                  )}
                  {currentTab === 'monthly-report' && (
                    <DirectorMonthlyReportView
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      attendanceLogs={currentYearAttendanceLogs}
                      students={currentYearStudents}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      allUsers={users}
                      settings={settings}
                      activeYear={activeYear}
                    />
                  )}
                </>
              )}

              {/* Admin Views */}
              {currentUser.role === 'admin' && (
                <>
                  {currentTab === 'dashboard' && (
                    <AdminDashboard
                      subjects={currentYearSubjects}
                      classes={currentYearClasses}
                      students={currentYearStudents}
                      users={users}
                      attendanceLogs={currentYearAttendanceLogs}
                      onNavigateTab={setCurrentTab}
                      academicYears={academicYears}
                      activeYear={activeYear}
                      currentUserRole="admin"
                    />
                  )}
                  {currentTab === 'settings' && (
                    <SystemSettingsView
                      settings={settings}
                      onSaveSettings={handleSaveSettings}
                      onPurgeDatabase={handlePurgeAllData}
                    />
                  )}
                  {currentTab === 'years' && (
                    <AcademicYearsView
                      academicYears={academicYears}
                      onAddYear={handleAddYear}
                      onUpdateYear={handleUpdateYear}
                      onDeleteYear={handleDeleteYear}
                      onSetCurrentYear={handleSetCurrentYear}
                      openConfirm={openConfirm}
                    />
                  )}
                  {currentTab === 'periods' && (
                    <PeriodsView
                      periods={currentYearPeriods}
                      activeYear={activeYear}
                      onAddPeriod={handleAddPeriod}
                      onUpdatePeriod={handleUpdatePeriod}
                      onDeletePeriod={handleDeletePeriod}
                      onDeleteAllPeriods={handleDeleteAllPeriods}
                      onImportPeriods={handleImportPeriods}
                      openConfirm={openConfirm}
                      showToast={showToast}
                    />
                  )}
                  {currentTab === 'classes' && (
                    <ClassesView
                      classes={currentYearClasses}
                      activeYear={activeYear}
                      onAddClass={handleAddClass}
                      onUpdateClass={handleUpdateClass}
                      onDeleteClass={handleDeleteClass}
                      onDeleteAllClasses={handleDeleteAllClasses}
                      onDeleteSelectedClasses={handleDeleteSelectedClasses}
                      onReorderClasses={handleReorderClasses}
                      onImportClasses={handleImportClasses}
                      openConfirm={openConfirm}
                      showToast={showToast}
                    />
                  )}
                  {currentTab === 'users' && (
                    <UsersView
                      users={users}
                      onAddUser={handleAddUser}
                      onUpdateUser={handleUpdateUser}
                      onDeleteUser={handleDeleteUser}
                      onDeleteAllUsers={handleDeleteAllUsers}
                      onImportUsers={handleImportUsers}
                      openConfirm={openConfirm}
                      showToast={showToast}
                    />
                  )}
                  {currentTab === 'students' && (
                    <StudentsView
                      students={currentYearStudents}
                      classes={currentYearClasses}
                      activeYear={activeYear}
                      onAddStudent={handleAddStudent}
                      onUpdateStudent={handleUpdateStudent}
                      onDeleteStudent={handleDeleteStudent}
                      onDeleteAllStudentsByClass={handleDeleteAllStudentsByClass}
                      onImportStudents={handleImportStudents}
                      openConfirm={openConfirm}
                      showToast={showToast}
                    />
                  )}
                  {currentTab === 'subjects' && (
                    <SubjectsView
                      subjects={currentYearSubjects}
                      classes={currentYearClasses}
                      activeYear={activeYear}
                      onAddSubject={handleAddSubject}
                      onUpdateSubject={handleUpdateSubject}
                      onDeleteSubject={handleDeleteSubject}
                      onDeleteAllSubjects={handleDeleteAllSubjects}
                      onImportSubjects={handleImportSubjects}
                      openConfirm={openConfirm}
                      showToast={showToast}
                    />
                  )}
                  {currentTab === 'assignments' && (
                    <AssignmentsView
                      assignments={currentYearAssignments}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      periods={currentYearPeriods}
                      activeYear={activeYear}
                      systemSettings={settings}
                      onAddAssignment={handleAddAssignment}
                      onUpdateAssignment={handleUpdateAssignment}
                      onDeleteAssignment={handleDeleteAssignment}
                      onDeleteAllAssignments={handleDeleteAllAssignments}
                      openConfirm={openConfirm}
                      showToast={showToast}
                    />
                  )}
                  {currentTab === 'report' && (
                    <TeacherReportView
                      attendanceLogs={currentYearAttendanceLogs}
                      assignments={currentYearAssignments}
                      allAttendanceLogs={currentYearAttendanceLogs}
                      allAssignments={currentYearAssignments}
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      students={currentYearStudents}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      allUsers={users}
                      periods={currentYearPeriods}
                      settings={settings}
                      teacherUsername={currentUser.username}
                      teacherFullName={currentUser.fullName}
                      currentUserRole={currentUser.role}
                      activeYear={activeYear}
                      initialStudentId={pendingReportStudent?.studentId}
                      initialClassId={pendingReportStudent?.classId}
                      onClearInitialStudent={() => setPendingReportStudent(null)}
                      onUpdateAttendance={handleUpdateAttendance}
                      onSaveAttendance={handleSaveAttendance}
                      onNavigateTab={setCurrentTab}
                      onSelectAssignmentForAttendance={(assignment) => {
                        setPendingAttendanceAssignment(assignment);
                        setCurrentTab('attendance');
                      }}
                    />
                  )}
                  {currentTab === 'daily-report' && (
                    <DirectorDailyReportView
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      assignments={currentYearAssignments}
                      attendanceLogs={currentYearAttendanceLogs}
                      periods={currentYearPeriods}
                      students={currentYearStudents}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      allUsers={users}
                      settings={settings}
                      activeYear={activeYear}
                    />
                  )}
                  {currentTab === 'monthly-report' && (
                    <DirectorMonthlyReportView
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      attendanceLogs={currentYearAttendanceLogs}
                      students={currentYearStudents}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      allUsers={users}
                      settings={settings}
                      activeYear={activeYear}
                    />
                  )}
                </>
              )}

              {/* Teacher Views */}
              {currentUser.role === 'teacher' && (
                <>
                  {currentTab === 'dashboard' && (
                    <TeacherDashboard
                      teacherUsername={currentUser.username}
                      teacherFullName={currentUser.fullName}
                      assignments={currentYearAssignments}
                      periods={currentYearPeriods}
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      students={currentYearStudents}
                      attendanceLogs={currentYearAttendanceLogs}
                      activeYear={activeYear}
                      onNavigateTab={setCurrentTab}
                      onSelectAssignmentForAttendance={(assignment) => {
                        setPendingAttendanceAssignment(assignment);
                        setCurrentTab('attendance');
                      }}
                      onSelectStudentForReport={(studentId, classId) => {
                        setPendingReportStudent({ studentId, classId });
                        setCurrentTab('report');
                      }}
                    />
                  )}
                  {currentTab === 'attendance' && (
                    <TeacherAttendanceView
                      teacherUsername={currentUser.username}
                      teacherFullName={currentUser.fullName}
                      assignments={currentYearAssignments}
                      periods={currentYearPeriods}
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      students={currentYearStudents}
                      attendanceLogs={currentYearAttendanceLogs}
                      activeYear={activeYear}
                      pendingAssignment={pendingAttendanceAssignment}
                      onClearPendingAssignment={() => setPendingAttendanceAssignment(null)}
                      onSaveAttendance={handleSaveAttendance}
                      onUpdateAttendance={handleUpdateAttendance}
                      onDeleteAttendance={handleDeleteAttendance}
                      openConfirm={openConfirm}
                      showToast={showToast}
                    />
                  )}
                  {currentTab === 'report' && (
                    <TeacherReportView
                      attendanceLogs={currentYearAttendanceLogs}
                      assignments={currentYearAssignments}
                      allAttendanceLogs={currentYearAttendanceLogs}
                      allAssignments={currentYearAssignments}
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      students={currentYearStudents}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      allUsers={users}
                      periods={currentYearPeriods}
                      settings={settings}
                      teacherUsername={currentUser.username}
                      teacherFullName={currentUser.fullName}
                      currentUserRole={currentUser.role}
                      activeYear={activeYear}
                      initialStudentId={pendingReportStudent?.studentId}
                      initialClassId={pendingReportStudent?.classId}
                      onClearInitialStudent={() => setPendingReportStudent(null)}
                      onUpdateAttendance={handleUpdateAttendance}
                      onSaveAttendance={handleSaveAttendance}
                      onNavigateTab={setCurrentTab}
                      onSelectAssignmentForAttendance={(assignment) => {
                        setPendingAttendanceAssignment(assignment);
                        setCurrentTab('attendance');
                      }}
                    />
                  )}
                  {currentTab === 'profile' && (
                    <TeacherProfileView
                      currentUser={teacherUser}
                      onUpdateProfile={handleUpdateTeacherProfile}
                      showToast={showToast}
                    />
                  )}
                </>
              )}

              {/* Student Views */}
              {currentUser.role === 'student' && (
                <>
                  {(currentTab === 'dashboard' || !['student-info', 'daily-attendance', 'monthly-attendance'].includes(currentTab)) && (
                    <StudentDashboardView
                      currentStudent={studentUser}
                      attendanceLogs={currentYearAttendanceLogs}
                      subjects={currentYearSubjects}
                      classes={currentYearClasses}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      activeYear={activeYear}
                      settings={settings}
                      onNavigateTab={setCurrentTab}
                    />
                  )}
                  {currentTab === 'student-info' && (
                    <StudentInfoView
                      currentStudent={studentUser}
                      classes={currentYearClasses}
                      subjects={currentYearSubjects}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      activeYear={activeYear}
                      settings={settings}
                    />
                  )}
                  {currentTab === 'daily-attendance' && (
                    <StudentDailyAttendanceView
                      currentStudent={studentUser}
                      attendanceLogs={currentYearAttendanceLogs}
                      subjects={currentYearSubjects}
                      periods={currentYearPeriods}
                      classes={currentYearClasses}
                      activeYear={activeYear}
                      settings={settings}
                    />
                  )}
                  {currentTab === 'monthly-attendance' && (
                    <StudentMonthlyAttendanceView
                      currentStudent={studentUser}
                      attendanceLogs={currentYearAttendanceLogs}
                      subjects={currentYearSubjects}
                      classes={currentYearClasses}
                      teachers={users.filter((u) => u.role === 'teacher')}
                      activeYear={activeYear}
                      settings={settings}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation Bar (as requested: "เฉพาะเมื่อ responsive mobile เท่านั้น เพิ่มแสดง menu mobile navigation bar (กรอบพื้นหลังลอยมุมโครงมน)") */}
      <MobileNavBar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        role={currentUser.role}
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
      />

      {/* Global Footer (as requested: "5.footer ระบบเช็คชื่อนักเรียนสำหรับรายวิชา ชื่อโรงเรียน(ดึงข้อมูล) โดย รองฯภัทรธีระ ประทุมเม") */}
      <Footer schoolName={settings.schoolName} />

      {/* SweetAlert Confirm Modal */}
      <SweetConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Toast Alert Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
