import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { 
  Crown, 
  Trophy, 
  Star, 
  Gift, 
  Zap, 
  Shield, 
  Check,
  CreditCard,
  ArrowLeft,
  Lock,
  Coins
} from "lucide-react";
import { toast } from "sonner";
import { userAPI } from "../utils/api";
import { useUser } from "../contexts/UserContext";

interface VIPSubscriptionProps {
  onNavigate: (page: string) => void;
}

export function VIPSubscription({ onNavigate }: VIPSubscriptionProps) {
  const { refreshProfile, user } = useUser();
  const [paymentType, setPaymentType] = useState<'money' | 'points'>('money');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Card payment form
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');

  const plan = {
    priceEuro: 5.00,
    pricePoints: 5000,
    period: 'month',
    popular: true
  };
  
  const userPoints = user?.points || 0;

  const vipBenefits = [
    { icon: Crown, text: 'Tournament Access', description: 'Enter all premium tournaments' },
    { icon: Trophy, text: 'Exclusive VIP Badge', description: 'Show off your VIP status' },
    { icon: Star, text: 'Priority Matchmaking', description: 'Get matched faster' },
    { icon: Gift, text: '1000 Bonus Points', description: 'Instant points on signup' },
    { icon: Zap, text: '+50 XP Per Win', description: 'Earn 50 XP per win vs 30 for standard' },
    { icon: Shield, text: 'Premium Support', description: '24/7 priority assistance' }
  ];

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      setCardNumber(formatted);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    if (formatted.length <= 5) {
      setExpiryDate(formatted);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/gi, '');
    if (value.length <= 4) {
      setCvv(value);
    }
  };

  const validatePayment = () => {
    if (paymentMethod === 'card') {
      if (!cardNumber || cardNumber.replace(/\s/g, '').length !== 16) {
        toast.error('Invalid card number', {
          description: 'Please enter a valid 16-digit card number',
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
        return false;
      }
      if (!cardName || cardName.trim().length < 3) {
        toast.error('Invalid card holder name', {
          description: 'Please enter the name on the card',
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
        return false;
      }
      if (!expiryDate || expiryDate.length !== 5) {
        toast.error('Invalid expiry date', {
          description: 'Please enter expiry date (MM/YY)',
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
        return false;
      }
      if (!cvv || cvv.length < 3) {
        toast.error('Invalid CVV', {
          description: 'Please enter 3 or 4 digit CVV',
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
        return false;
      }
    }
    return true;
  };

  const handlePayPalPayment = () => {
    setIsProcessing(true);
    
    // PayPal configuration for production
    const paypalAmount = '5.00';
    const paypalCurrency = 'EUR';
    
    // Create PayPal payment URL
    // Replace with your actual PayPal business email or merchant ID
    const paypalEmail = 'sectornine@business.paypal.com'; // Replace with your PayPal email
    
    const paypalUrl = `https://www.paypal.com/cgi-bin/webscr?` +
      `cmd=_xclick&` +
      `business=${encodeURIComponent(paypalEmail)}&` +
      `item_name=${encodeURIComponent('Sector Nine VIP Subscription - 1 Month')}&` +
      `amount=${paypalAmount}&` +
      `currency_code=${paypalCurrency}&` +
      `return=${encodeURIComponent(window.location.origin + '/vip-subscription?success=true')}&` +
      `cancel_return=${encodeURIComponent(window.location.origin + '/vip-subscription?cancelled=true')}&` +
      `notify_url=${encodeURIComponent(window.location.origin + '/api/paypal-ipn')}&` +
      `no_shipping=1&` +
      `rm=2`;
    
    // Open PayPal in new window
    window.open(paypalUrl, '_blank');
    
    toast.info('PayPal Payment', {
      description: 'Opening PayPal payment window...',
      className: 'bg-blue-900/90 border-blue-700 text-blue-100'
    });
    
    setIsProcessing(false);
  };

  const handlePayment = async () => {
    // Check points if paying with points
    if (paymentType === 'points') {
      if (userPoints < plan.pricePoints) {
        toast.error('Insufficient Points', {
          description: `You need ${plan.pricePoints} points. You have ${userPoints} points.`,
          className: 'bg-red-900/90 border-red-700 text-red-100'
        });
        return;
      }
    } else {
      // Handle PayPal payment
      if (paymentMethod === 'paypal') {
        handlePayPalPayment();
        return;
      }
      
      // Validate card payment form
      if (!validatePayment()) return;
    }

    setIsProcessing(true);
    
    try {
      // Simulate payment processing for card/points
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Activate VIP subscription (pass payment type to backend)
      await userAPI.upgradeToVIP(paymentType === 'money' ? 'payment' : 'points');
      await refreshProfile();
      
      // Show confirmation
      setShowConfirmation(true);
      
      toast.success('Payment Successful!', {
        description: paymentType === 'money' 
          ? 'VIP monthly subscription activated' 
          : 'VIP subscription activated with points',
        className: 'bg-green-900/90 border-green-700 text-green-100'
      });
    } catch (error: any) {
      toast.error('Payment Failed', {
        description: error.message || 'Please try again or contact support',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto bg-gradient-to-br from-yellow-900/20 via-orange-900/20 to-green-900/20 border-yellow-900/30">
          <CardContent className="p-12 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse">
              <Crown className="w-12 h-12 text-black" />
            </div>
            
            <h2 className="text-3xl font-bold text-yellow-400 font-mono mb-4">
              WELCOME TO VIP!
            </h2>
            
            <p className="text-gray-300 font-mono text-lg mb-8">
              Your VIP subscription has been activated successfully
            </p>
            
            <div className="bg-black/40 border border-yellow-900/30 rounded-lg p-6 mb-8">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-green-400 font-mono text-sm mb-1">BONUS POINTS</div>
                  <div className="text-2xl font-bold text-green-400 font-mono">+1000</div>
                </div>
                <div>
                  <div className="text-orange-400 font-mono text-sm mb-1">XP PER WIN</div>
                  <div className="text-2xl font-bold text-orange-400 font-mono">+50 XP</div>
                </div>
              </div>
            </div>
            
            <div className="space-y-3 mb-8">
              {vipBenefits.map((benefit, index) => (
                <div key={index} className="flex items-center space-x-3 text-left bg-black/20 p-3 rounded border border-yellow-900/20">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span className="text-gray-300 font-mono text-sm">{benefit.text}</span>
                </div>
              ))}
            </div>
            
            <Button
              onClick={() => onNavigate('hub')}
              className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black hover:from-yellow-500 hover:to-orange-500 font-mono"
            >
              RETURN TO HUB
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="outline"
        onClick={() => onNavigate('store')}
        className="mb-6 border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        BACK TO STORE
      </Button>

      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-yellow-400 font-mono mb-2">VIP SUBSCRIPTION</h1>
        <p className="text-gray-400 font-mono">Unlock premium features and exclusive tournament access</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Benefits */}
        <div className="lg:col-span-1">
          <Card className="bg-black/40 border-yellow-900/20 sticky top-8">
            <CardHeader>
              <CardTitle className="text-yellow-400 font-mono flex items-center">
                <Crown className="w-5 h-5 mr-2" />
                VIP BENEFITS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vipBenefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <div key={index} className="flex items-start space-x-3">
                    <Icon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                    <div>
                      <div className="text-gray-300 font-mono text-sm font-bold">{benefit.text}</div>
                      <div className="text-gray-500 font-mono text-xs">{benefit.description}</div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right: Subscription & Payment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plan Selection */}
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">SUBSCRIPTION PLAN</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment Type Selection */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={paymentType === 'money' ? 'default' : 'outline'}
                  onClick={() => setPaymentType('money')}
                  className={paymentType === 'money' 
                    ? 'bg-yellow-900/30 border border-yellow-900/50 text-yellow-400 font-mono h-auto py-4 flex-col'
                    : 'border-orange-900/30 text-gray-400 hover:bg-orange-900/10 font-mono h-auto py-4 flex-col'
                  }
                >
                  <CreditCard className="w-6 h-6 mb-2" />
                  <div className="text-lg">€{plan.priceEuro.toFixed(2)}</div>
                  <div className="text-xs opacity-70">per month</div>
                </Button>
                <Button
                  variant={paymentType === 'points' ? 'default' : 'outline'}
                  onClick={() => setPaymentType('points')}
                  className={paymentType === 'points' 
                    ? 'bg-yellow-900/30 border border-yellow-900/50 text-yellow-400 font-mono h-auto py-4 flex-col'
                    : 'border-orange-900/30 text-gray-400 hover:bg-orange-900/10 font-mono h-auto py-4 flex-col'
                  }
                >
                  <Coins className="w-6 h-6 mb-2" />
                  <div className="text-lg">{plan.pricePoints} Points</div>
                  <div className="text-xs opacity-70">per month</div>
                </Button>
              </div>
              
              {paymentType === 'points' && (
                <div className="p-4 bg-blue-900/10 border border-blue-900/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 font-mono text-sm">Your Points:</span>
                    <span className={`font-mono font-bold ${userPoints >= plan.pricePoints ? 'text-green-400' : 'text-red-400'}`}>
                      {userPoints} Points
                    </span>
                  </div>
                  {userPoints < plan.pricePoints && (
                    <p className="text-xs text-red-400 font-mono mt-2">
                      You need {plan.pricePoints - userPoints} more points to subscribe
                    </p>
                  )}
                </div>
              )}
              
              <div className="p-6 border-2 border-yellow-400 bg-yellow-900/10 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-orange-400 font-mono">MONTHLY SUBSCRIPTION</h3>
                  <Badge className="bg-yellow-900/20 text-yellow-400 border-yellow-900/30">
                    VIP ACCESS
                  </Badge>
                </div>
                <div className="text-3xl font-bold text-yellow-400 font-mono mb-1">
                  {paymentType === 'money' ? `€${plan.priceEuro.toFixed(2)}` : `${plan.pricePoints} Points`}
                </div>
                <div className="text-gray-400 font-mono text-sm">per month</div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method - Only show for money payment */}
          {paymentType === 'money' && (
            <Card className="bg-black/40 border-orange-900/20">
              <CardHeader>
                <CardTitle className="text-orange-400 font-mono">PAYMENT METHOD</CardTitle>
              </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('card')}
                  className={paymentMethod === 'card' 
                    ? 'bg-orange-900/30 border border-orange-900/50 text-orange-400 font-mono'
                    : 'border-orange-900/30 text-gray-400 hover:bg-orange-900/10 font-mono'
                  }
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  CREDIT CARD
                </Button>
                <Button
                  variant={paymentMethod === 'paypal' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('paypal')}
                  className={paymentMethod === 'paypal'
                    ? 'bg-orange-900/30 border border-orange-900/50 text-orange-400 font-mono'
                    : 'border-orange-900/30 text-gray-400 hover:bg-orange-900/10 font-mono'
                  }
                >
                  PAYPAL
                </Button>
              </div>

              <Separator className="bg-orange-900/20" />

              {paymentMethod === 'card' ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-400 font-mono text-sm">Card Number</Label>
                    <Input
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="1234 5678 9012 3456"
                      className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                      maxLength={19}
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 font-mono text-sm">Cardholder Name</Label>
                    <Input
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="JOHN DOE"
                      className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 font-mono text-sm">Expiry Date</Label>
                      <Input
                        value={expiryDate}
                        onChange={handleExpiryChange}
                        placeholder="MM/YY"
                        className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 font-mono text-sm">CVV</Label>
                      <Input
                        type="password"
                        value={cvv}
                        onChange={handleCvvChange}
                        placeholder="123"
                        className="mt-1 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                        maxLength={4}
                      />
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 p-3 bg-blue-900/10 border border-blue-900/30 rounded">
                    <Lock className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-400 font-mono">
                      Your payment information is encrypted and secure
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">💳</div>
                  <p className="text-gray-400 font-mono text-sm mb-4">
                    You will be redirected to PayPal to complete your payment
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    Secure payment processing by PayPal
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Order Summary & Payment */}
          <Card className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-900/30">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-mono">VIP Subscription (Monthly)</span>
                  <span className="text-orange-400 font-mono font-bold">
                    {paymentType === 'money' ? `€${plan.priceEuro.toFixed(2)}` : `${plan.pricePoints} Points`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-mono">Bonus Points</span>
                  <span className="text-green-400 font-mono font-bold">+1000</span>
                </div>
                <Separator className="bg-orange-900/20" />
                <div className="flex justify-between items-center">
                  <span className="text-yellow-400 font-mono font-bold">TOTAL</span>
                  <span className="text-yellow-400 font-mono font-bold text-xl">
                    {paymentType === 'money' ? `€${plan.priceEuro.toFixed(2)}` : `${plan.pricePoints} Points`}
                  </span>
                </div>
                
                <Button
                  onClick={handlePayment}
                  disabled={isProcessing || (paymentType === 'points' && userPoints < plan.pricePoints)}
                  className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-black hover:from-yellow-500 hover:to-orange-500 font-mono disabled:opacity-50 py-6"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                      PROCESSING...
                    </>
                  ) : (
                    <>
                      <Crown className="w-5 h-5 mr-2" />
                      {paymentType === 'money' 
                        ? `ACTIVATE VIP - €${plan.priceEuro.toFixed(2)}`
                        : `ACTIVATE VIP - ${plan.pricePoints} Points`
                      }
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-center text-gray-500 font-mono">
                  By completing this purchase, you agree to our Terms of Service
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
