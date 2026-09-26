'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, LogIn, ChevronRight, Loader2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('vectracom_token');
    if (!token) return;
    let role = '';
    try { role = JSON.parse(localStorage.getItem('vectracom_user') || '{}').role ?? ''; } catch { /* session illisible */ }
    router.push(['super_admin', 'finance_admin', 'support_admin'].includes(role) ? '/console' : role === 'magasinier' ? '/stock' : '/dashboard');
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100/api/v1';
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message || `Erreur ${res.status}`);
      }
      const data = await res.json();
      localStorage.removeItem('vectracom_support_token');
      localStorage.removeItem('vectracom_support_user');
      localStorage.setItem('vectracom_token', data.accessToken);
      localStorage.setItem('vectracom_user', JSON.stringify(data.user));
      if (data.user?.mustChangePassword) router.push('/compte?force=1');
      else if (['super_admin', 'finance_admin', 'support_admin'].includes(data.user?.role)) router.push('/console');
      else if (data.user?.role === 'magasinier') router.push('/stock');
      else router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { label: 'Admin ONECOMIT', email: 'admin@onecomit.sn', role: 'Administrateur' },
    { label: 'Super Admin Green-T', email: 'admin@green-t.sn', role: 'Super Admin' },
    { label: 'Direction', email: 'direction@onecomit.sn', role: 'Direction' },
    { label: "Chef d'équipe", email: 'chef@onecomit.sn', role: "Chef d'équipe" },
    { label: 'Magasinier', email: 'magasinier@onecomit.sn', role: 'Magasinier' },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f0d] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-[#0f9d70]/15 flex items-center justify-center">
            <Shield className="h-6 w-6 text-[#0f9d70]" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-[#e8ede9] tracking-tight">
            VEC<span className="text-[#0f9d70]">TRA</span>COM
          </h1>
          <p className="text-sm text-[#e8ede9]/50 mt-1">Gestion des opérations terrain</p>
        </div>

        <div className="rounded-[0.625rem] border border-[#1e2e25] bg-[#111916] p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Connexion">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#7a8f80] mb-1.5">Adresse e-mail</label>
              <input
                id="email"
                type="email"
                className="w-full h-11 px-3 rounded-lg bg-[#0a0f0d]/60 border border-[#1e2e25] text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50 focus:border-[#0f9d70] transition-all"
                placeholder="nom@entreprise.sn"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#7a8f80] mb-1.5">Mot de passe</label>
              <input
                id="password"
                type="password"
                className="w-full h-11 px-3 rounded-lg bg-[#0a0f0d]/60 border border-[#1e2e25] text-[#e8ede9] placeholder:text-[#7a8f80] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50 focus:border-[#0f9d70] transition-all"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <div className="mt-1.5 text-right">
                <a href="/forgot-password" className="text-xs text-[#0f9d70] hover:underline">Mot de passe oublié ?</a>
              </div>
            </div>

            {error && (
              <div role="alert" className="bg-[#C0392B]/12 border border-[#C0392B]/30 rounded-lg p-3">
                <p className="text-sm text-[#C0392B]">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-[#0f9d70] text-white font-semibold text-sm hover:bg-[#0d8a62] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50 focus:ring-offset-2 focus:ring-offset-[#0a0f0d] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Se connecter
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setShowDemo(!showDemo)}
            className="w-full flex items-center justify-between text-sm text-[#e8ede9]/50 hover:text-[#e8ede9]/70 transition-colors"
          >
            Comptes de démonstration
            <ChevronRight className={`h-4 w-4 transition-transform ${showDemo ? 'rotate-90' : ''}`} />
          </button>

          {showDemo && (
            <div className="max-h-60 overflow-y-auto rounded-lg border border-[#1e2e25] divide-y divide-[#1e2e25]/50">
              {demoAccounts.map(acc => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword('Onecomit!2026'); }}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm text-[#e8ede9]">{acc.email}</p>
                    <p className="text-xs text-[#7a8f80]">{acc.role}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#7a8f80]" />
                </button>
              ))}
              <div className="p-3 border-t border-[#1e2e25]">
                <p className="text-xs text-[#e8ede9]/35">Mot de passe : Onecomit!2026 / ChangeMe!2026</p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#7a8f80]/60">© 2026 Green-T · VECTRACOM v1.0</p>
      </div>
    </div>
  );
}
