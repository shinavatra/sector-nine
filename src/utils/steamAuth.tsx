import { steamAPI } from './api';

const STEAM_STATE_KEY = 'sector_nine_steam_openid_state';
const STEAM_CALLBACK_COMPLETED_KEY = 'sector_nine_steam_callback_completed';
const activeSteamCallbackStates = new Set<string>();
type SteamAuthIntent = 'login' | 'link';

export const markSteamCallbackCompleted = () => sessionStorage.setItem(STEAM_CALLBACK_COMPLETED_KEY, '1');
export const wasSteamCallbackCompleted = () => sessionStorage.getItem(STEAM_CALLBACK_COMPLETED_KEY) === '1';
export const claimSteamCallback = (url: string) => {
  const state = new URL(url).searchParams.get('state');
  if (!state || activeSteamCallbackStates.has(state)) return false;
  activeSteamCallbackStates.add(state);
  return true;
};

const checkSteamEnvironment=()=>{
  const isLocalhost=['localhost','127.0.0.1','::1'].includes(window.location.hostname)
  const ready=window.location.protocol==='https:'||isLocalhost
  return{ready,issues:ready?[]:['Steam authentication requires HTTPS outside local development.']}
}

const createSteamLogin=async(intent: SteamAuthIntent)=>{
  sessionStorage.removeItem(STEAM_CALLBACK_COMPLETED_KEY);
  const request=await steamAPI.startAuthentication(intent);
  if(typeof request?.state!=='string'||typeof request?.loginUrl!=='string')throw new Error('Steam login could not be initialized');
  sessionStorage.setItem(STEAM_STATE_KEY,request.state);
  return request.loginUrl as string;
}

export interface SteamProfile {
  steamId: string;
  username: string;
  avatar: string;
  profileUrl: string;
  realName?: string;
  countryCode?: string;
  accountCreated: number;
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

export const openSteamLoginInNewWindow = async (intent: SteamAuthIntent = 'login') => {
  try {
    const steamLoginUrl=await createSteamLogin(intent);
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

export const initiateSteamLogin = async (intent: SteamAuthIntent = 'login') => {
  try {
    const envCheck = checkSteamEnvironment();
    if (!envCheck.ready) {
      console.error('Steam environment check failed:', envCheck.issues);
      if (isInIframe()) {
        const opened = await openSteamLoginInNewWindow(intent);
        if (!opened) {
          throw new Error('Unable to open Steam login. Please open in a new tab.');
        }
        return;
      }
      throw new Error(envCheck.issues[0] || 'Environment not ready for Steam authentication');
    }

    if (isInIframe()) {
      await openSteamLoginInNewWindow(intent);
      return;
    }

    window.location.href = await createSteamLogin(intent);
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

export const authenticateSteamCallback = async (url: string): Promise<any> => {
  const callbackUrl = new URL(url);
  const returnedState=callbackUrl.searchParams.get('state');
  const expectedState=sessionStorage.getItem(STEAM_STATE_KEY);
  sessionStorage.removeItem(STEAM_STATE_KEY);
  if(!returnedState||!expectedState||returnedState!==expectedState)throw new Error('Steam login state is invalid or expired');
  const callbackParams: Record<string, string> = {};
  callbackUrl.searchParams.forEach((value, key) => {
    if (key.startsWith('openid.')) callbackParams[key] = value;
  });
  return steamAPI.authenticate(callbackParams,returnedState);
};
