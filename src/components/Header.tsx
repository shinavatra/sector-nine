import * as React from "react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { Bell, Settings, LogOut, User, Shield, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { CrowbarLogo } from "./CrowbarLogo";
import { FramedAvatar } from "./FramedAvatar";
import { useUser } from "../contexts/UserContext";
import { displayPlayerName, playerInitials } from "../utils/displayName";
import { isAdminUser, showPlayerProgression } from "../utils/userRole";

interface HeaderProps {
  onNavigate?: (page: string) => void;
  currentPage?: string;
  onLogout?: () => void;
  isPremium?: boolean;
  notificationUnreadCount?: number;
}

export function Header({ onNavigate, currentPage = 'hub', onLogout, isPremium = false, notificationUnreadCount = 0 }: HeaderProps) {
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const playerName = displayPlayerName(user, "Player");
  const isAdmin = isAdminUser(user);
  const hasPlayerProgression = showPlayerProgression(user);
  
  const routeFor = (page: string) => ({ hub: '/hub', lobby: '/matchmaking', tournament: '/tournaments', stats: '/stats', store: '/store', notifications: '/notifications', profile: '/profile', achievements:'/achievements', configuration: '/configuration' }[page] || `/${page}`);
  const follow = (event: React.MouseEvent<HTMLAnchorElement>, page: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setMobileOpen(false);
    onNavigate?.(page);
  };
  React.useEffect(() => setMobileOpen(false), [currentPage]);
  const navItems = [
    { id: 'hub', label: 'HUB' }, { id: 'lobby', label: 'MATCHMAKING' },
    { id: 'tournament', label: 'TOURNAMENTS' }, { id: 'stats', label: 'STATS' },
    { id: 'store', label: 'STORE' }, { id: 'profile', label: 'PROFILE' },
    { id: 'configuration', label: 'CONFIGURATION' }, { id: 'notifications', label: 'NOTIFICATIONS' },
  ];
  const isActive = (page: string) => currentPage === page || (page === 'tournament' && currentPage.startsWith('tournaments/'));
  
  return (
    <header className="app-header sticky top-0 z-40 border-b border-orange-900/20 bg-black/90 backdrop-blur supports-[backdrop-filter]:bg-black/75">
      <div className="container mx-auto px-4">
        <div className="main-header-grid items-center">
          <div className="header-left flex min-w-0 items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mobile-nav-trigger shrink-0 text-orange-300" aria-label="Open main navigation" aria-expanded={mobileOpen}><Menu className="size-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="mobile-nav-drawer w-[min(88vw,22rem)] border-orange-900/40 bg-[#09090b] p-0 text-gray-200">
                <SheetHeader className="border-b border-orange-900/25 px-5 py-5 text-left">
                  <SheetTitle className="flex items-center gap-3 font-mono text-orange-300"><CrowbarLogo className="size-8" />SECTOR NINE</SheetTitle>
                  <SheetDescription className="font-mono text-xs text-gray-400">TACTICAL NAVIGATION</SheetDescription>
                </SheetHeader>
                <nav aria-label="Mobile main navigation" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
                  {navItems.map(page => <a key={page.id} href={routeFor(page.id)} aria-current={isActive(page.id) ? 'page' : undefined} onClick={event => follow(event, page.id)} className={`rounded-md border px-4 py-3 font-mono text-sm transition-colors ${isActive(page.id) ? 'border-orange-700/50 bg-orange-900/25 text-orange-300' : 'border-transparent text-gray-300 hover:border-orange-900/30 hover:bg-orange-950/20 hover:text-orange-300'}`}>{page.label}</a>)}
                  {isAdmin && <a href="/admin" onClick={event => follow(event, 'admin')} className="mt-2 flex items-center gap-2 rounded-md border border-red-900/35 bg-red-950/15 px-4 py-3 font-mono text-sm text-red-200"><Shield className="size-4" />ADMIN PANEL</a>}
                </nav>
              </SheetContent>
            </Sheet>
            <div className="flex items-center space-x-3">
              <a href="/hub" aria-label="Sector Nine hub" onClick={(event) => follow(event, 'hub')} className="flex min-w-0 items-center gap-2 hover:opacity-80 transition-opacity">
                <CrowbarLogo className="w-8 h-8 text-orange-400" />
                <span className="hidden truncate font-mono text-sm font-bold tracking-wider text-orange-300 sm:block">SECTOR NINE</span>
              </a>
            </div>

          </div>

          <nav className="primary-desktop-nav items-center justify-center gap-2 xl:gap-4" aria-label="Primary navigation">
            {navItems.slice(0, 5).map((page) => (
              <a
                key={page.id}
                href={routeFor(page.id)}
                className={`rounded-md px-3 py-2 text-sm font-mono ${
                  isActive(page.id)
                    ? 'text-orange-400 bg-orange-900/20' 
                    : 'text-gray-300 hover:text-orange-400 hover:bg-orange-900/10'
                }`}
                onClick={(event) => follow(event, page.id)}
              >
                {page.label}
              </a>
            ))}
          </nav>

          <div className="header-actions flex items-center justify-end space-x-3">
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
                        <AvatarImage src={user?.resolvedAvatar} alt={playerName} />
                        <AvatarFallback className="bg-orange-900/20 text-orange-400">{playerInitials(user)}</AvatarFallback>
                      </Avatar>
                    </FramedAvatar>
                    {isPremium && (
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
                      <p className="font-medium text-orange-400">{playerName}</p>
                      {isAdmin ? (
                        <Badge className="border border-red-700/50 bg-red-950/50 px-1.5 py-0.5 text-xs font-bold text-red-200">
                          ADMIN
                        </Badge>
                      ) : isPremium && (
                        <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black text-xs font-bold px-1.5 py-0.5">
                          VIP
                        </Badge>
                      )}
                    </div>
                    {hasPlayerProgression && <p className="w-[200px] truncate text-sm text-green-400 font-mono">
                      {isPremium ? 'VIP RESEARCHER' : `LEVEL ${user?.level || 0} RESEARCHER`}
                    </p>}
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
                {isAdmin && <DropdownMenuItem asChild className="text-gray-300 hover:text-orange-400 hover:bg-orange-900/10"><a href="/admin" onClick={(event) => follow(event, 'admin')}><Shield className="mr-2 h-4 w-4"/><span>ADMINISTRATION</span></a></DropdownMenuItem>}
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
