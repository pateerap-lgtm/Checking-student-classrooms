import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  SystemSettings,
  AcademicYear,
  Period,
  Classroom,
  AppUser,
  Student,
  Subject,
  TeachingAssignment,
  AttendanceLog
} from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    }
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'settings', 'config'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing.');
    }
  }
}

// Default initial system settings
export const DEFAULT_SETTINGS: SystemSettings = {
  schoolName: 'โรงเรียนอนุบาลศรีสุทโธ',
  affiliationName: 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาอุดรธานี เขต 3',
  logoUrl: '',
  directorName: 'ดร.สุรัตน์ มีเกียรติ',
};

// Clean empty defaults
export const DEFAULT_ACADEMIC_YEARS: AcademicYear[] = [];
export const DEFAULT_PERIODS: Period[] = [];
export const DEFAULT_CLASSES: Classroom[] = [];

// Single master admin account for initial login if no users exist
export const DEFAULT_USERS: AppUser[] = [
  { id: 'u_admin', username: 'admin', password: 'admin123', fullName: 'ผู้ดูแลระบบ', role: 'admin' },
];

export const DEFAULT_STUDENTS: Student[] = [];
export const DEFAULT_SUBJECTS: Subject[] = [];
export const DEFAULT_ASSIGNMENTS: TeachingAssignment[] = [];

/**
 * Initialize system without deleting existing data.
 * Keeps all data in the database permanently across reboots and reloads.
 */
export async function initSystem() {
  try {
    // Only create admin if appUsers collection is completely empty
    const userSnap = await getDocs(collection(db, 'appUsers'));
    if (userSnap.empty) {
      await setDoc(doc(db, 'appUsers', 'u_admin'), {
        id: 'u_admin',
        username: 'admin',
        password: 'admin123',
        fullName: 'ผู้ดูแลระบบ',
        role: 'admin'
      });
      console.log('Initialized master admin account.');
    }

    // Only create default settings if settings collection is completely empty
    const settingsSnap = await getDocs(collection(db, 'settings'));
    if (settingsSnap.empty) {
      await setDoc(doc(db, 'settings', 'config'), DEFAULT_SETTINGS);
      console.log('Initialized default system settings.');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'initSystem');
  }
}

/**
 * Manual purge action: called ONLY when the administrator explicitly
 * clicks "ลบข้อมูลทั้งหมด" in System Settings and confirms.
 */
export async function purgeAllSampleData() {
  try {
    const collectionsToPurge = [
      'students',
      'subjects',
      'assignments',
      'attendance',
      'classes',
      'periods',
      'academicYears'
    ];

    for (const colName of collectionsToPurge) {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        console.log(`Purged all documents from Firestore collection: ${colName}`);
      }
    }

    // Purge appUsers except 'admin'
    const userSnap = await getDocs(collection(db, 'appUsers'));
    const userBatch = writeBatch(db);
    let hasAdmin = false;

    userSnap.forEach((d) => {
      const data = d.data() as AppUser;
      if (data.username === 'admin') {
        hasAdmin = true;
      } else {
        userBatch.delete(d.ref);
      }
    });

    // Ensure master admin exists
    if (!hasAdmin) {
      userBatch.set(doc(db, 'appUsers', 'u_admin'), {
        id: 'u_admin',
        username: 'admin',
        password: 'admin123',
        fullName: 'ผู้ดูแลระบบ',
        role: 'admin'
      });
    }

    await userBatch.commit();
    console.log('Sample users purged. Master admin account retained.');

    // Ensure settings doc exists
    const settingsSnap = await getDocs(collection(db, 'settings'));
    if (settingsSnap.empty) {
      await setDoc(doc(db, 'settings', 'config'), DEFAULT_SETTINGS);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'purgeAllSampleData');
  }
}
