import React from 'react';

interface FooterProps {
  schoolName: string;
}

export const Footer: React.FC<FooterProps> = ({ schoolName }) => {
  return (
    <footer className="w-full bg-white border-t border-slate-100 py-4 px-6 text-center text-xs text-slate-500 shadow-xs no-print">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#0C7C82]"></span>
          <span>ระบบเช็คชื่อนักเรียนสำหรับรายวิชา {schoolName || 'โรงเรียนอนุบาลศรีสุทโธ'}</span>
        </div>
        <div className="text-slate-600 font-medium">
          พัฒนาโดย <span className="text-[#0C7C82] font-semibold">รองฯภัทรธีระ ประทุมเม</span>
        </div>
      </div>
    </footer>
  );
};
