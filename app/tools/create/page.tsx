'use client';

import { CommandSelect } from '@/components/command-select';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toolCategories, toolPermissions, toolTypes } from '@/lib/ai';
import { mcpToolsApi, type MCPToolFormData } from '@/lib/api/mcp-tools';
import { ExternalLink, Key, Save, Settings, Shield, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface FormData {
  name: string;
  mcp_name: string; // 修复：使用后端字段名mcp_name
  description?: string;
  category: 'dootask' | 'external' | 'custom';
  type: 'internal' | 'external';
  config: Record<string, unknown>;
  permissions: string[];
  configType: 'url' | 'npx'; // 新增：配置方式
  apiKey?: string;
  baseUrl?: string;
  npxConfig?: string; // 新增：NPX配置
}

export default function CreateMCPToolPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    mcp_name: '', // 修复：使用后端字段名mcp_name
    description: '',
    category: 'external',
    type: 'external',
    config: {},
    permissions: ['read'],
    configType: 'url', // 新增：默认URL方式
    apiKey: '',
    baseUrl: '',
    npxConfig: '', // 新增：NPX配置
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.description?.trim()) {
      toast.error('请填写所有必填字段');
      return;
    }

    if (!formData.mcp_name.trim()) {
      toast.error('请填写MCP工具标识');
      return;
    }

    if (!formData.permissions || formData.permissions.length === 0) {
      toast.error('请至少选择一个权限');
      return;
    }

    // 验证NPX配置JSON格式
    if (formData.configType === 'npx' && formData.npxConfig) {
      try {
        JSON.parse(formData.npxConfig);
      } catch (error) {
        toast.error('NPX配置JSON格式错误，请检查语法');
        return;
      }
    }

    setIsLoading(true);

    try {
      // 构建表单数据用于API调用
      const toolFormData: MCPToolFormData = {
        name: formData.name,
        mcpName: formData.mcp_name, // 新增：MCP工具标识
        description: formData.description || '',
        category: formData.category,
        type: formData.type,
        config: {}, // 保持空对象，让转换函数处理
        permissions: formData.permissions,
        configType: formData.configType, // 新增：配置方式
        apiKey: formData.apiKey,
        baseUrl: formData.baseUrl,
        npxConfig: formData.npxConfig, // 新增：NPX配置
      };

      const newTool = await mcpToolsApi.create(toolFormData);
      toast.success(`MCP 工具 "${newTool.name}" 创建成功！`);
      router.push('/tools');
    } catch (error) {
      console.error('Failed to create tool:', error);
      toast.error('创建 MCP 工具失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionToggle = (permission: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked ? [...prev.permissions!, permission] : prev.permissions!.filter(p => p !== permission),
    }));
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
            <BreadcrumbPage>添加工具</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">添加 MCP 工具</h1>
          <p className="text-muted-foreground">配置新的 MCP 工具供智能体使用</p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/tools">取消</Link>
          </Button>
          <Button type="submit" form="tool-form" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                创建中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                添加工具
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧主要内容 */}
        <div className="lg:col-span-2">
          <form id="tool-form" onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  基本信息
                </CardTitle>
                <CardDescription>MCP 工具的基本配置信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">工具名称 *</Label>
                    <Input
                      id="name"
                      placeholder="例如：天气查询"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mcpName">MCP工具标识 *</Label>
                    <Input
                      id="mcpName"
                      placeholder="例如：weather-api"
                      value={formData.mcp_name}
                      onChange={e => setFormData(prev => ({ ...prev, mcp_name: e.target.value }))}
                      pattern="[a-zA-Z0-9]+"
                      title="仅限英文和数字"
                      required
                    />
                    <p className="text-muted-foreground text-xs">仅限英文和数字，用于工具唯一标识</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">工具类别 *</Label>
                    <CommandSelect
                      options={toolCategories.map(category => ({
                        value: category.value,
                        label: category.label,
                        description: category.description,
                      }))}
                      value={formData.category}
                      onValueChange={value =>
                        setFormData(prev => ({ ...prev, category: value as 'dootask' | 'external' | 'custom' }))
                      }
                      placeholder="选择工具类别"
                      searchPlaceholder="搜索类别..."
                      emptyMessage="没有找到相关类别"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">工具类型 *</Label>
                    <CommandSelect
                      options={toolTypes.map(type => ({
                        value: type.value,
                        label: type.label,
                        description: type.description,
                      }))}
                      value={formData.type}
                      onValueChange={value =>
                        setFormData(prev => ({ ...prev, type: value as 'internal' | 'external' }))
                      }
                      placeholder="选择工具类型"
                      searchPlaceholder="搜索类型..."
                      emptyMessage="没有找到相关类型"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">工具描述 *</Label>
                  <Textarea
                    id="description"
                    placeholder="描述工具的功能和用途..."
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    required
                  />
                  <p className="text-muted-foreground text-xs">详细描述有助于智能体正确选择和使用工具</p>
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
                <CardDescription>配置工具的连接参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 配置方式选择 */}
                <div className="space-y-2">
                  <Label>配置方式 *</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="config-url"
                        name="configType"
                        value="url"
                        checked={formData.configType === 'url'}
                        onChange={e => {
                          const newConfigType = e.target.value as 'url' | 'npx';
                          setFormData(prev => ({
                            ...prev,
                            configType: newConfigType,
                            // 清空之前的配置
                            apiKey: newConfigType === 'url' ? prev.apiKey : '',
                            baseUrl: newConfigType === 'url' ? prev.baseUrl : '',
                            npxConfig: newConfigType === 'npx' ? prev.npxConfig : '',
                          }));
                        }}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="config-url" className="text-sm font-normal">URL方式</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="config-npx"
                        name="configType"
                        value="npx"
                        checked={formData.configType === 'npx'}
                        onChange={e => {
                          const newConfigType = e.target.value as 'url' | 'npx';
                          setFormData(prev => ({
                            ...prev,
                            configType: newConfigType,
                            // 清空之前的配置
                            apiKey: newConfigType === 'url' ? prev.apiKey : '',
                            baseUrl: newConfigType === 'url' ? prev.baseUrl : '',
                            npxConfig: newConfigType === 'npx' ? prev.npxConfig : '',
                          }));
                        }}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="config-npx" className="text-sm font-normal">NPX方式</Label>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    URL方式：通过HTTP API调用 | NPX方式：通过本地NPX包调用
                  </p>
                </div>

                {/* URL方式配置 */}
                {formData.configType === 'url' && (
                  <>
                    {formData.type === 'external' && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          API 基础 URL
                        </Label>
                        <Input
                          placeholder="https://api.example.com/v1"
                          value={formData.baseUrl}
                          onChange={e => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                        />
                        <p className="text-muted-foreground text-xs">外部 API 服务的基础地址</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        API Key / 访问令牌
                      </Label>
                      <Input
                        type="password"
                        placeholder="sk-... 或其他访问令牌"
                        value={formData.apiKey}
                        onChange={e => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                      />
                      <p className="text-muted-foreground text-xs">用于访问 API 的密钥或令牌</p>
                    </div>
                  </>
                )}

                {/* NPX方式配置 */}
                {formData.configType === 'npx' && (
                  <div className="space-y-2">
                    <Label>NPX配置 (JSON格式) *</Label>
                    <Textarea
                      placeholder={`{
  "command": "npx @modelcontextprotocol/server-filesystem@latest",
  "args": ["--root", "/path/to/files"],
  "env": {
    "API_KEY": "your-api-key"
  }
}`}
                      value={formData.npxConfig}
                      onChange={e => setFormData(prev => ({ ...prev, npxConfig: e.target.value }))}
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <p className="text-muted-foreground text-xs">
                      输入NPX工具的JSON配置，包含命令、参数和环境变量等
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500"></div>
                    <div className="text-sm">
                      <p className="font-medium text-amber-900">安全提示</p>
                      <p className="mt-1 text-amber-800">
                        API 密钥将被安全加密存储。请确保使用具有适当权限的专用 API 密钥。
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* 右侧配置 */}
        <div className="space-y-6">
          {/* 权限设置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                权限设置
              </CardTitle>
              <CardDescription>设置工具的访问权限</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {toolPermissions.map(permission => (
                  <div key={permission.value} className="flex items-start space-x-3 rounded-lg border p-3">
                    <Checkbox
                      id={`permission-${permission.value}`}
                      checked={formData.permissions?.includes(permission.value) || false}
                      onCheckedChange={(checked: boolean) => handlePermissionToggle(permission.value, checked)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`permission-${permission.value}`} className="text-sm font-medium">
                        {permission.label}
                      </Label>
                      <p className="text-muted-foreground mt-1 text-xs">{permission.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-start gap-2">
                  <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500"></div>
                  <div className="text-sm">
                    <p className="font-medium text-blue-900">权限说明</p>
                    <p className="mt-1 text-blue-800">权限控制智能体可以对工具执行的操作类型。建议遵循最小权限原则。</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 示例配置 */}
          <Card className="border-gray-200 bg-gray-50">
            <CardHeader>
              <CardTitle className="text-gray-900">常见工具示例</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-gray-900">天气查询</p>
                  <p className="text-xs text-gray-600">类别: 外部工具 | 权限: 读取</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">邮件发送</p>
                  <p className="text-xs text-gray-600">类别: 外部工具 | 权限: 执行</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">任务管理</p>
                  <p className="text-xs text-gray-600">类别: DooTask | 权限: 读取、写入</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">文档搜索</p>
                  <p className="text-xs text-gray-600">类别: 自定义 | 权限: 读取</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
