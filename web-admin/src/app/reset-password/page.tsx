'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { Suspense } from 'react';

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialToken = useMemo(() => params.get('token') ?? '', [params]);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 8) {
      setError('Minimum 8 caractères');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100/api/v1';
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Erreur ${res.status}`);
      setOk(true);
      setTimeout(() => router.push('/'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[0.625rem] border border-[#1e2e25] bg-[#111916] p-6 space-y-4">
      {ok ? (
        <p className="text-sm text-[#0f9d70] text-center">Mot de passe réinitialisé — redirection…</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {!initialToken && (
            <div>
              <label className="block text-sm font-medium text-[#7a8f80] mb-1.5">Token</label>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="w-full h-11 px-3 rounded-lg bg-[#0a0f0d]/60 border border-[#1e2e25] text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#7a8f80] mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full h-11 px-3 rounded-lg bg-[#0a0f0d]/60 border border-[#1e2e25] text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#7a8f80] mb-1.5">Confirmer</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="w-full h-11 px-3 rounded-lg bg-[#0a0f0d]/60 border border-[#1e2e25] text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
            />
          </div>
          {error && <p className="text-sm text-[#C0392B]">{error}</p>}
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full h-11 rounded-lg bg-[#0f9d70] text-white font-semibold text-sm hover:bg-[#0d8a62] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Réinitialiser
          </button>
        </form>
      )}
      <Link href="/" className="flex items-center justify-center gap-1 text-sm text-[#7a8f80] hover:text-[#0f9d70]">
        <ArrowLeft size={14} /> Retour connexion
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f0d] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-[#0f9d70]/15 flex items-center justify-center">
            <Shield className="h-6 w-6 text-[#0f9d70]" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-[#e8ede9]">Nouveau mot de passe</h1>
          <p className="text-sm text-[#7a8f80] mt-1">Choisissez un mot de passe sécurisé</p>
        </div>
        <Suspense fallback={<div className="h-40 rounded-lg bg-[#111916] animate-pulse" />}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
