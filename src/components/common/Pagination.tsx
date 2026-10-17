import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 40,
  onPageChange,
  className = '',
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div
      className={`p-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 ${className}`}
    >
      {/* Item range count */}
      <div className="flex items-center gap-2 text-slate-500 font-medium">
        <span>
          แสดงรายการที่ <strong className="text-slate-800">{startItem}</strong> -{' '}
          <strong className="text-slate-800">{endItem}</strong> จากทั้งหมด{' '}
          <strong className="text-[#0C7C82]">{totalItems}</strong> รายการ
        </span>
        <span className="hidden sm:inline text-slate-300">|</span>
        <span className="hidden sm:inline text-[11px] bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded-md">
          {itemsPerPage} รายการต่อหน้า
        </span>
      </div>

      {/* Page Navigation Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-[#0C7C82] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="หน้าแรก"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-[#0C7C82] disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer font-medium"
            title="หน้าก่อนหน้า"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden md:inline">ก่อนหน้า</span>
          </button>

          {/* Page Number Buttons */}
          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`dots-${idx}`} className="px-2 py-1 text-slate-400 select-none">
                    ...
                  </span>
                );
              }

              const pageNum = p as number;
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                    isActive
                      ? 'bg-[#0C7C82] text-white shadow-xs'
                      : 'border border-slate-200 text-slate-600 hover:bg-white hover:text-[#0C7C82]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-[#0C7C82] disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer font-medium"
            title="หน้าถัดไป"
          >
            <span className="hidden md:inline">ถัดไป</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-[#0C7C82] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="หน้าสุดท้าย"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
