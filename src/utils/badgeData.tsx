// Badge System for Sector Nine Initiative
// Avatar Badges and Profile Frames

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'VIP';
  type: 'avatar' | 'frame';
  pricePoints: number;
  unlockCondition?: string;
  isVIPOnly?: boolean;
}

// Avatar Badges (30+)
export const avatarBadges: Badge[] = [
  // Common Badges (0-500 points)
  { id: 'av_lambda', name: 'Lambda Operative', description: 'Standard Black Mesa operative badge', icon: 'λ', rarity: 'COMMON', type: 'avatar', pricePoints: 0 },
  { id: 'av_crowbar', name: 'Crowbar Wielder', description: 'Basic melee combat badge', icon: '🔨', rarity: 'COMMON', type: 'avatar', pricePoints: 100 },
  { id: 'av_headcrab', name: 'Headcrab Hunter', description: 'Eliminated your first headcrab', icon: '🦀', rarity: 'COMMON', type: 'avatar', pricePoints: 150 },
  { id: 'av_scientist', name: 'Research Assistant', description: 'Entry-level scientist badge', icon: '🔬', rarity: 'COMMON', type: 'avatar', pricePoints: 200 },
  { id: 'av_security', name: 'Security Personnel', description: 'Basic security clearance', icon: '🛡️', rarity: 'COMMON', type: 'avatar', pricePoints: 250 },
  { id: 'av_hazard', name: 'HEV Suit Trainee', description: 'Completed HEV training', icon: '☢️', rarity: 'COMMON', type: 'avatar', pricePoints: 300 },
  { id: 'av_medkit', name: 'Field Medic', description: 'Medical support specialist', icon: '⚕️', rarity: 'COMMON', type: 'avatar', pricePoints: 350 },
  { id: 'av_energy', name: 'Power Core', description: 'Energy systems operator', icon: '⚡', rarity: 'COMMON', type: 'avatar', pricePoints: 400 },
  
  // Uncommon Badges (500-1000 points)
  { id: 'av_veteran', name: 'Combat Veteran', description: 'Survived 50 matches', icon: '🎖️', rarity: 'UNCOMMON', type: 'avatar', pricePoints: 500 },
  { id: 'av_marksman', name: 'Marksman', description: 'Precision shooter badge', icon: '🎯', rarity: 'UNCOMMON', type: 'avatar', pricePoints: 600 },
  { id: 'av_explosive', name: 'Demolitions Expert', description: 'Explosives specialist', icon: '💣', rarity: 'UNCOMMON', type: 'avatar', pricePoints: 700 },
  { id: 'av_tactical', name: 'Tactical Operator', description: 'Advanced combat tactics', icon: '🎮', rarity: 'UNCOMMON', type: 'avatar', pricePoints: 750 },
  { id: 'av_engineer', name: 'Field Engineer', description: 'Technical support specialist', icon: '⚙️', rarity: 'UNCOMMON', type: 'avatar', pricePoints: 800 },
  { id: 'av_researcher', name: 'Senior Researcher', description: 'Level 3 clearance', icon: '📊', rarity: 'UNCOMMON', type: 'avatar', pricePoints: 850 },
  { id: 'av_anomaly', name: 'Anomaly Survivor', description: 'Survived anomalous events', icon: '🌀', rarity: 'UNCOMMON', type: 'avatar', pricePoints: 900 },
  { id: 'av_portal', name: 'Portal Jumper', description: 'Dimensional travel specialist', icon: '🌌', rarity: 'UNCOMMON', type: 'avatar', pricePoints: 950 },
  
  // Rare Badges (1000-2000 points)
  { id: 'av_master', name: 'Arena Master', description: 'Won 100 matches', icon: '🏆', rarity: 'RARE', type: 'avatar', pricePoints: 1000 },
  { id: 'av_gordonf', name: 'Gordon Freeman', description: 'Legendary theoretical physicist', icon: '👨‍🔬', rarity: 'RARE', type: 'avatar', pricePoints: 1200 },
  { id: 'av_gman', name: 'G-Man', description: 'Mysterious entity', icon: '👔', rarity: 'RARE', type: 'avatar', pricePoints: 1300 },
  { id: 'av_vortigaunt', name: 'Vortigaunt Ally', description: 'Allied with the Vortigaunts', icon: '👽', rarity: 'RARE', type: 'avatar', pricePoints: 1400 },
  { id: 'av_combine', name: 'Combine Defector', description: 'Former Combine operative', icon: '🤖', rarity: 'RARE', type: 'avatar', pricePoints: 1500 },
  { id: 'av_resistance', name: 'Resistance Leader', description: 'Leading the resistance', icon: '✊', rarity: 'RARE', type: 'avatar', pricePoints: 1600 },
  { id: 'av_xen', name: 'Xen Explorer', description: 'Explored the border world', icon: '🌍', rarity: 'RARE', type: 'avatar', pricePoints: 1700 },
  { id: 'av_cascade', name: 'Cascade Survivor', description: 'Survived the resonance cascade', icon: '💥', rarity: 'RARE', type: 'avatar', pricePoints: 1800 },
  
  // Epic Badges (2000-3500 points)
  { id: 'av_champion', name: 'Tournament Champion', description: 'Won a tournament', icon: '🥇', rarity: 'EPIC', type: 'avatar', pricePoints: 2000 },
  { id: 'av_legend', name: 'Lambda Legend', description: 'Reached 2000 rating', icon: '⭐', rarity: 'EPIC', type: 'avatar', pricePoints: 2500 },
  { id: 'av_blackmesa', name: 'Black Mesa Elite', description: 'Top-tier operative', icon: '💼', rarity: 'EPIC', type: 'avatar', pricePoints: 2750 },
  { id: 'av_aperture', name: 'Aperture Scientist', description: 'Rival facility operative', icon: '🔵', rarity: 'EPIC', type: 'avatar', pricePoints: 3000 },
  { id: 'av_nihilanth', name: 'Nihilanth Slayer', description: 'Defeated the final boss', icon: '👹', rarity: 'EPIC', type: 'avatar', pricePoints: 3250 },
  
  // Legendary Badges (3500+ points)
  { id: 'av_freeman_golden', name: 'Golden Freeman', description: 'Ultimate achievement', icon: '🌟', rarity: 'LEGENDARY', type: 'avatar', pricePoints: 4000 },
  { id: 'av_admin', name: 'Administrator', description: 'Facility administrator', icon: '👑', rarity: 'LEGENDARY', type: 'avatar', pricePoints: 4500 },
  { id: 'av_founder', name: 'Sector Nine Founder', description: 'Original founding member', icon: '💎', rarity: 'LEGENDARY', type: 'avatar', pricePoints: 5000 },
  
  // VIP Exclusive Badges
  { id: 'av_vip', name: 'VIP Member', description: 'Active VIP subscription', icon: '👑', rarity: 'VIP', type: 'avatar', pricePoints: 0, isVIPOnly: true },
  { id: 'av_vip_gold', name: 'VIP Gold', description: '3 months VIP', icon: '🏅', rarity: 'VIP', type: 'avatar', pricePoints: 0, isVIPOnly: true },
  { id: 'av_vip_platinum', name: 'VIP Platinum', description: '6 months VIP', icon: '💫', rarity: 'VIP', type: 'avatar', pricePoints: 0, isVIPOnly: true },
  { id: 'av_vip_diamond', name: 'VIP Diamond', description: '12 months VIP', icon: '💠', rarity: 'VIP', type: 'avatar', pricePoints: 0, isVIPOnly: true },
];

// Profile Frames (30+)
export const profileFrames: Badge[] = [
  // Common Frames (0-500 points)
  { id: 'fr_basic', name: 'Standard Frame', description: 'Default profile frame', icon: '🖼️', rarity: 'COMMON', type: 'frame', pricePoints: 0 },
  { id: 'fr_orange', name: 'Orange Border', description: 'Classic HEV orange frame', icon: '🟧', rarity: 'COMMON', type: 'frame', pricePoints: 150 },
  { id: 'fr_green', name: 'Green Border', description: 'Radiation green frame', icon: '🟩', rarity: 'COMMON', type: 'frame', pricePoints: 150 },
  { id: 'fr_blue', name: 'Blue Border', description: 'Portal blue frame', icon: '🟦', rarity: 'COMMON', type: 'frame', pricePoints: 150 },
  { id: 'fr_red', name: 'Red Alert', description: 'Emergency red frame', icon: '🟥', rarity: 'COMMON', type: 'frame', pricePoints: 200 },
  { id: 'fr_purple', name: 'Xen Purple', description: 'Alien energy frame', icon: '🟪', rarity: 'COMMON', type: 'frame', pricePoints: 250 },
  { id: 'fr_yellow', name: 'Hazard Yellow', description: 'Warning stripe frame', icon: '🟨', rarity: 'COMMON', type: 'frame', pricePoints: 300 },
  
  // Uncommon Frames (500-1000 points)
  { id: 'fr_lambda_simple', name: 'Lambda Frame', description: 'Lambda symbol border', icon: 'λ', rarity: 'UNCOMMON', type: 'frame', pricePoints: 500 },
  { id: 'fr_hazard', name: 'Hazard Frame', description: 'Biohazard border design', icon: '☢️', rarity: 'UNCOMMON', type: 'frame', pricePoints: 600 },
  { id: 'fr_circuit', name: 'Circuit Board', description: 'Tech circuit pattern', icon: '🔌', rarity: 'UNCOMMON', type: 'frame', pricePoints: 650 },
  { id: 'fr_metal', name: 'Metal Plating', description: 'Industrial metal frame', icon: '⚙️', rarity: 'UNCOMMON', type: 'frame', pricePoints: 700 },
  { id: 'fr_caution', name: 'Caution Tape', description: 'Warning tape border', icon: '⚠️', rarity: 'UNCOMMON', type: 'frame', pricePoints: 750 },
  { id: 'fr_energy', name: 'Energy Field', description: 'Glowing energy border', icon: '⚡', rarity: 'UNCOMMON', type: 'frame', pricePoints: 800 },
  { id: 'fr_portal_ring', name: 'Portal Ring', description: 'Circular portal frame', icon: '⭕', rarity: 'UNCOMMON', type: 'frame', pricePoints: 850 },
  { id: 'fr_scientist', name: 'Lab Coat', description: 'Scientist theme frame', icon: '🥼', rarity: 'UNCOMMON', type: 'frame', pricePoints: 900 },
  
  // Rare Frames (1000-2000 points)
  { id: 'fr_blackmesa', name: 'Black Mesa Frame', description: 'Official facility frame', icon: '🏢', rarity: 'RARE', type: 'frame', pricePoints: 1000 },
  { id: 'fr_hev', name: 'HEV Suit Frame', description: 'HEV suit design', icon: '🦺', rarity: 'RARE', type: 'frame', pricePoints: 1200 },
  { id: 'fr_crowbar_gold', name: 'Golden Crowbar', description: 'Gold crowbar border', icon: '🔨', rarity: 'RARE', type: 'frame', pricePoints: 1300 },
  { id: 'fr_lambda_gold', name: 'Golden Lambda', description: 'Premium lambda frame', icon: '💛', rarity: 'RARE', type: 'frame', pricePoints: 1400 },
  { id: 'fr_xen_crystal', name: 'Xen Crystal', description: 'Crystalline border', icon: '💎', rarity: 'RARE', type: 'frame', pricePoints: 1500 },
  { id: 'fr_vortigaunt', name: 'Vortigaunt Energy', description: 'Vortigaunt power frame', icon: '⚡', rarity: 'RARE', type: 'frame', pricePoints: 1600 },
  { id: 'fr_combine', name: 'Combine Tech', description: 'Combine technology frame', icon: '🤖', rarity: 'RARE', type: 'frame', pricePoints: 1700 },
  { id: 'fr_resistance', name: 'Resistance Banner', description: 'Resistance symbol frame', icon: '🚩', rarity: 'RARE', type: 'frame', pricePoints: 1800 },
  
  // Epic Frames (2000-3500 points)
  { id: 'fr_champion', name: 'Champion Frame', description: 'Tournament winner frame', icon: '🏆', rarity: 'EPIC', type: 'frame', pricePoints: 2000 },
  { id: 'fr_master', name: 'Master Frame', description: 'Elite operative frame', icon: '👑', rarity: 'EPIC', type: 'frame', pricePoints: 2500 },
  { id: 'fr_animated_energy', name: 'Animated Energy', description: 'Pulsing energy frame', icon: '✨', rarity: 'EPIC', type: 'frame', pricePoints: 2750 },
  { id: 'fr_holographic', name: 'Holographic', description: 'Hologram effect frame', icon: '🌐', rarity: 'EPIC', type: 'frame', pricePoints: 3000 },
  { id: 'fr_cascade', name: 'Resonance Cascade', description: 'Cascading energy frame', icon: '💥', rarity: 'EPIC', type: 'frame', pricePoints: 3250 },
  
  // Legendary Frames (3500+ points)
  { id: 'fr_admin', name: 'Administrator Frame', description: 'Facility admin frame', icon: '👔', rarity: 'LEGENDARY', type: 'frame', pricePoints: 4000 },
  { id: 'fr_gman', name: 'G-Man Frame', description: 'Mysterious entity frame', icon: '🎩', rarity: 'LEGENDARY', type: 'frame', pricePoints: 4500 },
  { id: 'fr_freeman', name: 'Freeman Legacy', description: 'Gordon Freeman frame', icon: '🌟', rarity: 'LEGENDARY', type: 'frame', pricePoints: 5000 },
  { id: 'fr_ultimate', name: 'Ultimate Power', description: 'Maximum prestige frame', icon: '💠', rarity: 'LEGENDARY', type: 'frame', pricePoints: 6000 },
  
  // VIP Exclusive Frames
  { id: 'fr_vip', name: 'VIP Frame', description: 'Active VIP frame', icon: '👑', rarity: 'VIP', type: 'frame', pricePoints: 0, isVIPOnly: true },
  { id: 'fr_vip_gold', name: 'VIP Gold Frame', description: '3 months VIP frame', icon: '🥇', rarity: 'VIP', type: 'frame', pricePoints: 0, isVIPOnly: true },
  { id: 'fr_vip_platinum', name: 'VIP Platinum Frame', description: '6 months VIP frame', icon: '🥈', rarity: 'VIP', type: 'frame', pricePoints: 0, isVIPOnly: true },
  { id: 'fr_vip_diamond', name: 'VIP Diamond Frame', description: '12 months VIP frame', icon: '🥉', rarity: 'VIP', type: 'frame', pricePoints: 0, isVIPOnly: true },
];

export const allBadges = [...avatarBadges, ...profileFrames];

export const getRarityColor = (rarity: Badge['rarity']) => {
  switch (rarity) {
    case 'COMMON': return 'bg-gray-900/20 text-gray-400 border-gray-900/30';
    case 'UNCOMMON': return 'bg-green-900/20 text-green-400 border-green-900/30';
    case 'RARE': return 'bg-blue-900/20 text-blue-400 border-blue-900/30';
    case 'EPIC': return 'bg-purple-900/20 text-purple-400 border-purple-900/30';
    case 'LEGENDARY': return 'bg-orange-900/20 text-orange-400 border-orange-900/30';
    case 'VIP': return 'bg-yellow-900/20 text-yellow-400 border-yellow-900/30';
    default: return 'bg-gray-900/20 text-gray-400 border-gray-900/30';
  }
};

export const getRarityGlow = (rarity: Badge['rarity']) => {
  switch (rarity) {
    case 'COMMON': return '';
    case 'UNCOMMON': return 'shadow-lg shadow-green-500/20';
    case 'RARE': return 'shadow-lg shadow-blue-500/30';
    case 'EPIC': return 'shadow-lg shadow-purple-500/40';
    case 'LEGENDARY': return 'shadow-xl shadow-orange-500/50';
    case 'VIP': return 'shadow-xl shadow-yellow-500/60';
    default: return '';
  }
};
