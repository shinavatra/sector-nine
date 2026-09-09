import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Alert, AlertDescription } from "../components/ui/alert";
import { CrowbarLogo } from "../components/CrowbarLogo";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Eye, EyeOff, Shield, Lock, User, Mail, AlertTriangle, ExternalLink, Info } from "lucide-react";
import { authAPI } from "../utils/api";
import { toast } from "sonner";

interface AuthProps {
  onLogin: (isNewUser?: boolean) => void;
  onNavigate: (page: string) => void;
  registrationUnavailableReason?: string;
}

export function Auth({ onLogin, onNavigate, registrationUnavailableReason }: AuthProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Check if in iframe
  const inIframe = window.self !== window.top;
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Register form state
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
    toast.info("Opening in new tab", {
      description: "Please continue with Steam login in the new tab",
      className: "bg-blue-900/90 border-blue-700 text-blue-100"
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const data = await authAPI.signin(loginEmail, loginPassword);
      toast.success("Login successful", {
        className: "bg-green-900/90 border-green-700 text-green-100"
      });
      onLogin(false); // Existing user
    } catch (error: any) {
      toast.error("Login failed", {
        description: error.message || "Invalid credentials",
        className: "bg-red-900/90 border-red-700 text-red-100"
      });
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registrationUnavailableReason) {
      toast.error("Registration unavailable", { description: registrationUnavailableReason });
      return;
    }
    
    if (registerPassword !== registerConfirmPassword) {
      toast.error("Passwords do not match", {
        className: "bg-red-900/90 border-red-700 text-red-100"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      await authAPI.signup(registerEmail, registerPassword, registerUsername);
      toast.success("Registration successful", {
        description: "Welcome to Sector Nine Initiative!",
        className: "bg-green-900/90 border-green-700 text-green-100"
      });
      
      onLogin(true); // New user — token already set by signup
    } catch (error: any) {
      toast.error("Registration failed", {
        description: error.message || "Unable to create account",
        className: "bg-red-900/90 border-red-700 text-red-100"
      });
      setIsLoading(false);
    }
  };

  const handleSteamConnect = async () => {
    setIsLoading(true);
    
    try {
      // Check if we're in a secure context
      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
        toast.error("Secure connection required", {
          description: "Steam login requires HTTPS. Please use a secure connection.",
          className: "bg-red-900/90 border-red-700 text-red-100"
        });
        setIsLoading(false);
        return;
      }

      // Import and initiate Steam auth
      const { initiateSteamLogin } = await import("../utils/steamAuth");
        // Check if in iframe
        if (inIframe) {
          handleOpenInNewTab();
          return;
        }
        
        await initiateSteamLogin('login');
        
        // Don't set loading to false for new window approach
        // User needs to complete auth in new window
    } catch (error) {
      console.error('Steam connect error:', error);
      setIsLoading(false);
      toast.error("Steam login failed", {
        description: error instanceof Error ? error.message : "Unable to connect to Steam. Please try again or use email registration.",
        className: "bg-red-900/90 border-red-700 text-red-100"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1707496716716-018d98618f52?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYWxmJTIwbGlmZSUyMGJsYWNrJTIwbWVzYSUyMGZhY2lsaXR5fGVufDF8fHx8MTc1ODIzNDkxNXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Black Mesa Research Facility"
          className="absolute inset-0 w-full h-full object-cover opacity-10"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/95 to-black/90" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <CrowbarLogo className="w-10 h-10 text-orange-400" />
              <div>
                <h1 className="text-2xl font-bold text-orange-400">crowbar.gg</h1>
                <div className="text-xs text-green-400 font-mono">COMPETITIVE GAMING PLATFORM</div>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-900/20 text-green-400 border-green-900/30 font-mono">
              <Shield className="w-3 h-3 mr-1" />
              FREE REGISTRATION AVAILABLE
            </Badge>
          </div>

          {/* Steam Connect - Primary Option */}
          <Card className="bg-black/40 border-orange-900/20 mb-6">
            <CardContent className="p-6">
              {/* Iframe Warning */}
              {inIframe && (
                <Alert className="mb-4 bg-blue-900/20 border-blue-900/30">
                  <Info className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-blue-300 font-mono text-xs">
                    Running in preview mode. For Steam login, please{" "}
                    <button
                      onClick={handleOpenInNewTab}
                      className="underline hover:text-blue-200 inline-flex items-center"
                    >
                      open in new tab <ExternalLink className="w-3 h-3 ml-1" />
                    </button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-center mb-4">
                <div className="text-orange-400 font-mono mb-2">QUICK & SECURE REGISTRATION</div>
                <div className="text-sm text-gray-400 font-mono">
                  Connect with Steam for instant account creation and verification - completely free
                </div>
              </div>
              
              <Button 
                onClick={handleSteamConnect}
                disabled={isLoading}
                className="w-full bg-blue-900/20 border border-blue-900/30 text-blue-400 hover:bg-blue-900/30 font-mono disabled:opacity-50 py-4"
              >
                <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                {isLoading ? 'CONNECTING TO STEAM...' : 'SIGN IN / REGISTER WITH STEAM'}
              </Button>

              <div className="mt-4 p-3 bg-green-900/10 border border-green-900/20 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Shield className="w-4 h-4 text-green-400 mt-0.5" />
                  <div>
                    <div className="text-green-400 font-mono text-xs font-semibold">SECURE & INSTANT</div>
                    <div className="text-gray-400 font-mono text-xs mt-1">
                      • Creates account automatically • Verifies Half-Life ownership  No payment required • Free lifetime access
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="relative mb-6">
            <Separator className="bg-orange-900/20" />
            <div className="absolute inset-0 flex justify-center items-center">
              <span className="bg-background px-4 text-gray-400 font-mono text-sm">OR</span>
            </div>
          </div>

          <Tabs defaultValue="connect" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-orange-900/20">
              <TabsTrigger value="connect" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                CONNECT
              </TabsTrigger>
              <TabsTrigger value="register" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
                REGISTER
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connect">
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono text-center">PERSONNEL ACCESS</CardTitle>
                  <div className="text-sm text-gray-400 font-mono text-center">
                    Connect with your existing credentials
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-gray-300 font-mono">EMAIL ADDRESS</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="researcher@blackmesa.gov"
                          className="pl-10 bg-black/20 border-orange-900/20 text-gray-300 placeholder-gray-500 font-mono"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-gray-300 font-mono">PASSWORD</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10 bg-black/20 border-orange-900/20 text-gray-300 placeholder-gray-500 font-mono"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="remember" className="form-checkbox text-orange-400" />
                      <Label htmlFor="remember" className="text-gray-400 font-mono text-sm">
                        Remember security clearance
                      </Label>
                    </div>

                    <Button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono disabled:opacity-50"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      {isLoading ? 'CONNECTING...' : 'CONNECT TO FACILITY'}
                    </Button>
                  </form>

                  <Separator className="bg-orange-900/20" />

                  <div className="text-center">
                    <Button 
                      variant="link" 
                      className="text-gray-400 hover:text-orange-400 font-mono text-sm"
                      onClick={() => {
                        toast.info('Redirecting to password reset...', {
                          className: 'bg-blue-900/90 border-blue-700 text-blue-100'
                        });
                        onNavigate('forgot-password');
                      }}
                    >
                      Forgot security credentials?
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="bg-black/40 border-orange-900/20">
                <CardHeader>
                  <CardTitle className="text-orange-400 font-mono text-center">PERSONNEL REGISTRATION</CardTitle>
                  <div className="text-sm text-gray-400 font-mono text-center">
                    Request security clearance for facility access
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    {registrationUnavailableReason && (
                      <Alert className="border-amber-600/40 bg-amber-950/30 text-amber-100">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="font-mono text-xs">{registrationUnavailableReason}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="register-username" className="text-gray-300 font-mono">USERNAME</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="register-username"
                          type="text"
                          placeholder="Freeman_G"
                          className="pl-10 bg-black/20 border-orange-900/20 text-gray-300 placeholder-gray-500 font-mono"
                          value={registerUsername}
                          onChange={(e) => setRegisterUsername(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="text-gray-300 font-mono">EMAIL ADDRESS</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="researcher@blackmesa.gov"
                          className="pl-10 bg-black/20 border-orange-900/20 text-gray-300 placeholder-gray-500 font-mono"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-gray-300 font-mono">PASSWORD</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10 bg-black/20 border-orange-900/20 text-gray-300 placeholder-gray-500 font-mono"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-gray-300 font-mono">CONFIRM PASSWORD</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10 bg-black/20 border-orange-900/20 text-gray-300 placeholder-gray-500 font-mono"
                          value={registerConfirmPassword}
                          onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-start space-x-2">
                      <input type="checkbox" id="terms" className="form-checkbox text-orange-400 mt-1" required />
                      <Label htmlFor="terms" className="text-gray-400 font-mono text-sm leading-relaxed">
                        I agree to the Terms of Service and acknowledge that all activities are monitored for security purposes
                      </Label>
                    </div>

                    <Button 
                      type="submit"
                      disabled={isLoading || Boolean(registrationUnavailableReason)}
                      className="w-full bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono disabled:opacity-50"
                    >
                      <User className="w-4 h-4 mr-2" />
                      {isLoading ? 'PROCESSING...' : 'REQUEST ACCESS'}
                    </Button>
                  </form>

                  <div className="bg-orange-900/10 border border-orange-900/20 rounded-lg p-3">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5" />
                      <div>
                        <div className="text-orange-400 font-mono text-xs font-semibold">SECURITY NOTICE</div>
                        <div className="text-gray-400 font-mono text-xs mt-1">
                          New personnel require Level 3 clearance approval. Account activation may take 24-48 hours.
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-8 text-center text-xs text-gray-500 font-mono">
            <p>&copy; 2025 CROWBAR.GG - ALL RIGHTS RESERVED</p>
            <p className="text-orange-400 mt-1">UNAUTHORIZED ACCESS WILL RESULT IN TERMINATION</p>
          </div>
        </div>
      </div>
    </div>
  );
}
