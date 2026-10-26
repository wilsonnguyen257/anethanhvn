import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => {
  return (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`}></div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-slate-100 rounded-2xl border border-slate-200/80 overflow-hidden">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-6">
        <Skeleton className="h-6 w-3/4 mb-4" />
        <div className="space-y-2 mb-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full mt-2" />
      </div>
    </div>
  );
};

export const ListSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-100 rounded-xl border border-slate-200/80">
      <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-5 w-1/3 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
};

export const GallerySkeleton: React.FC = () => {
  return (
    <div className="h-[200px] rounded-2xl overflow-hidden border border-slate-200">
      <Skeleton className="w-full h-full rounded-none" />
    </div>
  );
};
