import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface SignupFormProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  redirectTo?: string;
}

export default function SignupForm({ supabaseUrl, supabaseAnonKey, redirectTo = '/' }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
      setError('Brak konfiguracji Supabase.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Hasła muszą być identyczne.');
      return;
    }
    if (!terms || !privacy) {
      setError('Zaakceptuj regulamin i politykę prywatności.');
      return;
    }
    setLoading(true);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const termsAt = new Date().toISOString();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          account_type: 'influencer',
          terms_accepted_at: termsAt,
          privacy_accepted_at: termsAt,
          locale: 'pl',
        },
      },
    });
    setLoading(false);
    if (err) {
      if (err.message.includes('already registered')) {
        setError('Ten adres e-mail jest już zarejestrowany.');
      } else {
        setError(err.message || 'Rejestracja nie powiodła się.');
      }
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 2000);
  }

  if (success) {
    return (
      <div className="alert alert-success max-w-sm">
        <span>Konto utworzone. Sprawdź e-mail (link potwierdzający, jeśli włączony). Przekierowanie…</span>
      </div>
    );
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
          minLength={6}
          autoComplete="new-password"
        />
      </label>
      <label className="form-control w-full">
        <span className="label-text">Powtórz hasło</span>
        <input
          type="password"
          className="input input-bordered w-full"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </label>
      <label className="flex gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
        />
        <span className="label-text">Akceptuję <a href="/regulamin" className="link">regulamin</a></span>
      </label>
      <label className="flex gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
        />
        <span className="label-text">Akceptuję <a href="/polityka-prywatnosci" className="link">politykę prywatności</a></span>
      </label>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Rejestracja…' : 'Zarejestruj się'}
      </button>
    </form>
  );
}
