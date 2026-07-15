import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ArrowLeft, HelpCircle, MessageCircle, FileText, Send, Search, Clock } from "lucide-react";
import { useState } from "react";

const faqItems = [
  {
    category: "Account",
    question: "How do I link my Steam account?",
    answer: "Navigate to your profile settings and click 'Connect Steam Account'. You'll be redirected to Steam's authorization page to complete the linking process."
  },
  {
    category: "Premium",
    question: "What are the benefits of Premium subscription?",
    answer: "Premium subscribers get priority matchmaking, exclusive tournaments, 1000 monthly points, advanced statistics, and premium support access."
  },
  {
    category: "Gameplay",
    question: "How does the matchmaking system work?",
    answer: "Our quantum matchmaking system pairs players based on skill level, connection quality, and preferred game modes to ensure balanced and fair matches."
  },
  {
    category: "Technical",
    question: "What are the minimum system requirements?",
    answer: "Windows 10, 4GB RAM, DirectX 11 compatible graphics card, and a stable internet connection. Half-Life 1 must be installed via Steam."
  },
  {
    category: "Points",
    question: "How do I earn points?",
    answer: "Premium subscribers receive 1000 points monthly. Points can only be used for cosmetic purchases and cannot be purchased separately."
  }
];

const ticketStatuses: Array<{ id: string; subject: string; status: string; priority: string; created: string }> = [];

interface SupportProps {
  onNavigate?: (page: string) => void;
}

export function Support({ onNavigate }: SupportProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketForm, setTicketForm] = useState({
    category: "",
    priority: "",
    subject: "",
    description: ""
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-red-900/20 text-red-400 border-red-900/30';
      case 'In Progress': return 'bg-orange-900/20 text-orange-400 border-orange-900/30';
      case 'Resolved': return 'bg-green-900/20 text-green-400 border-green-900/30';
      default: return 'bg-gray-900/20 text-gray-400 border-gray-900/30';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-900/20 text-red-400 border-red-900/30';
      case 'Medium': return 'bg-yellow-900/20 text-yellow-400 border-yellow-900/30';
      case 'Low': return 'bg-green-900/20 text-green-400 border-green-900/30';
      default: return 'bg-gray-900/20 text-gray-400 border-gray-900/30';
    }
  };

  const filteredFAQ = faqItems.filter(item => 
    item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button 
          variant="outline" 
          onClick={() => onNavigate?.('hub')}
          className="mb-4 border-orange-900/30 text-orange-400 hover:bg-orange-900/10 font-mono"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          RETURN TO HUB
        </Button>
        <h1 className="text-4xl font-bold text-orange-400 font-mono flex items-center">
          <HelpCircle className="w-8 h-8 mr-3" />
          TECHNICAL SUPPORT
        </h1>
        <p className="text-gray-400 font-mono mt-2">Get help with platform issues and technical problems</p>
      </div>

      <Tabs defaultValue="faq" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-black/40 border border-orange-900/20">
          <TabsTrigger value="faq" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            <FileText className="w-4 h-4 mr-2" />
            KNOWLEDGE BASE
          </TabsTrigger>
          <TabsTrigger value="tickets" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            <MessageCircle className="w-4 h-4 mr-2" />
            SUPPORT TICKETS
          </TabsTrigger>
          <TabsTrigger value="contact" className="font-mono data-[state=active]:bg-orange-900/20 data-[state=active]:text-orange-400">
            <Send className="w-4 h-4 mr-2" />
            CONTACT US
          </TabsTrigger>
        </TabsList>

        {/* FAQ / Knowledge Base */}
        <TabsContent value="faq" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">FREQUENTLY ASKED QUESTIONS</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search knowledge base..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredFAQ.map((item, index) => (
                <Card key={index} className="bg-black/20 border-orange-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-orange-400 font-mono">{item.question}</h3>
                      <Badge className="bg-blue-900/20 text-blue-400 border-blue-900/30 font-mono text-xs">
                        {item.category}
                      </Badge>
                    </div>
                    <p className="text-gray-300 font-mono text-sm leading-relaxed">{item.answer}</p>
                  </CardContent>
                </Card>
              ))}
              
              {filteredFAQ.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-gray-500 font-mono">No results found for "{searchQuery}"</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="bg-black/40 border-green-900/20">
            <CardHeader>
              <CardTitle className="text-green-400 font-mono">QUICK SUPPORT LINKS</CardTitle>
            </CardHeader>
            <CardContent>
              <Button disabled variant="outline" className="w-full font-mono justify-start">
                <Clock className="w-4 h-4 mr-2" />
                Support links coming soon
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tickets */}
        <TabsContent value="tickets" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">MY SUPPORT TICKETS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticketStatuses.length === 0 && <p className="text-gray-500 font-mono text-center py-8">Support tickets coming soon</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Form */}
        <TabsContent value="contact" className="space-y-6">
          <Card className="bg-black/40 border-orange-900/20">
            <CardHeader>
              <CardTitle className="text-orange-400 font-mono">SUBMIT SUPPORT TICKET</CardTitle>
              <p className="text-gray-400 font-mono text-sm">
                Support ticket submission coming soon
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 font-mono">Category</label>
                    <Select disabled value={ticketForm.category} onValueChange={(value) => setTicketForm({...ticketForm, category: value})}>
                      <SelectTrigger className="bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-black/90 border-orange-900/20">
                        <SelectItem value="technical" className="text-orange-400 font-mono">Technical Issue</SelectItem>
                        <SelectItem value="account" className="text-orange-400 font-mono">Account Problem</SelectItem>
                        <SelectItem value="billing" className="text-orange-400 font-mono">Billing Support</SelectItem>
                        <SelectItem value="gameplay" className="text-orange-400 font-mono">Gameplay Issue</SelectItem>
                        <SelectItem value="report" className="text-orange-400 font-mono">Report Player</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 font-mono">Priority Level</label>
                    <Select disabled value={ticketForm.priority} onValueChange={(value) => setTicketForm({...ticketForm, priority: value})}>
                      <SelectTrigger className="bg-black/20 border-orange-900/20 text-orange-400 font-mono">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent className="bg-black/90 border-orange-900/20">
                        <SelectItem value="low" className="text-orange-400 font-mono">Low - General inquiry</SelectItem>
                        <SelectItem value="medium" className="text-orange-400 font-mono">Medium - Affects gameplay</SelectItem>
                        <SelectItem value="high" className="text-orange-400 font-mono">High - Cannot play</SelectItem>
                        <SelectItem value="critical" className="text-orange-400 font-mono">Critical - Account locked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 font-mono">Subject</label>
                    <Input
                      disabled
                      placeholder="Brief description of the issue"
                      value={ticketForm.subject}
                      onChange={(e) => setTicketForm({...ticketForm, subject: e.target.value})}
                      className="bg-black/20 border-orange-900/20 text-gray-300 font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 font-mono">Player ID</label>
                    <Input
                      placeholder="Freeman_G"
                      defaultValue="Freeman_G"
                      disabled
                      className="bg-black/20 border-orange-900/20 text-gray-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-mono">Description</label>
                <Textarea
                  disabled
                  placeholder="Provide detailed information about the issue including steps to reproduce, error messages, and any relevant screenshots..."
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({...ticketForm, description: e.target.value})}
                  className="bg-black/20 border-orange-900/20 text-gray-300 font-mono min-h-32"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400 font-mono">
                  Ticket submission is not available yet.
                </div>
                <Button disabled className="bg-green-900/20 border border-green-900/30 text-green-400 font-mono">
                  <Send className="w-4 h-4 mr-2" />
                  COMING SOON
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
