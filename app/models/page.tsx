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
import { getProviderInfo, providerOptions } from '@/lib/ai';
import { aiModelsApi, getModelDisplayName } from '@/lib/api/ai-models';
import { AIModelConfig, PaginationBase } from '@/lib/types';
import { getAllAgents } from '@/lib/utils';
import {
  Activity,
  Bot,
  CheckCircle,
  Cpu,
  Edit,
  Eye,
  Key,
  MoreHorizontal,
  Plus,
  Settings,
  Star,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ModelsPage() {
  const { Confirm } = useAppContext();
  const [models, setModels] = useState<AIModelConfig[]>([]);
  const [defaultModel, setDefaultModel] = useState<AIModelConfig | null>(null);
  const [pagination, setPagination] = useState<PaginationBase>(defaultPagination);
  const [isLoading, setIsLoading] = useState(true);

  const loadModels = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await aiModelsApi.getAIModels({
        page: pagination.current_page,
        page_size: pagination.page_size,
      });
      setModels(data.data.items);
      setPagination(data);
    } catch (error) {
      console.error('加载AI模型列表失败:', error);
      toast.error('加载AI模型列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.current_page, pagination.page_size]);

  const loadDefaultModel = useCallback(async () => {
    try {
      const response = await aiModelsApi.getAIModels({
        page: 1,
        page_size: 1,
        sorts: [
          {
            key: 'is_default',
            desc: true,
          },
        ],
      });
      setDefaultModel(response.data.items[0] || null);
    } catch {
      setDefaultModel(null);
    }
  }, []);

  // 分页切换
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, current_page: page }));
  };
  // 每页数量切换
  const handlePageSizeChange = (size: number) => {
    setPagination(prev => ({ ...prev, page_size: size, current_page: 1 }));
  };

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    loadDefaultModel();
  }, [loadDefaultModel]);

  const handleToggleActive = async (modelId: number, isActive: boolean) => {
    try {
      // 乐观更新：先更新UI状态
      setModels(prevModels =>
        prevModels.map(model => (model.id === modelId ? { ...model, is_enabled: isActive } : model))
      );

      // 后端更新
      const updatedModel = await aiModelsApi.updateAIModel(modelId, { is_enabled: isActive });
      setModels(prevModels => prevModels.map(model => (model.id === modelId ? updatedModel : model)));

      toast.success(isActive ? '模型已启用' : '模型已停用');
    } catch (error) {
      console.error('更新模型状态失败:', error);

      // 错误回滚：恢复原始状态
      setModels(prevModels =>
        prevModels.map(model => (model.id === modelId ? { ...model, is_enabled: !isActive } : model))
      );

      toast.error('更新模型状态失败');
    }
  };

  const handleSetDefault = async (modelId: number) => {
    const backupDefaultModel = defaultModel;

    try {
      // 乐观更新：先更新UI状态
      setDefaultModel(models.find(model => model.id === modelId) || null);

      // 后端更新
      await aiModelsApi.updateAIModel(modelId, { is_default: true });

      // 重新加载所有模型以确保只有一个默认模型
      setModels(prevModels => prevModels.map(model => ({ ...model, is_default: model.id === modelId })));

      toast.success('已设为默认模型');
    } catch (error) {
      console.error('设置默认模型失败:', error);

      // 错误回滚：恢复原始状态
      setDefaultModel(backupDefaultModel);

      toast.error('设置默认模型失败');
    }
  };

  const handleDeleteModel = async (modelId: number) => {
    try {
      // 使用getAllAgents确保检查所有智能体的关联关系
      const allAgents = await getAllAgents();
      const usingAgents = allAgents.filter(agent => agent.ai_model_id === modelId);

      if (usingAgents.length > 0) {
        const agentNames = usingAgents.map(agent => agent.name).join('、');
        const confirmed = await Confirm({
          title: '确认删除AI模型',
          message: `该模型正在被 ${usingAgents.length} 个智能体使用：${agentNames}。\n\n删除后这些智能体将无法正常工作，需要重新配置模型。是否继续删除？`,
          variant: 'destructive',
        });

        if (!confirmed) {
          return;
        }
      } else {
        const confirmed = await Confirm({
          title: '确认删除AI模型',
          message: '此操作将永久删除该AI模型配置。此操作无法撤销。',
          variant: 'destructive',
        });

        if (!confirmed) {
          return;
        }
      }

      await aiModelsApi.deleteAIModel(modelId);
      setModels(prevModels => prevModels.filter(model => model.id !== modelId));

      if (usingAgents.length > 0) {
        toast.success(`模型已删除，${usingAgents.length} 个智能体需要重新配置模型`);
      } else {
        toast.success('模型已删除');
      }
    } catch (error) {
      console.error('删除模型失败:', error);
      toast.error('删除模型失败，请重试');
    }
  };

  // 统计数据
  const stats = {
    total: models.length,
    active: models.filter(m => m.is_enabled).length,
    defaultModel: defaultModel?.name || '未设置',
    providers: [...new Set(models.map(m => m.provider))].length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Bot className="text-primary h-8 w-8" />
              <h1 className="text-3xl font-bold tracking-tight">AI 模型管理</h1>
            </div>
            <p className="text-muted-foreground">管理和配置 AI 模型</p>
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Bot className="text-primary h-8 w-8" />
              <h1 className="text-3xl font-bold tracking-tight">AI 模型管理</h1>
            </div>
          </div>
          <p className="text-muted-foreground">管理和配置 AI 模型</p>
        </div>
        <Button asChild>
          <Link href="/models/create">
            <Plus className="mr-2 h-4 w-4" />
            添加模型
          </Link>
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">模型总数</CardTitle>
            <Cpu className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-muted-foreground text-xs">已配置模型</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃模型</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-muted-foreground text-xs">已启用模型</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">默认模型</CardTitle>
            <Star className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-2xl font-bold">{stats.defaultModel}</div>
            <p className="text-muted-foreground text-xs">当前默认</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">服务商数量</CardTitle>
            <CheckCircle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.providers}</div>
            <p className="text-muted-foreground text-xs">支持的服务商</p>
          </CardContent>
        </Card>
      </div>

      {models.length === 0 ? (
        <Card className="p-12 text-center">
          <Cpu className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">还没有AI模型</h3>
          <p className="text-muted-foreground mb-4">添加您的第一个AI模型来开始使用</p>
          <Button asChild>
            <Link href="/models/create">
              <Plus className="mr-2 h-4 w-4" />
              添加模型
            </Link>
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {models.map(model => {
              const providerInfo = getProviderInfo(model.provider);
              const displayName = getModelDisplayName(model);

              return (
                <Card key={model.id} className="group transition-all duration-200 hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-1 rounded-lg p-2 ${model.is_enabled ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}
                        >
                          <Cpu
                            className={`h-5 w-5 ${
                              model.is_enabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                            }`}
                          />
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2 text-lg">{displayName}</CardTitle>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {model.is_default && (
                              <div className="flex items-center">
                                <Star className="h-4 w-4 shrink-0 fill-current text-yellow-500" />
                              </div>
                            )}
                            <Badge variant="default" className={providerInfo.color}>
                              {providerInfo.name}
                            </Badge>
                            {model.is_thinking && (
                              <Badge variant="secondary" className="text-xs">
                                思考型
                              </Badge>
                            )}
                            {model.is_enabled ? (
                              <Badge variant="default" className="bg-green-100 text-xs text-green-800">
                                启用
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                禁用
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
                            <Link href={`/models/${model.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              查看详情
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/models/${model.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑配置
                            </Link>
                          </DropdownMenuItem>
                          {!model.is_default && (
                            <DropdownMenuItem onClick={() => handleSetDefault(model.id)}>
                              <Star className="mr-2 h-4 w-4" />
                              设为默认
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDeleteModel(model.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="mt-2 text-sm">
                      模型：{model.model_name} | 最大Token：{model.max_tokens}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col justify-end space-y-4 pt-0">
                    {/* 启用/禁用开关 */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">状态</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${model.is_enabled ? 'text-green-600' : 'text-gray-500'}`}>
                          {model.is_enabled ? '运行中' : '已停用'}
                        </span>
                        <Switch
                          checked={model.is_enabled}
                          onCheckedChange={checked => handleToggleActive(model.id, checked)}
                        />
                      </div>
                    </div>

                    {/* API配置信息 */}
                    <div className="bg-muted/50 space-y-2 rounded-lg p-3">
                      <p className="text-muted-foreground text-xs">API配置</p>
                      <div className="flex items-center gap-2 text-sm">
                        <Key className="text-muted-foreground h-3 w-3" />
                        <span>密钥：{model.api_key ? '已配置' : '未配置'}</span>
                      </div>
                      {model.base_url &&
                        providerOptions.find(p => p.value === model.provider)?.baseUrl !== model.base_url && (
                          <div className="flex items-center gap-2 text-sm">
                            <Settings className="text-muted-foreground h-3 w-3" />
                            <span className="truncate">自定义API地址</span>
                          </div>
                        )}
                      {model.proxy_url && (
                        <div className="flex items-center gap-2 text-sm">
                          <Settings className="text-muted-foreground h-3 w-3" />
                          <span className="truncate">使用代理请求</span>
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link href={`/models/${model.id}`}>
                          <Eye className="mr-1 h-3 w-3" />
                          查看
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link href={`/models/${model.id}/edit`}>
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
