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
import { Textarea } from '@/components/ui/textarea';
import { formatKnowledgeBaseForUI, knowledgeBasesApi, parseKnowledgeBaseMetadata } from '@/lib/api/knowledge-bases';
import { Database, Save, Settings } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// 前端表单数据类型
interface KnowledgeBaseFormData {
  name: string;
  description?: string;
  embeddingModel: string;
  chunkSize?: number;
  chunkOverlap?: number;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export default function EditKnowledgeBasePage() {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<KnowledgeBaseFormData>({
    name: '',
    description: '',
    embeddingModel: 'text-embedding-ada-002',
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  // 可用的 Embedding 模型
  const availableModels = [
    {
      value: 'text-embedding-ada-002',
      label: 'OpenAI Ada-002',
      description: '成本较低，适合大部分场景',
      dimensions: 1536,
      cost: '低',
    },
    {
      value: 'text-embedding-3-small',
      label: 'OpenAI Embedding v3 Small',
      description: '平衡性能与成本',
      dimensions: 1536,
      cost: '中',
    },
    {
      value: 'text-embedding-3-large',
      label: 'OpenAI Embedding v3 Large',
      description: '最佳性能，成本较高',
      dimensions: 3072,
      cost: '高',
    },
  ];

  // 转换为CommandSelect选项
  const modelSelectOptions: CommandSelectOption[] = availableModels.map(model => ({
    value: model.value,
    label: model.label,
    description: model.description,
  }));

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const kbId = parseInt(params.id as string);
      const kb = await knowledgeBasesApi.get(kbId);
      const parsedKB = parseKnowledgeBaseMetadata(kb);
      const formattedKB = formatKnowledgeBaseForUI(parsedKB);

      setFormData({
        name: formattedKB.name || '',
        description: formattedKB.description || '',
        embeddingModel: formattedKB.embeddingModel || formattedKB.embedding_model || 'text-embedding-ada-002',
        chunkSize: formattedKB.chunk_size || 1000,
        chunkOverlap: formattedKB.chunk_overlap || 200,
        isActive: formattedKB.isActive !== undefined ? formattedKB.isActive : formattedKB.is_active,
      });
    } catch (error) {
      console.error('加载知识库数据失败:', error);
      toast.error('加载知识库数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.description?.trim()) {
      toast.error('请填写所有必填字段');
      return;
    }

    setIsLoading(true);

    try {
      const kbId = parseInt(params.id as string);
      const updatedKB = await knowledgeBasesApi.update(kbId, formData);
      toast.success(`知识库 "${updatedKB.name}" 更新成功！`);
      router.push(`/knowledge/${params.id}`);
    } catch (error) {
      console.error('更新知识库失败:', error);
      toast.error('更新知识库失败');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedModel = availableModels.find(model => model.value === formData.embeddingModel);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
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
              <Link href="/knowledge">知识库管理</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/knowledge/${params.id}`}>{formData.name || '知识库详情'}</Link>
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">编辑知识库</h1>
          <p className="text-muted-foreground">修改知识库的配置和设置</p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={`/knowledge/${params.id}`}>取消</Link>
          </Button>
          <Button type="submit" form="knowledge-form" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                更新中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存更改
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧主要内容 */}
        <div className="lg:col-span-2">
          <form id="knowledge-form" onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  基本信息
                </CardTitle>
                <CardDescription>知识库的基本配置信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">知识库名称 *</Label>
                  <Input
                    id="name"
                    placeholder="例如：技术文档库"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">知识库描述 *</Label>
                  <Textarea
                    id="description"
                    placeholder="描述知识库的用途和内容类型..."
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    required
                  />
                  <p className="text-muted-foreground text-xs">详细描述有助于 AI 更好地理解知识库内容</p>
                </div>
              </CardContent>
            </Card>

            {/* Embedding 模型设置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  向量化设置
                </CardTitle>
                <CardDescription>选择文档向量化的模型和参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="embeddingModel">Embedding 模型 *</Label>
                  <CommandSelect
                    options={modelSelectOptions}
                    value={formData.embeddingModel}
                    onValueChange={value => setFormData(prev => ({ ...prev, embeddingModel: value }))}
                    placeholder="选择 Embedding 模型"
                    searchPlaceholder="搜索模型..."
                  />
                  {selectedModel && (
                    <div className="text-muted-foreground mt-2 text-sm">
                      <p>向量维度：{selectedModel.dimensions}</p>
                      <p>成本：{selectedModel.cost}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="chunkSize">分块大小</Label>
                    <Input
                      id="chunkSize"
                      type="number"
                      min="100"
                      max="4000"
                      value={formData.chunkSize || 1000}
                      onChange={e => setFormData(prev => ({ ...prev, chunkSize: parseInt(e.target.value) || 1000 }))}
                    />
                    <p className="text-muted-foreground text-xs">文档分块的字符数量 (100-4000)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chunkOverlap">重叠字符</Label>
                    <Input
                      id="chunkOverlap"
                      type="number"
                      min="0"
                      max="1000"
                      value={formData.chunkOverlap || 200}
                      onChange={e => setFormData(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) || 200 }))}
                    />
                    <p className="text-muted-foreground text-xs">分块间的重叠字符数 (0-1000)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* 右侧信息面板 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">编辑知识库</CardTitle>
              <CardDescription>修改知识库的配置和设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Embedding 模型:</span>
                  <span className="font-medium">{selectedModel?.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">分块大小:</span>
                  <span className="font-medium">{formData.chunkSize || 1000} 字符</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">重叠字符:</span>
                  <span className="font-medium">{formData.chunkOverlap || 200} 字符</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">注意事项</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-3 text-sm">
              <p>• 修改 Embedding 模型将需要重新处理所有文档</p>
              <p>• 调整分块参数会影响现有文档的检索效果</p>
              <p>• 建议在低峰期进行重要配置更改</p>
              <p>• 配置更改后建议测试检索效果</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
