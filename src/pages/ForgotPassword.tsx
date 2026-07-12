import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { CrowbarLogo } from "../components/CrowbarLogo";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { authAPI } from "../utils/api";
import { toast } from "sonner";

interface ForgotPasswordProps {
  onNavigate: (page: string) => void;
}

export function ForgotPassword({ onNavigate }: ForgotPasswordProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      await authAPI.resetPassword(email);
      
      setMessage({
        type: 'success',
        text: 'Password reset instructions have been sent to your email. Please check your inbox.'
      });
      
      toast.success('Reset email sent!', {
        description: 'Check your inbox for password reset instructions',
        className: 'bg-green-900/90 border-green-700 text-green-100'
      });
      
      setEmail("");
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send reset email. Please try again.';
      
      setMessage({
        type: 'error',
        text: errorMessage
      });
      
      toast.error('Reset failed', {
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
                <div className="text-xs text-green-400 font-mono">SECURITY CREDENTIALS RECOVERY</div>
              </div>
            </div>
          </div>

          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono text-center">PASSWORD RESET</CardTitle>
              <div className="text-sm text-gray-400 font-mono text-center">
                Enter your email address to receive password reset instructions
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
                  <Label htmlFor="reset-email" className="text-gray-300 font-mono">EMAIL ADDRESS</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="researcher@blackmesa.gov"
                      className="pl-10 bg-black/20 border-orange-900/20 text-gray-300 placeholder-gray-500 font-mono"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {isLoading ? 'SENDING INSTRUCTIONS...' : 'SEND RESET INSTRUCTIONS'}
                </Button>

                <Button
                  type="button"
                  variant="link"
                  className="w-full text-gray-400 hover:text-orange-400 font-mono text-sm"
                  onClick={() => onNavigate('auth')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Return to login
                </Button>
              </form>

              <div className="mt-6 p-3 bg-blue-900/10 border border-blue-900/20 rounded-lg">
                <div className="text-blue-400 font-mono text-xs font-semibold mb-1">SECURITY NOTICE</div>
                <div className="text-gray-400 font-mono text-xs">
                  Password reset emails are valid for 1 hour. If you don't receive an email, check your spam folder or ensure the email address is correct.
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
