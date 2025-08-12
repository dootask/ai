'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth > 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  return (
    <main className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background p-4 md:hidden">
        <SidebarTrigger />
        <h1 className="text-lg font-semibold">DooTask AI</h1>
      </div>
      <div className={`flex-1 ${isLargeScreen ? 'py-6' : ''}`}>{children}</div>
    </main>
  );
}