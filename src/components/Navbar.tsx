import React from 'react';
import { BookOpen, Compass, HardDrive, MessageSquareText, ShieldCheck, Lock, Wifi, WifiOff } from 'lucide-react';
import { SyncState } from '../lib/syncEngine';

interface NavbarProps {
  activeTab: 'home' | 'learn' | 'vault' | 'ask' | 'system';
  setActiveTab: (tab: 'home' | 'learn' | 'vault' | 'ask' | 'system') => void;
  syncState: SyncState;
  pendingSyncCount: number;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  syncState,
  pendingSyncCount,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 bg-[#FBFBF9]/90 backdrop-blur-md dark:border-stone-800 dark:bg-[#121316]/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Single Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('home')}
            className="text-left font-serif text-xl font-bold tracking-tight text-stone-900 transition-colors hover:text-stone-700 dark:text-stone-100"
          >
            Ishizaki
          </button>
          <span className="hidden text-xs text-stone-600 sm:inline-block">· Academic OS</span>
        </div>

        {/* Zone 2: Clean 4 Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'home'
                ? 'bg-stone-200/80 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => setActiveTab('learn')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'learn'
                ? 'bg-stone-200/80 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Learn</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'vault'
                ? 'bg-stone-200/80 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
          >
            <HardDrive className="h-3.5 w-3.5" />
            <span>Vault</span>
          </button>

          <button
            onClick={() => setActiveTab('ask')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'ask'
                ? 'bg-stone-200/80 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            <span>Ask</span>
          </button>
        </nav>

        {/* Zone 3: Sync Status & Protected System / Lock Actions */}
        <div className="flex items-center gap-2">
          {/* Subtle sync status */}
          <div className="hidden items-center gap-1.5 text-[11px] text-stone-600 sm:flex">
            {syncState === 'OFFLINE' ? (
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            ) : syncState === 'SYNCING' ? (
              <span className="flex items-center gap-1 text-blue-700 dark:text-blue-300">
                <Wifi className="h-3 w-3 animate-pulse" /> Syncing ({pendingSyncCount})
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <Wifi className="h-3 w-3" /> Synced
              </span>
            )}
          </div>

          {/* Diagnostic System link */}
          <button
            onClick={() => setActiveTab('system')}
            title="System Diagnostics"
            className={`rounded-md p-1.5 text-xs transition-colors ${
              activeTab === 'system'
                ? 'bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
          </button>

          {/* Lock session */}
          <button
            onClick={onLogout}
            title="Lock Ishizaki"
            className="rounded-md p-1.5 text-stone-600 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            <Lock className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
