import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Switch } from "../components/ui/switch";
import { Bell, AlertTriangle, Trophy, Users, Calendar, Settings, Check, X, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "../contexts/UserContext";

// Initial notifications will be empty - data will come from backend
const initialNotifications: any[] = [];

// Alerts will be populated from backend
const alerts: any[] = [];

interface NotificationsProps {
  onNavigate?: (page: string) => void;
}

export function Notifications({ onNavigate }: NotificationsProps) {
  const { user, updateProfile } = useUser();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    matchNotifications: true,
    friendRequests: true,
    tournamentUpdates: true,
    achievementAlerts: true,
    systemMaintenance: true,
    securityAlerts: true
  });

  useEffect(() => {
    if (!user) return;
    setPreferences({
      matchNotifications: user.notificationPreferences.matchFound,
      friendRequests: user.notificationPreferences.friendRequests,
      tournamentUpdates: user.notificationPreferences.tournaments,
      achievementAlerts: user.notificationPreferences.social,
      systemMaintenance: user.notificationPreferences.systemMaintenance,
      securityAlerts: user.notificationPreferences.securityAlerts,
    });
  }, [user]);

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    toast.success("All notifications marked as read", {
      className: "bg-green-900/90 border-green-700 text-green-100"
    });
  };

  const handleMarkRead = (id: number) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, unread: false } : n
    ));
  };

  const handleDismiss = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.info("Notification dismissed", {
      className: "bg-orange-900/90 border-orange-700 text-orange-100"
    });
  };

  const handleAcceptFriend = (id: number, name: string) => {
    handleDismiss(id);
    toast.success("Friend request accepted", {
      description: `${name} is now your friend`,
      className: "bg-green-900/90 border-green-700 text-green-100"
    });
  };

  const handleDeclineFriend = (id: number) => {
    handleDismiss(id);
    toast.info("Friend request declined", {
      className: "bg-orange-900/90 border-orange-700 text-orange-100"
    });
  };

  const handleJoinMatch = (id: number) => {
    handleMarkRead(id);
    toast.success("Joining match...", {
      className: "bg-green-900/90 border-green-700 text-green-100"
    });
    // Navigate to match or handle match joining logic
  };

  const handleSavePreferences = async () => {
    if (!user) return void toast.error('You must be signed in to save notification preferences');
    setIsSavingPreferences(true);
    try {
      await updateProfile({ notificationPreferences: {
        matchFound: preferences.matchNotifications,
        friendRequests: preferences.friendRequests,
        tournaments: preferences.tournamentUpdates,
        messages: user.notificationPreferences.messages,
        social: preferences.achievementAlerts,
        systemMaintenance: preferences.systemMaintenance,
        securityAlerts: preferences.securityAlerts,
      } });
      toast.success("Preferences saved successfully", {
        className: "bg-green-900/90 border-green-700 text-green-100"
      });
    } catch (error) {
      toast.error('Unable to save notification preferences', {
        description: error instanceof Error ? error.message : 'The server rejected the update',
        className: 'bg-red-900/90 border-red-700 text-red-100',
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'penalty': return <AlertTriangle className="w-4 h-4" />;
      case 'match': return <Users className="w-4 h-4" />;
      case 'friend': return <Users className="w-4 h-4" />;
      case 'achievement': return <Trophy className="w-4 h-4" />;
      case 'tournament': return <Trophy className="w-4 h-4" />;
      case 'system': return <Settings className="w-4 h-4" />;
      case 'league': return <Trophy className="w-4 h-4" />;
      case 'invite': return <Users className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'penalty': return 'bg-red-900/20 text-red-400';
      case 'match': return 'bg-green-900/20 text-green-400';
      case 'friend': return 'bg-blue-900/20 text-blue-400';
      case 'achievement': return 'bg-orange-900/20 text-orange-400';
      case 'tournament': return 'bg-purple-900/20 text-purple-400';
      case 'system': return 'bg-gray-900/20 text-gray-400';
      case 'league': return 'bg-orange-900/20 text-orange-400';
      case 'invite': return 'bg-blue-900/20 text-blue-400';
      default: return 'bg-gray-900/20 text-gray-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'border-red-900/30 bg-red-900/10';
      case 'warning': return 'border-yellow-900/30 bg-yellow-900/10';
      case 'info': return 'border-blue-900/30 bg-blue-900/10';
      default: return 'border-gray-900/30 bg-gray-900/10';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <X className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'info': return <Eye className="w-4 h-4 text-blue-400" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-orange-400 font-mono">COMMUNICATIONS</h1>
            <p className="text-gray-400 font-mono mt-1">System alerts and facility notifications</p>
          </div>
          <div className="flex items-center space-x-4">
            {unreadCount > 0 && (
              <Badge className="bg-red-900/20 text-red-400 border-red-900/30 font-mono">
                {unreadCount} UNREAD
              </Badge>
            )}
            <Button 
              variant="outline" 
              className="border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono text-xs sm:text-sm"
              onClick={handleMarkAllRead}
            >
              <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">MARK ALL READ</span>
              <span className="sm:hidden">READ ALL</span>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-black/40 border border-orange-900/20">
          <TabsTrigger value="notifications" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            NOTIFICATIONS
          </TabsTrigger>
          <TabsTrigger value="alerts" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            SYSTEM ALERTS
          </TabsTrigger>
          <TabsTrigger value="settings" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            PREFERENCES
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          {notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`bg-black/40 border-orange-900/20 ${
                notification.unread ? 'ring-1 ring-orange-900/30' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  {notification.avatar ? (
                    <Avatar className="w-10 h-10 border border-orange-900/30">
                      <AvatarImage src={notification.avatar} />
                      <AvatarFallback className="bg-orange-900/20 text-orange-400">
                        {notification.title.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className={`p-2 rounded-lg ${getTypeColor(notification.type)}`}>
                      {getTypeIcon(notification.type)}
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-mono text-orange-400">{notification.title}</h3>
                        {notification.unread && (
                          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                        )}
                        {notification.priority === 'high' && (
                          <Badge className="bg-red-900/20 text-red-400 border-red-900/30 font-mono text-xs">
                            HIGH PRIORITY
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 font-mono">{notification.time}</span>
                    </div>
                    <p className="text-gray-300 font-mono text-sm mt-1">{notification.message}</p>
                    
                    {notification.action && (
                      <div className="mt-3 flex space-x-2">
                        <Button 
                          size="sm" 
                          className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono text-xs sm:text-sm"
                          onClick={() => handleJoinMatch(notification.id)}
                        >
                          {notification.action}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-orange-900/30 text-gray-400 hover:bg-orange-900/10 font-mono text-xs sm:text-sm"
                          onClick={() => handleDismiss(notification.id)}
                        >
                          DISMISS
                        </Button>
                      </div>
                    )}
                    
                    {(notification.type === 'friend' || notification.type === 'invite') && (
                      <div className="mt-3 flex space-x-2">
                        <Button 
                          size="sm" 
                          className="bg-green-900/20 border border-green-900/30 text-green-400 hover:bg-green-900/30 font-mono text-xs sm:text-sm"
                          onClick={() => handleAcceptFriend(notification.id, notification.message.split(' ')[0])}
                        >
                          <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          ACCEPT
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-red-900/30 text-red-400 hover:bg-red-900/10 font-mono text-xs sm:text-sm"
                          onClick={() => handleDeclineFriend(notification.id)}
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          DECLINE
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alerts.length === 0 ? (
            <Card className="bg-black/40 border-orange-900/20">
              <CardContent className="p-12">
                <div className="text-center">
                  <AlertTriangle className="w-16 h-16 text-orange-400/30 mx-auto mb-4" />
                  <h3 className="text-orange-400 font-mono mb-2">NO SYSTEM ALERTS</h3>
                  <p className="text-gray-400 font-mono text-sm">
                    All systems operational
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            alerts.map((alert) => (
              <Card key={alert.id} className={`border ${getSeverityColor(alert.severity)}`}>
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    <div className="p-2">
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-mono text-orange-400">{alert.title}</h3>
                        <span className="text-xs text-gray-400 font-mono">{alert.time}</span>
                      </div>
                      <p className="text-gray-300 font-mono text-sm mt-1">{alert.message}</p>
                      <Badge className={`mt-2 font-mono ${
                        alert.severity === 'error' ? 'bg-red-900/20 text-red-400 border-red-900/30' :
                        alert.severity === 'warning' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900/30' :
                        'bg-blue-900/20 text-blue-400 border-blue-900/30'
                      }`}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">NOTIFICATION PREFERENCES</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-orange-400">Match Notifications</div>
                    <div className="text-sm text-gray-400 font-mono">Alerts for match invitations and results</div>
                  </div>
                  <Switch 
                    checked={preferences.matchNotifications}
                    onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, matchNotifications: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-orange-400">Friend Requests</div>
                    <div className="text-sm text-gray-400 font-mono">Notifications for friend requests and messages</div>
                  </div>
                  <Switch 
                    checked={preferences.friendRequests}
                    onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, friendRequests: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-orange-400">Tournament Updates</div>
                    <div className="text-sm text-gray-400 font-mono">League and tournament announcements</div>
                  </div>
                  <Switch 
                    checked={preferences.tournamentUpdates}
                    onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, tournamentUpdates: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-orange-400">Achievement Alerts</div>
                    <div className="text-sm text-gray-400 font-mono">Notifications for unlocked achievements</div>
                  </div>
                  <Switch 
                    checked={preferences.achievementAlerts}
                    onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, achievementAlerts: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-orange-400">System Maintenance</div>
                    <div className="text-sm text-gray-400 font-mono">Server maintenance and downtime alerts</div>
                  </div>
                  <Switch 
                    checked={preferences.systemMaintenance}
                    onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, systemMaintenance: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-orange-400">Security Alerts</div>
                    <div className="text-sm text-gray-400 font-mono">Unusual activity and security warnings</div>
                  </div>
                  <Switch 
                    checked={preferences.securityAlerts}
                    onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, securityAlerts: checked }))}
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-orange-900/20">
                <Button 
                  className="bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono text-sm sm:text-base"
                  onClick={handleSavePreferences}
                  disabled={isSavingPreferences || !user}
                >
                  {isSavingPreferences ? <><Loader2 className="mr-2 size-4 animate-spin"/>SAVING...</> : 'SAVE PREFERENCES'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
