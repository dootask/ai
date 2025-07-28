'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import MessageContent from '@/components/message-content';
import { useDebounceCallback } from '@/hooks/use-debounce';
import { agentsApi } from '@/lib/api/agents';
import { fetchConversations, fetchMessages } from '@/lib/api/conversations';
import { Agent, Conversation, Message, PaginationBase } from '@/lib/types';
import { Bot, Calendar, CheckCircle, Clock, Eye, Filter, MessageSquare, Search, TrendingUp, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { defaultPagination, Pagination } from '../../components/pagination';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pagination, setPagination] = useState<PaginationBase>(defaultPagination);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [statistics, setStatistics] = useState({
    total: 0,
    today: 0,
    averageMessages: 0,
    averageResponseTime: 0,
    successRate: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // 加载对话列表
  const loadData = useDebounceCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      // 构建查询参数
      const filters: Record<string, unknown> = {};

      if (selectedAgent !== 'all') {
        filters.agent_id = parseInt(selectedAgent);
      }

      if (searchQuery) {
        filters.search = searchQuery;
      }

      // 获取对话列表
      const conversationResponse = await fetchConversations({
        page: pagination.current_page,
        page_size: pagination.page_size,
        filters,
      });

      // 使用新的响应数据结构
      setConversations(conversationResponse.data.items);

      // 设置统计信息
      setStatistics({
        total: conversationResponse.data.statistics.total,
        today: conversationResponse.data.statistics.today,
        averageMessages: Math.round(conversationResponse.data.statistics.average_messages),
        averageResponseTime: conversationResponse.data.statistics.average_response_time,
        successRate: conversationResponse.data.statistics.success_rate,
      });
    } catch (error) {
      console.error('加载数据失败:', error);
      setError('加载对话数据失败，请检查后端服务是否正常运行');
      // 如果API调用失败，显示空数据
      setConversations([]);
      setStatistics({ total: 0, today: 0, averageMessages: 0, averageResponseTime: 0, successRate: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [selectedAgent, searchQuery, pagination.current_page, pagination.page_size]);

  // 加载智能体列表
  const loadAgents = useCallback(async () => {
    try {
      const agentResponse = await agentsApi.list({ page: 1, page_size: 100 });
      setAgents(agentResponse.data.items);
    } catch (error) {
      console.error('加载智能体列表失败:', error);
      // 如果API调用失败，显示空数据
      setAgents([]);
    }
  }, []);

  // 加载对话消息
  const loadConversationMessages = async (conversationId: string) => {
    try {
      const messagesResponse = await fetchMessages(conversationId, {
        page: 1,
        page_size: 20,
        sorts: [{ key: 'created_at', desc: true }],
      });

      // 使用新的响应数据结构
      setConversationMessages(messagesResponse.data.items);
    } catch (error) {
      console.error('加载消息失败:', error);
      setConversationMessages([]);
    }
  };

  // 分页切换
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, current_page: page }));
  };
  // 每页数量切换
  const handlePageSizeChange = (size: number) => {
    setPagination(prev => ({ ...prev, page_size: size, current_page: 1 }));
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleViewConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await loadConversationMessages(conversation.id);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">对话监控</h1>
            <p className="text-muted-foreground">查看和分析 AI 处理的对话记录</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="bg-muted h-4 w-20 animate-pulse rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted h-8 w-16 animate-pulse rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">对话监控</h1>
          <p className="text-muted-foreground">查看和分析 AI 处理的对话记录</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          刷新数据
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">对话总数</CardTitle>
            <MessageSquare className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.total}</div>
            <p className="text-muted-foreground text-xs">今日新增 {statistics.today}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均消息数</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.averageMessages}</div>
            <p className="text-muted-foreground text-xs">每个对话</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.averageResponseTime.toFixed(1)}s</div>
            <p className="text-muted-foreground text-xs">AI 处理时间</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成功率</CardTitle>
            <CheckCircle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.successRate.toFixed(1)}%</div>
            <p className="text-muted-foreground text-xs">无错误响应</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="min-w-0 flex-1 sm:min-w-[200px]">
              <Select
                value={selectedAgent}
                onValueChange={value => {
                  setSearchQuery('');
                  setSelectedAgent(value);
                  setPagination(prev => ({ ...prev, current_page: 1 }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择智能体" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有智能体</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        {agent.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 flex-1 sm:min-w-[200px]">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                <Input
                  placeholder="搜索用户名或智能体..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 对话列表 */}
      <Card>
        <CardHeader>
          <CardTitle>对话记录</CardTitle>
          <CardDescription>显示 {conversations.length} 条对话记录</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <h3 className="mb-2 text-lg font-medium text-red-600">加载失败</h3>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={loadData} variant="outline" className="mt-4">
                重试
              </Button>
            </div>
          )}
          {!error && conversations.length === 0 && (
            <div className="py-12 text-center">
              <MessageSquare className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-medium">暂无对话记录</h3>
              <p className="text-muted-foreground">尚未找到匹配的对话记录</p>
            </div>
          )}
          {!error && conversations.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">用户</TableHead>
                  <TableHead className="min-w-[100px]">智能体</TableHead>
                  <TableHead className="min-w-[80px] text-center">消息数</TableHead>
                  <TableHead className="hidden min-w-[140px] sm:table-cell">开始时间</TableHead>
                  <TableHead className="min-w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map(conversation => (
                  <TableRow key={conversation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="text-muted-foreground h-4 w-4" />
                        <span className="font-medium">{conversation.user_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-blue-500" />
                        <span>{conversation.agent_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{conversation.message_count}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="text-muted-foreground flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {new Date(conversation.created_at).toLocaleString('zh-CN')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => handleViewConversation(conversation)}>
                            <Eye className="mr-1 h-4 w-4" />
                            查看详情
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] sm:max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>对话详情</DialogTitle>
                            <DialogDescription>
                              {conversation.user_name} 与 {conversation.agent_name} 的对话记录
                            </DialogDescription>
                          </DialogHeader>

                          <div className="max-h-[70vh] overflow-y-auto pr-2">
                            {selectedConversation && (
                              <div className="space-y-4">
                                {/* 对话信息 */}
                                <div className="bg-muted/50 grid grid-cols-2 gap-4 rounded-lg p-4">
                                  <div>
                                    <p className="text-sm font-medium">用户</p>
                                    <p className="text-muted-foreground text-sm">{selectedConversation.user_name}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">智能体</p>
                                    <p className="text-muted-foreground text-sm">{selectedConversation.agent_name}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">消息总数</p>
                                    <p className="text-muted-foreground text-sm">
                                      {selectedConversation.message_count}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">开始时间</p>
                                    <p className="text-muted-foreground text-sm">
                                      {new Date(selectedConversation.created_at).toLocaleString('zh-CN')}
                                    </p>
                                  </div>
                                </div>

                                {/* 消息记录 */}
                                <div className="space-y-3">
                                  <h4 className="font-medium">消息记录</h4>
                                  {selectedConversation.message_count > 20 && (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                      <span className="text-muted-foreground text-sm">仅显示最新20条记录</span>
                                    </div>
                                  )}
                                  {conversationMessages.map(message => (
                                    <div
                                      key={message.id}
                                      className={`rounded-lg p-3 ${
                                        message.role === 'user'
                                          ? 'border-l-4 border-blue-500 bg-blue-50'
                                          : 'border-l-4 border-green-500 bg-green-50'
                                      }`}
                                    >
                                      <div className="mb-2 flex items-center gap-2">
                                        {message.role === 'user' ? (
                                          <>
                                            <User className="h-4 w-4 text-blue-500" />
                                            <span className="text-sm font-medium text-blue-700">用户</span>
                                          </>
                                        ) : (
                                          <>
                                            <Bot className="h-4 w-4 text-green-500" />
                                            <span className="text-sm font-medium text-green-700">AI助手</span>
                                          </>
                                        )}
                                        <span className="text-muted-foreground ml-auto text-xs">
                                          {new Date(message.created_at).toLocaleTimeString('zh-CN')}
                                        </span>
                                        {message.response_time && (
                                          <Badge variant="outline" className="ml-1">
                                            {message.response_time}s
                                          </Badge>
                                        )}
                                      </div>
                                      <MessageContent content={message.content} messageRole={message.role} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
