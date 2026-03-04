'use client';

import { useState, useEffect } from 'react';
import { Paperclip } from 'lucide-react';

export default function ChatMessage({ message, currentUserId, onRead }) {
  const isOwn = message.senderId === currentUserId;
  const hasBeenRead = message.reads && message.reads.some(r => r.userId === currentUserId);
  const imageAttachments = (message.attachments || []).filter(
    (attachment) => attachment?.mimeType?.startsWith('image/')
  );
  const fileAttachments = (message.attachments || []).filter(
    (attachment) => !attachment?.mimeType?.startsWith('image/')
  );

  useEffect(() => {
    // Mark as read when message comes into view
    if (!isOwn && !hasBeenRead && onRead) {
      const timer = setTimeout(() => {
        onRead(message.id);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [message.id, isOwn, hasBeenRead, onRead]);

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwn
            ? 'bg-indigo-600 text-white rounded-br-none'
            : 'bg-gray-100 text-gray-900 rounded-bl-none'
        }`}
      >
        {!isOwn && <p className="text-xs font-semibold text-gray-600 mb-1">{message.sender?.username}</p>}
        {message.content && (
          <p className="text-sm break-words">{message.content}</p>
        )}
        
        {imageAttachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {imageAttachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={att.url}
                  alt={att.filename}
                  className="max-h-64 w-full rounded-lg object-cover border border-black/10"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}

        {fileAttachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {fileAttachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block text-xs underline ${
                  isOwn ? 'text-indigo-100' : 'text-indigo-600'
                }`}
              >
                <Paperclip className="w-3 h-3 mr-1 inline" /> {att.filename}
              </a>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs ${isOwn ? 'text-indigo-200' : 'text-gray-500'}`}>
            {formatTime(message.createdAt)}
          </span>
          {isOwn && message.reads && (
            <span className="text-xs ml-2">
              {message.reads.length > 0 ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
