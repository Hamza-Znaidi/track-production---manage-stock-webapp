'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import ChatMessage from './ChatMessage';
import chatAPI from '@/lib/chat';
import { SendHorizontal,Paperclip,X , Hourglass} from 'lucide-react';
import { notifyError } from '@/lib/toast';
import {
  joinThread,
  leaveThread,
  sendMessage,
  markMessageRead,
  startTyping,
  stopTyping,
  onMessageNew,
  onMessageRead,
  onUserTyping,
  onUserStoppedTyping,
  removeListener,
} from '@/lib/socket';

export default function ChatThread({ threadId, currentUserId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [thread, setThread] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load thread data and initial messages
  useEffect(() => {
    const loadThread = async () => {
      try {
        setIsLoading(true);
        const [threadData, messages] = await Promise.all([
          chatAPI.getThread(threadId),
          chatAPI.getMessages(threadId),
        ]);
        setThread(threadData);
        setMessages(messages);
        joinThread(threadId);
      } catch (err) {
        notifyError('Failed to load chat');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadThread();

    return () => {
      leaveThread(threadId);
    };
  }, [threadId]);

  // Listen for new messages
  const handleNewMessage = useCallback((message) => {
    setMessages((prev) => {
      if (prev.some((existing) => existing.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
  }, []);

  // Listen for read receipts
  const handleMessageRead = useCallback((data) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === data.messageId
          ? {
              ...msg,
              reads: [...(msg.reads || []), { userId: data.userId, readAt: data.readAt }],
            }
          : msg
      )
    );
  }, []);

  // Listen for typing indicators
  const handleUserTyping = useCallback((data) => {
    setTypingUsers((prev) => new Set([...prev, data.userId]));
  }, []);

  const handleUserStoppedTyping = useCallback((data) => {
    setTypingUsers((prev) => {
      const updated = new Set(prev);
      updated.delete(data.userId);
      return updated;
    });
  }, []);

  useEffect(() => {
    onMessageNew(handleNewMessage);
    onMessageRead(handleMessageRead);
    onUserTyping(handleUserTyping);
    onUserStoppedTyping(handleUserStoppedTyping);

    return () => {
      removeListener('message:new', handleNewMessage);
      removeListener('message:marked-read', handleMessageRead);
      removeListener('typing:user-typing', handleUserTyping);
      removeListener('typing:user-stopped', handleUserStoppedTyping);
    };
  }, [handleNewMessage, handleMessageRead, handleUserTyping, handleUserStoppedTyping]);

  // Handle typing indicator
  const handleInputChange = (e) => {
    setInput(e.target.value);
    startTyping(threadId);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(threadId);
    }, 3000);
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!input.trim() && selectedFiles.length === 0) || isSending) return;

    try {
      const content = input.trim();
      setIsSending(true);
      stopTyping(threadId);
      let attachmentsPayload = [];

      if (selectedFiles.length > 0) {
        attachmentsPayload = await Promise.all(
          selectedFiles.map((file) => chatAPI.uploadAttachment(file))
        );
      }

      const sentMessage = await chatAPI.sendMessage(threadId, content, attachmentsPayload);
      setMessages((prev) => {
        if (prev.some((existing) => existing.id === sentMessage.id)) {
          return prev;
        }
        return [...prev, sentMessage];
      });
      setInput('');
      setSelectedFiles([]);
      inputRef.current?.focus();
    } catch (err) {
      notifyError('Failed to send message');
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...files]);
    event.target.value = '';
  };

  const removeSelectedFile = (indexToRemove) => {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  // Mark message as read
  const handleMarkRead = async (messageId) => {
    try {
      await chatAPI.markMessageAsRead(threadId, messageId);
    } catch (err) {
      console.error('Failed to mark message as read:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const otherParticipants = thread?.participants?.filter((p) => p.userId !== currentUserId) || [];
  const threadName = thread?.type === 'DIRECT'
    ? otherParticipants[0]?.user?.username || 'Chat'
    : thread?.name || thread?.workOrder?.workOrderNumber || 'Chat';

  return (
    <div className="flex flex-col h-[72vh] min-h-[520px] max-h-[72vh] bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">{threadName}</h3>
          {thread?.type === 'WORK_ORDER' && thread?.workOrder && (
            <p className="text-xs text-gray-500">{thread.workOrder.client}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              onRead={handleMarkRead}
            />
          ))
        )}

        {/* Typing indicator */}
        {typingUsers.size > 0 && (
          <div className="text-xs text-gray-500">
            <span>{Array.from(typingUsers).join(', ')} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="px-6 py-4 border-t border-gray-200">
        {selectedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${index}`}
                className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
              >
                <span className="max-w-[180px] truncate">📎 {file.name}</span>
                <button
                  type="button"
                  onClick={() => removeSelectedFile(index)}
                  className="text-gray-500 hover:text-gray-800"
                  aria-label="Remove attachment"
                >
                  <X />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleSelectFiles}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
            title="Attach file"
          >
            <Paperclip />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
            disabled={isSending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
          />
          <button
            type="submit"
            disabled={isSending || (!input.trim() && selectedFiles.length === 0)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            {isSending ? <Hourglass className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
