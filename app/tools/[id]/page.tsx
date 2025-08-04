'use client';

import { Badge } from '@/components/ui/badge';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/contexts/app-context';
import { toolCategories } from '@/lib/ai';
import { agentsApi } from '@/lib/api/agents';
import { mcpToolsApi } from '@/lib/api/mcp-tools';
import { Agent, MCPTool } from '@/lib/types';
import { getAllAgents } from '@/lib/utils';
import { Bot, Edit, Eye, Settings, Trash2, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function MCPToolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { Confirm } = useAppContext();
  const [tool, setTool] = useState<MCPTool | null>(null);
  const [relatedAgents, setRelatedAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTool = async () => {
      setLoading(true);
      try {
        const toolId = params.id as string;
        const toolData = await mcpToolsApi.get(toolId);
        setTool(toolData);

        // 获取关联的智能体
        const agentsResponse = await agentsApi.list({ page: 1, page_size: 100 });
        const usingAgents = agentsResponse.data.items.filter((agent: Agent) => {
          try {
            let toolIds: string[] = [];
            if (typeof agent.tools === 'string') {
              toolIds = JSON.parse(agent.tools);
            } else if (Array.isArray(agent.tools)) {
              toolIds = agent.tools.map((tool: unknown) => (typeof tool === 'string' ? tool : String(tool)));
            }
            return toolIds.includes(toolId);
          } catch {
            return false;
          }
        });
        setRelatedAgents(usingAgents);
      } catch (error) {
        console.error('Failed to load tool:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTool();
  }, [params.id]);

  const handleDelete = async () => {
    if (!tool) return;

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
          return toolIds.includes(tool.id);
        } catch {
          return false;
        }
      });

      if (usingAgents.length > 0) {
        const agentNames = usingAgents.map(agent => agent.name).join('、');
        const confirmed = await Confirm({
          title: '确定要删除这个MCP工具吗？',
          message: `该工具正在被 ${usingAgents.length} 个智能体使用：${agentNames}。\n\n删除后这些智能体将无法使用该工具的功能。是否继续删除？`,
          variant: 'destructive',
        });

        if (!confirmed) {
          return;
        }
      } else {
        const confirmed = await Confirm({
          title: '确定要删除这个MCP工具吗？',
          message: '此操作不可撤销。',
          variant: 'destructive',
        });

        if (!confirmed) {
          return;
        }
      }

      await mcpToolsApi.delete(tool.id);

      if (usingAgents.length > 0) {
        toast.success(`MCP工具删除成功，${usingAgents.length} 个智能体的关联已自动解除`);
      } else {
        toast.success('MCP工具删除成功');
      }

      router.push('/tools');
    } catch (error) {
      console.error('删除工具失败:', error);
      toast.error('删除工具失败，请重试');
    }
  };

  const handleToggleStatus = async (isActive: boolean) => {
    if (!tool) return;

    try {
      const updatedTool = await mcpToolsApi.toggle(tool.id, isActive);
      setTool(updatedTool);
      toast.success(`工具已${isActive ? '启用' : '停用'}`);
    } catch (error) {
      console.error('Failed to toggle tool status:', error);
      toast.error('更新工具状态失败');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <Wrench className="text-muted-foreground mb-4 h-16 w-16" />
        <h2 className="mb-2 text-xl font-semibold">MCP工具不存在</h2>
        <p className="text-muted-foreground mb-4">请检查 URL 是否正确</p>
        <Button asChild>
          <Link href="/tools">返回列表</Link>
        </Button>
      </div>
    );
  }

  const currentCategory = toolCategories.find(category => category.value === tool.category) || {
    label: tool.category,
    color: 'bg-gray-500 text-white',
  };

  const getConfigTypeDisplayName = (configTypeName: string) => {
    switch (configTypeName) {
      case 'streamable_http':
        return 'Streamable HTTP';
      case 'websocket':
        return 'WebSocket';
      case 'sse':
        return 'Server-Sent Events';
      case 'stdio':
        return 'Standard I/O';
      default:
        return configTypeName;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb导航 */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/tools">MCP 工具管理</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{tool.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 页面标题和操作 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className={`mt-1 rounded-lg p-2 ${tool.isActive ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
              <Wrench
                className={`h-5 w-5 ${tool.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{tool.name}</h1>
            <Badge variant={tool.isActive ? 'default' : 'secondary'}>{tool.isActive ? '活跃' : '停用'}</Badge>
            <Badge variant="outline" className="text-xs">
              {currentCategory.label}
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">{tool.description}</p>

        </div>
        <div className="flex gap-3">
          {/* todo: 测试工具 */}
          {/* <Button variant="outline" onClick={testTool} disabled={testing}>
            {testing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                测试中...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                测试工具
              </>
            )}
          </Button> */}
          <Button variant="outline" asChild>
            <Link href={`/tools/${tool.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Link>
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧主要信息 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-muted-foreground text-sm font-medium">工具名称</h4>
                  <p className="text-sm">{tool.name}</p>
                </div>
                <div>
                  <h4 className="text-muted-foreground text-sm font-medium">MCP工具标识</h4>
                  <p className="text-sm font-mono">{tool.mcpName || '-'}</p>
                </div>
                <div>
                  <h4 className="text-muted-foreground text-sm font-medium">工具类别</h4>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${currentCategory.color}`}></div>
                    <p className="text-sm">{currentCategory.label}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-muted-foreground text-sm font-medium">状态</h4>
                  <Badge variant={tool.isActive ? 'default' : 'secondary'}>{tool.isActive ? '活跃' : '停用'}</Badge>
                </div>
                <div>
                  <h4 className="text-muted-foreground text-sm font-medium">创建时间</h4>
                  <p className="text-sm">{new Date(tool.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <h4 className="text-muted-foreground text-sm font-medium">更新时间</h4>
                  <p className="text-sm">{new Date(tool.updatedAt).toLocaleString()}</p>
                </div>
              </div>
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">描述</h4>
                <p className="text-sm leading-relaxed">{tool.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* 配置信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                配置信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 配置类型 */}
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">配置类型</h4>
                <Badge variant="outline">
                  {getConfigTypeDisplayName(tool.configTypeName || 'streamable_http')}
                </Badge>
              </div>

              {/* 配置信息显示 */}
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">配置详情</h4>
                {tool.configJson ? (
                  <div className="rounded-md bg-muted p-3">
                    <pre className="text-xs overflow-auto whitespace-pre-wrap">
                      {tool.configJson}
                    </pre>
                  </div>
                ) : Object.keys(tool.config || {}).length > 0 ? (
                  <div className="rounded-md bg-muted p-3">
                    <pre className="text-xs overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(tool.config, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">暂无配置信息</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 权限设置 */}

        </div>

        {/* 右侧状态和设置 */}
        <div className="space-y-6">
          {/* 状态控制 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">状态信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">工具状态</span>
                <Switch checked={tool.isActive} onCheckedChange={handleToggleStatus} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">关联智能体</span>
                <span className="font-medium">{relatedAgents.length}</span>
              </div>
              {/* todo: 测试工具 */}
              {/* <div className="pt-2">
                <Button onClick={testTool} disabled={testing} className="w-full">
                  {testing ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      测试中...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      测试工具
                    </>
                  )}
                </Button>
              </div> */}
            </CardContent>
          </Card>

          {/* todo: 使用统计, 无法获取使用的具体是哪个工具 */}
          {/* <Card>
            <CardHeader>
              <CardTitle>使用统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">总调用次数</span>
                <span className="text-sm font-medium">{tool.statistics?.totalCalls || 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">今日调用次数</span>
                <span className="text-sm font-medium">{tool.statistics?.todayCalls || 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">平均响应时间</span>
                <span className="text-sm font-medium">{tool.statistics?.averageResponseTime || 0}s</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">成功率</span>
                <span className="text-sm font-medium">
                  {tool.statistics?.successRate ? `${(tool.statistics.successRate * 100).toFixed(1)}%` : '-'}
                </span>
              </div>
            </CardContent>
          </Card> */}

          {/* 关联智能体 */}
          <Card>
            <CardHeader>
              <CardTitle>关联智能体</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {relatedAgents.length > 0 ? (
                  <div className="space-y-3">
                    {relatedAgents.map(agent => (
                      <div key={agent.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-blue-100 p-2">
                            <Bot className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-muted-foreground text-sm">{agent.description || '暂无描述'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/agents/${agent.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/agents/${agent.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground py-4 text-center text-sm">暂无关联的智能体</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 配置指南 */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">使用指南</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
                  <span>定期检查工具的调用统计和成功率</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
                  <span>监控工具的响应时间和错误情况</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
                  <span>根据需要调整工具权限设置</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
                  <span>测试工具连接以确保正常运行</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
