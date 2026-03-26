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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      {error && (
        <div className="alert alert-error text-sm" role="alert">
          {error}
        </div>
      )}
      <label className="form-control w-full">
        <span className="label-text">E-mail</span>
        <input
          type="email"
          className="input input-bordered w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </label>
      <label className="form-control w-full">
        <span className="label-text">Hasło</span>
        <input
          type="password"
          className="input input-bordered w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      <button type="submit" className="btn-crezio-gradient rounded-full" disabled={loading}>
        {loading ? 'Logowanie…' : 'Zaloguj się'}
      </button>
    </form>
  );
}
