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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/contexts/app-context';
import { getProviderInfo } from '@/lib/ai';
import { aiModelsApi, getModelDisplayName } from '@/lib/api/ai-models';
import { AIModelConfig } from '@/lib/types';
import { Cpu, Edit, Key, Power, Settings, Star, Trash2, Zap } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function ModelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { Confirm } = useAppContext();
  const [model, setModel] = useState<AIModelConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadModel = async () => {
      try {
        setLoading(true);
        const modelId = parseInt(params.id as string);
        const modelData = await aiModelsApi.getAIModel(modelId);
        setModel(modelData);
      } catch (error) {
        console.error('加载AI模型失败:', error);
        toast.error('加载AI模型失败');
        router.push('/models');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      loadModel();
    }
  }, [params.id, router]);

  const handleDelete = async () => {
    if (!model) return;

    if (
      await Confirm({
        title: '确定要删除这个AI模型吗？',
        message: '此操作不可撤销。',
        variant: 'destructive',
      })
    ) {
      try {
        await aiModelsApi.deleteAIModel(model.id);
        toast.success('AI模型删除成功');
        router.push('/models');
      } catch (error) {
        console.error('删除AI模型失败:', error);
        toast.error('删除AI模型失败');
      }
    }
  };

  const handleToggleStatus = async () => {
    if (!model) return;

    try {
      const newStatus = !model.is_enabled;
      const updatedModel = await aiModelsApi.updateAIModel(model.id, { is_enabled: newStatus });
      setModel(updatedModel);
      toast.success(`模型已${newStatus ? '启用' : '停用'}`);
    } catch (error) {
      console.error('更新模型状态失败:', error);
      toast.error('更新模型状态失败');
    }
  };

  const handleToggleDefault = async () => {
    if (!model) return;

    try {
      const newDefault = !model.is_default;
      const updatedModel = await aiModelsApi.updateAIModel(model.id, { is_default: newDefault });
      setModel(updatedModel);
      toast.success(`${newDefault ? '已设为默认模型' : '已取消默认模型'}`);
    } catch (error) {
      console.error('设置默认模型失败:', error);
      toast.error('设置默认模型失败');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <Cpu className="text-muted-foreground mb-4 h-16 w-16" />
        <h2 className="mb-2 text-xl font-semibold">AI模型不存在</h2>
        <p className="text-muted-foreground mb-4">请检查 URL 是否正确</p>
        <Button asChild>
          <Link href="/models">返回列表</Link>
        </Button>
      </div>
    );
  }

  const currentProvider = getProviderInfo(model.provider);
  const displayName = getModelDisplayName(model);

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb导航 */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/models">AI 模型管理</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{model.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 页面标题和操作 */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className={`h-8 w-8 rounded-lg ${model.is_enabled ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'} flex items-center justify-center`}
            >
              <Cpu
                className={`h-5 w-5 ${
                  model.is_enabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                }`}
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
            <Badge variant={model.is_enabled ? 'default' : 'secondary'}>{model.is_enabled ? '启用' : '停用'}</Badge>
            {model.is_default && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                <Star className="mr-1 h-3 w-3" />
                默认
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">模型标识：{model.model_name}</p>
          <p className="text-muted-foreground">提供商：{currentProvider.name}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href={`/models/${model.id}/edit`}>
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">模型ID</p>
              <p className="text-muted-foreground text-sm">{model.id}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">显示名称</p>
              <p className="text-muted-foreground text-sm">{model.name}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">模型标识</p>
              <p className="text-muted-foreground text-sm">{model.model_name}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">AI提供商</p>
              <div className="flex items-center gap-2">
                <Badge className={currentProvider.color}>{currentProvider.name}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 配置参数 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              配置参数
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">最大Token数</p>
              <p className="text-muted-foreground text-sm">{model.max_tokens.toLocaleString()}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">温度参数</p>
              <p className="text-muted-foreground text-sm">{model.temperature}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">API密钥</p>
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                <p className="text-muted-foreground text-sm">{model.api_key ? '已配置' : '未配置'}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">API地址</p>
              <p className="text-muted-foreground text-sm truncate">{model.base_url}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">使用代理请求</p>
              <p className="text-muted-foreground text-sm truncate">{model.proxy_url || '未配置'}</p>
            </div>
          </CardContent>
        </Card>

        {/* 状态和操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              状态和操作
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 启用状态 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">启用状态</p>
                <p className="text-muted-foreground text-sm">控制模型是否可用</p>
              </div>
              <Switch checked={model.is_enabled} onCheckedChange={handleToggleStatus} />
            </div>

            <Separator />

            {/* 默认模型 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">默认模型</p>
                <p className="text-muted-foreground text-sm">新建智能体时自动选择</p>
              </div>
              <Switch checked={model.is_default} onCheckedChange={handleToggleDefault} />
            </div>

            <Separator />

            {/* 测试连接 */}
            <div>
              <p className="mb-4 font-medium">快速操作</p>
              <div className="flex flex-col gap-3">
              <Button variant="outline" className="w-full" asChild>
              <Link href={`/models/${model.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                编辑配置
              </Link>
            </Button>
            <Button
              variant={model.is_enabled ? 'destructive' : 'default'}
              className="w-full"
              onClick={handleToggleStatus}
            >
              <Power className="mr-2 h-4 w-4" />
              {model.is_enabled ? '停用模型' : '启用模型'}
            </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 时间信息 */}
        <Card>
          <CardHeader>
            <CardTitle>时间信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">创建时间</p>
              <p className="text-muted-foreground text-sm">{new Date(model.created_at).toLocaleString()}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">最后更新</p>
              <p className="text-muted-foreground text-sm">{new Date(model.updated_at).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* 统计信息（扩展功能） */}
        <Card>
          <CardHeader>
            <CardTitle>使用统计</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">关联智能体</p>
              <p className="text-2xl font-bold">{model.agent_count || 0}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">对话次数</p>
              <p className="text-2xl font-bold">{model.conversation_count || 0}</p>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Token使用</p>
              <p className="text-2xl font-bold">{(model.token_usage || 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
