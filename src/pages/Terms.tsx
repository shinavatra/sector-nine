import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowLeft, Shield, Users, AlertTriangle, Lock, FileText } from "lucide-react";

interface TermsProps {
  onNavigate?: (page: string) => void;
}

export function Terms({ onNavigate }: TermsProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button 
          variant="outline" 
          className="mb-4 border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
          onClick={() => onNavigate?.('lobby')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          RETURN TO FACILITY
        </Button>
        <h1 className="text-3xl font-bold text-orange-400 font-mono">TERMS AND CONDITIONS</h1>
        <p className="text-gray-400 font-mono mt-1">Legal framework and operational guidelines for Sector Nine Initiative</p>
      </div>

      {/* Main Terms Card */}
      <Card className="bg-black/40 border-orange-900/20 mb-8">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-orange-400" />
            <CardTitle className="text-orange-400 font-mono">CLASSIFIED AGREEMENT - LEVEL 3 CLEARANCE</CardTitle>
          </div>
          <div className="text-sm text-gray-400 font-mono">
            Last Updated: January 13, 2025 • Version 4.0.0 • Classification: RESTRICTED
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Section 1 */}
          <div className="space-y-4 p-4 bg-black/20 border border-orange-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-green-400" />
              <h3 className="text-green-400 font-mono text-lg">1. PLATFORM ACCESS & USAGE</h3>
            </div>
            <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
              <p>
                The Sector Nine Initiative is a <span className="text-orange-400">COMPETITIVE ESPORTS MATCHMAKING PLATFORM</span> exclusively focused on Half-Life 1 gameplay. Access to the platform requires account registration and Steam authentication.
              </p>
              <p>
                Users are granted access to <span className="text-green-400">TWO MATCHMAKING MODES</span>: Classic Deathmatch and Instagib Mode. All competitive matches are 1v1 format requiring exactly 5 map selections.
              </p>
              <p>
                <span className="text-orange-400">VIP SUBSCRIPTION (€5.00)</span> is required for tournament registration. Standard matchmaking is accessible to all registered users.
              </p>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-4 p-4 bg-black/20 border border-orange-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="text-blue-400 font-mono text-lg">2. PLAYER CONDUCT & BEHAVIOR</h3>
            </div>
            <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
              <p>
                All personnel must maintain <span className="text-blue-400">PROFESSIONAL CONDUCT</span> during competitive sessions. Harassment, toxic behavior, cheating, or exploitation of game mechanics will result in immediate account suspension or termination.
              </p>
              <p>
                Use of unauthorized software, aim assistance, wallhacks, or any third-party tools that provide unfair advantages is <span className="text-red-400">STRICTLY PROHIBITED</span> and grounds for permanent ban.
              </p>
              <p>
                Match abandonment, AFK behavior, or intentional game disruption will result in progressive penalties including temporary bans with escalating durations.
              </p>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-4 p-4 bg-black/20 border border-orange-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-purple-400" />
              <h3 className="text-purple-400 font-mono text-lg">3. ACCOUNT & DISPLAY NAMES</h3>
            </div>
            <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
              <p>
                Users are assigned a permanent username upon registration. Display name changes require <span className="text-orange-400">1500 PLATFORM POINTS</span>.
              </p>
              <p>
                Account credentials must remain confidential. Users are responsible for all activity conducted through their accounts. Account sharing or credential trading is prohibited.
              </p>
              <p>
                Email addresses are permanent identifiers and cannot be changed without contacting platform support with valid verification.
              </p>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-4 p-4 bg-black/20 border border-orange-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="text-yellow-400 font-mono text-lg">4. DATA PRIVACY & SECURITY</h3>
            </div>
            <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
              <p>
                The platform collects <span className="text-yellow-400">MINIMAL DATA</span> including email, username, Steam ID, match statistics, and gameplay data. This information is used solely for platform functionality and competitive integrity.
              </p>
              <p>
                <span className="text-red-400">DO NOT ENTER REAL PERSONAL INFORMATION</span> in bio fields, chat messages, or profile descriptions. The platform is not designed for handling sensitive personal data.
              </p>
              <p>
                All stored data is encrypted and protected. Users may request account data export or deletion by contacting platform support.
              </p>
            </div>
          </div>

          {/* Section 5 */}
          <div className="space-y-4 p-4 bg-black/20 border border-orange-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-orange-400" />
              <h3 className="text-orange-400 font-mono text-lg">5. VIP SUBSCRIPTION & PAYMENTS</h3>
            </div>
            <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
              <p>
                VIP subscription is priced at <span className="text-orange-400">€5.00</span> and grants access to tournament registration, exclusive features, and VIP badge visibility across all pages.
              </p>
              <p>
                Subscription fees are non-refundable except in cases of platform error or service unavailability. Cancellation requests must be submitted through official support channels.
              </p>
              <p>
                VIP status is personal and non-transferable. Sharing VIP benefits or account access violates terms and may result in subscription termination.
              </p>
            </div>
          </div>

          {/* Section 6 */}
          <div className="space-y-4 p-4 bg-black/20 border border-orange-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-green-400" />
              <h3 className="text-green-400 font-mono text-lg">6. SERVICE LIMITATIONS & LIABILITY</h3>
            </div>
            <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
              <p>
                The platform is provided <span className="text-yellow-400">"AS IS"</span> without guarantees of uptime, match quality, or competitive balance. Technical issues, server downtime, or data loss may occur.
              </p>
              <p>
                Platform operators are not liable for losses, damages, or negative experiences resulting from service use, technical failures, or player behavior.
              </p>
              <p>
                Features, game modes, and tournament formats may be modified or discontinued without advance notice to maintain platform quality and competitive integrity.
              </p>
            </div>
          </div>

          {/* Section 7 */}
          <div className="space-y-4 p-4 bg-black/20 border border-orange-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-red-400" />
              <h3 className="text-red-400 font-mono text-lg">7. TERMINATION & MODIFICATIONS</h3>
            </div>
            <div className="text-gray-300 font-mono text-sm space-y-3 leading-relaxed">
              <p>
                These terms may be updated to reflect platform changes or legal requirements. Users will be notified of significant changes through in-platform announcements.
              </p>
              <p>
                Accounts may be suspended or terminated for terms violations, cheating, or behavior negatively impacting the community. Termination decisions are final.
              </p>
              <p>
                Users may request account deletion at any time. Deletion is permanent and irreversible, including all associated data, statistics, and purchases.
              </p>
            </div>
          </div>

          {/* Classification Footer */}
          <div className="pt-6 border-t border-orange-900/20">
            <div className="text-center space-y-2">
              <div className="text-orange-400 font-mono text-sm">
                CLASSIFICATION: RESTRICTED • SECURITY LEVEL: 3 • DISTRIBUTION: AUTHORIZED PERSONNEL ONLY
              </div>
              <div className="text-gray-500 font-mono text-xs">
                Document ID: S9I-TERMS-2025-V4.0.0 • Authority: Sector Nine Legal Division
              </div>
              <div className="text-green-400 font-mono text-xs mt-4">
                By using this platform, you acknowledge understanding and acceptance of these terms.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="bg-black/40 border-orange-900/20">
        <CardHeader>
          <CardTitle className="text-orange-400 font-mono">CONTACT & SUPPORT</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-300 font-mono text-sm space-y-2">
            <p>For questions regarding these terms or platform policies:</p>
            <p className="text-orange-400">• Technical Support: Use in-platform support system</p>
            <p className="text-orange-400">• Legal Inquiries: Contact through official support channels</p>
            <p className="text-orange-400">• VIP Issues: Access VIP support tab in configuration</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
