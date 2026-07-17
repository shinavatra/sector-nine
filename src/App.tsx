import { useState, useEffect, useCallback } from "react";
import { UserProvider, useUser } from "./contexts/UserContext";
import { Header } from "./components/Header";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { CrowbarLogo } from "./components/CrowbarLogo";
import { Hub } from "./pages/Hub";

import { Stats } from "./pages/Stats";
import { Profile } from "./pages/Profile";
import { Notifications } from "./pages/Notifications";

import { Lobby } from "./pages/Lobby";
import { Auth } from "./pages/Auth";
import { ForgotPassword } from "./pages/ForgotPassword";
import { NewPassword } from "./pages/NewPassword";
import { Store } from "./pages/Store";
import { VIPSubscription } from "./pages/VIPSubscription";
import { Matches } from "./pages/Matches";
import { SteamSetup } from "./pages/SteamSetup";
import { SteamGameVerification } from "./pages/SteamGameVerification";
import { SteamCallback } from "./pages/SteamCallback";
import { MapSelection } from "./pages/MapSelection";
import { MapBanning } from "./pages/MapBanning";
import { TournamentRules } from "./pages/TournamentRules";
import { ClassicDeathmatch } from "./pages/ClassicDeathmatch";
import { InstagibMode } from "./pages/InstagibMode";
import { Configuration } from "./pages/Configuration";
import { Support } from "./pages/Support";
import { Tournament } from "./pages/Tournament";
import { BlackMesaChampionship } from "./pages/BlackMesaChampionship";
import { LambdaInstagibTournament } from "./pages/LambdaInstagibTournament";
import { TacticalOperationsChampionship } from "./pages/TacticalOperationsChampionship";
import { ResonanceCascadeRoyale } from "./pages/ResonanceCascadeRoyale";
import { MonthlyLadder } from "./pages/MonthlyLadder";
import { WinterLadder } from "./pages/WinterLadder";
import { SpringLadder } from "./pages/SpringLadder";
import { SummerLadder } from "./pages/SummerLadder";
import { AutumnLadder } from "./pages/AutumnLadder";
import { Terms } from "./pages/Terms";
import { Disclaimer } from "./pages/Disclaimer";

import { GlobalChat } from "./components/GlobalChat";
import { MatchReadyAlert } from "./components/MatchReadyAlert";
import { Toaster } from "./components/ui/sonner";
import { reportAPI } from "./utils/api";
import { Admin } from "./pages/Admin";

const pagePaths: Record<string, string> = {
  auth: '/', hub: '/hub', lobby: '/matchmaking', tournament: '/tournaments', stats: '/stats',
  store: '/store', profile: '/profile', configuration: '/configuration', support: '/support',
  'steam-callback': '/auth/steam/callback', admin: '/admin',
};
const pageFromPath = (pathname: string) => {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  const match = Object.entries(pagePaths).find(([, path]) => path === pathname);
  return match?.[0] || pathname.replace(/^\//, '') || 'auth';
};

function AppContent() {
  const { user, isLoading, isAuthenticated, refreshProfile, logout } = useUser();
  const [currentPage, setCurrentPageState] = useState<string>(() => pageFromPath(window.location.pathname));
  const [hasCompletedSteamVerification, setHasCompletedSteamVerification] = useState<boolean>(false);
  const [matchReady, setMatchReady] = useState<{
    isOpen: boolean;
    matchType: string;
    mapName: string;
    playersReady: number;
    totalPlayers: number;
  }>({
    isOpen: false,
    matchType: "",
    mapName: "",
    playersReady: 0,
    totalPlayers: 0
  });

  const navigate = useCallback((page: string, replace = false) => {
    const path = pagePaths[page] || `/${page}`;
    if (window.location.pathname !== path) window.history[replace ? 'replaceState' : 'pushState']({ page }, '', path);
    setCurrentPageState(page);
  }, []);
  const setCurrentPage = navigate;

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
  const handlePopState = () => setCurrentPageState(pageFromPath(window.location.pathname));
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, []);


useEffect(() => {
  if (!isLoading && isAuthenticated && currentPage === 'auth') {
    navigate('hub', true);
  }
}, [isAuthenticated, isLoading, currentPage, navigate]);

useEffect(() => {
  const publicPages = ['auth', 'forgot-password', 'new-password', 'steam-callback'];
  if (!isLoading && !isAuthenticated && !publicPages.includes(currentPage)) navigate('auth', true);
}, [isAuthenticated, isLoading, currentPage, navigate]);

const handleLogin = async (isNewUser: boolean = false) => {
  await refreshProfile();

  if (isNewUser) {
    // New users go through Steam verification first
    setCurrentPage('steam-game-verification');
  } else {
    navigate('hub');
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

  const handleMatchAccept = () => {
    setMatchReady(prev => ({ ...prev, isOpen: false }));
    setCurrentPage('map-banning');
  };

  const handleMatchDecline = async () => {
    setMatchReady(prev => ({ ...prev, isOpen: false }));

    // Issue ban via the real API using the authenticated user's id
    // BanSystem localStorage logic is a placeholder until server-side bans are complete
    if (user?.id) {
      try {
        await reportAPI.getBanStatus(); // refresh ban state after decline penalty
      } catch {
        // non-critical — ban will be applied server-side when that endpoint is wired
      }
    }

    setCurrentPage('lobby');
  };

  const handleStartMatch = (matchType: string, mapName: string) => {
    // Only show the match-ready alert when coming from the lobby
    if (currentPage === 'lobby') {
      setTimeout(() => {
        setMatchReady({
          isOpen: true,
          matchType,
          mapName,
          playersReady: 2,
          totalPlayers: 2,
        });
      }, 2000);
    }
  };

  const renderPage = () => {
    // Unauthenticated users can only see auth pages
    if (
      !isAuthenticated &&
      currentPage !== 'auth' &&
      currentPage !== 'forgot-password' &&
      currentPage !== 'new-password' &&
      currentPage !== 'steam-callback'
    ) {
      return <Auth onLogin={handleLogin} onNavigate={setCurrentPage} />;
    }

    switch (currentPage) {
      case 'auth':
        return <Auth onLogin={handleLogin} onNavigate={setCurrentPage} />;
      case 'forgot-password':
        return <ForgotPassword onNavigate={setCurrentPage} />;
      case 'new-password':
        return <NewPassword onNavigate={setCurrentPage} />;
      case 'steam-callback':
        return <SteamCallback onNavigate={setCurrentPage} onLogin={handleLogin} />;

      case 'hub':
        return <Hub onNavigate={setCurrentPage} />;
      case 'admin':
        return <Admin onNavigate={setCurrentPage} />;
      case 'stats':
        return <Stats onNavigate={setCurrentPage} />;
      case 'profile':
        return <Profile onNavigate={setCurrentPage} isPremium={user?.isPremium || false} />;
      case 'notifications':
        return <Notifications onNavigate={setCurrentPage} />;
      case 'configuration':
        return <Configuration onNavigate={setCurrentPage} />;

      case 'lobby':
        return <Lobby onNavigate={setCurrentPage} onStartMatch={handleStartMatch} isPremium={user?.isPremium || false} />;
      case 'map-selection':
        return <MapSelection onNavigate={setCurrentPage} />;
      case 'map-banning':
        return <MapBanning onNavigate={setCurrentPage} />;
      case 'classic-deathmatch':
        return <ClassicDeathmatch onNavigate={setCurrentPage} />;
      case 'instagib-mode':
        return <InstagibMode onNavigate={setCurrentPage} />;
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
          ? <Lobby onNavigate={setCurrentPage} onStartMatch={handleStartMatch} isPremium={user?.isPremium || false} />
          : <Auth onLogin={handleLogin} onNavigate={setCurrentPage} />;
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
        <Admin onNavigate={setCurrentPage} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <AnimatedBackground />

      {isAuthenticated && currentPage !== 'auth' && currentPage !== 'admin' && (
        <Header
          onNavigate={setCurrentPage}
          currentPage={currentPage}
          onLogout={handleLogout}
          isPremium={user?.isPremium || false}
        />
      )}

      <div className="relative z-10">
        {renderPage()}
      </div>

      {isAuthenticated && currentPage !== 'auth' && currentPage !== 'admin' && (
        <GlobalChat />
      )}

      <MatchReadyAlert
        isOpen={matchReady.isOpen}
        onAccept={handleMatchAccept}
        onDecline={handleMatchDecline}
        matchType={matchReady.matchType}
        mapName={matchReady.mapName}
        playersReady={matchReady.playersReady}
        totalPlayers={matchReady.totalPlayers}
      />

      <Toaster />

      {isAuthenticated && currentPage !== 'auth' && currentPage !== 'admin' && (
        <footer className="border-t border-orange-900/20 bg-black/60 mt-16 relative z-10">
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
      <AppContent />
    </UserProvider>
  );
}
