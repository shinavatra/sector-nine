import { Menu, Plus, RefreshCw, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { UserProfile } from '../../contexts/UserContext';
import type { AdminSection } from './adminTypes';
import { sectionMeta } from './adminTypes';
import { displayPlayerName } from '../../utils/displayName';

export function AdminTopbar({
  section,
  user,
  search,
  onSearch,
  onMenu,
  onRefresh,
  onCreate,
  loading,
}: {
  section: AdminSection;
  user: UserProfile;
  search: string;
  onSearch: (v: string) => void;
  onMenu: () => void;
  onRefresh: () => void;
  onCreate: (type: 'user' | 'host' | 'server' | 'tournament') => void;
  loading: boolean;
}) {
  const meta = sectionMeta[section];
  const createType =
    section === 'users'
      ? 'user'
      : section === 'hosts'
        ? 'host'
      : section === 'servers'
        ? 'server'
        : section === 'tournaments'
          ? 'tournament'
          : null;
  return (
    <header className="admin-topbar sticky top-0 z-40 border-b border-orange-900/25 bg-[#09090a]/95 backdrop-blur-xl">
      <div className="admin-topbar-inner flex min-h-16 items-center gap-4 px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open administration menu"
          onClick={onMenu}
          className="admin-menu-button shrink-0 text-slate-400"
        >
          <Menu size={20} />
        </Button>
        <div className="hidden min-w-0 flex-1 md:block">
          <h1 className="truncate text-base font-semibold text-slate-100">{meta.title}</h1>
          <p className="truncate text-xs text-slate-500">{meta.description}</p>
        </div>
        <div className="relative min-w-0 basis-40 flex-1 md:max-w-md">
          <Input
            aria-label={`Search ${meta.title}`}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search records…"
            className="h-9 w-full min-w-0 border-orange-900/25 bg-black/40 pr-10 text-sm focus-visible:ring-orange-500/30"
          />
          <Search
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-600"
            size={16}
          />
        </div>
        {createType && (
          <Button size="sm" onClick={() => onCreate(createType)} className="shrink-0 gap-2">
            <Plus size={15} />
            <span className="hidden lg:inline">Create {createType}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh administration data"
          onClick={onRefresh}
          disabled={loading}
          className="text-slate-400 hover:text-orange-300"
        >
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
        </Button>
        <div className="hidden shrink-0 border-l border-orange-900/25 pl-3 sm:block">
          <p className="max-w-36 truncate text-xs font-medium text-slate-200">
            {displayPlayerName(user)}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-orange-500">Administrator</p>
        </div>
      </div>
    </header>
  );
}
