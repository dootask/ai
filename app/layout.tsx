import { MainLayout } from '@/app/main';
import { AppSidebar } from '@/components/app-sidebar';
import ProtectedRoute from '@/components/protected-route';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppProvider } from '@/contexts/app-context';
import { DootaskProvider } from '@/contexts/dootask-context';
import type { Metadata } from 'next';

import { headers } from "next/headers";
import './globals.css';


export const metadata: Metadata = {
  title: 'DooTask AI 智能体管理',
  description: 'DooTask AI 智能体插件管理系统',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const theme = headersList.get("x-theme") || undefined

  return (
    <html lang="zh-CN" className={theme} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body >
        <AppProvider>
          <DootaskProvider>
            <ProtectedRoute>
              <SidebarProvider>
                <div className="flex h-screen w-full">
                  <AppSidebar />
                  <MainLayout>{children}</MainLayout>
                </div>
              </SidebarProvider>
            </ProtectedRoute>
          </DootaskProvider>
        </AppProvider>
      </body>
    </html>
  );
}
