import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Crown, Zap, Shield, Star, Gift, Trophy } from "lucide-react";
import { toast } from "sonner";
import { userAPI } from "../utils/api";
import { useUser } from "../contexts/UserContext";
import { avatarBadges, profileFrames, getRarityColor, getRarityGlow } from "../utils/badgeData";

interface StoreProps {
  onNavigate?: (page: string) => void;
  isPremium?: boolean;
}

export function Store({ onNavigate, isPremium = false }: StoreProps) {
  const { user, refreshProfile, adoptProfile } = useUser();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [purchasingItem, setPurchasingItem] = useState<string | null>(null);

  const userPoints = user?.points || 0;
  const ownedBadges = user?.ownedBadges || [];
  const ownedFrames = user?.ownedFrames || [];

  const handlePurchaseBadge = async (badgeId: string, pointsCost: number) => {
    setPurchasingItem(badgeId);
    try {
      console.log(`Attempting to purchase badge ${badgeId} for ${pointsCost} points`);
      console.log(`Current user points: ${userPoints}`);
      await userAPI.purchaseBadge(badgeId, pointsCost);
      await refreshProfile();
      toast.success('Badge purchased!', {
        description: 'Badge unlocked successfully',
        className: 'bg-green-900/90 border-green-700 text-green-100'
      });
    } catch (error: any) {
      console.error('Badge purchase error:', error);
      console.error('Error message:', error.message);
      toast.error('Purchase failed', {
        description: error.message || 'Not enough points or badge already owned',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setPurchasingItem(null);
    }
  };

  const handlePurchaseFrame = async (frameId: string, pointsCost: number) => {
    setPurchasingItem(frameId);
    try {
      const { profile } = await userAPI.purchaseFrame(frameId, pointsCost);
      adoptProfile(profile);
      toast.success('Frame purchased!', {
        description: 'Frame unlocked successfully',
        className: 'bg-green-900/90 border-green-700 text-green-100'
      });
    } catch (error: any) {
      toast.error('Purchase failed', {
        description: error.message || 'Not enough points or frame already owned',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setPurchasingItem(null);
    }
  };

  const handleCancelVIP = async () => {
    setIsCancelling(true);
    try {
      await userAPI.cancelVIP();
      await refreshProfile();
      toast.success('VIP Cancelled', {
        description: 'Your VIP subscription has been cancelled',
        className: 'bg-orange-900/90 border-orange-700 text-orange-100'
      });
    } catch (error: any) {
      toast.error('Cancellation failed', {
        description: error.message || 'Please try again',
        className: 'bg-red-900/90 border-red-700 text-red-100'
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-orange-400 font-mono">EQUIPMENT ARMORY</h1>
            <p className="text-gray-400 font-mono mt-1">Purchase cosmetic items with points earned through matches and tournaments</p>
          </div>
          <Card className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-900/30">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 font-mono mb-1">AVAILABLE POINTS</div>
                <div className="text-3xl font-bold text-yellow-400 font-mono">{userPoints.toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="premium" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-black/40 border border-orange-900/20">
          <TabsTrigger value="premium" className="font-mono data-[state=active]:bg-yellow-900/20 data-[state=active]:text-yellow-400">
            VIP SUBSCRIPTION
          </TabsTrigger>
          <TabsTrigger value="avatar-badges" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            AVATAR BADGES
          </TabsTrigger>
          <TabsTrigger value="profile-frames" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            PROFILE FRAMES
          </TabsTrigger>
        </TabsList>

        <TabsContent value="premium" className="space-y-6">
          <Card className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-900/30">
            <CardHeader>
              <div className="text-center">
                <div className="text-4xl mb-4">👑</div>
                <CardTitle className="text-yellow-400 font-mono text-2xl">VIP SUBSCRIPTION</CardTitle>
                <p className="text-gray-300 font-mono mt-2">Unlock exclusive tournament access and premium features</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isPremium ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-black/40 border-yellow-900/20">
                      <CardHeader>
                        <CardTitle className="text-yellow-400 font-mono">VIP BENEFITS</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <Crown className="w-5 h-5 text-yellow-400" />
                          <span className="text-gray-300 font-mono">Tournament Access</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Trophy className="w-5 h-5 text-yellow-400" />
                          <span className="text-gray-300 font-mono">Exclusive VIP Badge</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Star className="w-5 h-5 text-yellow-400" />
                          <span className="text-gray-300 font-mono">Priority Matchmaking</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Gift className="w-5 h-5 text-yellow-400" />
                          <span className="text-gray-300 font-mono">1000 Bonus Points</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Zap className="w-5 h-5 text-yellow-400" />
                          <span className="text-gray-300 font-mono">+50 XP Per Win</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Shield className="w-5 h-5 text-yellow-400" />
                          <span className="text-gray-300 font-mono">Premium Support</span>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-black/40 border-yellow-900/20">
                      <CardHeader>
                        <CardTitle className="text-yellow-400 font-mono">PRICING</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center py-3">
                          <div className="text-4xl font-bold text-yellow-400 font-mono mb-2">
                            5000 Points / €5
                          </div>
                          <div className="text-sm text-gray-400 font-mono">per month</div>
                        </div>
                        <Button 
                          onClick={() => onNavigate?.('vip-subscription')}
                          className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-black hover:from-yellow-500 hover:to-orange-500 font-mono"
                        >
                          GET VIP ACCESS
                        </Button>
                        <div className="text-xs text-gray-400 font-mono text-center px-4">
                          Pay with points or via PayPal/Card
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="text-6xl">👑</div>
                  <h3 className="text-2xl text-yellow-400 font-mono">VIP ACTIVE</h3>
                  <p className="text-gray-300 font-mono">You have full access to all premium features</p>
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black text-lg font-bold px-4 py-2">
                    VIP MEMBER
                  </Badge>
                  <Button 
                    onClick={handleCancelVIP}
                    disabled={isCancelling}
                    variant="outline"
                    className="mt-4 border-red-900/30 text-red-400 hover:bg-red-900/10 font-mono disabled:opacity-50"
                  >
                    {isCancelling ? 'CANCELLING...' : 'CANCEL SUBSCRIPTION'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avatar-badges" className="space-y-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-orange-400 font-mono mb-2">AVATAR BADGES</h2>
            <p className="text-gray-400 font-mono mb-3">Customize your profile with unique avatar badges</p>
            <div className="bg-orange-900/10 border border-orange-900/20 rounded-lg p-3">
              <p className="text-xs text-orange-400 font-mono">
                💡 Earn points by winning matches and tournaments. Equip badges from your Profile page.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {avatarBadges.map((badge) => (
              <Card key={badge.id} className={`bg-black/40 border-orange-900/20 ${getRarityGlow(badge.rarity)} transition-all hover:scale-105`}>
                <CardHeader className="p-4">
                  <div className="text-center">
                    <div className="text-5xl mb-2">{badge.icon}</div>
                    <CardTitle className="text-sm text-orange-400 font-mono">{badge.name}</CardTitle>
                    <Badge className={`font-mono text-xs mt-2 ${getRarityColor(badge.rarity)}`}>
                      {badge.rarity}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-gray-400 font-mono text-xs mb-3 text-center min-h-[2.5rem]">
                    {badge.description}
                  </p>
                  
                  {badge.isVIPOnly && !user?.isPremium ? (
                    <Button 
                      disabled
                      className="w-full bg-yellow-900/20 border border-yellow-900/30 text-yellow-400 font-mono text-xs cursor-not-allowed"
                    >
                      VIP ONLY
                    </Button>
                  ) : ownedBadges.includes(badge.id) ? (
                    <Button 
                      disabled
                      className="w-full bg-green-900/20 border border-green-900/30 text-green-400 font-mono text-xs cursor-not-allowed"
                    >
                      OWNED
                    </Button>
                  ) : badge.pricePoints === 0 ? (
                    <Button 
                      disabled
                      className="w-full bg-gray-900/20 border border-gray-900/30 text-gray-400 font-mono text-xs cursor-not-allowed"
                    >
                      FREE
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handlePurchaseBadge(badge.id, badge.pricePoints)}
                      disabled={purchasingItem === badge.id || userPoints < badge.pricePoints}
                      className="w-full bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono text-xs disabled:opacity-50"
                    >
                      {purchasingItem === badge.id ? 'BUYING...' : `${badge.pricePoints} PTS`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="profile-frames" className="space-y-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-orange-400 font-mono mb-2">PROFILE FRAMES</h2>
            <p className="text-gray-400 font-mono mb-3">Enhance your profile with distinctive frames</p>
            <div className="bg-orange-900/10 border border-orange-900/20 rounded-lg p-3">
              <p className="text-xs text-orange-400 font-mono">
                💡 Earn points by winning matches and tournaments. Equip frames from your Profile page.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {profileFrames.map((frame) => (
              <Card key={frame.id} className={`bg-black/40 border-orange-900/20 ${getRarityGlow(frame.rarity)} transition-all hover:scale-105`}>
                <CardHeader className="p-4">
                  <div className="text-center">
                    <div className="text-5xl mb-2">{frame.icon}</div>
                    <CardTitle className="text-sm text-orange-400 font-mono">{frame.name}</CardTitle>
                    <Badge className={`font-mono text-xs mt-2 ${getRarityColor(frame.rarity)}`}>
                      {frame.rarity}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-gray-400 font-mono text-xs mb-3 text-center min-h-[2.5rem]">
                    {frame.description}
                  </p>
                  
                  {frame.isVIPOnly && !user?.isPremium ? (
                    <Button 
                      disabled
                      className="w-full bg-yellow-900/20 border border-yellow-900/30 text-yellow-400 font-mono text-xs cursor-not-allowed"
                    >
                      VIP ONLY
                    </Button>
                  ) : ownedFrames.includes(frame.id) ? (
                    <Button 
                      disabled
                      className="w-full bg-green-900/20 border border-green-900/30 text-green-400 font-mono text-xs cursor-not-allowed"
                    >
                      OWNED
                    </Button>
                  ) : frame.pricePoints === 0 ? (
                    <Button 
                      disabled
                      className="w-full bg-gray-900/20 border border-gray-900/30 text-gray-400 font-mono text-xs cursor-not-allowed"
                    >
                      FREE
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handlePurchaseFrame(frame.id, frame.pricePoints)}
                      disabled={purchasingItem === frame.id || userPoints < frame.pricePoints}
                      className="w-full bg-orange-900/20 border border-orange-900/30 text-orange-400 hover:bg-orange-900/30 font-mono text-xs disabled:opacity-50"
                    >
                      {purchasingItem === frame.id ? 'BUYING...' : `${frame.pricePoints} PTS`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
