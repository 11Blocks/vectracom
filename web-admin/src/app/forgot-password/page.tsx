'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, ArrowLeft, Loader2, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setDevToken(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100/api/v1';
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Erreur ${res.status}`);
      setMessage(body.message || 'Si le compte existe, un lien a été envoyé.');
      if (body.devResetToken) setDevToken(body.devResetToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f0d] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-[#0f9d70]/15 flex items-center justify-center">
            <Shield className="h-6 w-6 text-[#0f9d70]" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-[#e8ede9]">Mot de passe oublié</h1>
          <p className="text-sm text-[#7a8f80] mt-1">Recevez un lien de réinitialisation</p>
        </div>

        <div className="rounded-[0.625rem] border border-[#1e2e25] bg-[#111916] p-6 space-y-4">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#7a8f80] mb-1.5">Adresse e-mail</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-[#0a0f0d]/60 border border-[#1e2e25] text-[#e8ede9] focus:outline-none focus:ring-2 focus:ring-[#0f9d70]/50"
                placeholder="nom@entreprise.sn"
              />
            </div>
            {error && <p className="text-sm text-[#C0392B]">{error}</p>}
            {message && <p className="text-sm text-[#0f9d70]">{message}</p>}
            {devToken && (
              <div className="rounded-lg border border-[#f5a623]/40 bg-[#f5a623]/10 p-3 space-y-2">
                <p className="text-xs text-[#f5a623]">Mode démo — token de reset (SMTP non branché) :</p>
                <button
                  type="button"
                  className="text-xs text-[#e8ede9] underline break-all text-left"
                  onClick={() => router.push('/reset-password?token=' + encodeURIComponent(devToken))}
                >
                  Continuer vers la réinitialisation
                </button>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-[#0f9d70] text-white font-semibold text-sm hover:bg-[#0d8a62] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Envoyer le lien
            </button>
          </form>
          <Link href="/" className="flex items-center justify-center gap-1 text-sm text-[#7a8f80] hover:text-[#0f9d70]">
            <ArrowLeft size={14} /> Retour connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
