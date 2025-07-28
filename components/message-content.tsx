import { Quote } from 'lucide-react';
import React from 'react';

interface MessageContentProps {
  content: string;
  messageRole?: 'user' | 'assistant' | 'system';
}

const MessageContent: React.FC<MessageContentProps> = ({ content, messageRole }) => {
  const parseContent = (text: string) => {
    const quotedRegex = /<quoted_content>([\s\S]*?)<\/quoted_content>/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = quotedRegex.exec(text)) !== null) {
      // 添加引用前的普通文本
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        if (beforeText.trim()) {
          parts.push(
            <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
              {beforeText}
            </span>
          );
        }
      }

      // 添加引用内容
      const quotedText = match[1];
      parts.push(
        <div
          key={`quote-${match.index}`}
          className={`my-3 rounded-md border-l-4 p-3 ${
            messageRole === 'user' 
              ? 'border-blue-300 bg-blue-50/50' 
              : messageRole === 'system'
              ? 'border-purple-300 bg-purple-50/50'
              : 'border-gray-300 bg-gray-50/50'
          }`}
        >
          <div className="mb-2 flex items-center gap-1 text-xs text-gray-500">
            <Quote className="h-3 w-3" />
            <span>引用内容</span>
          </div>
          <div className="whitespace-pre-wrap text-sm text-gray-700 italic">
            {quotedText.trim()}
          </div>
        </div>
      );

      lastIndex = quotedRegex.lastIndex;
    }

    // 添加剩余的普通文本
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      if (remainingText.trim()) {
        parts.push(
          <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
            {remainingText}
          </span>
        );
      }
    }

    return parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{text}</span>;
  };

  return <div className="text-sm">{parseContent(content)}</div>;
};

export default MessageContent; 