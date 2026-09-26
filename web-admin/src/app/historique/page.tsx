'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, Input, Select } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { settingsService, usersService } from '@/services';
import { AuditTimeline } from '@/components/admin/AuditTimeline';
import { History } from 'lucide-react';

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data: usersData } = useQuery(() => usersService.list(), []);
  const users: any[] = Array.isArray(usersData) ? usersData : (usersData as any)?.items ?? [];

  const filters: Record<string, string> = {
    ...(userId ? { userId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(search ? { q: search } : {}),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="p-2 rounded-lg bg-[#0f9d70]/10 text-[#0f9d70]"><History size={20} /></span>
        <div>
          <h1 className="text-xl font-bold text-[#e8ede9]">Historique</h1>
          <p className="text-xs text-[#7a8f80]">
            Qui a fait quoi et quand : facturation, caisse, stock, missions, RH, comptes… Les traces techniques (chaque requête) sont disponibles en option.
          </p>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <Select label="Utilisateur" value={userId} onChange={e => setUserId(e.target.value)}>
          <option value="">Tous</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
        </Select>
        <Input label="Du" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <Input label="Au" type="date" value={to} onChange={e => setTo(e.target.value)} />
        <form onSubmit={e => { e.preventDefault(); setSearch(q.trim()); }}>
          <Input label="Recherche (n° facture, motif…)" value={q} onChange={e => setQ(e.target.value)} onBlur={() => setSearch(q.trim())} placeholder="FAC-2026-…" />
        </form>
      </Card>

      <Card className="p-4">
        <AuditTimeline fetcher={(p) => settingsService.auditLogs({ ...filters, ...p })} deps={[userId, from, to, search]} />
      </Card>
    </div>
  );
}
