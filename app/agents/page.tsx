'use client';

import { defaultPagination, Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/contexts/app-context';
import { agentsApi, formatAgentForUI, parseAgentJSONBFields } from '@/lib/api/agents';
import { Agent, PaginationBase } from '@/lib/types';
import { Activity, Bot, BotIcon, Edit, Eye, MessageSquare, MoreHorizontal, Plus, Settings, Trash2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function AgentsPage() {
  const { Confirm } = useAppContext();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pagination, setPagination] = useState<PaginationBase>(defaultPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    autoAssignMCP: true,
  });

  const handleSaveSettings = async () => {
    toast.success('设置已保存');
    await agentsApi.setSettings(settings);
    setIsSettingsOpen(false);
  };


  // 加载智能体列表
  const loadAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const settingsResponse = await agentsApi.getSettings();
      console.log(settingsResponse);
      setSettings(prevSettings => ({
        ...prevSettings,
        autoAssignMCP: settingsResponse.autoAssignMCP === '0' ? false : true,
      }));
      const response = await agentsApi.list({
        page: pagination.current_page,
        page_size: pagination.page_size,
      });
      const formattedAgents = response.data.items.map((agent: Agent) => {
        const parsedAgent = parseAgentJSONBFields(agent);
        return formatAgentForUI(parsedAgent);
      });
      setAgents(formattedAgents);
      setPagination(response);
    } catch (error) {
      console.error('加载智能体列表失败:', error);
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.current_page, pagination.page_size]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleToggleActive = async (agentId: number, isActive: boolean) => {
    try {
      // 乐观更新：先更新UI状态
      setAgents(prevAgents =>
        prevAgents.map(agent => (agent.id === agentId ? { ...agent, is_active: isActive } : agent))
      );

      // 后端更新
      const updatedAgent = await agentsApi.toggle(agentId, isActive);
      const formattedAgent = formatAgentForUI(parseAgentJSONBFields(updatedAgent));

      // 确认更新：用服务器返回的数据更新状态
      setAgents(prevAgents => prevAgents.map(agent => (agent.id === agentId ? formattedAgent : agent)));

      toast.success(isActive ? '智能体已启用' : '智能体已停用');
    } catch (error) {
      console.error('切换智能体状态失败:', error);

      // 错误回滚：恢复原始状态
      setAgents(prevAgents =>
        prevAgents.map(agent => (agent.id === agentId ? { ...agent, is_active: !isActive } : agent))
      );

      toast.error('操作失败，请重试');
    }
  };

  const handleDeleteAgent = async (agentId: number) => {
    if (
      await Confirm({
        title: '确认删除智能体',
        message: '此操作将永久删除该智能体及其相关配置。此操作无法撤销。',
        variant: 'destructive',
      })
    ) {
      try {
        await agentsApi.delete(agentId);
        setAgents(agents.filter(agent => agent.id !== agentId));
        toast.success('智能体已删除');
      } catch (error) {
        console.error('删除智能体失败:', error);
        toast.error('删除失败，请重试');
      }
    }
  };

  const getModelBadgeVariant = (model?: string) => {
    switch (model) {
      case 'gpt-4':
        return 'default';
      case 'gpt-3.5-turbo':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // 统计数据
  const stats = {
    total: agents.length,
    active: agents.filter(agent => agent.is_active).length,
    totalMessages: agents.reduce((sum, agent) => sum + (agent.statistics?.total_messages || 0), 0),
    averageResponseTime:
      agents.length > 0
        ? agents.reduce((sum, agent) => sum + (agent.statistics?.average_response_time || 0), 0) / agents.length
        : 0,
  };

  // 分页切换
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, current_page: page }));
  };
  // 每页数量切换
  const handlePageSizeChange = (size: number) => {
    setPagination(prev => ({ ...prev, page_size: size, current_page: 1 }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-2">
              <BotIcon className="text-primary h-8 w-8" />
              <h1 className="text-3xl font-bold tracking-tight">智能体管理</h1>
            </div>
            <p className="text-muted-foreground">管理和配置 AI 智能体</p>
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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mb-2">
              <BotIcon className="text-primary h-8 w-8" />
              <h1 className="text-3xl font-bold tracking-tight">智能体管理</h1>
            </div>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <span
                  role="button"
                  aria-label="设置"
                  className="hover:bg-muted text-muted-foreground inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded"
                >
                  <Settings className="h-4 w-4" />
                </span>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>智能体设置</DialogTitle>
                  <DialogDescription>配置全局智能体相关的默认行为与偏好。</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium leading-none">自动关联dootask mcp</div>
                    </div>
                    <Switch
                      checked={settings.autoAssignMCP}
                      onCheckedChange={(v: boolean) => setSettings(s => ({ ...s, autoAssignMCP: v }))}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="secondary" onClick={() => setIsSettingsOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSaveSettings}>保存</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <p className="text-muted-foreground">管理和配置 AI 智能体</p>
        </div>
        <Button asChild>
          <Link href="/agents/create">
            <Plus className="mr-2 h-4 w-4" />
            创建智能体
          </Link>
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">智能体总数</CardTitle>
            <Bot className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-muted-foreground text-xs">已创建智能体</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃智能体</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-muted-foreground text-xs">已启用智能体</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总对话数</CardTitle>
            <MessageSquare className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
            <p className="text-muted-foreground text-xs">历史消息总数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.averageResponseTime / 1000).toFixed(1)}s</div>
            <p className="text-muted-foreground text-xs">智能体响应时间</p>
          </CardContent>
        </Card>
      </div>

      {agents.length === 0 ? (
        <Card className="p-12 text-center">
          <Bot className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">还没有智能体</h3>
          <p className="text-muted-foreground mb-4">创建您的第一个 AI 智能体来开始</p>
          <Button asChild>
            <Link href="/agents/create">
              <Plus className="mr-2 h-4 w-4" />
              创建智能体
            </Link>
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {agents.map(agent => (
              <Card key={agent.id} className="group transition-all duration-200 hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 rounded-lg p-2 ${agent.is_active ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}
                      >
                        <Bot
                          className={`h-5 w-5 ${
                            agent.is_active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                          }`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge variant={getModelBadgeVariant(agent.ai_model?.name)} className="text-xs">
                            {agent.ai_model?.name || 'unknown'}
                          </Badge>
                          {agent.is_active ? (
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
                          <Link href={`/agents/${agent.id}`} className="flex items-center">
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/agents/${agent.id}/edit`} className="flex items-center">
                            <Edit className="mr-2 h-4 w-4" />
                            编辑
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="mt-2 text-sm">{agent.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-end space-y-4 pt-0">
                  {/* 启用/禁用开关 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">状态</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${agent.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                        {agent.is_active ? '运行中' : '已停用'}
                      </span>
                      <Switch
                        checked={agent.is_active}
                        onCheckedChange={(checked: boolean) => handleToggleActive(agent.id, checked)}
                      />
                    </div>
                  </div>

                  {/* 工具和知识库信息 */}
                  <div className="bg-muted/50 space-y-2 rounded-lg p-3">
                    {agent.tool_names && agent.tool_names.length > 0 ? (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">
                          MCP工具 ({agent.tool_names.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {agent.tool_names
                            .slice(0, 2)
                            .map((tool: string) => (
                              <Badge key={tool} variant="outline" className="text-xs">
                                {tool}
                              </Badge>
                            ))}
                          {agent.tool_names.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{agent.tool_names.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">MCP工具 (0)</p>
                      </div>
                    )}

                    {agent.kb_names && agent.kb_names.length > 0 ? (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">
                          知识库 ({agent.kb_names.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {agent.kb_names
                            .slice(0, 2)
                            .map((kb: string) => (
                              <Badge key={kb} variant="outline" className="text-xs">
                                {kb}
                              </Badge>
                            ))}
                          {agent.kb_names.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{agent.kb_names.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs">知识库 (0)</p>
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/agents/${agent.id}`}>
                        <Eye className="mr-1 h-3 w-3" />
                        查看
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/agents/${agent.id}/edit`}>
                        <Edit className="mr-1 h-3 w-3" />
                        编辑
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      <Pagination
        currentPage={pagination.current_page}
        totalPages={pagination.total_pages}
        pageSize={pagination.page_size}
        totalItems={pagination.total_items}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}
