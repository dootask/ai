'use client';

import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/contexts/app-context';
import { toolCategories, toolPermissions, toolTypes } from '@/lib/ai';
import { mcpToolsApi } from '@/lib/api/mcp-tools';
import { MCPTool } from '@/lib/types';
import { getAllAgents } from '@/lib/utils';
import {
  Activity,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ToolsPage() {
  const [, setTools] = useState<MCPTool[]>([]);
  const [filteredTools, setFilteredTools] = useState<MCPTool[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    current_page: 1,
    page_size: 12,
    total_items: 0,
    total_pages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [shouldFetch, setShouldFetch] = useState(true);

  const { Confirm } = useAppContext();

  const loadTools = async () => {
    setIsLoading(true);
    try {
      const response = await mcpToolsApi.list();
      setTools(response.data.items);
      setFilteredTools(response.data.items);
    } catch (error) {
      console.error('Failed to load tools:', error);
      toast.error('加载工具列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, []);

  // keyword输入防抖
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 搜索条件变化时重置分页
  useEffect(() => {
    if (pagination.current_page !== 1) {
      setShouldFetch(false); // 暂停请求
      setPagination(prev => ({ ...prev, current_page: 1 }));
    } else {
      setShouldFetch(true); // 允许请求
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, debouncedSearchQuery]);

  // 分页+搜索加载工具
  useEffect(() => {
    if (!shouldFetch) {
      setShouldFetch(true); // 下次允许请求
      return;
    }
    const load = async () => {
      setIsLoading(true);
      try {
        const filters: Record<string, unknown> = {};
        if (selectedCategory !== 'all') filters.category = selectedCategory;
        if (debouncedSearchQuery.trim()) filters.search = debouncedSearchQuery.trim();
        const response = await mcpToolsApi.list({
          page: pagination.current_page,
          page_size: pagination.page_size,
          filters,
        });
        setTools(response.data.items);
        setFilteredTools(response.data.items);
        setPagination({
          current_page: response.current_page,
          page_size: response.page_size,
          total_items: response.total_items,
          total_pages: response.total_pages,
        });
      } catch (error) {
        console.error('加载工具列表失败:', error);
        toast.error('加载工具列表失败');
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current_page, pagination.page_size, selectedCategory, debouncedSearchQuery]);

  // 分页切换
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, current_page: page }));
  };
  // 每页数量切换
  const handlePageSizeChange = (size: number) => {
    setPagination(prev => ({ ...prev, page_size: size, current_page: 1 }));
  };

  const handleToggleActive = async (toolId: string, isActive: boolean) => {
    try {
      // 乐观更新：先更新UI状态
      setTools(prevTools => prevTools.map(tool => (tool.id === toolId ? { ...tool, isActive } : tool)));

      // 后端更新
      const updatedTool = await mcpToolsApi.toggle(toolId, isActive);

      // 确认更新：用服务器返回的数据更新状态
      setTools(prevTools => prevTools.map(tool => (tool.id === toolId ? updatedTool : tool)));

      toast.success(isActive ? '工具已启用' : '工具已停用');
    } catch (error) {
      console.error('Failed to toggle tool status:', error);

      // 错误回滚：恢复原始状态
      setTools(prevTools => prevTools.map(tool => (tool.id === toolId ? { ...tool, isActive: !isActive } : tool)));

      toast.error('更新工具状态失败');
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    try {
      // 使用getAllAgents确保检查所有智能体的关联关系
      const allAgents = await getAllAgents();
      const usingAgents = allAgents.filter(agent => {
        try {
          let toolIds: string[] = [];
          if (typeof agent.tools === 'string') {
            toolIds = JSON.parse(agent.tools);
          } else if (Array.isArray(agent.tools)) {
            toolIds = agent.tools.map(tool => (typeof tool === 'string' ? tool : tool.toString()));
          }
          return toolIds.includes(toolId);
        } catch {
          return false;
        }
      });

      if (usingAgents.length > 0) {
        const agentNames = usingAgents.map(agent => agent.name).join('、');
        const confirmed = await Confirm({
          title: '确认删除MCP工具',
          message: `该工具正在被 ${usingAgents.length} 个智能体使用：${agentNames}。\n\n删除后这些智能体将无法使用该工具的功能。是否继续删除？`,
          variant: 'destructive',
        });

        if (!confirmed) {
          return;
        }
      } else {
        const confirmed = await Confirm({
          title: '确认删除MCP工具',
          message: '此操作将永久删除该工具及其配置。此操作无法撤销。',
          variant: 'destructive',
        });

        if (!confirmed) {
          return;
        }
      }

      await mcpToolsApi.delete(toolId);
      setTools(prevTools => prevTools.filter(tool => tool.id !== toolId));

      if (usingAgents.length > 0) {
        toast.success(`工具已删除，${usingAgents.length} 个智能体的关联已自动解除`);
      } else {
        toast.success('工具已删除');
      }
    } catch (error) {
      console.error('删除工具失败:', error);
      toast.error('删除工具失败，请重试');
    }
  };

  const getCategoryBadge = (category: string) => {
    const categoryOption = toolCategories.find(item => item.value === category);
    if (categoryOption) {
      return (
        <Badge variant="default" className={`${categoryOption.color} text-xs`}>
          {categoryOption.label}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {category}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeOption = toolTypes.find(item => item.value === type);
    if (typeOption) {
      return (
        <Badge variant={typeOption.variant} className="text-xs">
          {typeOption.shortLabel}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {type}
      </Badge>
    );
  };

  const getSuccessRateBadge = (successRate: number) => {
    if (successRate >= 0.95) {
      return (
        <Badge variant="default" className="bg-green-100 text-xs text-green-800">
          优秀
        </Badge>
      );
    } else if (successRate >= 0.8) {
      return (
        <Badge variant="default" className="bg-yellow-100 text-xs text-yellow-800">
          良好
        </Badge>
      );
    } else {
      return (
        <Badge variant="default" className="bg-red-100 text-xs text-red-800">
          需优化
        </Badge>
      );
    }
  };

  // 统计数据
  const stats = {
    total: filteredTools.length,
    active: filteredTools.filter(tool => tool.isActive).length,
    totalCalls: filteredTools.reduce((sum, tool) => sum + (tool.statistics?.totalCalls || 0), 0),
    avgResponseTime:
      filteredTools.length > 0
        ? filteredTools.reduce((sum, tool) => sum + (tool.statistics?.averageResponseTime || 0), 0) /
          filteredTools.length
        : 0,
  };

  // category切换时重置页码和搜索框
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPagination(prev => ({ ...prev, current_page: 1 }));
    setSearchQuery('');
    setDebouncedSearchQuery('');
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">MCP 工具管理</h1>
            <p className="text-muted-foreground">管理智能体可使用的 MCP 工具</p>
          </div>
        </div>
        {/* 统计概览骨架屏 */}
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="bg-muted h-4 w-20 animate-pulse rounded"></div>
                <div className="bg-muted h-4 w-4 animate-pulse rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted h-8 w-16 animate-pulse rounded"></div>
                <div className="bg-muted mt-1 h-3 w-24 animate-pulse rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* 筛选区域骨架屏 */}
        <Card>
          <CardHeader>
            <div className="bg-muted h-5 w-24 animate-pulse rounded"></div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted h-10 w-full animate-pulse rounded"></div>
          </CardContent>
        </Card>
        {/* 卡片骨架屏 */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="bg-muted h-5 w-32 animate-pulse rounded"></div>
                <div className="bg-muted h-4 w-48 animate-pulse rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="bg-muted h-4 w-24 animate-pulse rounded"></div>
                  <div className="bg-muted h-3 w-36 animate-pulse rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* 分页骨架屏 */}
        <div className="mt-6 flex justify-center">
          <div className="bg-muted h-10 w-48 animate-pulse rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">MCP 工具管理</h1>
          <p className="text-muted-foreground">管理智能体可使用的 MCP 工具</p>
        </div>
        <Button asChild>
          <Link href="/tools/create">
            <Plus className="mr-2 h-4 w-4" />
            添加工具
          </Link>
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">工具总数</CardTitle>
            <Wrench className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-muted-foreground text-xs">活跃: {stats.active}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总调用次数</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCalls.toLocaleString()}</div>
            <p className="text-muted-foreground text-xs">所有工具累计</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResponseTime.toFixed(1)}s</div>
            <p className="text-muted-foreground text-xs">工具处理时间</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">整体状态</CardTitle>
            <CheckCircle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">正常</div>
            <p className="text-muted-foreground text-xs">所有工具运行正常</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            筛选工具
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="min-w-0 flex-1 sm:min-w-[200px]">
              <Label htmlFor="category">工具类别</Label>
              <Tabs value={selectedCategory} onValueChange={handleCategoryChange} className="mt-2">
                <TabsList className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <TabsTrigger value="all">全部</TabsTrigger>
                  {toolCategories.map(category => (
                    <TabsTrigger key={category.value} value={category.value}>
                      {category.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="min-w-0 flex-1 sm:min-w-[200px]">
              <Label htmlFor="search">搜索工具</Label>
              <div className="relative mt-2">
                <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="搜索工具名称或描述..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredTools.length === 0 && !isLoading ? (
        <Card className="p-12 text-center">
          <Wrench className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">没有找到工具</h3>
          <p className="text-muted-foreground">请尝试调整筛选条件或搜索关键词</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map(tool => (
              <Card key={tool.id} className="group transition-all duration-200 hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-2 ${tool.isActive ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}
                      >
                        <Wrench
                          className={`h-5 w-5 ${
                            tool.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                          }`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{tool.name}</CardTitle>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {getCategoryBadge(tool.category)}
                          {getTypeBadge(tool.type)}
                          {tool.isActive ? (
                            <Badge variant="default" className="bg-green-100 text-xs text-green-800">
                              运行中
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              已停用
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/tools/${tool.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/tools/${tool.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            修改
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => handleDeleteTool(tool.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="mt-2 text-sm">{tool.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col justify-end space-y-4 pt-0">
                  {/* 启用/禁用开关 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">状态</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${tool.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                        {tool.isActive ? '运行中' : '已停用'}
                      </span>
                      <Switch
                        checked={tool.isActive}
                        onCheckedChange={(checked: boolean) => handleToggleActive(tool.id, checked)}
                      />
                    </div>
                  </div>

                  {/* 统计信息和权限 */}
                  <div className="bg-muted/50 space-y-3 rounded-lg p-3">
                    {/* 统计信息 */}
                    {tool.statistics && tool.isActive && (
                      <div className="border-muted-foreground/10 grid grid-cols-2 gap-3 border-b pb-2">
                        <div className="text-center">
                          <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1">
                            <Activity className="h-3 w-3" />
                            <span className="text-xs">今日调用</span>
                          </div>
                          <p className="text-sm font-semibold">{tool.statistics.todayCalls}</p>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground mb-1 flex items-center justify-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            <span className="text-xs">成功率</span>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <p className="text-sm font-semibold">{(tool.statistics.successRate * 100).toFixed(0)}%</p>
                            {getSuccessRateBadge(tool.statistics.successRate)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 权限信息 */}
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs">权限等级</p>
                      <div className="flex flex-wrap gap-1">
                        {tool.permissions.slice(0, 2).map(permission => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {toolPermissions.find((item: { value: string; label: string }) => item.value === permission)
                              ?.label || permission}
                          </Badge>
                        ))}
                        {tool.permissions.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{tool.permissions.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/tools/${tool.id}`}>
                        <Eye className="mr-1 h-3 w-3" />
                        详情
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/tools/${tool.id}/edit`}>
                        <Edit className="mr-1 h-3 w-3" />
                        编辑
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination
            currentPage={pagination.current_page}
            totalPages={pagination.total_pages}
            pageSize={pagination.page_size}
            totalItems={pagination.total_items}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}
    </div>
  );
}
