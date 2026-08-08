import { Button } from '../ui/button'
import type { AdminSection } from './adminTypes'

export type AdminSectionAction='clear_queue'|'force_match'|'create_ban'|'create_badge'|'create_frame'|'clear_cache'

export function AdminSectionActions({section,onAction}:{section:AdminSection;onAction:(action:AdminSectionAction)=>void}) {
  if(section==='matchmaking')return <div className="mb-4 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>onAction('force_match')}>Force match</Button><Button variant="destructive" onClick={()=>onAction('clear_queue')}>Clear full queue</Button></div>
  if(section==='bans')return <div className="mb-4"><Button onClick={()=>onAction('create_ban')}>Add ban</Button></div>
  if(section==='badges')return <div className="mb-4"><Button onClick={()=>onAction('create_badge')}>Add badge</Button></div>
  if(section==='frames')return <div className="mb-4"><Button onClick={()=>onAction('create_frame')}>Add frame</Button></div>
  if(section==='store')return <div className="mb-4"><Button onClick={()=>onAction('create_frame')}>Add frame</Button></div>
  if(section==='system')return <div className="mb-4"><Button variant="outline" onClick={()=>onAction('clear_cache')}>Clear Steam profile cache</Button></div>
  return null
}
