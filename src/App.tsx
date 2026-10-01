import { lazy, Suspense, useState, useEffect, useCallback, useRef, type ComponentType } from "react";
import { toast } from "sonner";
import { UserProvider, useUser } from "./contexts/UserContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GameProvider } from "./contexts/GameContext";
import { Header } from "./components/Header";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { CrowbarLogo } from "./components/CrowbarLogo";
import { Hub } from "./pages/Hub";
import { Lobby } from "./pages/Lobby";
import { Auth } from "./pages/Auth";

import { GlobalChat } from "./components/GlobalChat";
import { Toaster } from "./components/ui/sonner";
import { logFrontendAuthEvent, notificationsAPI, platformAPI, type PublicPlatformSettings } from "./utils/api";
import { subscribeToNotificationChanges } from "./utils/notificationEvents";

const lazyPage = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(async () => ({ default: (await loader())[name] as ComponentType<any> }));
const Profile=lazyPage(()=>import("./pages/Profile"),"Profile");
const Notifications=lazyPage(()=>import("./pages/Notifications"),"Notifications");
const Achievements=lazyPage(()=>import("./pages/Achievements"),"Achievements");
const ForgotPassword=lazyPage(()=>import("./pages/ForgotPassword"),"ForgotPassword");
const NewPassword=lazyPage(()=>import("./pages/NewPassword"),"NewPassword");
const Store=lazyPage(()=>import("./pages/Store"),"Store");
const VIPSubscription=lazyPage(()=>import("./pages/VIPSubscription"),"VIPSubscription");
const Matches=lazyPage(()=>import("./pages/Matches"),"Matches");
const SteamSetup=lazyPage(()=>import("./pages/SteamSetup"),"SteamSetup");
const SteamGameVerification=lazyPage(()=>import("./pages/SteamGameVerification"),"SteamGameVerification");
const SteamCallback=lazyPage(()=>import("./pages/SteamCallback"),"SteamCallback");
const TournamentRules=lazyPage(()=>import("./pages/TournamentRules"),"TournamentRules");
const Configuration=lazyPage(()=>import("./pages/Configuration"),"Configuration");
const Support=lazyPage(()=>import("./pages/Support"),"Support");
const Tournament=lazyPage(()=>import("./pages/Tournament"),"Tournament");
const TournamentDetail=lazyPage(()=>import("./pages/TournamentDetail"),"TournamentDetail");
const BlackMesaChampionship=lazyPage(()=>import("./pages/BlackMesaChampionship"),"BlackMesaChampionship");
const LambdaInstagibTournament=lazyPage(()=>import("./pages/LambdaInstagibTournament"),"LambdaInstagibTournament");
const TacticalOperationsChampionship=lazyPage(()=>import("./pages/TacticalOperationsChampionship"),"TacticalOperationsChampionship");
const ResonanceCascadeRoyale=lazyPage(()=>import("./pages/ResonanceCascadeRoyale"),"ResonanceCascadeRoyale");
const MonthlyLadder=lazyPage(()=>import("./pages/MonthlyLadder"),"MonthlyLadder");
const WinterLadder=lazyPage(()=>import("./pages/WinterLadder"),"WinterLadder");
const SpringLadder=lazyPage(()=>import("./pages/SpringLadder"),"SpringLadder");
const SummerLadder=lazyPage(()=>import("./pages/SummerLadder"),"SummerLadder");
const AutumnLadder=lazyPage(()=>import("./pages/AutumnLadder"),"AutumnLadder");
const Terms=lazyPage(()=>import("./pages/Terms"),"Terms");
const Disclaimer=lazyPage(()=>import("./pages/Disclaimer"),"Disclaimer");
const Admin=lazyPage(()=>import("./pages/Admin"),"Admin");
const Stats=lazyPage(()=>import("./pages/Stats"),"Stats");

const pageFallback=<div className="grid min-h-[55vh] place-items-center font-mono text-sm text-gray-400">LOADING SECTOR DATA...</div>;

const pagePaths: Record<string, string> = {
  auth: '/', hub: '/hub', lobby: '/matchmaking', tournament: '/tournaments', stats: '/stats',
  store: '/store', profile: '/profile', notifications:'/notifications', achievements:'/achievements', configuration: '/configuration', support: '/support',
  'forgot-password': '/forgot-password', 'new-password': '/new-password', 'steam-callback': '/auth/steam/callback', admin: '/admin',
};
const authFlowPages = ['auth', 'forgot-password', 'new-password', 'steam-callback'];
const pageFromPath = (pathname: string) => {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/auth/forgot-password' || pathname === '/reset-password' || pathname === '/password-reset') return 'forgot-password';
  const match = Object.entries(pagePaths).find(([, path]) => path === pathname);
  return match?.[0] || pathname.replace(/^\//, '') || 'auth';
};

function AppContent() {
  const { user, isLoading, isAuthenticated, refreshProfile, logout } = useUser();
  const [currentPage, setCurrentPageState] = useState<string>(() => pageFromPath(window.location.pathname));
  const [hasCompletedSteamVerification, setHasCompletedSteamVerification] = useState<boolean>(false);
  const [notificationUnreadCount,setNotificationUnreadCount]=useState(0);
  const [platformSettings,setPlatformSettings]=useState<PublicPlatformSettings|null>(null);
  const [platformSettingsError,setPlatformSettingsError]=useState<string|null>(null);
  const seenFriendNotifications=useRef(new Set<string>());
  const notificationsInitialized=useRef(false);
  const notificationPollInFlight=useRef(false);
  const notificationPollQueued=useRef(false);
  const notificationPollRevision=useRef(0);
  const previousPage=useRef(currentPage);
  const previousPath=useRef(window.location.pathname);

  const navigate = useCallback((page: string, replace = false) => {
    const path = pagePaths[page] || `/${page}`;
    const previousPathname = window.location.pathname;
    if (previousPathname !== path) {
      window.history[replace ? 'replaceState' : 'pushState']({ page }, '', path);
      logFrontendAuthEvent('app_path_changed', { previousPath: previousPathname, nextPath: path, method: replace ? 'replaceState' : 'pushState' });
    }
    setCurrentPageState(page);
  }, []);
  const setCurrentPage = navigate;
  const refreshPlatformSettings=useCallback(async()=>{
    try{
      const settings=await platformAPI.getSettings()
      setPlatformSettings(settings)
      setPlatformSettingsError(null)
    }catch(error:any){
      setPlatformSettingsError(error?.message||'Unable to load live platform settings')
    }
  },[])

  useEffect(()=>{void refreshPlatformSettings()},[refreshPlatformSettings])

  useEffect(()=>{if(!isAuthenticated){setNotificationUnreadCount(0);seenFriendNotifications.current.clear();notificationsInitialized.current=false;return}let active=true;const poll=async()=>{if(notificationPollInFlight.current){notificationPollQueued.current=true;return}const revision=notificationPollRevision.current;notificationPollInFlight.current=true;try{const data:any=await notificationsAPI.getNotifications();if(!active||revision!==notificationPollRevision.current)return;const items=Array.isArray(data?.notifications)?data.notifications:[];const unread=items.filter((item:any)=>!item.read);setNotificationUnreadCount(typeof data?.unreadCount==='number'?data.unreadCount:unread.length);for(const item of unread.filter((entry:any)=>entry.type==='friend_request')){const id=String(item.id);if(seenFriendNotifications.current.has(id))continue;seenFriendNotifications.current.add(id);if(notificationsInitialized.current)toast(item.message||'New friend request',{action:{label:'Open',onClick:()=>{sessionStorage.setItem('open_friend_requests','1');navigate('profile')}}})}notificationsInitialized.current=true}catch{/* Keep the last valid badge during transient failures. */}finally{notificationPollInFlight.current=false;if(active&&notificationPollQueued.current){notificationPollQueued.current=false;void poll()}}};const unsubscribe=subscribeToNotificationChanges(unreadCount=>{notificationPollRevision.current+=1;if(typeof unreadCount==='number'){setNotificationUnreadCount(unreadCount);return}void poll()});void poll();const interval=window.setInterval(poll,7000);return()=>{active=false;notificationPollRevision.current+=1;notificationPollQueued.current=false;unsubscribe();window.clearInterval(interval)}},[isAuthenticated,navigate]);

 // Check for Steam callback and password reset token on first load
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  if (window.location.pathname === '/auth/steam/callback' || urlParams.has('openid.mode')) {
    setCurrentPageState('steam-callback');
    return;
  }

  // Password reset link puts token in URL hash (legacy Supabase behaviour)
  // Our new flow uses a reset token in the URL query param instead
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    setCurrentPageState('new-password');
  }
}, []);

useEffect(() => {
  const handlePopState = () => {
    const nextPath = window.location.pathname;
    logFrontendAuthEvent('app_path_changed', { previousPath: previousPath.current, nextPath, method: 'popstate' });
    previousPath.current = nextPath;
    setCurrentPageState(pageFromPath(nextPath));
  };
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, []);

useEffect(() => {
  if (previousPage.current !== currentPage) {
    logFrontendAuthEvent('app_current_page_changed', { previousPage: previousPage.current, nextPage: currentPage });
    previousPage.current = currentPage;
  }
  previousPath.current = window.location.pathname;
}, [currentPage]);


useEffect(() => {
  if (!isLoading && isAuthenticated && currentPage === 'auth') {
    navigate('hub', true);
  }
}, [isAuthenticated, isLoading, currentPage, navigate]);

useEffect(() => {
  if (!isLoading && !isAuthenticated && !authFlowPages.includes(currentPage)) navigate('auth', true);
}, [isAuthenticated, isLoading, currentPage, navigate]);

const handleLogin = async (isNewUser: boolean = false) => {
  const isSteamCallback = currentPage === 'steam-callback';
  if (isSteamCallback) logFrontendAuthEvent('steam_callback_profile_loading');
  await refreshProfile(isSteamCallback ? 'steam_callback' : undefined);
  if (isSteamCallback) logFrontendAuthEvent('steam_callback_profile_loaded');

  if (isNewUser) {
    // New users go through Steam verification first
    setCurrentPage('steam-game-verification');
  } else {
    if (isSteamCallback) {
      logFrontendAuthEvent('steam_callback_login_completed');
      logFrontendAuthEvent('steam_callback_navigation_started', { destination: 'hub' });
      logFrontendAuthEvent('steam_callback_navigate_hub');
    }
    navigate('hub', isSteamCallback);
  }
};
  const handleLogout = () => {
    logout();
    setHasCompletedSteamVerification(false);
    navigate('auth', true);
  };

  const handleSteamVerificationComplete = () => {
    setHasCompletedSteamVerification(true);
  };

  const handleStartMatch = (_matchType: string, _mapName: string) => {
    if (currentPage === 'lobby') setCurrentPage('matches');
  };

  const renderPage = () => {
    const registrationUnavailableReason=platformSettings?.maintenanceMode
      ? 'New account registration is unavailable during platform maintenance.'
      :platformSettings?.registrationEnabled===false
        ?'New account registration is currently disabled.'
        :undefined
    // Unauthenticated users can only see auth pages
    if (!isAuthenticated && !authFlowPages.includes(currentPage)) {
      return <Auth onLogin={handleLogin} onNavigate={setCurrentPage} registrationUnavailableReason={registrationUnavailableReason} />;
    }

    if (currentPage.startsWith('tournaments/')) {
      const tournamentId=decodeURIComponent(currentPage.slice('tournaments/'.length));
      return <TournamentDetail tournamentId={tournamentId} onNavigate={setCurrentPage} isPremium={user?.isPremium || false} />;
    }

    switch (currentPage) {
      case 'auth':
        return <Auth onLogin={handleLogin} onNavigate={setCurrentPage} registrationUnavailableReason={registrationUnavailableReason} />;
      case 'forgot-password':
        return <ForgotPassword onNavigate={setCurrentPage} />;
      case 'new-password':
        return <NewPassword onNavigate={setCurrentPage} />;
      case 'steam-callback':
        return <SteamCallback onNavigate={setCurrentPage} onLogin={handleLogin} />;

      case 'hub':
        return <Hub onNavigate={setCurrentPage} />;
      case 'admin':
        return <Admin onNavigate={setCurrentPage} onPlatformSettingsSaved={refreshPlatformSettings} />;
      case 'stats':
        return <Suspense fallback={<div className="grid min-h-[55vh] place-items-center font-mono text-sm text-gray-400">LOADING STATISTICS...</div>}><Stats onNavigate={setCurrentPage} /></Suspense>;
      case 'profile':
        return <Profile onNavigate={setCurrentPage} isPremium={user?.isPremium || false} />;
      case 'notifications':
        return <Notifications onNavigate={setCurrentPage} />;
      case 'achievements':
        return <Achievements />;
      case 'configuration':
        return <Configuration onNavigate={setCurrentPage} />;

      case 'lobby':
        return <Lobby onNavigate={setCurrentPage} onStartMatch={handleStartMatch} isPremium={user?.isPremium || false} maintenanceMode={platformSettings?.maintenanceMode===true} />;
      case 'map-selection':
      case 'map-banning':
      case 'classic-deathmatch':
      case 'instagib-mode':
        return <Lobby onNavigate={setCurrentPage} onStartMatch={handleStartMatch} isPremium={user?.isPremium || false} maintenanceMode={platformSettings?.maintenanceMode===true} />;
      case 'matches':
        return <Matches />;

      case 'store':
        return <Store onNavigate={setCurrentPage} isPremium={user?.isPremium || false} />;
      case 'vip-subscription':
        return <VIPSubscription onNavigate={setCurrentPage} />;

      case 'steam-setup':
        return <SteamSetup onNavigate={setCurrentPage} />;
      case 'steam-game-verification':
        return <SteamGameVerification onNavigate={setCurrentPage} onComplete={handleSteamVerificationComplete} />;

      case 'tournament':
        return <Tournament onNavigate={setCurrentPage} isPremium={user?.isPremium || false} />;
      case 'black-mesa-championship':
        return <BlackMesaChampionship onNavigate={setCurrentPage} isPremium={user?.isPremium || false} />;
      case 'lambda-instagib-tournament':
        return <LambdaInstagibTournament onNavigate={setCurrentPage} isPremium={user?.isPremium || false} />;
      case 'tactical-operations-championship':
        return <TacticalOperationsChampionship onNavigate={setCurrentPage} isPremium={user?.isPremium || false} />;
      case 'resonance-cascade-royale':
        return <ResonanceCascadeRoyale onNavigate={setCurrentPage} isPremium={user?.isPremium || false} />;
      case 'tournament-rules':
        return <TournamentRules onNavigate={setCurrentPage} />;

      case 'monthly-ladder':
        return <MonthlyLadder onNavigate={setCurrentPage} />;
      case 'winter-ladder':
        return <WinterLadder onNavigate={setCurrentPage} />;
      case 'spring-ladder':
        return <SpringLadder onNavigate={setCurrentPage} />;
      case 'summer-ladder':
        return <SummerLadder onNavigate={setCurrentPage} />;
      case 'autumn-ladder':
        return <AutumnLadder onNavigate={setCurrentPage} />;

      case 'support':
        return <Support onNavigate={setCurrentPage} />;
      case 'terms':
        return <Terms onNavigate={setCurrentPage} />;
      case 'disclaimer':
        return <Disclaimer onNavigate={setCurrentPage} />;

      default:
        return isAuthenticated
          ? <Lobby onNavigate={setCurrentPage} onStartMatch={handleStartMatch} isPremium={user?.isPremium || false} maintenanceMode={platformSettings?.maintenanceMode===true} />
          : <Auth onLogin={handleLogin} onNavigate={setCurrentPage} registrationUnavailableReason={registrationUnavailableReason} />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center font-mono">
          <CrowbarLogo className="w-16 h-16 mx-auto text-orange-400 animate-pulse" />
          <p className="mt-4 text-orange-400">RESTORING PERSONNEL SESSION...</p>
        </div>
      </div>
    );
  }

  // Administration owns its complete viewport layout. Keep it outside the
  // normal Hub shell, AnimatedBackground, global header/chat/footer, and their
  // stacking contexts so its sidebar can reserve real horizontal space.
  if (isAuthenticated && currentPage === 'admin') {
    return (
      <>
        <Suspense fallback={pageFallback}>
          <Admin onNavigate={setCurrentPage} onPlatformSettingsSaved={refreshPlatformSettings} />
        </Suspense>
        <GlobalChat />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <AnimatedBackground />

      {isAuthenticated && !authFlowPages.includes(currentPage) && currentPage !== 'admin' && (
        <Header
          onNavigate={setCurrentPage}
          currentPage={currentPage}
          notificationUnreadCount={notificationUnreadCount}
          onLogout={handleLogout}
          isPremium={user?.isPremium || false}
        />
      )}

      {currentPage !== 'admin' && (
        <div className="relative z-20 w-full">
          {platformSettingsError && (
            <div role="status" className="border-y border-amber-700/50 bg-amber-950 px-4 py-2 text-center font-mono text-xs text-amber-100 sm:text-sm">
              Live platform status could not be loaded: {platformSettingsError}. Actions remain subject to server checks.
            </div>
          )}
          {platformSettings?.maintenanceMode && (
            <div role="alert" className="border-y border-red-600/60 bg-red-950 px-4 py-3 text-center font-mono text-sm text-red-100">
              <strong>PLATFORM MAINTENANCE:</strong> Read-only areas remain available, but registration and matchmaking are temporarily unavailable.
            </div>
          )}
          {isAuthenticated && platformSettings?.announcement.enabled && platformSettings.announcement.message.trim() && (
            <div role="status" className="border-y border-orange-600/50 bg-[#241306] px-4 py-3 text-center font-mono text-sm text-orange-100">
              {platformSettings.announcement.title.trim() && <strong className="mr-2 text-orange-300">{platformSettings.announcement.title.trim()}:</strong>}
              <span className="break-words">{platformSettings.announcement.message.trim()}</span>
            </div>
          )}
        </div>
      )}

      <div className="relative z-10">
        <Suspense fallback={pageFallback}>{renderPage()}</Suspense>
      </div>

      {isAuthenticated && !authFlowPages.includes(currentPage) && currentPage !== 'admin' && (
        <GlobalChat />
      )}

      <Toaster />

      {isAuthenticated && !authFlowPages.includes(currentPage) && currentPage !== 'admin' && (
        <footer className="border-t border-orange-900/20 bg-black/60 mt-16 relative z-10">
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <h3 className="font-semibold mb-4 text-orange-400 font-mono">SECTOR NINE INITIATIVE</h3>
                <p className="text-sm text-gray-400 font-mono leading-relaxed">
                  FREE COMPETITIVE GAMING PLATFORM.<br />
                  SPECIALIZED HALF-LIFE 1 COMBAT PROTOCOLS.<br />
                  OPEN REGISTRATION FOR ALL OPERATIVES.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-3 text-green-400 font-mono">NAVIGATION</h4>
                <ul className="space-y-2 text-sm text-gray-400 font-mono">
                  <li className="cursor-pointer hover:text-orange-400 transition-colors" onClick={() => setCurrentPage('lobby')}>&gt; Matchmaking</li>
                  <li className="cursor-pointer hover:text-orange-400 transition-colors" onClick={() => setCurrentPage('tournament')}>&gt; Tournaments</li>
                  <li className="cursor-pointer hover:text-orange-400 transition-colors" onClick={() => setCurrentPage('stats')}>&gt; Statistics</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3 text-green-400 font-mono">PLATFORM</h4>
                <ul className="space-y-2 text-sm text-gray-400 font-mono">
                  <li className="cursor-pointer hover:text-orange-400 transition-colors" onClick={() => setCurrentPage('profile')}>&gt; Player Profile</li>
                  <li className="cursor-pointer hover:text-orange-400 transition-colors" onClick={() => setCurrentPage('store')}>&gt; Equipment Armory</li>
                  <li className="cursor-pointer hover:text-orange-400 transition-colors" onClick={() => setCurrentPage('configuration')}>&gt; Configuration</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3 text-green-400 font-mono">SUPPORT</h4>
                <ul className="space-y-2 text-sm text-gray-400 font-mono">
                  <li className="cursor-pointer hover:text-orange-400 transition-colors" onClick={() => setCurrentPage('support')}>&gt; Technical Support</li>
                  <li className="cursor-pointer hover:text-orange-400 transition-colors" onClick={() => window.open('https://discord.gg/sectornine', '_blank')}>&gt; Discord Community</li>
                  <li className="cursor-pointer hover:text-orange-400 transition-colors" onClick={() => setCurrentPage('terms')}>&gt; Terms & Conditions</li>
                  <li className="cursor-pointer hover:text-orange-400 transition-colors" onClick={() => setCurrentPage('disclaimer')}>&gt; Platform Disclaimer</li>
                </ul>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-orange-900/20 text-center text-sm text-gray-500 font-mono">
              <p>&copy; 2025 SECTOR NINE INITIATIVE - CLASSIFIED</p>
              <p className="text-xs mt-1 text-orange-400">AUTHORIZED PERSONNEL ONLY</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <GameProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </GameProvider>
    </UserProvider>
  );
}
