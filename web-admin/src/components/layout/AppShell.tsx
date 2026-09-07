'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { notificationsService, settingsService } from '@/services';

function playNotifBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close().catch(() => undefined);
    }, 180);
  } catch {
    /* ignore */
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevCount = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('vectracom_token');
    const userJson = localStorage.getItem('vectracom_user');
    if (!token) { router.push('/'); return; }
    if (userJson) { setUser(JSON.parse(userJson)); setReady(true); }
    else {
      fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100/api/v1') + '/auth/me', {
        headers: { Authorization: 'Bearer ' + token },
      }).then(r => r.ok ? r.json() : null).then(me => {
        if (me) { setUser(me); setReady(true); }
        else { localStorage.removeItem('vectracom_token'); router.push('/'); }
      }).catch(() => { localStorage.removeItem('vectracom_token'); router.push('/'); });
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;
    settingsService.getSection('notifications').then((s: any) => {
      const data = s?.data ?? s ?? {};
      if (typeof data.soundEnabled === 'boolean') setSoundEnabled(data.soundEnabled);
    }).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      try {
        const d: any = await notificationsService.unreadCount();
        const count = Number(d?.count ?? d ?? 0);
        if (soundEnabled && prevCount.current != null && count > prevCount.current) {
          playNotifBeep();
        }
        prevCount.current = count;
        setNotifCount(count);
      } catch { /* ignore */ }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user, soundEnabled]);

  if (!ready || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0f0d]">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }} />
      </div>
    );
  }

  const logout = () => { localStorage.clear(); router.push('/'); };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0f0d]">
      <aside className="hidden md:flex w-56 shrink-0" role="complementary">
        <Sidebar role={user.role} />
      </aside>

      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <aside className="fixed left-0 top-0 z-50 h-full w-56 md:hidden" role="complementary">
            <Sidebar role={user.role} />
          </aside>
        </>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-[#18181b] px-4" role="banner">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-lg hover:bg-zinc-800 text-zinc-400" aria-label="Menu">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
            <p className="text-sm text-zinc-500 hidden sm:block">{user?.companyName ?? 'Green-T Console'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/notifications')} className="relative p-2 rounded-lg hover:bg-zinc-800 text-zinc-400" aria-label={'Notifications (' + notifCount + ' non lues)'}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              {notifCount > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white px-1">{notifCount > 99 ? '99+' : notifCount}</span>}
            </button>
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-zinc-200">{user?.fullName}</p>
                <p className="text-xs text-zinc-500">{user?.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-sm font-semibold">
                {(user?.fullName || '?').charAt(0).toUpperCase()}
              </div>
              <button onClick={logout} className="ml-1 p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300" aria-label="Déconnexion" title="Déconnexion">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6" role="main">{children}</main>
      </div>
    </div>
  );
}
