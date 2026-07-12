/**
 * Static data initialization utilities.
 * Pure frontend constants — no network calls.
 * Real tournament + ladder data comes from the PostgreSQL backend via api.tsx.
 */

// Tournament definitions — used as fallback UI while API loads
// Live data comes from: tournamentAPI.getAll()
export const initializeTournaments = async () => {
  return [
    {
      id: 'black-mesa-championship',
      name: 'Black Mesa Championship',
      description: 'Elite Half-Life 1 tournament featuring the best players',
      gameMode: 'classic-deathmatch',
      status: 'upcoming',
      startDate: '2025-11-15T18:00:00Z',
      prizePool: 1000,
      maxParticipants: 32,
      vipOnly: true,
      format: 'single-elimination',
      rules: [
        'Classic Deathmatch mode',
        '1v1 format',
        'Best of 3 maps',
        'Map banning phase before each match',
        'VIP subscription required for entry',
      ],
    },
    {
      id: 'lambda-instagib-tournament',
      name: 'Lambda Instagib Tournament',
      description: 'Fast-paced Instagib tournament',
      gameMode: 'instagib',
      status: 'upcoming',
      startDate: '2025-11-20T18:00:00Z',
      prizePool: 750,
      maxParticipants: 32,
      vipOnly: true,
      format: 'single-elimination',
      rules: [
        'Instagib mode',
        '1v1 format',
        'Best of 3 maps',
        'Map banning phase before each match',
        'VIP subscription required for entry',
      ],
    },
    {
      id: 'tactical-operations-championship',
      name: 'Tactical Operations Championship',
      description: 'Strategic tournament for tactical players',
      gameMode: 'classic-deathmatch',
      status: 'upcoming',
      startDate: '2025-11-25T18:00:00Z',
      prizePool: 850,
      maxParticipants: 32,
      vipOnly: true,
      format: 'double-elimination',
      rules: [
        'Classic Deathmatch mode',
        '1v1 format',
        'Best of 5 maps',
        'Double elimination bracket',
        'VIP subscription required for entry',
      ],
    },
    {
      id: 'resonance-cascade-royale',
      name: 'Resonance Cascade Royale',
      description: 'Ultimate championship with mixed game modes',
      gameMode: 'mixed',
      status: 'upcoming',
      startDate: '2025-12-01T18:00:00Z',
      prizePool: 1500,
      maxParticipants: 64,
      vipOnly: true,
      format: 'single-elimination',
      rules: [
        'Mixed game modes (Classic DM & Instagib)',
        '1v1 format',
        'Best of 5 maps',
        'Alternating game modes',
        'VIP subscription required for entry',
      ],
    },
  ];
};

// Lobby sector rooms — static, no DB needed
export const initializeLobbyRooms = () => [
  { id: 'alpha-sector', name: 'Alpha Sector', description: 'Entry level matchmaking',    playerCount: 0, maxPlayers: 100, status: 'active' },
  { id: 'beta-sector',  name: 'Beta Sector',  description: 'Intermediate gameplay',       playerCount: 0, maxPlayers: 100, status: 'active' },
  { id: 'gamma-sector', name: 'Gamma Sector', description: 'Advanced tactical combat',    playerCount: 0, maxPlayers: 100, status: 'active' },
  { id: 'delta-sector', name: 'Delta Sector', description: 'Elite player matches',        playerCount: 0, maxPlayers: 100, status: 'active' },
];

// Half-Life 1 map pool — static, used by Lobby + MapSelection
export const getMapPool = () => [
  { id: 'c1a0',      name: 'Black Mesa Inbound',       image: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400&h=300&fit=crop', mode: ['classic', 'instagib'] },
  { id: 'c1a1',      name: 'Anomalous Materials',      image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop', mode: ['classic', 'instagib'] },
  { id: 'c1a2',      name: 'Unforeseen Consequences',  image: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?w=400&h=300&fit=crop', mode: ['classic', 'instagib'] },
  { id: 'c2a1',      name: 'Lambda Core',              image: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?w=400&h=300&fit=crop', mode: ['classic', 'instagib'] },
  { id: 'c3a1',      name: 'Xen Teleportation',        image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&h=300&fit=crop', mode: ['classic', 'instagib'] },
  { id: 'bounce',    name: 'Bounce Arena',              image: 'https://images.unsplash.com/photo-1614731247929-0e5e4e0c65e0?w=400&h=300&fit=crop', mode: ['classic', 'instagib'] },
  { id: 'crossfire', name: 'Crossfire',                 image: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=400&h=300&fit=crop', mode: ['classic', 'instagib'] },
  { id: 'bootcamp',  name: 'Boot Camp',                 image: 'https://images.unsplash.com/photo-1581092335397-9583eb92d232?w=400&h=300&fit=crop', mode: ['classic', 'instagib'] },
];

// Game modes — static, used by Lobby
export const getGameModes = () => [
  { id: 'classic-deathmatch', name: 'Classic Deathmatch', description: 'Traditional Half-Life 1 deathmatch combat', format: '1v1', mapsRequired: 5 },
  { id: 'instagib',           name: 'Instagib Mode',       description: 'One-shot kills with specialized weapons',   format: '1v1', mapsRequired: 5 },
];
