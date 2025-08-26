'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { agentsApi } from '@/lib/api/agents';
import { Agent } from '@/lib/types';
import { MessageCircle, Search, TrendingUp, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function PopularAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    filterAgents();
  }, [agents, searchTerm, categoryFilter, timeFilter]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await agentsApi.listAll();
      // 按会话数量排序（模拟热度排序）
      console.log(response);
      
      const sortedAgents = response.data.items.sort((a: Agent, b: Agent) => {
        // 这里使用 id 作为模拟的会话数量，实际应该使用真实的会话统计数据
        return (b.statistics?.week_messages || 0) - (a.statistics?.week_messages || 0);
      });
      setAgents(sortedAgents);
    } catch (error) {
      console.error('加载智能体失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAgents = () => {
    let filtered = [...agents];

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (agent.description && agent.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // 类别过滤（基于描述内容进行简单分类）
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(agent => {
        const description = agent.description?.toLowerCase() || '';
        switch (categoryFilter) {
          case 'assistant':
            return description.includes('助手') || description.includes('助理');
          case 'creative':
            return description.includes('创作') || description.includes('写作') || description.includes('设计');
          case 'analysis':
            return description.includes('分析') || description.includes('数据') || description.includes('报告');
          case 'customer':
            return description.includes('客服') || description.includes('服务');
          default:
            return true;
        }
      });
    }

    // 时间过滤（基于创建时间）
    if (timeFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(agent => {
        if (!agent.created_at) return true;
        const createdAt = new Date(agent.created_at);
        const diffTime = now.getTime() - createdAt.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        switch (timeFilter) {
          case 'week':
            return diffDays <= 7;
          case 'month':
            return diffDays <= 30;
          case 'quarter':
            return diffDays <= 90;
          default:
            return true;
        }
      });
    }

    setFilteredAgents(filtered);
  };

  const getAgentCategory = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('助手') || desc.includes('助理')) return '智能助手';
    if (desc.includes('创作') || desc.includes('写作')) return '创意写作';
    if (desc.includes('分析') || desc.includes('数据')) return '数据分析';
    if (desc.includes('客服') || desc.includes('服务')) return '客户服务';
    return '通用工具';
  };

  const getPopularityScore = (agent: Agent) => {
    // 模拟热度分数，实际应该基于真实的会话数据
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
          </Select>

          {/* 时间筛选 */}
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="创建时间" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有时间</SelectItem>
              <SelectItem value="week">最近一周</SelectItem>
              <SelectItem value="month">最近一月</SelectItem>
              <SelectItem value="quarter">最近三月</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 结果统计 */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            找到 {filteredAgents.length} 个智能体
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setCategoryFilter('all');
              setTimeFilter('all');
            }}
          >
            清除筛选
          </Button>
        </div>
      </div>

      {/* 智能体卡片网格 */}
      {filteredAgents.length === 0 ? (
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
            onClick={() => {
              setSearchTerm('');
              setCategoryFilter('all');
              setTimeFilter('all');
            }}
          >
            清除所有筛选
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent, index) => (
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
                        {index < 3 && (
                          <Badge variant="default" className="text-xs">
                            🔥 热门
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-primary">
                      #{index + 1}
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
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/agents/${agent.id}`}>
                      查看详情
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/conversations?agent=${agent.id}`}>
                      开始对话
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}