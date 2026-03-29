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
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [contact, setContact] = useState('');
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
    if (!name.trim()) {
      setError('Podaj nazwę marki.');
      return;
    }
    setLoading(true);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const termsAt = new Date().toISOString();
    const { data: authData, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          account_type: 'brand',
          terms_accepted_at: termsAt,
          privacy_accepted_at: termsAt,
          locale: 'pl',
        },
      },
    });
    if (err) {
      setLoading(false);
      if (err.message.includes('already registered')) {
        setError('Ten adres e-mail jest już zarejestrowany.');
      } else {
        setError(err.message || 'Rejestracja nie powiodła się.');
      }
      return;
    }
    if (authData.user) {
      const { error: brandErr } = await supabase.from('brands').insert({
        profile_id: authData.user.id,
        name: name.trim(),
        industry: industry.trim() || null,
        contact: contact.trim() || null,
      });
      if (brandErr) {
        setError('Konto utworzone, ale nie udało się zapisać danych marki. Skontaktuj się z supportem.');
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    setSuccess(true);
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 2000);
  }

  if (success) {
    return (
      <div className="mt-6 rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
        <span>Konto marki utworzone. Przekierowanie...</span>
      </div>
    );
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
          minLength={6}
          autoComplete="new-password"
        />
      </label>
      <label className="flex w-full flex-col gap-1.5">
        <span className="text-sm text-slate-300">Powtórz hasło</span>
        <input
          type="password"
          className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </label>
      <label className="flex w-full flex-col gap-1.5">
        <span className="text-sm text-slate-300">Nazwa marki *</span>
        <input
          type="text"
          className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="np. Moja Marka Beauty"
        />
      </label>
      <label className="flex w-full flex-col gap-1.5">
        <span className="text-sm text-slate-300">Branża</span>
        <input
          type="text"
          className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="np. beauty, fashion"
        />
      </label>
      <label className="flex w-full flex-col gap-1.5">
        <span className="text-sm text-slate-300">Kontakt (opcjonalnie)</span>
        <input
          type="text"
          className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="telefon lub inny kontakt"
        />
      </label>
      <label className="flex cursor-pointer gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-white/30 bg-slate-900 text-emerald-300"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
        />
        <span>Akceptuję <a href="/regulamin" className="brand-link">regulamin</a></span>
      </label>
      <label className="flex cursor-pointer gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-white/30 bg-slate-900 text-emerald-300"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
        />
        <span>Akceptuję <a href="/polityka-prywatnosci" className="brand-link">politykę prywatności</a></span>
      </label>
      <button type="submit" className="brand-cta w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={loading}>
        {loading ? 'Rejestracja...' : 'Zarejestruj markę'}
      </button>
    </form>
  );
}
