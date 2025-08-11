import { AppSidebar } from '@/components/app-sidebar';
import ProtectedRoute from '@/components/protected-route';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppProvider } from '@/contexts/app-context';
import { DootaskProvider } from '@/contexts/dootask-context';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DooTask AI 智能体管理',
  description: 'DooTask AI 智能体插件管理系统',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <AppProvider>
          <DootaskProvider>
            <ProtectedRoute>
              <SidebarProvider>
                <div className="flex h-screen w-full">
                  <AppSidebar />
                  <main className="flex flex-1 flex-col">
                    {/* 移动端触发按钮 */}
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white p-4 md:hidden">
                      <SidebarTrigger />
                      <h1 className="text-lg font-semibold">DooTask AI</h1>
                    </div>
                    <div className="flex-1 py-8">{children}</div>
                  </main>
                </div>
              </SidebarProvider>
            </ProtectedRoute>
          </DootaskProvider>
        </AppProvider>
      </body>
    </html>
  );
}
