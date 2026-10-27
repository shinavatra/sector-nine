export type GameAdapter={gameId:'hl1'|'cs16'|'cod4'|'l4d2';engine:'goldsrc'|'cod4'|'source';implementation:'ready'|'foundation';trustedResults:boolean;supportedModes:ReadonlySet<string>}

const adapters:Record<GameAdapter['gameId'],GameAdapter>={
  hl1:{gameId:'hl1',engine:'goldsrc',implementation:'ready',trustedResults:true,supportedModes:new Set(['classic-deathmatch','instagib-mode'])},
  cs16:{gameId:'cs16',engine:'goldsrc',implementation:'foundation',trustedResults:false,supportedModes:new Set(['competitive-1v1'])},
  cod4:{gameId:'cod4',engine:'cod4',implementation:'foundation',trustedResults:false,supportedModes:new Set(['promod-1v1'])},
  l4d2:{gameId:'l4d2',engine:'source',implementation:'foundation',trustedResults:false,supportedModes:new Set(['survival-duel'])},
}

export const gameAdapter=(gameId:unknown)=>adapters[String(gameId) as GameAdapter['gameId']]||null
export const hostableAdapter=(gameId:unknown,modeId:unknown)=>{const adapter=gameAdapter(gameId);return Boolean(adapter&&adapter.implementation==='ready'&&adapter.trustedResults&&adapter.supportedModes.has(String(modeId)))}
