'use client';

import AgentDetail from '@/components/agent-detail';
import { defaultPagination, Pagination } from '@/components/pagination';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { agentsApi } from '@/lib/api/agents';
import { Agent, PaginationBase } from '@/lib/types';
import { openDialogUserid } from '@dootask/tools';
import { MessageCircle, Search, TrendingUp, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface filterParams {
  page: number;
  page_size: number;
  filters: {
    search?: string;
    category?: string;
    create_at?: number;
  };
}
// 防抖Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function PopularAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  // const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [displayedAgents, setDisplayedAgents] = useState<Agent[]>([]);
  const [pagination, setPagination] = useState<PaginationBase>(defaultPagination);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all'); // 默认显示最近一周
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  // 使用防抖来优化搜索体验
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  // 用于取消之前的请求
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStartConversation = (bot_id?: number) => {
    if (bot_id !== undefined) {
      openDialogUserid(bot_id).then(() => {}).catch(() => console.error('打开对话窗口失败'));
    }
  };

  const handleViewDetail = (agentId: number) => {
    setSelectedAgentId(agentId);
  };

  const handleBackToList = () => {
    setSelectedAgentId(null);
  };

  // 加载智能体数据 - 添加请求取消机制防止竞态
  const loadAgents = useCallback(async (loadType: 'initial' | 'search' | 'pagination' = 'initial') => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 创建新的 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      // 根据加载类型设置不同的加载状态
      if (loadType === 'initial' ) {
        setLoading(true);
      } else if (loadType === 'search'|| loadType === 'pagination') {
        setSearching(true);
      } 
      
      // 构建请求参数，包含搜索、分类和时间过滤
      const params: filterParams = {
        page: pagination.current_page, 
        page_size: pagination.page_size,
        filters: {}
      };
      
      // 添加搜索过滤参数
      if (debouncedSearchTerm.trim()) {
        params.filters.search = debouncedSearchTerm.trim();
      }
      
      // 添加类别过滤参数 (需要后端支持category字段)
      if (categoryFilter !== 'all') {
        params.filters.category = categoryFilter;
      }
      
      // 添加时间过滤参数 (需要后端支持created_after字段)
      if (timeFilter !== 'all') {
        let days = 7; // 默认一周
        if (timeFilter === 'month') {
          days = 30;
        } else if (timeFilter === 'quarter') {
          days = 90;
        }
        
        const filterTimestamp = new Date().getTime() - (days * 24 * 60 * 60 * 1000);
        params.filters.create_at=filterTimestamp
      }
      
      const response = await agentsApi.listAll(params);

      // 检查请求是否被取消
      if (controller.signal.aborted) {
        return;
      }
      
      // 按会话数量排序（模拟热度排序）
      const sortedAgents = response.data.items.sort((a: Agent, b: Agent) => {
        return (b.statistics?.week_messages || 0) - (a.statistics?.week_messages || 0);
      });
      setAgents(sortedAgents);
      // setFilteredAgents(response.data.items);
      setDisplayedAgents(sortedAgents);
      
      // 更新分页信息
      setPagination(prev => ({
        ...prev,
        total_items: response.total_items,
        total_pages: response.total_pages
      }));
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('加载智能体失败:', error);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setSearching(false);
      }
    }
  }, [pagination.current_page, pagination.page_size, debouncedSearchTerm, categoryFilter, timeFilter]);

  // 重置筛选条件
  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setCategoryFilter('all');
    setTimeFilter('all');
    setPagination(prev => ({ ...prev, current_page: 1 }));
  }, []);

  // 页面切换处理
  const handlePageChange = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, current_page: page }));
  }, []);

  // 每页数量切换处理
  const handlePageSizeChange = useCallback((size: number) => {
    setPagination(prev => ({
      ...prev,
      page_size: size,
      current_page: 1
    }));
  }, []);

  // 统一的数据加载逻辑 - 避免多个 useEffect 相互触发
  useEffect(() => {
    let loadType: 'initial' | 'search' | 'pagination' = 'initial';
    
    // 判断是否为初始加载
    if (agents.length === 0 && pagination.current_page === 1 && !debouncedSearchTerm  && timeFilter === 'all') {
      loadType = 'initial';
    }
    // 判断是否为搜索操作（搜索条件变化且页面重置为1）
    else if (pagination.current_page === 1) {
      loadType = 'search';
    }
    // 其他情况为分页操作
    else {
      loadType = 'pagination';
    }
    
    loadAgents(loadType);
    
    // 清理函数：组件卸载时取消请求
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [pagination.current_page, pagination.page_size, debouncedSearchTerm, categoryFilter, timeFilter, loadAgents]);

  // 搜索和筛选变化时重置页码 - 单独处理，不触发数据加载
  useEffect(() => {
    if (pagination.current_page !== 1) {
      setPagination(prev => ({ ...prev, current_page: 1 }));
    }
  }, [debouncedSearchTerm, categoryFilter, timeFilter]);

  const getAgentCategory = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('助手') || desc.includes('助理')) return '智能助手';
    if (desc.includes('创作') || desc.includes('写作')) return '创意写作';
    if (desc.includes('分析') || desc.includes('数据')) return '数据分析';
    if (desc.includes('客服') || desc.includes('服务')) return '客户服务';
    return '通用工具';
  };

  const getPopularityScore = (agent: Agent) => {
    return agent.statistics?.week_messages || 0;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full mb-4" />
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* 分页骨架屏 */}
        <div className="mt-6 flex justify-center">
          <Skeleton className="h-10 w-48" />
        </div>
      </div>
    );
  }

  // 如果选中了智能体，显示详情页
  if (selectedAgentId) {
    const selectedAgent = agents.find(agent => agent.id === selectedAgentId);
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink 
                  onClick={handleBackToList}
                  className="cursor-pointer hover:text-primary"
                >
                  热门智能体
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{selectedAgent?.name || '智能体详情'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <AgentDetail 
          agentId={selectedAgentId} 
          showBreadcrumb={false}
          onDelete={handleBackToList}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">热门智能体</h1>
        </div>
        <p className="text-muted-foreground">
          发现最受欢迎的智能体，按会话热度排序
        </p>
      </div>

      {/* 筛选和搜索区域 */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 搜索框 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索智能体名称或描述..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 类别筛选 */}
          {/* <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="选择类别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有类别</SelectItem>
              <SelectItem value="assistant">智能助手</SelectItem>
              <SelectItem value="creative">创意写作</SelectItem>
              <SelectItem value="analysis">数据分析</SelectItem>
              <SelectItem value="customer">客户服务</SelectItem>
            </SelectContent>
          </Select> */}

          {/* 时间筛选 */}
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="创建时间" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">最近一周</SelectItem>
              <SelectItem value="month">最近一月</SelectItem>
              <SelectItem value="quarter">最近三月</SelectItem>
              <SelectItem value="all">所有时间</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 结果统计 */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            找到 {pagination.total_items} 个智能体，显示第 {pagination.current_page} 页，共 {pagination.total_pages} 页
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
          >
            清除筛选
          </Button>
        </div>
      </div>

      {/* 智能体卡片网格 */}
        {searching || (loading && displayedAgents.length === 0) ? (
          // 加载状态 - 显示骨架屏
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full mb-4" />
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : displayedAgents.length === 0 ? (
          // 空状态 - 无搜索结果
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">未找到匹配的智能体</h3>
            <p className="text-muted-foreground mb-4">
              尝试调整搜索条件或筛选器
            </p>
            <Button
              variant="outline"
              onClick={resetFilters}
            >
              清除所有筛选
            </Button>
          </div>
        ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedAgents.map((agent, index) => {
              // 计算全局排名（考虑分页）
              const globalIndex = (pagination.current_page - 1) * pagination.page_size + index;
              return (
                <Card key={agent.id} className="hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{agent.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {getAgentCategory(agent.description || '')}
                            </Badge>
                            {globalIndex < 3 && (
                              <Badge variant="default" className="text-xs">
                                🔥 热门
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-primary">
                          #{globalIndex + 1}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          排名
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4 line-clamp-3">
                      {agent.description || '暂无描述'}
                    </CardDescription>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          <span>{getPopularityScore(agent)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          <span>热度</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleViewDetail(agent.id)}
                      >
                        查看详情
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleStartConversation(agent.bot_id)}
                      >
                        开始对话
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 分页组件 */}
          <div className="mt-8">
            <Pagination
              currentPage={pagination.current_page}
              totalPages={pagination.total_pages}
              pageSize={pagination.page_size}
              totalItems={pagination.total_items}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </>
      )}
    </div>
  );
}