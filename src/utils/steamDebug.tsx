/**
 * Steam Integration Debug Utilities
 * 
 * Provides comprehensive logging and diagnostics for Steam OpenID integration
 */

export interface SteamDebugInfo {
  environment: 'development' | 'production';
  protocol: string;
  hostname: string;
  origin: string;
  returnUrl: string;
  isSecure: boolean;
  isLocalhost: boolean;
  canUseSteam: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Get comprehensive Steam debug information
 */
export const getSteamDebugInfo = (): SteamDebugInfo => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const origin = window.location.origin;
  const returnUrl = `${origin}/auth/steam/callback`;
  const isSecure = protocol === 'https:';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for common issues
  if (!isSecure && !isLocalhost) {
    errors.push('Steam OpenID requires HTTPS in production. Currently using HTTP.');
  }
  
  // Changed from error to warning - iframe will be handled differently
  if (window.self !== window.top) {
    warnings.push('Running in iframe - Steam authentication may require opening in new window.');
  }
  
  if (!navigator.cookieEnabled) {
    errors.push('Cookies must be enabled for Steam authentication.');
  }
  
  // Check for potential issues
  if (hostname.includes('192.168') || hostname.includes('10.0')) {
    warnings.push('Local network IPs require HTTPS for Steam OpenID.');
  }
  
  const canUseSteam = errors.length === 0 && (isSecure || isLocalhost);
  
  return {
    environment: isLocalhost ? 'development' : 'production',
    protocol,
    hostname,
    origin,
    returnUrl,
    isSecure,
    isLocalhost,
    canUseSteam,
    errors,
    warnings
  };
};

/**
 * Log Steam debug information to console
 */
export const logSteamDebugInfo = () => {
  const info = getSteamDebugInfo();
  
  console.group('🎮 Steam Integration Debug Info');
  console.log('Environment:', info.environment);
  console.log('Protocol:', info.protocol);
  console.log('Hostname:', info.hostname);
  console.log('Origin:', info.origin);
  console.log('Return URL:', info.returnUrl);
  console.log('Is Secure:', info.isSecure ? '✅' : '❌');
  console.log('Is Localhost:', info.isLocalhost ? '✅' : '❌');
  console.log('Can Use Steam:', info.canUseSteam ? '✅' : '❌');
  
  if (info.errors.length > 0) {
    console.group('❌ Errors:');
    info.errors.forEach(error => console.error(error));
    console.groupEnd();
  }
  
  if (info.warnings.length > 0) {
    console.group('⚠️ Warnings:');
    info.warnings.forEach(warning => console.warn(warning));
    console.groupEnd();
  }
  
  console.groupEnd();
  
  return info;
};

/**
 * Validate Steam callback URL parameters
 */
export const validateSteamCallback = (url: string): {
  isValid: boolean;
  steamId: string | null;
  errors: string[];
} => {
  const errors: string[] = [];
  let steamId: string | null = null;
  
  try {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    
    // Check for required OpenID parameters
    const mode = urlParams.get('openid.mode');
    const claimedId = urlParams.get('openid.claimed_id');
    const identity = urlParams.get('openid.identity');
    
    if (!mode) {
      errors.push('Missing openid.mode parameter');
    } else if (mode === 'cancel') {
      errors.push('User cancelled Steam authentication');
    } else if (mode !== 'id_res') {
      errors.push(`Unexpected openid.mode: ${mode}`);
    }
    
    if (!claimedId) {
      errors.push('Missing openid.claimed_id parameter');
    } else {
      // Extract Steam ID from claimed_id
      const match = claimedId.match(/\/(\d+)$/);
      if (match && match[1]) {
        steamId = match[1];
      } else {
        errors.push('Could not extract Steam ID from claimed_id');
      }
    }
    
    if (!identity) {
      errors.push('Missing openid.identity parameter');
    }
    
    // Log all parameters for debugging
    console.group('Steam Callback Parameters:');
    for (const [key, value] of urlParams.entries()) {
      console.log(`${key}:`, value);
    }
    console.groupEnd();
    
  } catch (error) {
    errors.push(`Failed to parse callback URL: ${error}`);
  }
  
  return {
    isValid: errors.length === 0 && steamId !== null,
    steamId,
    errors
  };
};

/**
 * Test Steam Community connectivity
 */
export const testSteamConnectivity = async (): Promise<{
  accessible: boolean;
  error?: string;
}> => {
  try {
    // Try to load a small Steam Community resource
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://steamcommunity.com/login/home/?goto=', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return { accessible: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          accessible: false,
          error: 'Steam Community request timed out. Check your network connection.'
        };
      }
      return {
        accessible: false,
        error: `Steam Community not accessible: ${error.message}`
      };
    }
    return {
      accessible: false,
      error: 'Unknown error accessing Steam Community'
    };
  }
};

/**
 * Get user-friendly error message for Steam integration issues
 */
export const getSteamErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('CORS')) {
      return 'Steam authentication blocked by browser security. Try a different browser or check your network settings.';
    }
    if (error.message.includes('network')) {
      return 'Cannot connect to Steam. Check your internet connection and firewall settings.';
    }
    if (error.message.includes('timeout')) {
      return 'Steam authentication timed out. Steam may be temporarily unavailable.';
    }
    return error.message;
  }
  return 'An unexpected error occurred during Steam authentication.';
};

/**
 * Format Steam ID for display
 */
export const formatSteamId = (steamId: string): string => {
  if (steamId.length > 10) {
    return `${steamId.substring(0, 5)}...${steamId.substring(steamId.length - 4)}`;
  }
  return steamId;
};

/**
 * Check if environment is suitable for Steam OpenID
 */
export const checkSteamEnvironment = (): {
  ready: boolean;
  issues: string[];
  suggestions: string[];
} => {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const debugInfo = getSteamDebugInfo();
  
  if (!debugInfo.canUseSteam) {
    issues.push('Environment not ready for Steam OpenID');
    
    if (!debugInfo.isSecure && !debugInfo.isLocalhost) {
      suggestions.push('Use HTTPS in production environments');
      suggestions.push('For development, use localhost or 127.0.0.1');
    }
  }
  
  if (debugInfo.errors.length > 0) {
    issues.push(...debugInfo.errors);
  }
  
  if (debugInfo.warnings.length > 0) {
    suggestions.push(...debugInfo.warnings);
  }
  
  return {
    ready: issues.length === 0,
    issues,
    suggestions
  };
};

/**
 * Export debug report for support
 */
export const exportDebugReport = (): string => {
  const info = getSteamDebugInfo();
  const timestamp = new Date().toISOString();
  
  const report = `
STEAM INTEGRATION DEBUG REPORT
Generated: ${timestamp}

ENVIRONMENT
-----------
Environment: ${info.environment}
Protocol: ${info.protocol}
Hostname: ${info.hostname}
Origin: ${info.origin}
Return URL: ${info.returnUrl}
Is Secure: ${info.isSecure}
Is Localhost: ${info.isLocalhost}
Can Use Steam: ${info.canUseSteam}

BROWSER INFO
------------
User Agent: ${navigator.userAgent}
Cookies Enabled: ${navigator.cookieEnabled}
Online: ${navigator.onLine}
Language: ${navigator.language}

ERRORS
------
${info.errors.length > 0 ? info.errors.join('\n') : 'None'}

WARNINGS
--------
${info.warnings.length > 0 ? info.warnings.join('\n') : 'None'}

RECOMMENDATIONS
---------------
${!info.canUseSteam ? '- Fix errors above before attempting Steam authentication' : '- Environment is ready for Steam OpenID'}
${!info.isSecure && !info.isLocalhost ? '- Use HTTPS in production' : ''}
${info.warnings.length > 0 ? '- Review warnings above' : ''}
  `.trim();
  
  return report;
};

// Automatically log debug info in development
if (process.env.NODE_ENV === 'development') {
  console.log('Steam Debug Utilities loaded. Run logSteamDebugInfo() for diagnostics.');
}