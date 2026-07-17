import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { Bell, Settings, LogOut, User, Trophy, Shield } from "lucide-react";
import { CrowbarLogo } from "./CrowbarLogo";
import { FramedAvatar } from "./FramedAvatar";
import { useUser } from "../contexts/UserContext";
import { avatarBadges } from "../utils/badgeData";

interface HeaderProps {
  onNavigate?: (page: string) => void;
  currentPage?: string;
  onLogout?: () => void;
  isPremium?: boolean;
  notificationUnreadCount?: number;
}

export function Header({ onNavigate, currentPage = 'hub', onLogout, isPremium = false, notificationUnreadCount = 0 }: HeaderProps) {
  const { user } = useUser();
  
  // Get equipped badge
  const equippedBadge = avatarBadges.find(badge => badge.id === user?.equippedBadge);
  const routeFor = (page: string) => ({ hub: '/hub', lobby: '/matchmaking', tournament: '/tournaments', stats: '/stats', store: '/store', notifications: '/notifications', profile: '/profile', configuration: '/configuration' }[page] || `/${page}`);
  const follow = (event: React.MouseEvent<HTMLAnchorElement>, page: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.(page);
  };
  
  return (
    <header className="border-b border-orange-900/20 bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <a href="/hub" onClick={(event) => follow(event, 'hub')} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                <CrowbarLogo className="w-8 h-8 text-orange-400" />
              </a>
            </div>

          </div>

          <nav className="hidden md:flex items-center space-x-6">
            {[
              { id: 'hub', label: 'HUB' },
              { id: 'lobby', label: 'MATCHMAKING' },
              { id: 'tournament', label: 'TOURNAMENT' },
              { id: 'stats', label: 'STATS' }, 
              { id: 'store', label: 'STORE' }
            ].map((page) => (
              <a
                key={page.id}
                href={routeFor(page.id)}
                className={`rounded-md px-3 py-2 text-sm font-mono ${
                  currentPage === page.id 
                    ? 'text-orange-400 bg-orange-900/20' 
                    : 'text-gray-300 hover:text-orange-400 hover:bg-orange-900/10'
                }`}
                onClick={(event) => follow(event, page.id)}
              >
                {page.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            <a
              href="/notifications"
              aria-label="Notifications"
              className="rounded-md p-2 text-gray-300 hover:text-orange-400 hover:bg-orange-900/10"
              onClick={(event) => follow(event, 'notifications')}
            >
              <span className="relative block"><Bell className="w-5 h-5" />{notificationUnreadCount>0&&<span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{notificationUnreadCount>99?'99+':notificationUnreadCount}</span>}</span>
            </a>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-orange-900/10">
                  <div className="relative">
                    <FramedAvatar frameId={user?.equippedFrame}>
                      <Avatar className={`h-10 w-10 border-2 ${isPremium?'border-yellow-400/50':'border-orange-900/30'}`}>
                        <AvatarImage src={user?.resolvedAvatar} alt={user?.username || "Player"} />
                        <AvatarFallback className="bg-orange-900/20 text-orange-400">{user?.username?.[0]?.toUpperCase() || 'P'}</AvatarFallback>
                      </Avatar>
                    </FramedAvatar>
                    {equippedBadge && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-black/80 border border-orange-900/30 rounded-full flex items-center justify-center text-xs">
                        {equippedBadge.icon}
                      </div>
                    )}
                    {isPremium && !equippedBadge && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                        <span className="text-black text-xs font-bold">V</span>
                      </div>
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-black/90 border-orange-900/20" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-orange-400">{user?.username || 'Freeman_G'}</p>
                      {isPremium && (
                        <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black text-xs font-bold px-1.5 py-0.5">
                          VIP
                        </Badge>
                      )}
                    </div>
                    <p className="w-[200px] truncate text-sm text-green-400 font-mono">
                      {isPremium ? 'VIP RESEARCHER' : `LEVEL ${user?.level || 0} RESEARCHER`}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-orange-900/20" />
                <DropdownMenuItem asChild
                  className="text-gray-300 hover:text-orange-400 hover:bg-orange-900/10"
                >
                  <a href="/profile" onClick={(event) => follow(event, 'profile')}><User className="mr-2 h-4 w-4" /><span>PERSONNEL FILE</span></a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild
                  className="text-gray-300 hover:text-orange-400 hover:bg-orange-900/10"
                >
                  <a href="/configuration" onClick={(event) => follow(event, 'configuration')}><Settings className="mr-2 h-4 w-4" /><span>CONFIGURATION</span></a>
                </DropdownMenuItem>
                {user?.role === 'admin' && <DropdownMenuItem asChild className="text-gray-300 hover:text-orange-400 hover:bg-orange-900/10"><a href="/admin" onClick={(event) => follow(event, 'admin')}><Shield className="mr-2 h-4 w-4"/><span>ADMINISTRATION</span></a></DropdownMenuItem>}
                <DropdownMenuSeparator className="bg-orange-900/20" />
                <DropdownMenuItem 
                  className="text-gray-300 hover:text-red-400 hover:bg-red-900/10"
                  onClick={onLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>DISCONNECT</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
