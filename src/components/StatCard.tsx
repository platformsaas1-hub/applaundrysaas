import React from 'react';

interface StatCardProps {
  id: string;
  title: string;
  value: string | number;
  subtext: string;
  trend?: string;
  trendPositive?: boolean;
  metricType?: string;
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  id,
  title,
  value,
  subtext,
  trend,
  trendPositive = true,
  metricType,
  icon
}) => {
  return (
    <div id={id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <div>
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
          {icon && <div className="text-slate-400">{icon}</div>}
        </div>
        <div className="text-2xl font-extrabold tracking-tight mt-2 text-slate-800 font-sans">
          {value}
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2 shrink-0">
        <span className="text-[11px] text-slate-400 font-medium">{subtext}</span>
        {trend && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            trendPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
};
