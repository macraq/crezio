import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface LoginFormProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  redirectTo?: string;
}

export default function LoginForm({ supabaseUrl, supabaseAnonKey, redirectTo = '/' }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setError('Brak konfiguracji Supabase.');
      return;
    }
    setLoading(true);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError('Nieprawidłowy e-mail lub hasło.');
      return;
    }
    window.location.href = redirectTo;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </div>
      )}
      <label className="flex w-full flex-col gap-1.5">
        <span className="text-sm text-slate-300">E-mail</span>
        <input
          type="email"
          className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </label>
      <label className="flex w-full flex-col gap-1.5">
        <span className="text-sm text-slate-300">Hasło</span>
        <input
          type="password"
          className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      <button type="submit" className="brand-cta w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={loading}>
        {loading ? 'Logowanie...' : 'Zaloguj się'}
      </button>
    </form>
  );
}
