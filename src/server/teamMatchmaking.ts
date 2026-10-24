export type QueueGroup={id:string;members:string[];joinedAt:string}
export type TeamAssignment={teamNumber:number;groups:QueueGroup[];members:string[]}

const combinations=<T>(items:T[],size:number,start=0,prefix:T[]=[]):T[][]=>{
  if(size===0)return[prefix]
  const result:T[][]=[]
  for(let index=start;index<=items.length-size;index++)result.push(...combinations(items,size-1,index+1,[...prefix,items[index]]))
  return result
}

export const assignGroupsToTeams=(groups:QueueGroup[],teamSize:number,teamCount=2):TeamAssignment[]|null=>{
  if(!Number.isInteger(teamSize)||teamSize<1||!Number.isInteger(teamCount)||teamCount<1)return null
  if(groups.some(group=>!group.members.length||group.members.length>teamSize))return null
  const uniqueMembers=new Set(groups.flatMap(group=>group.members))
  if(uniqueMembers.size!==groups.reduce((sum,group)=>sum+group.members.length,0)||uniqueMembers.size!==teamSize*teamCount)return null
  const ordered=[...groups].sort((a,b)=>a.joinedAt.localeCompare(b.joinedAt)||a.id.localeCompare(b.id))
  const build=(remaining:QueueGroup[],teamNumber:number):TeamAssignment[]|null=>{
    if(teamNumber>teamCount)return remaining.length?null:[]
    for(let size=1;size<=remaining.length;size++)for(const selected of combinations(remaining,size)){
      const members=selected.flatMap(group=>group.members)
      if(members.length!==teamSize)continue
      const ids=new Set(selected.map(group=>group.id))
      const rest=remaining.filter(group=>!ids.has(group.id))
      const tail=build(rest,teamNumber+1)
      if(tail)return[{teamNumber,groups:selected,members},...tail]
    }
    return null
  }
  return build(ordered,1)
}

export const groupsConflict=(left:QueueGroup,right:QueueGroup,blockedPairs:Set<string>)=>
  left.members.some(a=>right.members.some(b=>blockedPairs.has([a,b].sort().join(':'))))
