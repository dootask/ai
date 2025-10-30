'use client';

import { defaultPagination, Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/contexts/app-context';
import { knowledgeBasesApi } from '@/lib/api/knowledge-bases';
import { KnowledgeBase, PaginationBase } from '@/lib/types';
import { getAllAgents } from '@/lib/utils';
import {
  Activity,
  Calendar,
  Database,
  DatabaseIcon,
  Edit,
  Eye,
  FileText,
  MoreHorizontal,
  Plus,
  Trash2,
  TrendingUp,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function KnowledgeBasePage() {
  const { Confirm } = useAppContext();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [pagination, setPagination] = useState<PaginationBase>(defaultPagination);
  const [isLoading, setIsLoading] = useState(true);

  const loadKnowledgeBases = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await knowledgeBasesApi.list({
        page: pagination.current_page,
        page_size: pagination.page_size,
      });
      const formattedKBs = response.data.items.map((kb: KnowledgeBase) => kb);
      setKnowledgeBases(formattedKBs);
      setPagination(response);
    } catch (error) {
      console.error('加载知识库列表失败:', error);
      toast.error('加载知识库列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.current_page, pagination.page_size]);

  // 分页切换
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, current_page: page }));
  };
  // 每页数量切换
  const handlePageSizeChange = (size: number) => {
    setPagination(prev => ({ ...prev, page_size: size, current_page: 1 }));
  };

  useEffect(() => {
    loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  const handleToggleActive = async (kbId: number, isActive: boolean) => {
    try {
      // 乐观更新：先更新UI状态
      setKnowledgeBases(prevKBs => prevKBs.map(kb => (kb.id === kbId ? { ...kb, is_active: isActive, isActive } : kb)));

      // 后端更新
      const updatedKB = await knowledgeBasesApi.update(kbId, { is_active: isActive });

      // 确认更新：用服务器返回的数据更新状态
      setKnowledgeBases(prevKBs => prevKBs.map(kb => (kb.id === kbId ? updatedKB : kb)));

      toast.success(isActive ? '知识库已启用' : '知识库已停用');
    } catch (error) {
      console.error('更新知识库状态失败:', error);

      // 错误回滚：恢复原始状态
      setKnowledgeBases(prevKBs =>
        prevKBs.map(kb => (kb.id === kbId ? { ...kb, is_active: !isActive, isActive: !isActive } : kb))
      );

      toast.error('更新知识库状态失败');
    }
  };

  const handleDeleteKB = async (kbId: number) => {
    try {
      // 使用getAllAgents确保检查所有智能体的关联关系
      const allAgents = await getAllAgents();
      const usingAgents = allAgents.filter(agent => {
        try {
          let kbIds: number[] = [];
          if (typeof agent.knowledge_bases === 'string') {
            kbIds = JSON.parse(agent.knowledge_bases);
          } else if (Array.isArray(agent.knowledge_bases)) {
            kbIds = agent.knowledge_bases.map((kb: unknown) => (typeof kb === 'number' ? kb : parseInt(String(kb))));
          }
          return kbIds.includes(kbId);
        } catch {
          return false;
        }
      });

      if (usingAgents.length > 0) {
        const agentNames = usingAgents.map(agent => agent.name).join('、');
        const confirmed = await Confirm({
          title: '确认删除知识库',
          message: `该知识库正在被 ${usingAgents.length} 个智能体使用：${agentNames}。\n\n删除后这些智能体将无法访问该知识库的内容。是否继续删除？`,
          variant: 'destructive',
        });

        if (!confirmed) {
          return;
        }
      } else {
        const confirmed = await Confirm({
          title: '确认删除知识库',
          message: '此操作将永久删除该知识库及其所有文档。此操作无法撤销。',
          variant: 'destructive',
        });

        if (!confirmed) {
          return;
        }
      }

      await knowledgeBasesApi.delete(kbId);
      setKnowledgeBases(kbs => kbs.filter(kb => kb.id !== kbId));

      if (usingAgents.length > 0) {
        toast.success(`知识库已删除，${usingAgents.length} 个智能体的关联已自动解除`);
      } else {
        toast.success('知识库已删除');
      }
    } catch (error) {
      console.error('删除知识库失败:', error);
      toast.error('删除知识库失败，请重试');
    }
  };

  const getEmbeddingModelBadge = (model: string) => {
    switch (model) {
      case 'text-embedding-ada-002':
        return (
          <Badge variant="default" className="text-xs">
            OpenAI Ada
          </Badge>
        );
      case 'text-embedding-3-small':
        return (
          <Badge variant="secondary" className="text-xs">
            OpenAI Small
          </Badge>
        );
      case 'text-embedding-3-large':
        return (
          <Badge variant="outline" className="text-xs">
            OpenAI Large
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {model}
          </Badge>
        );
    }
  };

  // 统计数据
  const stats = {
    total: knowledgeBases.length,
    active: knowledgeBases.filter(kb => kb.is_active).length,
    totalDocuments: knowledgeBases.reduce((sum, kb) => sum + (kb.documents_count || 0), 0),
    embeddingModels: [...new Set(knowledgeBases.map(kb => kb.embedding_model))].length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-2">
              <DatabaseIcon className="text-primary h-8 w-8" />
              <h1 className="text-3xl font-bold tracking-tight">知识库管理</h1>
            </div>
            <p className="text-muted-foreground">管理 AI 智能体的知识库和文档</p>
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
          <div className="flex items-center gap-2 mb-2">
            <DatabaseIcon className="text-primary h-8 w-8" />
            <h1 className="text-3xl font-bold tracking-tight">知识库管理</h1>
          </div>
          <p className="text-muted-foreground">管理 AI 智能体的知识库和文档</p>
        </div>
        <Button asChild>
          <Link href="/knowledge/create">
            <Plus className="mr-2 h-4 w-4" />
            创建知识库
          </Link>
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">知识库总数</CardTitle>
            <Database className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-muted-foreground text-xs">已创建知识库</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃知识库</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-muted-foreground text-xs">已启用知识库</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总文档数</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments.toLocaleString()}</div>
            <p className="text-muted-foreground text-xs">所有文档总数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">嵌入模型</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.embeddingModels}</div>
            <p className="text-muted-foreground text-xs">使用的模型数量</p>
          </CardContent>
        </Card>
      </div>

      {knowledgeBases.length === 0 ? (
        <Card className="p-12 text-center">
          <Database className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">还没有知识库</h3>
          <p className="text-muted-foreground mb-4">创建您的第一个知识库来存储 AI 参考资料</p>
          <Button asChild>
            <Link href="/knowledge/create">
              <Plus className="mr-2 h-4 w-4" />
              创建知识库
            </Link>
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {knowledgeBases.map(kb => {
              const isActive = kb.is_active || false;

              return (
                <Card key={kb.id} className="group transition-all duration-200 hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1 rounded-lg p-2 ${isActive ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}
                        >
                          <Database
                            className={`h-5 w-5 ${
                              isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                            }`}
                          />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{kb.name}</CardTitle>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {getEmbeddingModelBadge(kb.embedding_model || '')}
                            {isActive ? (
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
                            <Link href={`/knowledge/${kb.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              查看详情
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/knowledge/${kb.id}?tab=documents`}>
                              <Upload className="mr-2 h-4 w-4" />
                              上传文档
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/knowledge/${kb.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteKB(kb.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="mt-2 text-sm">{kb.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col justify-end space-y-4 pt-0">
                    {/* 启用/禁用开关 */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">状态</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
                          {isActive ? '运行中' : '已停用'}
                        </span>
                        <Switch
                          checked={isActive}
                          onCheckedChange={(checked: boolean) => handleToggleActive(kb.id, checked)}
                        />
                      </div>
                    </div>

                    {/* 统计信息 */}
                    <div className="bg-muted/50 space-y-2 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="text-muted-foreground h-4 w-4" />
                          <span className="text-sm font-medium">文档数量</span>
                        </div>
                        <Badge variant="secondary">{kb.documents_count || 0}</Badge>
                      </div>

                      {/* 时间信息 */}
                      <div className="text-muted-foreground space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>创建：{new Date(kb.created_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                        {kb.updated_at && kb.updated_at !== kb.created_at && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>更新：{new Date(kb.updated_at).toLocaleDateString('zh-CN')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link href={`/knowledge/${kb.id}`}>
                          <Eye className="mr-1 h-3 w-3" />
                          查看
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link href={`/knowledge/${kb.id}/edit`}>
                          <Edit className="mr-1 h-3 w-3" />
                          编辑
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
