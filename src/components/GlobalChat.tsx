import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { MessageCircle, Send, X, Users, UserPlus, Settings, Volume2, VolumeX, Minimize2 } from "lucide-react";
import { friendsAPI, chatAPI } from "../utils/api";
import { toast } from "sonner";
import { useUser } from "../contexts/UserContext";

interface Friend {
  id: string;
  name: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  avatar: string;
  lastSeen?: string;
  currentMatch?: string;
}

interface Message {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
  createdAt: string;
  type: 'message' | 'system';
}

interface ChatRoom {
  id: string;
  name: string;
  type: 'friend' | 'group';
  participants: string[];
  messages: Message[];
  unreadCount: number;
}

const displayedChatNotificationIds = new Set<string>();

export function GlobalChat() {
  const { onlineFriends, user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState("chats");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const seenNotificationIds = useRef(displayedChatNotificationIds);
  const unreadInitialized = useRef(false);
  const originalTitle = useRef(document.title);
  const selectedChatRef = useRef<string | null>(null);
  const loadedConversationRef = useRef<string | null>(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    let active = true;
    const pollUnread = async () => {
      try {
        const { unread } = await chatAPI.getUnread();
        if (!active) return;
        const items = Array.isArray(unread) ? unread : [];
        const counts = new Map<string, { count: number; username: string }>();
        for (const item of items) {
          const current = counts.get(item.sender_id) || { count: 0, username: item.sender_name || item.sender_username || 'Unknown' };
          current.count += 1;
          counts.set(item.sender_id, current);
        }
        setChatRooms(prev => {
          const next = prev.map(room => ({ ...room, unreadCount: counts.get(room.id)?.count || 0 }));
          for (const [senderId, value] of counts) {
            if (!next.some(room => room.id === senderId)) next.push({
              id: senderId,
              name: value.username,
              type: 'friend',
              participants: [value.username],
              messages: [],
              unreadCount: value.count
            });
          }
          return next;
        });
        for (const item of items) {
          const notificationId = String(item.notification_id);
          if (seenNotificationIds.current.has(notificationId)) continue;
          seenNotificationIds.current.add(notificationId);
          if (unreadInitialized.current) toast('New secure message', {
            description: `${item.sender_name || item.sender_username} sent you a message`,
            action: { label: 'Open', onClick: () => openConversation(item.sender_id, item.sender_name || item.sender_username) }
          });
        }
        unreadInitialized.current = true;
      } catch {
        // Keep the last known unread state during transient polling failures.
      }
    };
    void pollUnread();
    const interval = window.setInterval(pollUnread, 7000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  useEffect(() => {
    const onlineIds = new Set(onlineFriends.map(friend => friend.id));
    setFriends(prev => prev.map(friend => ({ ...friend, status: onlineIds.has(friend.id) ? 'online' : 'offline' })));
  }, [onlineFriends]);

  const loadFriends = async () => {
    setIsLoading(true);
    try {
      const { friends: friendsData } = await friendsAPI.getFriends();
      
      // Map friends data to the Friend interface
      const mappedFriends: Friend[] = friendsData.map((f: any) => ({
        id: f.userId,
        name: f.username || 'Unknown',
        status: f.isOnline ? 'online' : 'offline',
        avatar: f.resolvedAvatar || f.steam_avatar || '',
        lastSeen: f.lastSeen || 'Recently'
      }));
      
      setFriends(mappedFriends);
    } catch (error) {
      console.error('Failed to load friends:', error);
      toast.error('Failed to load friends', {
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeMessage = (message: any): Message => {
    const createdAt = String(message.created_at ?? message.createdAt);
    return {
      id: String(message.id),
      sender: message.user_id === user?.id || message.userId === user?.id ? 'You' : message.username,
      message: message.message,
      createdAt,
      timestamp: new Date(createdAt).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }),
      type: 'message'
    };
  };

  const mergeMessages = (current: Message[], incoming: Message[]) => {
    const byId = new Map(current.map(message => [message.id, message]));
    for (const message of incoming) byId.set(message.id, message);
    return Array.from(byId.values()).sort((a, b) => {
      const timeDifference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return timeDifference || a.id.localeCompare(b.id);
    });
  };

  const loadChatMessages = async (roomId: string, shouldApply = () => true) => {
    const { messages } = await chatAPI.getMessages(roomId);
    if (!shouldApply()) return;
    const normalized = (Array.isArray(messages) ? messages : []).map(normalizeMessage);
    setChatRooms(prev => prev.map(room =>
      room.id === roomId
        ? { ...room, messages: mergeMessages(room.messages, normalized) }
        : room
    ));
  };

  useEffect(() => {
    if (!isOpen || !selectedChat || !user) return;
    const roomId = selectedChat;
    let active = true;
    let requestRunning = false;
    const replaceInitialMessages = loadedConversationRef.current !== roomId;

    if (replaceInitialMessages) {
      loadedConversationRef.current = roomId;
      setChatRooms(prev => prev.map(room => room.id === roomId ? { ...room, messages: [] } : room));
    }

    const pollConversation = async () => {
      if (requestRunning) return;
      requestRunning = true;
      try {
        if (!active || selectedChatRef.current !== roomId) return;
        await loadChatMessages(roomId, () => active && selectedChatRef.current === roomId);
      } catch (error) {
        if (active && selectedChatRef.current === roomId) {
          console.error('Failed to load chat messages:', error);
        }
      } finally {
        requestRunning = false;
      }
    };

    void pollConversation();
    const interval = window.setInterval(() => void pollConversation(), 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isOpen, selectedChat, user?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'away': return 'bg-yellow-400';
      case 'busy': return 'bg-red-400';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (friend: Friend) => {
    if (friend.status === 'online' && friend.currentMatch) {
      return `Playing: ${friend.currentMatch}`;
    }
    if (friend.status === 'offline' && friend.lastSeen) {
      return `Last seen: ${friend.lastSeen}`;
    }
    return friend.status.charAt(0).toUpperCase() + friend.status.slice(1);
  };

  const handleSendMessage = async () => {
    const messageText = messageInput.trim();
    if (!messageText || !selectedChat || isSending) return;
    const roomId = selectedChat;
    setIsSending(true);

      try {
        const { message: sentMessage } = await chatAPI.sendMessage(roomId, messageText);
        const newMessage = normalizeMessage({ ...sentMessage, user_id: user?.id });

        setChatRooms(prev => prev.map(room => 
          room.id === roomId
            ? { ...room, messages: mergeMessages(room.messages, [newMessage]) }
            : room
        ));
        if (selectedChatRef.current === roomId) setMessageInput("");
      } catch (error) {
        toast.error('Failed to send message', {
          description: error instanceof Error ? error.message : 'The server rejected the message',
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
      } finally {
        setIsSending(false);
      }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (selectedChat) {
      try {
        await chatAPI.deleteMessage(selectedChat, messageId);
        
        setChatRooms(prev => prev.map(room =>
          room.id === selectedChat
            ? { ...room, messages: room.messages.filter(msg => msg.id !== messageId) }
            : room
        ));
        
        toast.success('Message deleted', {
          className: 'bg-green-900/90 border-green-700 text-green-100'
        });
      } catch (error) {
        console.error('Failed to delete message:', error);
        toast.error('Failed to delete message', {
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
      }
    }
  };

  const markChatAsRead = async (chatId: string) => {
    setChatRooms(prev => prev.map(room =>
      room.id === chatId ? { ...room, unreadCount: 0 } : room
    ));
    try {
      await chatAPI.markConversationRead(chatId);
    } catch (error) {
      toast.error('Unable to mark conversation read', {
        description: error instanceof Error ? error.message : 'The server rejected the update'
      });
    }
  };

  function openConversation(friendId: string, friendName: string) {
    setChatRooms(prev => prev.some(room => room.id === friendId) ? prev : [...prev, {
      id: friendId,
      name: friendName,
      type: 'friend',
      participants: [friendName],
      unreadCount: 0,
      messages: []
    }]);
    setIsOpen(true);
    setIsMinimized(false);
    setSelectedChat(friendId);
    setActiveTab('chats');
    void markChatAsRead(friendId);
  }

  const startChat = (friendId: string) => {
    const friend = friends.find(f => f.id === friendId);
    if (!friend) return;

    const existingChat = chatRooms.find(room => room.id === friendId);
    if (existingChat) {
      openConversation(existingChat.id, existingChat.name);
      return;
    }
    openConversation(friendId, friend.name);
  };

  const totalUnreadMessages = chatRooms.reduce((total, room) => total + room.unreadCount, 0);

  useEffect(() => {
    document.title = totalUnreadMessages > 0
      ? `(${totalUnreadMessages}) ${originalTitle.current}`
      : originalTitle.current;
    return () => { document.title = originalTitle.current; };
  }, [totalUnreadMessages]);

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono relative"
          size="lg"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          SECURE COMMS
          {totalUnreadMessages > 0 && (
            <Badge className="absolute -top-2 -right-2 bg-red-600 text-white text-xs min-w-5 h-5 flex items-center justify-center rounded-full">
              {totalUnreadMessages}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${isMinimized ? 'w-80 h-12' : 'w-96 h-[600px]'}`}>
      <Card className="bg-black/90 border-orange-900/20 h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4 text-orange-400" />
              <CardTitle className="text-orange-400 font-mono text-sm">SECURE COMMS</CardTitle>
              {totalUnreadMessages > 0 && (
                <Badge className="bg-red-600 text-white text-xs">
                  {totalUnreadMessages}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-orange-400 h-6 w-6 p-0"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-orange-400 h-6 w-6 p-0"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-red-400 h-6 w-6 p-0"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="flex-1 p-0 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 bg-black/40 border-b border-orange-900/20 rounded-none">
                <TabsTrigger value="chats" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                  CHATS {totalUnreadMessages > 0 && `(${totalUnreadMessages})`}
                </TabsTrigger>
                <TabsTrigger value="friends" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                  FRIENDS ({onlineFriends.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chats" className="flex-1 flex flex-col mt-0">
                {selectedChat ? (
                  // Chat View
                  <div className="flex-1 flex flex-col">
                    <div className="p-3 border-b border-orange-900/20 bg-black/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-orange-400 font-mono text-xs"
                            onClick={() => setSelectedChat(null)}
                          >
                            ← BACK
                          </Button>
                          <span className="text-orange-400 font-mono text-sm">
                            {chatRooms.find(room => room.id === selectedChat)?.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ScrollArea className="flex-1 p-3">
                      <div className="space-y-3">
                        {chatRooms.find(room => room.id === selectedChat)?.messages.map((msg) => (
                          <div key={msg.id} className="group space-y-1">
                            <div className="flex items-center space-x-2 relative">
                              <span className="text-xs text-gray-500 font-mono">[{msg.timestamp}]</span>
                              {msg.type === 'system' ? (
                                <span className="text-blue-400 font-mono text-xs">{msg.message}</span>
                              ) : (
                                <>
                                  <span className="text-orange-400 font-mono text-xs">{msg.sender}:</span>
                                  <span className="text-gray-300 font-mono text-xs flex-1">{msg.message}</span>
                                  {msg.sender === 'You' && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="p-3 border-t border-orange-900/20">
                      <div className="flex items-center space-x-2">
                        <Input
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          placeholder="Type message..."
                          className="flex-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono text-xs"
                          disabled={isSending}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendMessage(); } }}
                        />
                        <Button
                          size="sm"
                          className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
                          onClick={handleSendMessage}
                          disabled={isSending || !messageInput.trim()}
                        >
                          <Send className={`w-4 h-4 ${isSending ? 'animate-pulse' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Chat List
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                      {chatRooms.map((room) => (
                        <div
                          key={room.id}
                          className="flex items-center space-x-3 p-2 bg-black/20 border border-orange-900/20 rounded cursor-pointer hover:bg-orange-900/10"
                          onClick={() => openConversation(room.id, room.name)}
                        >
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={friends.find(f => f.name === room.name)?.avatar} />
                            <AvatarFallback className="bg-orange-900/20 text-orange-400 text-xs">
                              {room.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-orange-400 font-mono text-sm truncate">{room.name}</span>
                              {room.unreadCount > 0 && (
                                <Badge className="bg-red-600 text-white text-xs">
                                  {room.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-gray-400 font-mono text-xs truncate">
                              {room.messages[room.messages.length - 1]?.message || 'No messages'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="friends" className="flex-1 mt-0">
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {isLoading ? (
                      <div className="text-center text-gray-400 font-mono text-xs py-4">
                        Loading friends...
                      </div>
                    ) : friends.length === 0 ? (
                      <div className="text-center text-gray-400 font-mono text-xs py-4">
                        No friends yet. Add some friends to chat!
                      </div>
                    ) : (
                      friends.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center space-x-3 p-2 bg-black/20 border border-orange-900/20 rounded"
                        >
                          <div className="relative">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={friend.avatar} />
                              <AvatarFallback className="bg-orange-900/20 text-orange-400 text-xs">
                                {friend.name.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-black ${getStatusColor(friend.status)}`}></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-orange-400 font-mono text-sm">{friend.name}</div>
                            <div className="text-gray-400 font-mono text-xs truncate">
                              {getStatusText(friend)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-400 hover:text-green-300 h-6 w-6 p-0"
                            onClick={() => startChat(friend.id)}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
