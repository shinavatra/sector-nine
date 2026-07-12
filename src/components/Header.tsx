import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { Bell, Settings, LogOut, User, Trophy } from "lucide-react";
import { CrowbarLogo } from "./CrowbarLogo";
import { useUser } from "../contexts/UserContext";
import { avatarBadges, profileFrames } from "../utils/badgeData";

interface HeaderProps {
  onNavigate?: (page: string) => void;
  currentPage?: string;
  onLogout?: () => void;
  isPremium?: boolean;
}

export function Header({ onNavigate, currentPage = 'hub', onLogout, isPremium = false }: HeaderProps) {
  const { user } = useUser();
  
  // Get equipped badge
  const equippedBadge = avatarBadges.find(badge => badge.id === user?.equippedBadge);
  const equippedFrame = profileFrames.find(frame => frame.id === user?.equippedFrame);
  
  return (
    <header className="border-b border-orange-900/20 bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => onNavigate?.('hub')} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                <CrowbarLogo className="w-8 h-8 text-orange-400" />
              </button>
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
              <Button 
                key={page.id}
                variant="ghost" 
                size="sm" 
                className={`font-mono ${
                  currentPage === page.id 
                    ? 'text-orange-400 bg-orange-900/20' 
                    : 'text-gray-300 hover:text-orange-400 hover:bg-orange-900/10'
                }`}
                onClick={() => onNavigate?.(page.id)}
              >
                {page.label}
              </Button>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-gray-300 hover:text-orange-400 hover:bg-orange-900/10"
              onClick={() => onNavigate?.('notifications')}
            >
              <Bell className="w-5 h-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-orange-900/10">
                  <div className="relative">
                    <Avatar className={`h-10 w-10 border-2 ${
                      equippedFrame 
                        ? 'border-orange-400 shadow-lg shadow-orange-500/30' 
                        : isPremium 
                          ? 'border-yellow-400/50' 
                          : 'border-orange-900/30'
                    }`}>
                      <AvatarImage src={user?.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"} alt={user?.username || "Player"} />
                      <AvatarFallback className="bg-orange-900/20 text-orange-400">
                        {user?.username?.[0]?.toUpperCase() || 'P'}
                      </AvatarFallback>
                    </Avatar>
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
                <DropdownMenuItem 
                  className="text-gray-300 hover:text-orange-400 hover:bg-orange-900/10"
                  onClick={() => onNavigate?.('profile')}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>PERSONNEL FILE</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-gray-300 hover:text-orange-400 hover:bg-orange-900/10"
                  onClick={() => onNavigate?.('configuration')}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>CONFIGURATION</span>
                </DropdownMenuItem>
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