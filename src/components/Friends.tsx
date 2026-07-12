import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Users, UserPlus, UserCheck, UserX, MessageCircle, Play, Search, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { friendsAPI } from "../utils/api";

interface Friend {
  id: string;
  playerId: string;
  playerName: string;
  status: 'online' | 'offline' | 'in-game' | 'away';
  addedAt: Date;
  lastSeen?: Date;
  currentActivity?: string;
}

interface FriendRequest {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  sentAt: Date;
  status: 'pending' | 'accepted' | 'declined';
}

interface FriendsProps {
  currentPlayerId: string;
  currentPlayerName: string;
}

export function Friends({ currentPlayerId, currentPlayerName }: FriendsProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("friends");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadFriendsData();
  }, [currentPlayerId]);

  const loadFriendsData = async () => {
    setIsLoading(true);
    try {
      // Load friends from API
      const { friends: friendsData } = await friendsAPI.getFriends();
      
      const mappedFriends: Friend[] = friendsData.map((f: any) => ({
        id: f.id || Date.now().toString(),
        playerId: f.userId,
        playerName: f.username || 'Unknown',
        status: 'offline', // Can be enhanced with online status tracking
        addedAt: new Date(f.addedAt || Date.now()),
        lastSeen: f.lastSeen ? new Date(f.lastSeen) : undefined
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

  const searchPlayers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const { users } = await friendsAPI.searchUsers(query);
      
      // Filter out already friends
      const results = users.filter((user: any) => 
        user.id !== currentPlayerId &&
        !friends.some(friend => friend.playerId === user.id)
      );
      
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search users:', error);
      toast.error('Failed to search users', {
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    }
  };

  const sendFriendRequest = async (targetPlayerId: string, targetPlayerName: string) => {
    try {
      await friendsAPI.sendFriendRequest(targetPlayerId);

      toast.success("Friend request sent", {
        description: `Request sent to ${targetPlayerName}`,
        className: "bg-green-900/90 border-green-700 text-green-100"
      });

      // Remove from search results
      setSearchResults(prev => prev.filter(player => player.id !== targetPlayerId));
    } catch (error) {
      console.error('Failed to send friend request:', error);
      toast.error('Failed to send friend request', {
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    }
  };

  const acceptFriendRequest = async (request: FriendRequest) => {
    try {
      await friendsAPI.acceptRequest(request.id);

      toast.success("Friend request accepted", {
        description: `${request.fromPlayerName} is now your friend`,
        className: "bg-green-900/90 border-green-700 text-green-100"
      });

      // Reload friends data
      await loadFriendsData();
      
      // Remove from friend requests
      setFriendRequests(prev => prev.filter(req => req.id !== request.id));
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      toast.error('Failed to accept friend request', {
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    }
  };

  const declineFriendRequest = (request: FriendRequest) => {
    // Remove from friend requests list
    setFriendRequests(prev => prev.filter(req => req.id !== request.id));
    
    toast.info("Friend request declined", {
      className: "bg-orange-900/90 border-orange-700 text-orange-100"
    });
  };

  const updateFriendRequestStatus = (requestId: string, status: 'accepted' | 'declined') => {
    const allRequests = JSON.parse(localStorage.getItem('friend_requests') || '[]');
    const updatedRequests = allRequests.map((req: any) => 
      req.id === requestId ? { ...req, status } : req
    );
    localStorage.setItem('friend_requests', JSON.stringify(updatedRequests));

    // Remove from current requests
    setFriendRequests(prev => prev.filter(req => req.id !== requestId));
  };

  const removeFriend = (friendId: string, friendName: string) => {
    const updatedFriends = friends.filter(friend => friend.id !== friendId);
    setFriends(updatedFriends);
    localStorage.setItem(`friends_${currentPlayerId}`, JSON.stringify(updatedFriends));

    toast.info("Friend removed", {
      description: `${friendName} has been removed from your friends list`,
      className: "bg-orange-900/90 border-orange-700 text-orange-100"
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'in-game': return 'text-orange-400';
      case 'away': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-900/20 text-green-400 border-green-700/50';
      case 'in-game': return 'bg-orange-900/20 text-orange-400 border-orange-700/50';
      case 'away': return 'bg-yellow-900/20 text-yellow-400 border-yellow-700/50';
      default: return 'bg-gray-900/20 text-gray-400 border-gray-700/50';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-black/40 border-orange-900/20">
        <CardHeader>
          <CardTitle className="text-orange-400 font-mono flex items-center">
            <Users className="w-5 h-5 mr-2" />
            FRIENDS MANAGEMENT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 bg-black/40 border border-orange-900/20">
              <TabsTrigger value="friends" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                FRIENDS ({friends.length})
              </TabsTrigger>
              <TabsTrigger value="requests" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                REQUESTS ({friendRequests.length})
              </TabsTrigger>
              <TabsTrigger value="search" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                FIND FRIENDS
              </TabsTrigger>
            </TabsList>

            {/* Friends List */}
            <TabsContent value="friends" className="space-y-4 mt-6">
              {friends.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 font-mono">No friends added yet</p>
                  <p className="text-gray-500 font-mono text-sm mt-2">
                    Use the search tab to find and add friends
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center justify-between p-4 bg-black/20 rounded border border-gray-700/30">
                      <div className="flex items-center space-x-4">
                        <div className="flex flex-col">
                          <span className="text-orange-400 font-mono">{friend.playerName}</span>
                          <Badge className={`w-fit text-xs ${getStatusBadge(friend.status)}`}>
                            {friend.status.toUpperCase()}
                          </Badge>
                        </div>
                        {friend.currentActivity && (
                          <span className="text-gray-500 font-mono text-sm">
                            Playing {friend.currentActivity}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline" className="border-green-700/50 text-green-400 hover:bg-green-900/20 font-mono">
                          <MessageCircle className="w-3 h-3 mr-1" />
                          MSG
                        </Button>
                        
                        {friend.status === 'online' && (
                          <Button size="sm" variant="outline" className="border-orange-700/50 text-orange-400 hover:bg-orange-900/20 font-mono">
                            <Play className="w-3 h-3 mr-1" />
                            INVITE
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="border-red-700/50 text-red-400 hover:bg-red-900/20 font-mono">
                              <UserX className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-black/95 border-2 border-red-500">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-red-400 font-mono">
                                Remove Friend
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-300 font-mono">
                                Are you sure you want to remove {friend.playerName} from your friends list?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-gray-700/20 border-gray-600 text-gray-400 font-mono">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => removeFriend(friend.id, friend.playerName)}
                                className="bg-red-900/20 border-red-700 text-red-400 hover:bg-red-900/30 font-mono"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Friend Requests */}
            <TabsContent value="requests" className="space-y-4 mt-6">
              {friendRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 font-mono">No pending friend requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friendRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 bg-black/20 rounded border border-orange-700/30">
                      <div className="flex items-center space-x-4">
                        <UserPlus className="w-5 h-5 text-orange-400" />
                        <div>
                          <span className="text-orange-400 font-mono">{request.fromPlayerName}</span>
                          <p className="text-gray-500 font-mono text-sm">
                            Sent {request.sentAt.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button 
                          size="sm" 
                          onClick={() => acceptFriendRequest(request)}
                          className="bg-green-900/20 border-green-700 text-green-400 hover:bg-green-900/30 font-mono"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          ACCEPT
                        </Button>
                        
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => declineFriendRequest(request)}
                          className="border-red-700/50 text-red-400 hover:bg-red-900/20 font-mono"
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          DECLINE
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Search Players */}
            <TabsContent value="search" className="space-y-4 mt-6">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchPlayers(e.target.value);
                    }}
                    placeholder="Search for players..."
                    className="pl-10 bg-black/20 border-orange-900/20 text-orange-400 font-mono"
                  />
                </div>

                {searchResults.length > 0 ? (
                  <div className="space-y-3">
                    {searchResults.map((player) => (
                      <div key={player.id} className="flex items-center justify-between p-4 bg-black/20 rounded border border-gray-700/30">
                        <div className="flex items-center space-x-4">
                          <UserCheck className="w-5 h-5 text-green-400" />
                          <div>
                            <span className="text-orange-400 font-mono">{player.username || 'Unknown'}</span>
                            {player.isPremium && (
                              <Badge className="ml-2 text-xs bg-orange-900/20 border-orange-900/30 text-orange-400">
                                VIP
                              </Badge>
                            )}
                            {player.level && (
                              <span className="ml-2 text-gray-500 font-mono text-xs">
                                Lvl {player.level}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <Button 
                          size="sm"
                          onClick={() => sendFriendRequest(player.id, player.username || 'Unknown')}
                          className="bg-green-900/20 border-green-700 text-green-400 hover:bg-green-900/30 font-mono"
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          ADD FRIEND
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : searchQuery.length >= 2 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 font-mono">No players found matching "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 font-mono">Enter at least 2 characters to search</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}