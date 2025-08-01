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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/contexts/app-context';
import { embeddingModels } from '@/lib/ai';
import { agentsApi } from '@/lib/api/agents';
import { knowledgeBasesApi } from '@/lib/api/knowledge-bases';
import { Agent, KnowledgeBase, KnowledgeBaseDocument } from '@/lib/types';
import { getAllAgents } from '@/lib/utils';
import { Bot, Database, Edit, Eye, FileText, Plus, Search, Settings, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function KnowledgeBaseDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { Confirm } = useAppContext();
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [relatedAgents, setRelatedAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);

  // 可以根据URL hash或其他方式获取默认tab，这里暂时使用固定值
  const defaultTab = searchParams.get('tab') || 'documents';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const kbId = parseInt(params.id as string);

      // 获取知识库详情
      const kbData = await knowledgeBasesApi.get(kbId);
      const parsedKB = kbData; // Assuming parseKnowledgeBaseMetadata is removed
      setKnowledgeBase(parsedKB);

      // 获取文档列表
      const docsResponse = await knowledgeBasesApi.getDocuments(kbId);
      const formattedDocs = docsResponse.data.items.map((doc: KnowledgeBaseDocument) => {
        const parsedDoc = doc; // Assuming parseDocumentMetadata is removed
        return parsedDoc;
      });
      setDocuments(formattedDocs);

      // 获取使用此知识库的智能体
      const agentsResponse = await agentsApi.list();
      const usingAgents = agentsResponse.data.items.filter((agent: Agent) => {
        try {
          let kbIds: number[] = [];
          if (Array.isArray(agent.knowledge_bases)) {
            kbIds = agent.knowledge_bases.map((kb: unknown) => (typeof kb === 'number' ? kb : parseInt(String(kb))));
          }
          return kbIds.includes(kbId);
        } catch (error) {
          console.error('解析智能体知识库失败:', error);
          return false;
        }
      });
      setRelatedAgents(usingAgents);
    } catch (error) {
      console.error('加载知识库数据失败:', error);
      toast.error('加载知识库数据失败');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const handleDelete = async () => {
    if (!knowledgeBase) return;

    try {
      // 使用getAllAgents确保检查所有智能体的关联关系
      const allAgents = await getAllAgents();
      const usingAgents = allAgents.filter(agent => {
        try {
          let kbIds: number[] = [];
          if (typeof agent.knowledge_bases === 'string') {
            kbIds = JSON.parse(agent.knowledge_bases);
          } else if (Array.isArray(agent.knowledge_bases)) {
            kbIds = agent.knowledge_bases.map(kb => (typeof kb === 'number' ? kb : parseInt(kb.toString())));
          }
          return kbIds.includes(knowledgeBase.id);
        } catch {
          return false;
        }
      });

      if (usingAgents.length > 0) {
        const agentNames = usingAgents.map(agent => agent.name).join('、');
        const confirmed = await Confirm({
          title: '确定要删除这个知识库吗？',
          message: `该知识库正在被 ${usingAgents.length} 个智能体使用：${agentNames}。\n\n删除后这些智能体将无法访问该知识库的内容。是否继续删除？`,
          variant: 'destructive',
        });

        if (!confirmed) {
          return;
        }
      } else {
        const confirmed = await Confirm({
          title: '确定要删除这个知识库吗？',
          message: '此操作不可撤销。',
          variant: 'destructive',
        });

        if (!confirmed) {
          return;
        }
      }

      await knowledgeBasesApi.delete(parseInt(params.id as string));

      if (usingAgents.length > 0) {
        toast.success(`知识库删除成功，${usingAgents.length} 个智能体的关联已自动解除`);
      } else {
        toast.success('知识库删除成功');
      }

      router.push('/knowledge');
    } catch (error) {
      console.error('删除知识库失败:', error);
      toast.error('删除知识库失败，请重试');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const file = files[0];

    try {
      // 简化的文件上传逻辑
      const content = await file.text(); // 对于文本文件
      const documentData = {
        title: file.name,
        content: content,
        file_type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
        file_size: file.size,
        file_path: `/uploads/${file.name}`,
      };

      const newDocument = await knowledgeBasesApi.uploadDocument(parseInt(params.id as string), documentData);

      setDocuments(prev => [newDocument, ...prev]);
      toast.success(`文件 "${file.name}" 上传成功`);
    } catch (error) {
      console.error('文件上传失败:', error);
      toast.error('文件上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (
      await Confirm({
        title: '确定要删除这个文档吗？',
        message: '此操作无法撤销。',
        variant: 'destructive',
      })
    ) {
      try {
        await knowledgeBasesApi.deleteDocument(parseInt(params.id as string), docId);
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
        toast.success('文档删除成功');
      } catch (error) {
        console.error('删除文档失败:', error);
        toast.error('删除文档失败');
      }
    }
  };

  const filteredDocuments = documents.filter(doc => doc.title?.toLowerCase().includes(searchTerm.toLowerCase()));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return (
          <Badge variant="default" className="bg-green-500">
            已处理
          </Badge>
        );
      case 'processing':
        return <Badge variant="secondary">处理中</Badge>;
      case 'failed':
        return <Badge variant="destructive">处理失败</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    const iconClass = 'h-4 w-4';
    switch (type) {
      case 'pdf':
        return <FileText className={`${iconClass} text-red-500`} />;
      case 'docx':
      case 'doc':
        return <FileText className={`${iconClass} text-blue-500`} />;
      case 'md':
      case 'markdown':
        return <FileText className={`${iconClass} text-green-500`} />;
      case 'txt':
        return <FileText className={`${iconClass} text-gray-500`} />;
      default:
        return <FileText className={`${iconClass} text-muted-foreground`} />;
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
      </div>
    );
  }

  if (!knowledgeBase) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <Database className="text-muted-foreground mb-4 h-16 w-16" />
        <h2 className="mb-2 text-xl font-semibold">知识库不存在</h2>
        <p className="text-muted-foreground mb-4">请检查 URL 是否正确</p>
        <Button asChild>
          <Link href="/knowledge">返回列表</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb 导航 */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/knowledge">知识库管理</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{knowledgeBase.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 页面标题和操作 */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className={`mt-1 rounded-lg p-2 ${knowledgeBase.is_active ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}
            >
              <Database
                className={`h-5 w-5 ${knowledgeBase.is_active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{knowledgeBase.name}</h1>
            <Badge variant={knowledgeBase.is_active ? 'default' : 'secondary'}>
              {knowledgeBase.is_active ? '启用' : '停用'}
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">{knowledgeBase.description || '暂无描述'}</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/knowledge/${knowledgeBase.id}/edit`}>
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

      {/* 知识库信息 */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">文档统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{knowledgeBase.documents_count || 0}</div>
            <p className="text-muted-foreground text-sm">已上传文档</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">关联智能体</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{relatedAgents.length}</div>
            <p className="text-muted-foreground text-sm">正在使用此知识库</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">向量化模型</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {embeddingModels.find(model => model.value === knowledgeBase.embedding_model)?.label ||
                knowledgeBase.embedding_model}
            </div>
            <p className="text-muted-foreground text-sm">Embedding 模型</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">创建时间</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {new Date(knowledgeBase.created_at).toLocaleDateString('zh-CN')}
            </div>
            <p className="text-muted-foreground text-sm">知识库创建日期</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="gap-2">
          <TabsTrigger value="documents">文档管理</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
          {/* 文档上传和搜索 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    文档管理
                  </CardTitle>
                  <CardDescription>上传和管理知识库文档</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      placeholder="搜索文档..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-64 pl-9"
                    />
                  </div>
                  <Button asChild>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {uploading ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          上传中...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          上传文档
                        </>
                      )}
                    </label>
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.md,.txt"
                    disabled={uploading}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {filteredDocuments.length === 0 ? (
                <div className="text-muted-foreground flex h-32 flex-col items-center justify-center">
                  <FileText className="mb-2 h-8 w-8" />
                  <p>{searchTerm ? '没有找到匹配的文档' : '还没有上传任何文档'}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>文档名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>大小</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>分块数</TableHead>
                      <TableHead>上传时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(doc.file_type)}
                            {doc.title}
                          </div>
                        </TableCell>
                        <TableCell>{doc.file_type}</TableCell>
                        <TableCell>{doc.file_size}</TableCell>
                        <TableCell>{getStatusBadge(doc.status)}</TableCell>
                        <TableCell>{doc.chunks_count || 0}</TableCell>
                        <TableCell>{new Date(doc.created_at).toLocaleDateString('zh-CN')}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                知识库设置
              </CardTitle>
              <CardDescription>管理知识库的配置和参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">基本信息</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-muted-foreground text-sm">知识库名称</span>
                      <p className="font-medium">{knowledgeBase.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">描述</span>
                      <p className="font-medium">{knowledgeBase.description || '暂无描述'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">向量化配置</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-muted-foreground text-sm">Embedding 模型</span>
                      <p className="font-medium">
                        {embeddingModels.find(model => model.value === knowledgeBase.embedding_model)?.label ||
                          knowledgeBase.embedding_model}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">分块大小</span>
                      <p className="font-medium">{knowledgeBase.chunk_size || 1000} 字符</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">重叠字符</span>
                      <p className="font-medium">{knowledgeBase.chunk_overlap || 200} 字符</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">关联智能体</h3>
                  <p className="text-muted-foreground text-sm">正在使用此知识库的智能体列表</p>
                </div>
              </div>
              <div className="space-y-3">
                {relatedAgents.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center">暂无关联智能体</p>
                ) : (
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
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
