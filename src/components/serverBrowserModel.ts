export type LiveStatus='online'|'offline'|'starting'|'in_match'
export type Availability='reachable'|'idle'|'reserved'|'active_match'|'offline'
export type BrowserServer={id:string;name:string;gameId:string;modeId:string|null;region:string;status:LiveStatus;availability:Availability;stale:boolean;currentMap:string|null;currentPlayers:number;maxPlayers:number;lastHeartbeat:string|null;address:string|null;canCopyAddress:boolean;protectedCompetitive:boolean}

export function filterServerBrowserRows(servers:BrowserServer[],filters:{search:string;game:string;region:string;availability:string}){
  const search=filters.search.trim().toLowerCase()
  return servers.filter(server=>(filters.game==='all'||server.gameId===filters.game)&&
    (filters.region==='all'||server.region===filters.region)&&
    (filters.availability==='all'||server.availability===filters.availability)&&
    (!search||server.name.toLowerCase().includes(search)))
}
