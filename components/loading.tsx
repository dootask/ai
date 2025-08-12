'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LoadingProps {
  message?: string;
  className?: string;
  delay?: number;
}

export default function Loading({ message = '正在加载...', className, delay = 0 }: LoadingProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (delay === 0) {
      setShow(true);
      return;
    }
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!show) return null;

  return (
    <div className={cn('bg-background flex min-h-screen items-center justify-center', className)}>
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600 dark:border-blue-400"></div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export function LoadingInline({ message, className, delay = 0 }: LoadingProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (delay === 0) {
      setShow(true);
      return;
    }
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!show) return null;

  return (
    <div className={cn('text-muted-foreground flex items-center justify-center gap-2', className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {message && <div>{message}</div>}
    </div>
  );
}

interface FloatingLoadingProps {
  message?: string;
  show?: boolean;
}

export const FloatingLoading = ({ message = '加载中...', show = true }: FloatingLoadingProps) => {
  if (!show) return null;

  return (
    <div className="fixed left-64 right-0 top-0 bottom-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
};

interface InlineLoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const InlineLoading = ({ message = '加载中...', size = 'md' }: InlineLoadingProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className="flex items-center gap-2">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
};
