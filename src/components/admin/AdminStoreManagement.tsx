import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { adminAPI } from '../../utils/adminApi'
import type { AdminRow } from './adminTypes'
import type { AdminStoreAction } from './AdminTable'

export type CatalogType='badges'|'frames'
type Props={row:AdminRow|null;type:CatalogType|null;action:AdminStoreAction|null;onClose:()=>void;onSaved:(type:CatalogType,item:AdminRow|null,id?:string)=>void}
const fieldClass='mt-1 border-orange-900/30 bg-black/30'
const rarities=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','VIP_EXCLUSIVE']

export function AdminStoreManagement({row,type,action,onClose,onSaved}:Props){
  const [saving,setSaving]=useState(false),[error,setError]=useState('')
  if(!type||!action)return null
  const singular=type==='badges'?'badge':'frame',title=action==='create'?`Add ${singular}`:action==='edit'?`Edit ${singular}`:action==='featured'?(row?.featured?'Remove featured':'Mark featured'):action==='hidden'?(row?.is_active===false?'Show item':'Hide item'):`Delete ${singular}`
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=new FormData(event.currentTarget),data=Object.fromEntries(form.entries()),reason=String(data.reason||'');setSaving(true);setError('');try{let result:any
    if(action==='create'||action==='edit'){const payload={name:data.name,description:data.description,rarity:data.rarity,vipOnly:data.vipOnly==='on',featured:data.featured==='on',isActive:data.isActive==='on',...(type==='badges'?{icon:data.icon,itemType:data.itemType,metadata:{...(row?.metadata||{}),unlockRule:String(data.unlockRule||'').trim()}}:{style:data.style,pricePoints:Number(data.pricePoints)}),reason};result=action==='create'?await adminAPI.post(`/catalog/${type}`,{id:data.id,...payload}):await adminAPI.patch(`/catalog/${type}/${row?.id}`,payload)}
    if(action==='featured')result=await adminAPI.patch(`/catalog/${type}/${row?.id}`,{featured:!row?.featured,reason})
    if(action==='hidden')result=await adminAPI.patch(`/catalog/${type}/${row?.id}`,{isActive:row?.is_active===false,reason})
    if(action==='delete'){const response:any=await adminAPI.delete(`/catalog/${type}/${row?.id}`,{reason});if(!response?.deleted)throw new Error('Backend did not confirm catalog deletion');toast.success(`${singular[0].toUpperCase()+singular.slice(1)} deleted`);onSaved(type,null,String(row?.id));onClose();return}
    if(!result?.item)throw new Error('Backend did not return the saved catalog item');toast.success(`${singular[0].toUpperCase()+singular.slice(1)} updated`);onSaved(type,result.item);onClose()
  }catch(e:any){setError(e.message||'Catalog action failed')}finally{setSaving(false)}}
  const field=(name:string,label:string,value:any='',inputType='text',required=true)=><label className="text-xs text-slate-400">{label}<Input name={name} type={inputType} defaultValue={value??''} required={required} className={fieldClass}/></label>
  const fullForm=action==='create'||action==='edit'
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-orange-900/30 bg-[#111113]"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{fullForm?'Persist the complete catalog record.':'This change is immediate and audited.'}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">
    {fullForm&&<><div className="grid gap-3 sm:grid-cols-2">{action==='create'&&field('id',`${singular[0].toUpperCase()+singular.slice(1)} ID`,'')}{field('name','Name',row?.name)}<label className="text-xs text-slate-400">Rarity<select name="rarity" defaultValue={row?.rarity||'COMMON'} className={`${fieldClass} h-10 w-full rounded border px-3`}>{rarities.map(value=><option key={value}>{value}</option>)}</select></label>{type==='badges'?<>{field('icon','Icon',row?.icon,'text',false)}<label className="text-xs text-slate-400">Badge type<select name="itemType" defaultValue={row?.type||'avatar'} className={`${fieldClass} h-10 w-full rounded border px-3`}><option value="avatar">Avatar</option><option value="profile">Profile</option></select></label></>:<>{field('pricePoints','Price points',row?.price_points??0,'number')}{field('style','Frame style',row?.style,'text',false)}</>}</div><label className="text-xs text-slate-400">Description<textarea name="description" defaultValue={row?.description||''} className={`${fieldClass} min-h-24 w-full rounded border p-3`}/></label>{type==='badges'&&field('unlockRule','Unlock rule',row?.metadata?.unlockRule||'', 'text',false)}<div className="grid gap-2 sm:grid-cols-3"><label className="flex items-center gap-2 text-xs text-slate-400"><input name="vipOnly" type="checkbox" defaultChecked={Boolean(row?.vip_only)}/>VIP only</label><label className="flex items-center gap-2 text-xs text-slate-400"><input name="featured" type="checkbox" defaultChecked={Boolean(row?.featured)}/>Featured</label><label className="flex items-center gap-2 text-xs text-slate-400"><input name="isActive" type="checkbox" defaultChecked={action==='create'||row?.is_active!==false}/>Visible</label></div></>}
    {action==='featured'&&<p className="rounded border border-orange-500/30 bg-orange-950/10 p-3 text-sm text-orange-200">{row?.featured?'Remove this item from featured inventory?':'Feature this item in the Store?'}</p>}
    {action==='hidden'&&<p className="rounded border border-orange-500/30 bg-orange-950/10 p-3 text-sm text-orange-200">{row?.is_active===false?'Make this item visible in the Store again?':'Hide this item from customer-facing Store inventory?'}</p>}
    {action==='delete'&&<p className="rounded border border-red-500/30 bg-red-950/10 p-3 text-sm text-red-300">Deletion is permanent. The item will also be removed from ownership lists and cleared from equipped cosmetics.</p>}
    {field('reason','Required administrative reason','')}{error&&<div className="flex gap-2 rounded border border-red-500/30 bg-red-950/10 p-3 text-xs text-red-300"><AlertTriangle size={15}/>{error}</div>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving} variant={action==='delete'?'destructive':'default'}>{saving?'Saving…':action==='delete'?'Delete permanently':'Save change'}</Button></DialogFooter>
  </form></DialogContent></Dialog>
}
