import * as XLSX from 'xlsx';

export function exportToExcel(data: Record<string, any>[], fileName: string, sheetName: string = 'Sheet1') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function parseExcelFile<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', codepage: 65001 });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<T>(worksheet, { defval: '' });
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

export function downloadPeriodTemplate() {
  const sampleData = [
    { 'ชื่อคาบ': 'คาบที่ 1', 'เวลาเริ่มต้น': '08:30', 'เวลาสิ้นสุด': '09:20', 'พักเที่ยง(ใช่/ไม่ใช่)': 'ไม่ใช่' },
    { 'ชื่อคาบ': 'คาบที่ 2', 'เวลาเริ่มต้น': '09:20', 'เวลาสิ้นสุด': '10:10', 'พักเที่ยง(ใช่/ไม่ใช่)': 'ไม่ใช่' },
    { 'ชื่อคาบ': 'คาบที่ 3', 'เวลาเริ่มต้น': '10:10', 'เวลาสิ้นสุด': '11:00', 'พักเที่ยง(ใช่/ไม่ใช่)': 'ไม่ใช่' },
    { 'ชื่อคาบ': 'พักกลางวัน', 'เวลาเริ่มต้น': '11:00', 'เวลาสิ้นสุด': '12:00', 'พักเที่ยง(ใช่/ไม่ใช่)': 'ใช่' },
    { 'ชื่อคาบ': 'คาบที่ 4', 'เวลาเริ่มต้น': '12:30', 'เวลาสิ้นสุด': '13:20', 'พักเที่ยง(ใช่/ไม่ใช่)': 'ไม่ใช่' },
  ];
  exportToExcel(sampleData, 'แบบฟอร์มนำเข้า_คาบสอน', 'คาบสอน');
}

export function downloadClassTemplate() {
  const sampleData = [
    { 'ชื่อชั้นเรียน': 'ม.1/1', 'สีHEX': '#0C7C82' },
    { 'ชื่อชั้นเรียน': 'ม.1/2', 'สีHEX': '#35B4B0' },
    { 'ชื่อชั้นเรียน': 'ม.2/1', 'สีHEX': '#26A69A' },
    { 'ชื่อชั้นเรียน': 'ม.3/1', 'สีHEX': '#AED581' },
  ];
  exportToExcel(sampleData, 'แบบฟอร์มนำเข้า_ชั้นเรียน', 'ชั้นเรียน');
}

export function downloadUserTemplate() {
  const sampleData = [
    { 'username': 'teacher_somchai', 'password': 'pass123', 'ชื่อ-นามสกุล': 'นายสมชาย ดีเลิศ', 'บทบาท(ผู้ดูแลระบบ/ผู้บริหาร/ครู)': 'ครู' },
    { 'username': 'admin_wichai', 'password': 'pass123', 'ชื่อ-นามสกุล': 'นายวิชัย สุขใจ', 'บทบาท(ผู้ดูแลระบบ/ผู้บริหาร/ครู)': 'ผู้ดูแลระบบ' },
    { 'username': 'director_surat', 'password': 'pass123', 'ชื่อ-นามสกุล': 'ดร.สุรัตน์ มีเกียรติ', 'บทบาท(ผู้ดูแลระบบ/ผู้บริหาร/ครู)': 'ผู้บริหาร' },
  ];
  exportToExcel(sampleData, 'แบบฟอร์มนำเข้า_ผู้ใช้งาน', 'ผู้ใช้งาน');
}

export function downloadStudentTemplate(className: string = 'ม.1/1') {
  const sampleData = [
    { 'ลำดับที่': 1, 'ชื่อนักเรียน': 'เด็กชายธีรภัทร วงศ์เจริญ', 'username': 'std01', 'password': 'pass123' },
    { 'ลำดับที่': 2, 'ชื่อนักเรียน': 'เด็กหญิงพิมพ์ชนก ศรีสุข', 'username': 'std02', 'password': 'pass123' },
    { 'ลำดับที่': 3, 'ชื่อนักเรียน': 'เด็กชายนพรัตน์ คำดี', 'username': 'std03', 'password': 'pass123' },
    { 'ลำดับที่': 4, 'ชื่อนักเรียน': 'เด็กหญิงกานต์พิชชา สายสมร', 'username': 'std04', 'password': 'pass123' },
    { 'ลำดับที่': 5, 'ชื่อนักเรียน': 'เด็กชายวรพล รักษ์ไทย', 'username': 'std05', 'password': 'pass123' },
  ];
  exportToExcel(sampleData, `แบบฟอร์มนำเข้า_นักเรียน_${className.replace('/', '-')}`, 'นักเรียน');
}

export function downloadSubjectTemplate() {
  const sampleData = [
    { 'รหัสวิชา': 'ว21101', 'ชื่อวิชา': 'วิทยาศาสตร์ 1', 'ประเภทวิชา(พื้นฐาน/เพิ่มเติม/พัฒนาผู้เรียน)': 'พื้นฐาน', 'คาบสอนต่อสัปดาห์': 3 },
    { 'รหัสวิชา': 'ค21101', 'ชื่อวิชา': 'คณิตศาสตร์ 1', 'ประเภทวิชา(พื้นฐาน/เพิ่มเติม/พัฒนาผู้เรียน)': 'พื้นฐาน', 'คาบสอนต่อสัปดาห์': 3 },
    { 'รหัสวิชา': 'ว21201', 'ชื่อวิชา': 'ปัญญาประดิษฐ์เบื้องต้น', 'ประเภทวิชา(พื้นฐาน/เพิ่มเติม/พัฒนาผู้เรียน)': 'เพิ่มเติม', 'คาบสอนต่อสัปดาห์': 2 },
    { 'รหัสวิชา': 'ก21901', 'ชื่อวิชา': 'แนะแนว', 'ประเภทวิชา(พื้นฐาน/เพิ่มเติม/พัฒนาผู้เรียน)': 'พัฒนาผู้เรียน', 'คาบสอนต่อสัปดาห์': 1 },
  ];
  exportToExcel(sampleData, 'แบบฟอร์มนำเข้า_รายวิชา', 'รายวิชา');
}
