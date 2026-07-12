import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { CrowbarLogo } from "../components/CrowbarLogo";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { authAPI } from "../utils/api";

interface NewPasswordProps {
  onNavigate: (page: string) => void;
}

export function NewPassword({ onNavigate }: NewPasswordProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Extract reset token from URL query param (?token=xxx)
    // Our server sends: /new-password?token=xxx
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setAccessToken(token);
    } else {
      setMessage({
        type: 'error',
        text: 'Invalid or expired reset link. Please request a new password reset.'
      });
    }
  }, []);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!accessToken) {
      setMessage({
        type: 'error',
        text: 'Invalid or expired reset link. Please request a new password reset.'
      });
      return;
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setMessage({
        type: 'error',
        text: passwordError
      });
      toast.error('Invalid password', {
        description: passwordError,
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setMessage({
        type: 'error',
        text: 'Passwords do not match'
      });
      toast.error('Password mismatch', {
        description: 'The passwords you entered do not match',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call API to update password
      await authAPI.updatePassword(accessToken, password);

      setMessage({
        type: 'success',
        text: 'Password successfully updated! You can now log in with your new password.'
      });

      toast.success('Password updated!', {
        description: 'Redirecting to login page...',
        className: 'bg-green-900/90 border-green-700 text-green-100'
      });

      // Clear form
      setPassword("");
      setConfirmPassword("");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        onNavigate('auth');
      }, 3000);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update password. Please try again.';
      
      setMessage({
        type: 'error',
        text: errorMessage
      });
      
      toast.error('Update failed', {
        description: errorMessage,
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setIsLoading(false);
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
                <h1 className="text-2xl font-bold text-orange-400">SECTOR NINE INITIATIVE</h1>
                <div className="text-xs text-green-400 font-mono">SECURITY CREDENTIALS UPDATE</div>
              </div>
            </div>
          </div>

          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono text-center">NEW PASSWORD</CardTitle>
              <div className="text-sm text-gray-400 font-mono text-center">
                Enter your new password to complete the reset process
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Message Alert */}
                {message && (
                  <Alert className={`${
                    message.type === 'success' 
                      ? 'bg-green-900/20 border-green-900/30' 
                      : 'bg-red-900/20 border-red-900/30'
                  }`}>
                    {message.type === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-400" />
                    )}
                    <AlertDescription className={`${
                      message.type === 'success' ? 'text-green-300' : 'text-red-300'
                    } font-mono text-xs`}>
                      {message.text}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-gray-300 font-mono">NEW PASSWORD</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      className="pl-10 pr-10 bg-black/20 border-orange-900/20 text-gray-300 placeholder-gray-500 font-mono"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading || !accessToken}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-orange-400 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-gray-300 font-mono">CONFIRM PASSWORD</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      className="pl-10 pr-10 bg-black/20 border-orange-900/20 text-gray-300 placeholder-gray-500 font-mono"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading || !accessToken}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-orange-400 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                <div className="p-3 bg-blue-900/10 border border-blue-900/20 rounded-lg">
                  <div className="text-blue-400 font-mono text-xs font-semibold mb-2">PASSWORD REQUIREMENTS</div>
                  <ul className="text-gray-400 font-mono text-xs space-y-1">
                    <li className={password.length >= 8 ? 'text-green-400' : ''}>
                      {'>'} At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(password) ? 'text-green-400' : ''}>
                      {'>'} At least one uppercase letter
                    </li>
                    <li className={/[a-z]/.test(password) ? 'text-green-400' : ''}>
                      {'>'} At least one lowercase letter
                    </li>
                    <li className={/[0-9]/.test(password) ? 'text-green-400' : ''}>
                      {'>'} At least one number
                    </li>
                  </ul>
                </div>

                <Button 
                  type="submit"
                  disabled={isLoading || !accessToken || message?.type === 'success'}
                  className="w-full bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono disabled:opacity-50"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {isLoading ? 'UPDATING PASSWORD...' : 'UPDATE PASSWORD'}
                </Button>

                <Button
                  type="button"
                  variant="link"
                  className="w-full text-gray-400 hover:text-orange-400 font-mono text-sm"
                  onClick={() => onNavigate('auth')}
                  disabled={isLoading}
                >
                  Return to login
                </Button>
              </form>

              <div className="mt-6 p-3 bg-yellow-900/10 border border-yellow-900/20 rounded-lg">
                <div className="text-yellow-400 font-mono text-xs font-semibold mb-1">SECURITY NOTICE</div>
                <div className="text-gray-400 font-mono text-xs">
                  After updating your password, you will be automatically logged out from all devices for security reasons.
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center text-xs text-gray-500 font-mono">
            <p>&copy; 2025 SECTOR NINE INITIATIVE - CLASSIFIED</p>
            <p className="text-orange-400 mt-1">AUTHORIZED PERSONNEL ONLY</p>
          </div>
        </div>
      </div>
    </div>
  );
}
