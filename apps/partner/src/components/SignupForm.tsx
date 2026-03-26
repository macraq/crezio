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
      <div className="alert alert-success max-w-sm">
        <span>Konto marki utworzone. Przekierowanie…</span>
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
      <label className="form-control w-full">
        <span className="label-text">Nazwa marki *</span>
        <input
          type="text"
          className="input input-bordered w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="np. Moja Marka Beauty"
        />
      </label>
      <label className="form-control w-full">
        <span className="label-text">Branża</span>
        <input
          type="text"
          className="input input-bordered w-full"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="np. beauty, fashion"
        />
      </label>
      <label className="form-control w-full">
        <span className="label-text">Kontakt (opcjonalnie)</span>
        <input
          type="text"
          className="input input-bordered w-full"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="telefon lub inny kontakt"
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
        {loading ? 'Rejestracja…' : 'Zarejestruj markę'}
      </button>
    </form>
  );
}
