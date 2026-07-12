import { steamAPI } from './api';
import { logSteamDebugInfo, checkSteamEnvironment } from './steamDebug';

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';

const getReturnUrl = () => {
  const origin = window.location.origin;
  return `${origin}/auth/steam/callback`;
};

export interface SteamProfile {
  steamId: string;
  username: string;
  avatar: string;
  profileUrl: string;
  realName?: string;
  countryCode?: string;
  accountCreated: number;
}

export interface SteamGameInfo {
  appId: number;
  name: string;
  playtime: number;
  lastPlayed?: number;
}

export const isSteamAvailable = async (): Promise<boolean> => {
  try {
    await fetch('https://steamcommunity.com/login/home/?goto=', {
      method: 'HEAD',
      mode: 'no-cors',
    });
    return true;
  } catch (error) {
    console.warn('Steam Community may not be accessible:', error);
    return false;
  }
};

export const isInIframe = (): boolean => {
  return window.self !== window.top;
};

export const openSteamLoginInNewWindow = () => {
  try {
    const returnUrl = getReturnUrl();
    const realm = window.location.origin;
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnUrl,
      'openid.realm': realm,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });
    const steamLoginUrl = `${STEAM_OPENID_URL}?${params.toString()}`;
    const width = 800;
    const height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    window.open(
      steamLoginUrl,
      'SteamLogin',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no`
    );
    return true;
  } catch (error) {
    console.error('Failed to open Steam login window:', error);
    return false;
  }
};

export const initiateSteamLogin = () => {
  try {
    const envCheck = checkSteamEnvironment();
    if (!envCheck.ready) {
      console.error('Steam environment check failed:', envCheck.issues);
      if (isInIframe()) {
        const opened = openSteamLoginInNewWindow();
        if (!opened) {
          throw new Error('Unable to open Steam login. Please open in a new tab.');
        }
        return;
      }
      throw new Error(envCheck.issues[0] || 'Environment not ready for Steam authentication');
    }

    logSteamDebugInfo();

    if (isInIframe()) {
      openSteamLoginInNewWindow();
      return;
    }

    const returnUrl = getReturnUrl();
    const realm = window.location.origin;
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnUrl,
      'openid.realm': realm,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    window.location.href = `${STEAM_OPENID_URL}?${params.toString()}`;
  } catch (error) {
    console.error('Failed to initiate Steam login:', error);
    throw error;
  }
};

export const extractSteamId = (url: string): string | null => {
  try {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const identity = urlParams.get('openid.claimed_id');
    if (identity) {
      const match = identity.match(/\/(\d+)$/);
      if (match?.[1]) return match[1];
    }
    return null;
  } catch (error) {
    console.error('Error extracting Steam ID:', error);
    return null;
  }
};

export const verifyHalfLifeOwnership = async (steamId: string): Promise<boolean> => {
  try {
    const data = await steamAPI.verifyGameOwnership(steamId, 70);
    return data.ownsGame;
  } catch (error) {
    console.error('Error verifying Half-Life ownership:', error);
    return false;
  }
};

export const getSteamProfile = async (steamId: string): Promise<SteamProfile | null> => {
  try {
    const data = await steamAPI.getProfile(steamId);
    return data.profile;
  } catch (error) {
    console.error('Error fetching Steam profile:', error);
    return null;
  }
};

export const getSteamGames = async (steamId: string): Promise<SteamGameInfo[]> => {
  try {
    const data = await steamAPI.getGames(steamId);
    return data.games || [];
  } catch (error) {
    console.error('Error fetching Steam games:', error);
    return [];
  }
};

export const linkSteamAccount = async (steamId: string): Promise<any> => {
  try {
    const data = await steamAPI.linkAccount(steamId);
    return data;
  } catch (error) {
    console.error('Error linking Steam account:', error);
    return null;
  }
};

export const isSteamRunning = async (): Promise<boolean> => {
  try {
    await fetch('http://localhost:27060/status', { method: 'GET', mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
};
