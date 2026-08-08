export type AdminSection = 'dashboard'|'news'|'users'|'servers'|'matchmaking'|'matches'|'tournaments'|'reports'|'support'|'bans'|'store'|'vip'|'badges'|'frames'|'logs'|'system'
export type AdminRow = Record<string, any>

export const sectionMeta: Record<AdminSection, { title: string; description: string }> = {
  dashboard:{title:'Dashboard',description:'Live platform operations and service overview'},
  news:{title:'News',description:'Create, publish, pin, and organize platform updates'},
  users:{title:'Users',description:'Manage accounts, progression, Steam status, and access'},
  servers:{title:'Game Servers',description:'Monitor regions, capacity, and server availability'},
  matchmaking:{title:'Matchmaking',description:'Inspect and manage the live player queue'},
  matches:{title:'Matches',description:'Review active and historical competitive sessions'},
  tournaments:{title:'Tournaments',description:'Coordinate events, participants, and schedules'},
  reports:{title:'Reports',description:'Review player reports and moderation decisions'},
  support:{title:'Support Tickets',description:'Review requests, respond to users, and track resolution'},
  bans:{title:'Bans',description:'Inspect active restrictions and moderation history'},
  store:{title:'Store',description:'Manage purchasable frames and future cosmetics'},
  vip:{title:'VIP',description:'Manage premium access and expiration status'},
  badges:{title:'Badges',description:'Manage badge pricing and featured inventory'},
  frames:{title:'Frames',description:'Manage frame pricing and featured inventory'},
  logs:{title:'Audit Logs',description:'Trace every administrative operation'},
  system:{title:'Settings',description:'Platform health, environment, cache, and settings'},
}

export const formatAdminValue = (value: any, key = '') => {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (/_at$|date|expires/i.test(key)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString()
  }
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}
