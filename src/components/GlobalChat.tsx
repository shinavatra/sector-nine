import { useState, useEffect } from "react";
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

export function GlobalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState("chats");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setIsLoading(true);
    try {
      const { friends: friendsData } = await friendsAPI.getFriends();
      
      // Map friends data to the Friend interface
      const mappedFriends: Friend[] = friendsData.map((f: any) => ({
        id: f.userId,
        name: f.username || 'Unknown',
        status: 'offline', // Can be enhanced with online status tracking
        avatar: f.avatar || '',
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

  const loadChatMessages = async (roomId: string) => {
    try {
      const { messages } = await chatAPI.getMessages(roomId);
      
      // Update the specific chat room with loaded messages
      setChatRooms(prev => prev.map(room =>
        room.id === roomId
          ? {
              ...room,
              messages: messages.map((m: any) => ({
                id: m.id,
                sender: m.username,
                message: m.message,
                timestamp: new Date(m.createdAt).toLocaleTimeString('en-US', { 
                  hour12: false, 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }),
                type: 'message' as const
              }))
            }
          : room
      ));
    } catch (error) {
      console.error('Failed to load chat messages:', error);
    }
  };

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
    if (messageInput.trim() && selectedChat) {
      const messageText = messageInput.trim();
      setMessageInput("");

      try {
        const { message: sentMessage } = await chatAPI.sendMessage(selectedChat, messageText);
        
        const newMessage: Message = {
          id: sentMessage.id,
          sender: 'You',
          message: sentMessage.message,
          timestamp: new Date(sentMessage.createdAt).toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          type: 'message'
        };

        setChatRooms(prev => prev.map(room => 
          room.id === selectedChat 
            ? { ...room, messages: [...room.messages, newMessage] }
            : room
        ));
      } catch (error) {
        console.error('Failed to send message:', error);
        toast.error('Failed to send message', {
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
        // Restore the message input
        setMessageInput(messageText);
      }
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

  const markChatAsRead = (chatId: string) => {
    setChatRooms(prev => prev.map(room =>
      room.id === chatId ? { ...room, unreadCount: 0 } : room
    ));
  };

  const startChat = (friendId: string) => {
    const friend = friends.find(f => f.id === friendId);
    if (!friend) return;

    const existingChat = chatRooms.find(room => room.id === friendId);
    if (existingChat) {
      setSelectedChat(existingChat.id);
      markChatAsRead(existingChat.id);
      loadChatMessages(existingChat.id);
      setActiveTab("chats");
      return;
    }

    const newChat: ChatRoom = {
      id: friendId,
      name: friend.name,
      type: 'friend',
      participants: [friend.name],
      unreadCount: 0,
      messages: []
    };

    setChatRooms(prev => [...prev, newChat]);
    setSelectedChat(newChat.id);
    loadChatMessages(friendId);
    setActiveTab("chats");
  };

  const totalUnreadMessages = chatRooms.reduce((total, room) => total + room.unreadCount, 0);

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
                  FRIENDS ({friends.filter(f => f.status === 'online').length})
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
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <Button
                          size="sm"
                          className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono"
                          onClick={handleSendMessage}
                        >
                          <Send className="w-4 h-4" />
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
                          onClick={() => {
                            setSelectedChat(room.id);
                            markChatAsRead(room.id);
                          }}
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