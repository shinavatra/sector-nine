import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Edit3, Loader2, Pin, PinOff, Plus, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminAPI } from '../../utils/adminApi'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import type { AdminRow } from './adminTypes'

type EditorState={mode:'create'|'edit';article:AdminRow|null}|null

export function AdminNewsManagement({
  data,
  onChanged,
  onPage,
}:{
  data:{items:AdminRow[];total:number;page:number;limit:number}
  onChanged:(article:AdminRow|null,id?:string)=>void
  onPage:(page:number)=>void
}) {
  const [editor,setEditor]=useState<EditorState>(null)
  const [pendingId,setPendingId]=useState<string|null>(null)
  const [items,setItems]=useState<AdminRow[]>(data.items)
  useEffect(()=>setItems(data.items),[data.items])

  const apply=(article:AdminRow|null,id?:string)=>{
    setItems(current=>article
      ? current.some(item=>item.id===article.id)
        ? current.map(item=>item.id===article.id?article:item)
        : [article,...current]
      : current.filter(item=>item.id!==id))
    onChanged(article,id)
  }
  const toggle=async(article:AdminRow,key:'isPinned'|'isPublished')=>{
    setPendingId(article.id)
    try{
      const response:any=await adminAPI.patch(`/news/${article.id}`,{
        [key]:!article[key==='isPinned'?'is_pinned':'is_published'],
        reason:`${key==='isPinned'?'Pin':'Publication'} state changed from News administration`,
      })
      apply(response.article)
      toast.success(key==='isPinned'?'Pin status updated':'Publication status updated')
    }catch(error:any){toast.error('News update failed',{description:error.message})}
    finally{setPendingId(null)}
  }
  const remove=async(article:AdminRow)=>{
    const reason=window.prompt(`Reason for permanently deleting "${article.title}"?`)?.trim()
    if(!reason)return
    if(!window.confirm('Permanently delete this news article and all future comments?'))return
    setPendingId(article.id)
    try{
      await adminAPI.delete(`/news/${article.id}`,{reason})
      apply(null,article.id)
      toast.success('News article deleted')
    }catch(error:any){toast.error('Delete failed',{description:error.message})}
    finally{setPendingId(null)}
  }
  const pages=Math.max(1,Math.ceil(data.total/data.limit))

  return <div className="space-y-4">
    <div className="flex justify-end"><Button onClick={()=>setEditor({mode:'create',article:null})}><Plus className="mr-2 size-4"/>Create article</Button></div>
    <div className="admin-table-scroll overflow-x-auto rounded-lg border border-orange-900/20">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="bg-white/[.03] text-slate-500"><tr><th className="p-3">Article</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Author</th><th className="p-3">Updated</th><th className="sticky right-0 bg-[#0d0d0f] p-3 text-right">Actions</th></tr></thead>
        <tbody>{items.map(article=><tr key={article.id} className="border-t border-orange-900/15 align-top">
          <td className="max-w-md p-3"><p className="font-medium text-slate-100">{article.title}</p><p className="mt-1 line-clamp-2 text-slate-500">{article.summary||article.content}</p></td>
          <td className="p-3"><Badge variant="outline" className="capitalize">{article.category}</Badge></td>
          <td className="p-3"><div className="flex flex-wrap gap-1">{article.is_pinned&&<Badge className="bg-orange-950 text-orange-300">Pinned</Badge>}<Badge className={article.is_published?'bg-green-950 text-green-300':'bg-slate-800 text-slate-400'}>{article.is_published?'Published':'Draft'}</Badge></div></td>
          <td className="p-3 text-slate-400">{article.author_name}</td>
          <td className="p-3 text-slate-400">{new Date(article.updated_at).toLocaleString()}</td>
          <td className="sticky right-0 bg-[#0d0d0f] p-3"><div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" title={article.is_pinned?'Unpin':'Pin'} disabled={pendingId===article.id} onClick={()=>toggle(article,'isPinned')}>{article.is_pinned?<PinOff className="size-4"/>:<Pin className="size-4"/>}</Button>
            <Button size="icon" variant="ghost" title={article.is_published?'Unpublish':'Publish'} disabled={pendingId===article.id} onClick={()=>toggle(article,'isPublished')}><Send className={`size-4 ${article.is_published?'text-green-400':''}`}/></Button>
            <Button size="icon" variant="ghost" title="Edit" onClick={()=>setEditor({mode:'edit',article})}><Edit3 className="size-4"/></Button>
            <Button size="icon" variant="ghost" title="Delete" disabled={pendingId===article.id} onClick={()=>remove(article)}><Trash2 className="size-4 text-red-400"/></Button>
          </div></td>
        </tr>)}</tbody>
      </table>
      {!items.length&&<div className="p-10 text-center text-sm text-slate-500">No news articles found.</div>}
    </div>
    {pages>1&&<div className="flex items-center justify-end gap-3 text-xs text-slate-500"><Button size="sm" variant="outline" disabled={data.page<=1} onClick={()=>onPage(data.page-1)}>Previous</Button><span>Page {data.page} of {pages}</span><Button size="sm" variant="outline" disabled={data.page>=pages} onClick={()=>onPage(data.page+1)}>Next</Button></div>}
    <NewsEditor state={editor} onClose={()=>setEditor(null)} onSaved={article=>{apply(article);setEditor(null)}}/>
  </div>
}

function NewsEditor({state,onClose,onSaved}:{state:EditorState;onClose:()=>void;onSaved:(article:AdminRow)=>void}) {
  const [saving,setSaving]=useState(false)
  if(!state)return null
  const article=state.article
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    const form=new FormData(event.currentTarget)
    const body={
      title:String(form.get('title')||''),
      summary:String(form.get('summary')||''),
      content:String(form.get('content')||''),
      category:String(form.get('category')||'general'),
      isPinned:form.get('isPinned')==='on',
      isPublished:form.get('isPublished')==='on',
      commentsEnabled:form.get('commentsEnabled')==='on',
      reason:String(form.get('reason')||''),
    }
    setSaving(true)
    try{
      const response:any=state.mode==='create'?await adminAPI.post('/news',body):await adminAPI.patch(`/news/${article?.id}`,body)
      onSaved(response.article)
      toast.success(state.mode==='create'?'News article created':'News article updated')
    }catch(error:any){toast.error('Unable to save news',{description:error.message})}
    finally{setSaving(false)}
  }
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="admin-dialog max-h-[90vh] max-w-3xl overflow-y-auto border-orange-900/30 bg-[#111113]">
    <DialogHeader><DialogTitle>{state.mode==='create'?'Create news article':'Edit news article'}</DialogTitle><DialogDescription>Drafts remain private until published.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-xs text-slate-400">Title<Input name="title" required maxLength={200} defaultValue={article?.title||''} className="mt-1"/></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs text-slate-400">Category<Input name="category" required maxLength={50} defaultValue={article?.category||'general'} className="mt-1"/></label><label className="block text-xs text-slate-400">Administrative reason<Input name="reason" required maxLength={500} className="mt-1"/></label></div>
      <label className="block text-xs text-slate-400">Summary<textarea name="summary" maxLength={500} defaultValue={article?.summary||''} className="mt-1 min-h-20 w-full rounded border border-orange-900/30 bg-black/40 p-3 text-slate-100"/></label>
      <label className="block text-xs text-slate-400">Content<textarea name="content" required maxLength={50000} defaultValue={article?.content||''} className="mt-1 min-h-64 w-full rounded border border-orange-900/30 bg-black/40 p-3 text-slate-100"/></label>
      <div className="flex flex-wrap gap-5 text-xs text-slate-300"><label className="flex items-center gap-2"><input name="isPinned" type="checkbox" defaultChecked={Boolean(article?.is_pinned)}/>Pinned</label><label className="flex items-center gap-2"><input name="isPublished" type="checkbox" defaultChecked={Boolean(article?.is_published)}/>Published</label><label className="flex items-center gap-2"><input name="commentsEnabled" type="checkbox" defaultChecked={Boolean(article?.comments_enabled)}/>Comments ready</label></div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving&&<Loader2 className="mr-2 size-4 animate-spin"/>}{saving?'Saving...':'Save article'}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
}
