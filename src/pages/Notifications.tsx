import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Switch } from "../components/ui/switch";
import { Bell, AlertTriangle, Trophy, Users, Calendar, Settings, Check, X, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "../contexts/UserContext";
import { friendsAPI, notificationsAPI } from "../utils/api";
import { notifyNotificationsChanged, subscribeToNotificationChanges } from "../utils/notificationEvents";

// Initial notifications will be empty - data will come from backend
const initialNotifications: any[] = [];

// Alerts will be populated from backend
const alerts: any[] = [];

const normalizeNotifications=(items:any[]):any[]=>Array.from(new Map<string,any>((Array.isArray(items)?items:[]).filter(item=>item&&typeof item==='object'&&item.id!==undefined&&item.id!==null).map((item:any)=>{
  const createdAt=typeof item.created_at==='string'||item.created_at instanceof Date?new Date(item.created_at):null
  const normalized={...item,id:String(item.id),title:typeof item.title==='string'&&item.title.trim()?item.title:'Notification',message:typeof item.message==='string'?item.message:'',unread:item.read!==true,read:item.read===true,time:createdAt&&!Number.isNaN(createdAt.getTime())?createdAt.toLocaleString():'Date unavailable',type:item.type==='friend_request'?'friend':typeof item.type==='string'?item.type:'system'}
  return[String(item.id),normalized]
})).values())

interface NotificationsProps {
  onNavigate?: (page: string) => void;
}

export function Notifications({ onNavigate }: NotificationsProps) {
  const { user, updateProfile } = useUser();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notificationsLoading,setNotificationsLoading]=useState(true);
  const [notificationsError,setNotificationsError]=useState('');
  const [notificationsErrorCode,setNotificationsErrorCode]=useState('');
  const [notificationView,setNotificationView]=useState<'unread'|'all'>('unread');
  const notificationRequest=useRef(0);
  const [markingAllRead,setMarkingAllRead]=useState(false);
  const [clearingAll,setClearingAll]=useState(false);
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

  const loadNotifications=useCallback(async(showLoading=false)=>{if(!user){setNotificationsLoading(false);setNotificationsErrorCode('AUTH_REQUIRED');setNotificationsError('Sign in to load notifications.');return}const request=++notificationRequest.current;if(showLoading)setNotificationsLoading(true);try{const data:any=await notificationsAPI.getNotifications();if(request!==notificationRequest.current)return;setNotifications(normalizeNotifications(data.notifications||[]));setNotificationsErrorCode('');setNotificationsError('')}catch(error:any){if(request===notificationRequest.current){setNotificationsErrorCode(typeof error?.code==='string'?error.code:'NOTIFICATIONS_LOAD_FAILED');setNotificationsError(error?.message||'Unable to load notifications')}}finally{if(request===notificationRequest.current)setNotificationsLoading(false)}},[user?.id])
  useEffect(()=>{if(!user)return;let active=true;void loadNotifications(true);const poll=()=>{if(active)void loadNotifications()};const unsubscribe=subscribeToNotificationChanges(unreadCount=>{if(unreadCount===0)setNotifications(previous=>previous.map(notification=>({...notification,read:true,unread:false})));poll()});const interval=window.setInterval(poll,7000);return()=>{active=false;unsubscribe();window.clearInterval(interval);notificationRequest.current+=1}},[user?.id,loadNotifications]);

  const handleMarkAllRead=async()=>{
    if(markingAllRead||!notifications.some(notification=>notification.unread))return;
    setMarkingAllRead(true);
    try{const result:any=await notificationsAPI.markAllAsRead();notificationRequest.current+=1;setNotifications(previous=>previous.map(notification=>({...notification,read:true,unread:false})));notifyNotificationsChanged(result.unreadCount);toast.success('All notifications marked as read')}
    catch(error:any){toast.error('Unable to mark notifications as read',{description:error.message})}
    finally{setMarkingAllRead(false)}
  };

  const handleClearAll = async () => {
    if(clearingAll)return;
    setClearingAll(true);
    try{const result:any=await notificationsAPI.clearAll();notificationRequest.current+=1;setNotifications([]);notifyNotificationsChanged(result.unreadCount)}catch(error:any){return void toast.error('Unable to clear notifications',{description:error.message})}finally{setClearingAll(false)}
    toast.success("All notifications cleared", {
      className: "bg-green-900/90 border-green-700 text-green-100"
    });
  };

  const handleMarkRead = async (id: string) => {
    const result:any=await notificationsAPI.markAsRead(id);setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, read:true, unread: false } : n
    ));notifyNotificationsChanged(result.unreadCount)
  };

  const handleDismiss = async (id: string) => {
    try{const result:any=await notificationsAPI.dismiss(id);notificationRequest.current+=1;setNotifications(previous=>previous.filter(notification=>notification.id!==id));notifyNotificationsChanged(result.unreadCount)}catch(error:any){return void toast.error('Unable to dismiss notification',{description:error.message})}
    toast.info("Notification dismissed", {
      className: "bg-orange-900/90 border-orange-700 text-orange-100"
    });
  };

  const handleAcceptFriend = async (notification:any) => {
    if(!notification.related_friendship_id)return void toast.error('Friend request link is missing')
    try{const result:any=await friendsAPI.acceptRequest(notification.related_friendship_id);setNotifications(previous=>previous.filter(item=>item.id!==notification.id));notifyNotificationsChanged(result.unreadCount);toast.success("Friend request accepted", {className: "bg-green-900/90 border-green-700 text-green-100"})}catch(error:any){toast.error('Unable to accept friend request',{description:error.message})}
  };

  const handleDeclineFriend = async (notification:any) => {
    if(!notification.related_friendship_id)return void toast.error('Friend request link is missing')
    try{const result:any=await friendsAPI.declineRequest(notification.related_friendship_id);setNotifications(previous=>previous.filter(item=>item.id!==notification.id));notifyNotificationsChanged(result.unreadCount);toast.info("Friend request declined", {className: "bg-orange-900/90 border-orange-700 text-orange-100"})}catch(error:any){toast.error('Unable to decline friend request',{description:error.message})}
  };

  const handleJoinMatch = async (id: string) => {
    const notification=notifications.find(item=>item.id===id);try{await handleMarkRead(id)}catch(error:any){return void toast.error('Unable to open notification',{description:error.message})}if(notification?.type==='friend'){sessionStorage.setItem('open_friend_requests','1');onNavigate?.('profile');return}
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
  const displayedNotifications=useMemo(()=>notificationView==='unread'?notifications.filter(notification=>notification.unread):notifications,[notificationView,notifications])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-orange-400 font-mono">COMMUNICATIONS</h1>
            <p className="text-gray-400 font-mono mt-1">System alerts and facility notifications</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            {unreadCount > 0 && (
              <Badge className="bg-red-900/20 text-red-400 border-red-900/30 font-mono">
                {unreadCount} UNREAD
              </Badge>
            )}
            <Button
              variant="outline"
              className="border-green-900/40 text-green-400 hover:bg-green-900/10 font-mono text-xs sm:text-sm"
              onClick={()=>void handleMarkAllRead()}
              disabled={markingAllRead || unreadCount===0}
            >
              {markingAllRead?<Loader2 className="mr-1 size-3 animate-spin sm:mr-2 sm:size-4"/>:<Check className="mr-1 size-3 sm:mr-2 sm:size-4"/>}
              <span className="hidden sm:inline">{markingAllRead?'MARKING...':'MARK ALL READ'}</span>
              <span className="sm:hidden">{markingAllRead?'...':'READ ALL'}</span>
            </Button>
            <Button 
              variant="outline" 
              className="border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono text-xs sm:text-sm"
              onClick={handleClearAll}
              disabled={clearingAll || notifications.length===0}
            >
              {clearingAll?<Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin"/>:<X className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />}
              <span className="hidden sm:inline">{clearingAll?'CLEARING...':'CLEAR ALL'}</span>
              <span className="sm:hidden">{clearingAll?'...':'CLEAR'}</span>
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
          <Tabs value={notificationView} onValueChange={value=>setNotificationView(value as 'unread'|'all')}>
            <TabsList className="grid w-full grid-cols-2 border border-orange-900/20 bg-black/40">
              <TabsTrigger value="unread" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">UNREAD ({unreadCount})</TabsTrigger>
              <TabsTrigger value="all" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">ALL ({notifications.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          {notificationsLoading&&<Card className="border-orange-900/20 bg-black/40"><CardContent className="p-6 font-mono text-sm text-gray-400">Loading notifications…</CardContent></Card>}
          {notificationsError&&<Card className="border-red-700/40 bg-red-950/10"><CardContent className="space-y-3 p-6 font-mono text-sm text-red-300"><p><strong>{notificationsErrorCode}</strong>: {notificationsError}</p><Button type="button" variant="outline" onClick={()=>void loadNotifications(true)} className="border-red-700/40 text-red-200">RETRY</Button></CardContent></Card>}
          {!notificationsLoading&&!notificationsError&&!displayedNotifications.length&&<Card className="border-orange-900/20 bg-black/40"><CardContent className="flex flex-col items-center p-10 text-center"><Bell className="mb-3 size-10 text-orange-400/30"/><p className="font-mono text-sm text-gray-400">{notificationView==='unread'?'You are all caught up.':'No notifications have arrived yet.'}</p></CardContent></Card>}
          {displayedNotifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`border-orange-900/20 ${
                notification.unread ? 'bg-black/40 ring-1 ring-orange-900/30' : 'bg-gray-950/70 opacity-60'
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
                          onClick={() => void handleAcceptFriend(notification)}
                        >
                          <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          ACCEPT
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-red-900/30 text-red-400 hover:bg-red-900/10 font-mono text-xs sm:text-sm"
                          onClick={() => void handleDeclineFriend(notification)}
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
                    aria-label="Match notifications"
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
                    aria-label="Friend request notifications"
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
                    aria-label="Tournament update notifications"
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
                    aria-label="Achievement notifications"
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
                    aria-label="System maintenance notifications"
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
                    aria-label="Security notifications"
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
