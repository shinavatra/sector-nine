import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { CheckCircle, XCircle, Loader2, Shield } from "lucide-react";
import { extractSteamId, getSteamProfile, linkSteamAccount, verifyHalfLifeOwnership } from "../utils/steamAuth";
import { validateSteamCallback } from "../utils/steamDebug";
import { authAPI } from "../utils/api";
import { toast } from "sonner";

interface SteamCallbackProps {
  onNavigate: (page: string) => void;
  onLogin: (isNewUser?: boolean) => void;
}

export function SteamCallback({ onNavigate, onLogin }: SteamCallbackProps) {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Steam authentication...');
  const [steamProfile, setSteamProfile] = useState<any>(null);
  const [ownsHalfLife, setOwnsHalfLife] = useState(false);
  const [vacStatus, setVacStatus] = useState<'clean' | 'banned' | 'unknown'>('unknown');

  useEffect(() => {
    handleSteamCallback();
  }, []);

  const handleSteamCallback = async () => {
    try {
      // Log and validate the callback
      console.log('🎮 Processing Steam callback');
      console.log('Callback URL:', window.location.href);
      
      // Validate callback parameters
      const validation = validateSteamCallback(window.location.href);
      
      if (!validation.isValid) {
        console.error('❌ Steam callback validation failed:', validation.errors);
        setStatus('error');
        setMessage(validation.errors[0] || 'Invalid Steam callback');
        toast.error('Steam authentication failed', {
          description: validation.errors[0] || 'Invalid Steam callback data',
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
        setTimeout(() => onNavigate('auth'), 3000);
        return;
      }
      
      const steamId = validation.steamId;
      
      if (!steamId) {
        console.error('❌ No Steam ID in validated callback');
        setStatus('error');
        setMessage('Failed to extract Steam ID');
        toast.error('Steam authentication failed', {
          description: 'Could not retrieve Steam ID',
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
        setTimeout(() => onNavigate('auth'), 3000);
        return;
      }

      console.log('✅ Steam ID extracted:', steamId);
      setMessage(`Steam ID verified: ${steamId}`);

      // Get Steam profile
      const profile = await getSteamProfile(steamId);
      if (!profile) {
        setStatus('error');
        setMessage('Failed to fetch Steam profile');
        toast.error('Steam authentication failed', {
          description: 'Could not retrieve Steam profile',
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
        setTimeout(() => onNavigate('auth'), 3000);
        return;
      }

      setSteamProfile(profile);
      setMessage(`Profile loaded: ${profile.username}`);

      // Try to link Steam to existing session and get verification results
      try {
        const linkResult = await linkSteamAccount(steamId);
        
        if (!linkResult || !linkResult.profile) {
          // No existing session - need to register/login with Steam
          setStatus('error');
          setMessage('Please create an account or login first, then link your Steam account');
          toast.warning('Account Required', {
            description: 'Create an account to link your Steam profile',
            className: 'bg-orange-900/90 border-orange-700 text-orange-100'
          });
          setTimeout(() => onNavigate('auth'), 3000);
          return;
        }

        // Update states with verification results
        // FIX: server returns ownsHL1 and hasVacBan (not vacStatus string)
        const hasHalfLife = linkResult.ownsHL1 === true;
        const isVacBanned = linkResult.hasVacBan === true;
        
        setOwnsHalfLife(hasHalfLife);
        setVacStatus(isVacBanned ? 'banned' : 'clean');
        
        // Check for issues
        if (!hasHalfLife) {
          setStatus('error');
          setMessage('Half-Life 1 not found in Steam library');
          toast.error('Game not found', {
            description: 'You must own Half-Life 1 on Steam to play',
            className: 'bg-red-900/90 border-red-700 text-red-100'
          });
          setTimeout(() => onNavigate('auth'), 5000);
          return;
        }

        if (isVacBanned) {
          setStatus('error');
          setMessage('Steam account has VAC ban');
          toast.error('Account Banned', {
            description: 'Your Steam account is VAC banned and cannot participate',
            className: 'bg-red-900/90 border-red-700 text-red-100'
          });
          setTimeout(() => onNavigate('auth'), 5000);
          return;
        }

        // Success - both checks passed
        setStatus('success');
        setMessage('Steam account linked and verified!');
        toast.success('Steam Integration Complete', {
          description: `Welcome, ${profile.username}!`,
          className: 'bg-green-900/90 border-green-700 text-green-100'
        });
        
        setTimeout(() => {
          onLogin(false);
        }, 2000);

      } catch (error) {
        setStatus('error');
        setMessage('Failed to link Steam account');
        setTimeout(() => onNavigate('auth'), 3000);
      }

    } catch (error) {
      console.error('Steam callback error:', error);
      setStatus('error');
      setMessage('An unexpected error occurred');
      toast.error('Steam authentication failed', {
        description: 'Please try again',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
      setTimeout(() => onNavigate('auth'), 3000);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="text-center space-y-6">
            <Loader2 className="w-16 h-16 mx-auto text-orange-400 animate-spin" />
            <h3 className="text-xl text-orange-400 font-mono">AUTHENTICATING WITH STEAM</h3>
            <p className="text-gray-400 font-mono">{message}</p>
            {steamProfile && (
              <div className="flex items-center justify-center space-x-3 p-4 bg-black/40 rounded-lg border border-orange-900/20">
                <img 
                  src={steamProfile.avatar} 
                  alt={steamProfile.username}
                  className="w-12 h-12 rounded-full border-2 border-orange-900/30"
                />
                <div className="text-left">
                  <div className="text-orange-400 font-mono">{steamProfile.username}</div>
                  <div className="text-xs text-gray-400 font-mono">Steam ID: {steamProfile.steamId}</div>
                </div>
              </div>
            )}
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-6">
            <CheckCircle className="w-16 h-16 mx-auto text-green-400" />
            <h3 className="text-xl text-green-400 font-mono">AUTHENTICATION SUCCESSFUL</h3>
            <Alert className="bg-green-900/20 border-green-900/30">
              <Shield className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-300 font-mono">
                {message}
              </AlertDescription>
            </Alert>
            {steamProfile && (
              <div className="flex items-center justify-center space-x-3 p-4 bg-black/40 rounded-lg border border-green-900/30">
                <img 
                  src={steamProfile.avatar} 
                  alt={steamProfile.username}
                  className="w-12 h-12 rounded-full border-2 border-green-900/30"
                />
                <div className="text-left">
                  <div className="text-green-400 font-mono">{steamProfile.username}</div>
                  <div className="text-xs text-gray-400 font-mono">Half-Life 1 Verified ✓</div>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-400 font-mono">Redirecting to platform...</p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-6">
            <XCircle className="w-16 h-16 mx-auto text-red-400" />
            <h3 className="text-xl text-red-400 font-mono">AUTHENTICATION FAILED</h3>
            <Alert className="bg-red-900/20 border-red-900/30">
              <XCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300 font-mono">
                {message}
              </AlertDescription>
            </Alert>
            {steamProfile && (
              <div className="mt-4">
                {!ownsHalfLife && (
                  <>
                    <p className="text-sm text-gray-400 font-mono mb-3">
                      Half-Life 1 is required to access the platform
                    </p>
                    <a 
                      href="https://store.steampowered.com/app/70/HalfLife/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-blue-900/20 border border-blue-900/30 text-blue-400 hover:bg-blue-900/30 font-mono rounded transition-colors"
                    >
                      GET HALF-LIFE ON STEAM
                    </a>
                  </>
                )}
                {vacStatus === 'banned' && (
                  <p className="text-sm text-gray-400 font-mono">
                    VAC banned accounts cannot access matchmaking
                  </p>
                )}
              </div>
            )}
            <p className="text-sm text-gray-400 font-mono">Redirecting back to login...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-400 font-mono mb-2">
            STEAM INTEGRATION
          </h1>
          <Badge className="mt-2 bg-orange-900/20 text-orange-400 border-orange-900/30 font-mono">
            SECURE AUTHENTICATION
          </Badge>
        </div>

        {/* Main Content */}
        <Card className="bg-black/40 border-orange-900/20">
          <CardHeader>
            <CardTitle className="text-center text-orange-400 font-mono">
              PROCESSING STEAM CREDENTIALS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {renderContent()}
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500 font-mono">
          <p>Secure OpenID authentication via Steam</p>
          <p>Your credentials are never stored on our servers</p>
        </div>
      </div>
    </div>
  );
}