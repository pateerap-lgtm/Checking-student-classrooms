import React from 'react';

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-slate-200 rounded-md w-24"></div>
            <div className="w-10 h-10 rounded-xl bg-slate-200"></div>
          </div>
          <div className="h-8 bg-slate-200 rounded-lg w-16 mb-3"></div>
          <div className="h-3 bg-slate-100 rounded-full w-full"></div>
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs animate-pulse">
      <div className="flex justify-between items-center mb-6">
        <div className="h-6 bg-slate-200 rounded-md w-48"></div>
        <div className="h-9 bg-slate-200 rounded-xl w-32"></div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-5 gap-4 pb-3 border-b border-slate-100">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 bg-slate-200 rounded-md"></div>
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid grid-cols-5 gap-4 py-2 border-b border-slate-50">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-4 bg-slate-100 rounded-md"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs animate-pulse">
      <div className="h-5 bg-slate-200 rounded-md w-40 mb-6"></div>
      <div className="h-64 bg-slate-100 rounded-xl flex items-end justify-between p-4 gap-2">
        <div className="w-10 bg-slate-200 rounded-t h-40"></div>
        <div className="w-10 bg-slate-200 rounded-t h-56"></div>
        <div className="w-10 bg-slate-200 rounded-t h-32"></div>
        <div className="w-10 bg-slate-200 rounded-t h-48"></div>
        <div className="w-10 bg-slate-200 rounded-t h-28"></div>
        <div className="w-10 bg-slate-200 rounded-t h-52"></div>
      </div>
    </div>
  );
};
