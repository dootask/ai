'use client';

import { CommandSelect, CommandSelectOption } from '@/components/command-select';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { providerOptions } from '@/lib/ai';
import { aiModelsApi } from '@/lib/api/ai-models';
import { AIModelConfig, UpdateAIModelRequest } from '@/lib/types';
import { Cpu, Key, Save, Settings, Star } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function EditModelPage() {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState<AIModelConfig | null>(null);
  const [formData, setFormData] = useState<UpdateAIModelRequest>({});

  // 转换为CommandSelect选项
  const providerSelectOptions: CommandSelectOption[] = providerOptions.map(option => ({
    value: option.value,
    label: option.name,
    description: option.description,
  }));

  const selectedProvider = providerOptions.find(p => p.value === (formData.provider || model?.provider));

  useEffect(() => {
    const loadModel = async () => {
      try {
        setLoading(true);
        const modelId = parseInt(params.id as string);
        const modelData = await aiModelsApi.getAIModel(modelId);
        setModel(modelData);
        setFormData({
          name: modelData.name,
          provider: modelData.provider,
          model_name: modelData.model_name,
          base_url: modelData.base_url,
          proxy_url: modelData.proxy_url,
          max_tokens: modelData.max_tokens,
          temperature: modelData.temperature,
          is_enabled: modelData.is_enabled,
          is_default: modelData.is_default,
          is_thinking: modelData.is_thinking, // 新增字段：是否为思考型模型
        });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      toast.error('请填写模型名称');
      return;
    }

    if (!formData.model_name?.trim()) {
      toast.error('请填写模型标识');
      return;
    }

    setIsLoading(true);

    try {
      const modelId = parseInt(params.id as string);
      const updatedModel = await aiModelsApi.updateAIModel(modelId, formData);
      setModel(updatedModel);
      toast.success(`AI模型 "${updatedModel.name}" 更新成功！`);
      router.push('/models');
    } catch (error) {
      console.error('更新AI模型失败:', error);
      toast.error('更新AI模型失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (provider: AIModelConfig['provider']) => {
    const providerConfig = providerOptions.find(p => p.value === provider);
    setFormData(prev => ({
      ...prev,
      provider,
      base_url: providerConfig?.baseUrl || '',
    }));
  };

  const handleProviderSelectChange = (value: string) => {
    handleProviderChange(value as AIModelConfig['provider']);
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
            <BreadcrumbLink asChild>
              <Link href={`/models/${model.id}`}>{model.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>编辑</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">编辑 AI 模型</h1>
          <p className="text-muted-foreground">修改 {model.name} 的配置</p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/models">取消</Link>
          </Button>
          <Button type="submit" form="model-form" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                更新中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                更新模型
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧主要内容 */}
        <div className="lg:col-span-2">
          <form id="model-form" onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  基本信息
                </CardTitle>
                <CardDescription>AI 模型的基本配置信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">AI 提供商 *</Label>
                  <CommandSelect
                    options={providerSelectOptions}
                    value={formData.provider || model.provider}
                    onValueChange={handleProviderSelectChange}
                    placeholder="选择 AI 提供商"
                    searchPlaceholder="搜索提供商..."
                    emptyMessage="没有找到相关提供商"
                  />
                  <p className="text-muted-foreground text-xs">
                    选择 AI 提供商，支持本地模型和第三方模型
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">模型名称 *</Label>
                    <Input
                      id="name"
                      placeholder="例如：GPT-4 Turbo"
                      value={formData.name || ''}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                    <p className="text-muted-foreground text-xs">用于在系统中显示的友好名称</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model_name">模型标识 *</Label>
                    <Input
                      id="model_name"
                      placeholder="例如：gpt-4-turbo"
                      value={formData.model_name || ''}
                      onChange={e => setFormData(prev => ({ ...prev, model_name: e.target.value }))}
                      required
                    />
                    <p className="text-muted-foreground text-xs">API调用时使用的模型标识</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="max_tokens">最大 Token 数</Label>
                    <Input
                      id="max_tokens"
                      type="number"
                      min="1"
                      value={formData.max_tokens || model.max_tokens}
                      onChange={e => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 4000 }))}
                      placeholder="4000"
                    />
                    <p className="text-muted-foreground text-xs">控制模型单次输出的最大长度</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">温度参数: {formData.temperature ?? model.temperature}</Label>
                    <div className="flex h-9 items-center">
                      <Slider
                        value={[formData.temperature ?? model.temperature]}
                        onValueChange={([value]) => setFormData(prev => ({ ...prev, temperature: value }))}
                        max={2}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">控制输出的随机性，0为确定性，2为高随机性</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API 配置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  API 配置
                </CardTitle>
                <CardDescription>配置模型的 API 连接参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(formData.provider || model.provider) !== 'local' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      API 密钥
                    </Label>
                    <Input
                      type="password"
                      placeholder={model.api_key ? '***已配置***' : 'sk-... 或其他API密钥'}
                      value={formData.api_key || ''}
                      onChange={e => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                    />
                    <p className="text-muted-foreground text-xs">留空则不修改当前密钥</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>API 基础地址</Label>
                  <Input
                    placeholder="https://api.example.com/v1"
                    value={formData.base_url ?? model.base_url}
                    onChange={e => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
                  />
                  <p className="text-muted-foreground text-xs">当前地址：{model.base_url}</p>
                </div>

                <div className="space-y-2">
                  <Label>使用代理请求</Label>
                  <Input
                    placeholder="socks5://proxy.example.com:1080"
                    value={formData.proxy_url || ''}
                    onChange={e => setFormData(prev => ({ ...prev, proxy_url: e.target.value }))}
                  />
                  <p className="text-muted-foreground text-xs">如果需要使用代理请求，请填写代理地址，否则请留空。</p>
                </div>
              </CardContent>
            </Card>

            {/* 高级设置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  高级设置
                </CardTitle>
                <CardDescription>模型的高级配置选项</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">启用状态</Label>
                    <p className="text-muted-foreground text-sm">是否启用此模型</p>
                  </div>
                  <Switch
                    checked={formData.is_enabled ?? model.is_enabled}
                    onCheckedChange={checked => setFormData(prev => ({ ...prev, is_enabled: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">设为默认模型</Label>
                    <p className="text-muted-foreground text-sm">新建智能体时默认选择此模型</p>
                  </div>
                  <Switch
                    checked={formData.is_default ?? model.is_default}
                    onCheckedChange={checked => setFormData(prev => ({ ...prev, is_default: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">思考型模型</Label>
                    <p className="text-muted-foreground text-sm">启用推理过程显示，支持思维链输出</p>
                  </div>
                  <Switch
                    checked={formData.is_thinking ?? model.is_thinking}
                    onCheckedChange={checked => setFormData(prev => ({ ...prev, is_thinking: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* 右侧信息 */}
        <div className="space-y-6">
          {/* 提供商信息 */}
          {selectedProvider && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedProvider.name}</CardTitle>
                <CardDescription>{selectedProvider.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">默认API地址</p>
                    <p className="text-muted-foreground text-xs break-all">{selectedProvider.baseUrl}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">常用模型</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedProvider.models.map(modelName => (
                        <Button
                          key={modelName}
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => setFormData(prev => ({ ...prev, model_name: modelName }))}
                        >
                          {modelName}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">建议最大 Token 数</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setFormData(prev => ({ ...prev, max_tokens: selectedProvider.maxTokens }))}
                    >
                      {selectedProvider.maxTokens}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 模型信息 */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-900">当前模型</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-2 text-green-800">
                <p>创建时间：{new Date(model.created_at).toLocaleString()}</p>
                <p>最后更新：{new Date(model.updated_at).toLocaleString()}</p>
                <p>模型ID：{model.id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
