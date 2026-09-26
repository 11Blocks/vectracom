'use client';

import { useState, useRef, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, Badge, Skeleton, Modal, Input, Select, Textarea, ConfirmDialog, useToast } from '@/components/ui';
import { useQuery, useMutation } from '@/hooks/use-query';
import { ragService } from '@/services';
import { AiModeBadge } from '@/components/AiModeBadge';
import { Sparkles, Send, Loader2, Plus, MessageSquare, Trash2, Bot, Library, FileText, BookOpen } from 'lucide-react';

const SUGGESTIONS = [
  'Quelles équipes sont en retard ?',
  'Quel véhicule est à risque ?',
  'Quel chantier coûte trop cher ?',
  'Quel stock va manquer ?',
  'Où en sont nos KPI SONATEL ?',
];

const CATEGORIES = [
  { value: 'contrat', label: 'Contrat' },
  { value: 'procedure', label: 'Procédure' },
  { value: 'bordereau', label: 'Bordereau' },
  { value: 'sonatel', label: 'Exigences SONATEL' },
  { value: 'rh', label: 'RH' },
  { value: 'autre', label: 'Autre' },
];
const CAT_CLS: Record<string, string> = {
  contrat: 'bg-[#5b8def]/15 text-[#5b8def] border-[#5b8def]/30',
  procedure: 'bg-[#0f9d70]/15 text-[#0f9d70] border-[#0f9d70]/30',
  bordereau: 'bg-[#D9822B]/15 text-[#D9822B] border-[#D9822B]/30',
  sonatel: 'bg-[#f5a623]/15 text-[#f5a623] border-[#f5a623]/30',
  rh: 'bg-[#a78bfa]/15 text-[#a78bfa] border-[#a78bfa]/30',
  autre: 'bg-[#1a2420] text-[#7a8f80] border-[#1e2e25]',
};

export default function Page() {
  return <AppShell><Content /></AppShell>;
}

function Content() {
  const [tab, setTab] = useState<'chat' | 'library'>('chat');

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-[#f5a623]/15 text-[#f5a623]"><Bot size={20} /></span>
          <div>
            <h1 className="text-xl font-bold text-[#e8ede9] flex items-center gap-2">Assistant Direction — RAG <AiModeBadge /></h1>
            <p className="text-xs text-[#7a8f80]">Données du tenant + base documentaire · réponses en ambre avec sources citées</p>
          </div>
        </div>
        <div className="flex gap-1 bg-[#111916] border border-[#1e2e25] rounded-lg p-1">
          <button onClick={() => setTab('chat')}
            className={'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ' + (tab === 'chat' ? 'bg-[#f5a623] text-[#0a0f0d]' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
            <MessageSquare size={13} /> Conversation
          </button>
          <button onClick={() => setTab('library')}
            className={'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ' + (tab === 'library' ? 'bg-[#f5a623] text-[#0a0f0d]' : 'text-[#7a8f80] hover:text-[#e8ede9]')}>
            <Library size={13} /> Bibliothèque
          </button>
        </div>
      </div>

      {tab === 'chat' ? <ChatPanel /> : <LibraryPanel />}
    </div>
  );
}

/* ═════════════════ CHAT ═════════════════ */
function ChatPanel() {
  const { toast } = useToast();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string; sources?: any[] }>>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations, loading, refetch } = useQuery(() => ragService.listConversations(), []);
  const convList = Array.isArray(conversations) ? conversations : [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  const askMut = useMutation(
    (q: string) => ragService.ask(q, conversationId ?? undefined),
    {
      onSuccess: (res: any) => {
        setConversationId(res.conversationId);
        setMessages(prev => [...prev, { role: 'assistant', content: res.answer, sources: res.sources ?? [] }]);
        setThinking(false);
        refetch();
      },
      onError: (e: any) => {
        setMessages(prev => [...prev, { role: 'error', content: e.message }]);
        setThinking(false);
      },
    },
  );

  const openConversation = async (id: string) => {
    try {
      const res = await ragService.getConversation(id);
      setConversationId(id);
      setMessages((res.messages ?? []).map((m: any) => ({ role: m.role, content: m.content })));
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  const send = (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || thinking) return;
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setInput('');
    setThinking(true);
    askMut.mutate(question);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-4 flex-1 min-h-0">
      {/* Conversations */}
      <Card className="border-[#1e2e25] bg-[#111916] p-3 flex flex-col min-h-0">
        <Button size="sm" className="mb-2" onClick={() => { setConversationId(null); setMessages([]); }}>
          <Plus size={14} /> Nouvelle conversation
        </Button>
        <div className="space-y-1 overflow-y-auto flex-1">
          {loading ? <Skeleton className="h-20" /> : convList.length === 0 ? (
            <p className="text-xs text-[#7a8f80]/60 px-2 py-4 text-center">Aucune conversation</p>
          ) : convList.map((c: any) => (
            <button key={c.id} onClick={() => openConversation(c.id)}
              className={
                'w-full text-left rounded-lg border px-2.5 py-2 transition-all ' +
                (conversationId === c.id ? 'border-[#0f9d70]/50 bg-[#0f9d70]/10' : 'border-transparent hover:bg-[#172019]')
              }>
              <p className="text-xs text-[#e8ede9] truncate flex items-center gap-1.5">
                <MessageSquare size={11} className="shrink-0 text-[#7a8f80]" /> {c.title}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* Chat */}
      <Card className="border-[#1e2e25] bg-[#111916] flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !thinking && (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <span className="p-3 rounded-xl bg-[#f5a623]/15 text-[#f5a623] mb-3"><Sparkles size={24} /></span>
              <p className="text-sm text-[#e8ede9] font-medium">Posez une question sur vos opérations</p>
              <p className="text-xs text-[#7a8f80] mt-1 mb-4">L&apos;assistant croise les données du tenant (missions, stock, véhicules, KPI) et votre base documentaire.</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="rounded-full border border-[#f5a623]/30 bg-[#f5a623]/[0.06] px-3 py-1.5 text-xs text-[#f5a623] hover:bg-[#f5a623]/15 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-xl rounded-br-sm bg-[#0f9d70] text-white px-3.5 py-2.5 text-sm">
                  {m.content}
                </div>
              </div>
            ) : m.role === 'error' ? (
              <div key={i} className="flex justify-start">
                <div className="max-w-[80%] rounded-xl rounded-bl-sm border border-[#C0392B]/40 bg-[#C0392B]/10 px-3.5 py-2.5 text-sm text-[#C0392B]">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start gap-2">
                <span className="p-1.5 rounded-lg bg-[#f5a623]/15 text-[#f5a623] shrink-0 h-fit mt-0.5"><Sparkles size={13} /></span>
                <div className="max-w-[80%] space-y-2">
                  <div className="rounded-xl rounded-bl-sm border border-[#f5a623]/40 bg-[#f5a623]/[0.06] px-3.5 py-2.5 text-sm text-[#e8ede9] whitespace-pre-wrap">
                    {m.content}
                  </div>
                  {m.sources && m.sources.length > 0 && <SourceChips sources={m.sources} />}
                </div>
              </div>
            )
          ))}
          {thinking && (
            <div className="flex justify-start gap-2">
              <span className="p-1.5 rounded-lg bg-[#f5a623]/15 text-[#f5a623] shrink-0"><Sparkles size={13} /></span>
              <div className="rounded-xl border border-[#f5a623]/40 bg-[#f5a623]/[0.06] px-4 py-3 flex gap-1.5 items-center">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#f5a623] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-[#1e2e25] flex gap-2">
          <input
            type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Votre question… (données du tenant ou documents)"
            className="flex-1 h-10 px-3.5 rounded-lg bg-[#0a0f0d] border border-[#1e2e25] text-sm text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#f5a623]/40"
          />
          <Button variant="ai" onClick={() => send()} disabled={thinking || !input.trim()}>
            {thinking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Sources citées sous une réponse : chaque extrait est traçable vers un document. */
function SourceChips({ sources }: { sources: any[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="text-[10px] text-[#7a8f80] self-center mr-0.5">Sources :</span>
      {sources.map((s, i) => (
        <div key={i} className="relative">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className={'rounded-full border px-2 py-0.5 text-[10px] transition-colors flex items-center gap-1 ' + (CAT_CLS[s.category] ?? CAT_CLS.autre)}>
            <FileText size={9} /> {s.title.length > 34 ? s.title.slice(0, 34) + '…' : s.title} §{s.chunkIndex}
          </button>
          {expanded === i && (
            <div className="absolute z-10 bottom-full mb-1.5 left-0 w-80 rounded-lg border border-[#1e2e25] bg-[#0a0f0d] p-2.5 shadow-xl">
              <p className="text-[10px] text-[#7a8f80] mb-1 flex items-center justify-between">
                <span>{s.title} · extrait §{s.chunkIndex}</span>
                <span className="text-[#f5a623]">score {s.score}</span>
              </p>
              <p className="text-[11px] text-[#e8ede9] leading-relaxed">{s.excerpt}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═════════════════ BIBLIOTHÈQUE DOCUMENTAIRE ═════════════════ */
function LibraryPanel() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: docs, loading, refetch } = useQuery(() => ragService.listDocuments(), []);
  const docList = Array.isArray(docs) ? docs : [];
  const totalChunks = docList.reduce((s: number, d: any) => s + d.chunkCount, 0);

  const deleteMut = useMutation((id: string) => ragService.deleteDocument(id), {
    onSuccess: () => { toast({ title: 'Document supprimé', description: 'Les morceaux indexés ont été retirés.', variant: 'success' }); setDeleteId(null); refetch(); },
    onError: (e: Error) => toast({ title: 'Suppression impossible', description: e.message, variant: 'error' }),
  });

  return (
    <div className="space-y-4 flex-1 min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#7a8f80]">
          {docList.length} document(s) · {totalChunks} morceaux indexés — chaque réponse de l&apos;assistant cite ses sources documentaires.
        </p>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Ajouter un document</Button>
      </div>

      <Card className="border-[#1e2e25] bg-[#111916] overflow-hidden flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : docList.length === 0 ? (
          <div className="p-10 text-center">
            <BookOpen size={36} className="mx-auto text-[#7a8f80]/40 mb-3" />
            <p className="text-sm text-[#e8ede9] font-medium">Bibliothèque vide</p>
            <p className="text-xs text-[#7a8f80] mt-1 mb-4">Ajoutez vos contrats, procédures et exigences SONATEL pour que l&apos;assistant puisse les citer.</p>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Ajouter le premier document</Button>
          </div>
        ) : (
          <div className="divide-y divide-[#1e2e25]/50">
            {docList.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#172019] transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-[#e8ede9] flex items-center gap-1.5"><FileText size={13} className="text-[#f5a623]" /> {d.title}</p>
                    <Badge className={CAT_CLS[d.category] ?? CAT_CLS.autre}>{CATEGORIES.find(c => c.value === d.category)?.label ?? d.category}</Badge>
                  </div>
                  <p className="text-[10px] text-[#7a8f80] mt-0.5">
                    {d.chunkCount} morceau(x) · {d.sizeChars.toLocaleString('fr-FR')} caractères
                    {d.fileName ? ` · ${d.fileName}` : ''}
                    {d.createdAt ? ` · ajouté le ${new Date(d.createdAt).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[#7a8f80] hover:text-[#C0392B] shrink-0" onClick={() => setDeleteId(d.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AddDocumentModal open={showAdd} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); refetch(); }} />
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer le document"
        message="L'assistant ne pourra plus citer ce document dans ses réponses." confirmText="Supprimer" danger
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)} />
    </div>
  );
}

function AddDocumentModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ title: '', category: 'contrat', content: '', fileName: '' });

  const mut = useMutation(
    () => ragService.ingestDocument({ title: f.title, category: f.category, content: f.content, fileName: f.fileName || undefined }),
    {
      onSuccess: (d: any) => {
        toast({ title: 'Document indexé', description: `${d.chunkCount} morceau(x) prêts pour le retrieval.`, variant: 'success' });
        setF({ title: '', category: 'contrat', content: '', fileName: '' });
        onDone();
      },
      onError: (e: Error) => toast({ title: 'Indexation impossible', description: e.message, variant: 'error' }),
    },
  );

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!/\.(txt|md|csv)$/i.test(file.name)) {
      toast({ title: 'Format non supporté', description: 'Fichiers texte (.txt, .md, .csv) — pour un PDF, copiez son contenu dans la zone de texte.', variant: 'warning' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setF(prev => ({ ...prev, content: String(reader.result ?? ''), fileName: file.name, title: prev.title || file.name.replace(/\.[^.]+$/, '') }));
    };
    reader.readAsText(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un document à la base RAG" size="lg">
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Titre *" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} required placeholder="Annexe Optimax juin 26" />
          <Select label="Catégorie *" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </div>
        <div>
          <p className="text-xs text-[#7a8f80] mb-1.5">Fichier texte (.txt, .md, .csv) — le contenu remplit la zone ci-dessous</p>
          <input type="file" accept=".txt,.md,.csv" onChange={e => pickFile(e.target.files?.[0])}
            className="w-full text-xs text-[#7a8f80] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#1a2420] file:text-[#e8ede9] file:text-xs file:cursor-pointer" />
        </div>
        <Textarea
          label="Contenu (texte) *"
          rows={10}
          value={f.content}
          onChange={e => setF({ ...f, content: e.target.value })}
          placeholder="Collez ici le contenu du document (PDF → copier le texte). Minimum 50 caractères. Le document sera découpé et indexé automatiquement."
        />
        <p className="text-[10px] text-[#7a8f80]">{f.content.length.toLocaleString('fr-FR')} caractère(s) — découpe automatique en morceaux de ~600 caractères.</p>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="ai" disabled={mut.loading || f.content.trim().length < 50 || !f.title.trim()}>
            {mut.loading ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />} Indexer le document
          </Button>
        </div>
      </form>
    </Modal>
  );
}
