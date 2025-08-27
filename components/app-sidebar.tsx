'use client';

import { Bot, Brain, Cpu, Database, Home, MessageSquare, TrendingUp, Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

// 导航菜单配置
const menuGroups = [
  {
    label: '核心功能',
    items: [
      {
        title: '仪表板',
        url: '/dashboard',
        icon: Home,
      },
      {
        title: '智能体管理',
        url: '/agents',
        icon: Bot,
      },
      {
        title: '热门智能体',
        url: '/popular',
        icon: TrendingUp,
      },
      {
        title: '对话监控',
        url: '/conversations',
        icon: MessageSquare,
      },
    ],
  },
  {
    label: '配置管理',
    items: [
      {
        title: 'AI 模型管理',
        url: '/models',
        icon: Cpu,
      },
      {
        title: '知识库',
        url: '/knowledge',
        icon: Database,
      },
      {
        title: 'MCP工具',
        url: '/tools',
        icon: Wrench,
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  // 处理菜单项点击，在移动端自动关闭侧边栏
  const handleMenuItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <Brain className="text-primary h-6 w-6" />
          <h1 className="text-xl font-bold">DooTask AI</h1>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menuGroups.map(group => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url || (item.url !== '/' && pathname.startsWith(item.url))}
                    >
                      <Link href={item.url} onClick={handleMenuItemClick}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}