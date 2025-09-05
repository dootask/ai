'use client';

import AgentDetail from '@/components/agent-detail';
import { useParams } from 'next/navigation';

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = parseInt(params.id as string);

  return <AgentDetail agentId={agentId} showBreadcrumb={true} />;
}
