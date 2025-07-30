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
import { CreateAIModelRequest } from '@/lib/types';
import { Cpu, Key, Save, Settings, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function CreateModelPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<CreateAIModelRequest & { __manual_token__: boolean }>({
    name: '',
    provider: '',
    model_name: '',
    api_key: '',
    base_url: '',
    proxy_url: '',
    max_tokens: 4000,
    temperature: 0.7,
    is_enabled: true,
    is_default: false,
    is_thinking: false, // 新增字段：是否为思考型模型
    __manual_token__: false,
  });

  // 转换为CommandSelect选项
  const providerSelectOptions: CommandSelectOption[] = providerOptions.map(option => ({
    value: option.value,
    label: option.name,
    description: option.description,
  }));

  const selectedProvider = providerOptions.find(p => p.value === formData.provider);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('请填写模型名称');
      return;
    }

    if (!formData.model_name.trim()) {
      toast.error('请填写模型标识');
      return;
    }

    if (formData.provider !== 'local' && !formData.api_key?.trim()) {
      toast.error('请填写API密钥');
      return;
    }

    setIsLoading(true);

    try {
      const newModel = await aiModelsApi.createAIModel(formData);
      toast.success(`AI模型 "${newModel.name}" 创建成功！`);
      router.push('/models');
    } catch (error) {
      console.error('创建AI模型失败:', error);
      toast.error('创建AI模型失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (provider: CreateAIModelRequest['provider']) => {
    const providerConfig = providerOptions.find(p => p.value === provider);
    setFormData(prev => ({
      ...prev,
      provider,
      base_url: providerConfig?.baseUrl || '',
      model_name: providerConfig?.models[0] || '',
      max_tokens: prev.__manual_token__ ? prev.max_tokens : providerConfig?.maxTokens || 4000,
    }));
  };

  const handleProviderSelectChange = (value: string) => {
    handleProviderChange(value as CreateAIModelRequest['provider']);
  };

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
            <BreadcrumbPage>添加模型</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">添加 AI 模型</h1>
          <p className="text-muted-foreground">配置新的 AI 模型供智能体使用</p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/models">取消</Link>
          </Button>
          <Button type="submit" form="model-form" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                创建中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                创建模型
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
                    value={formData.provider}
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
                      value={formData.name}
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
                      value={formData.model_name}
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
                      value={formData.max_tokens}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          __manual_token__: true,
                          max_tokens: parseInt(e.target.value) || 4000,
                        }))
                      }
                      placeholder="4000"
                    />
                    <p className="text-muted-foreground text-xs">控制模型单次输出的最大长度</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature">温度参数: {formData.temperature}</Label>
                    <div className="flex h-9 items-center">
                      <Slider
                        value={[formData.temperature]}
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
                {formData.provider !== 'local' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      API 密钥 *
                    </Label>
                    <Input
                      type="password"
                      placeholder="sk-... 或其他API密钥"
                      value={formData.api_key || ''}
                      onChange={e => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                      required={formData.provider !== 'local'}
                    />
                    <p className="text-muted-foreground text-xs">请确保 API 密钥具有适当的权限</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>API 基础地址</Label>
                  <Input
                    placeholder="https://api.example.com/v1"
                    value={formData.base_url}
                    onChange={e => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
                  />
                  <p className="text-muted-foreground text-xs">
                    {formData.base_url || selectedProvider?.baseUrl
                      ? `当前地址：${formData.base_url || selectedProvider?.baseUrl}`
                      : '请填写API基础地址'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>使用代理请求</Label>
                  <Input
                    placeholder="socks5://proxy.example.com:1080"
                    value={formData.proxy_url}
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
                    <p className="text-muted-foreground text-sm">是否立即启用此模型</p>
                  </div>
                  <Switch
                    checked={formData.is_enabled}
                    onCheckedChange={checked => setFormData(prev => ({ ...prev, is_enabled: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">设为默认模型</Label>
                    <p className="text-muted-foreground text-sm">新建智能体时默认选择此模型</p>
                  </div>
                  <Switch
                    checked={formData.is_default}
                    onCheckedChange={checked => setFormData(prev => ({ ...prev, is_default: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">思考型模型</Label>
                    <p className="text-muted-foreground text-sm">启用推理过程显示，支持思维链输出</p>
                  </div>
                  <Switch
                    checked={formData.is_thinking}
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
                      {selectedProvider.models.map(model => (
                        <Button
                          key={model}
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => setFormData(prev => ({ ...prev, model_name: model }))}
                        >
                          {model}
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

          {/* 配置指南 */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">配置指南</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
                  <span>获取 API 密钥：访问提供商官网注册并获取</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
                  <span>模型标识：必须与提供商支持的模型一致</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
                  <span>温度参数：数值越低输出越稳定</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* 安全提示 */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-900">安全提示</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="space-y-2 text-amber-800">
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"></span>
                  <span>API 密钥将被安全加密存储</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"></span>
                  <span>建议使用专用的 API 密钥</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"></span>
                  <span>定期检查 API 使用量和费用</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"></span>
                  <span>不要共享您的 API 密钥</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
