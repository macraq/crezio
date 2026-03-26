import { useEffect, useMemo, useState } from 'react';
import { getAdminAuthedClient } from '@/lib/supabaseBrowser';

type BrandRow = {
  id: string;
  name: string;
  industry: string | null;
  contact: string | null;
  subscription_tier: 'basic' | 'medium' | 'platinum';
  subscription_active: boolean;
  created_at: string;
};

interface BrandsTableProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function BrandsTable({ supabaseUrl, supabaseAnonKey }: BrandsTableProps) {
  const supabase = useMemo(() => getAdminAuthedClient(supabaseUrl, supabaseAnonKey), [supabaseUrl, supabaseAnonKey]);
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setError('Brak konfiguracji Supabase w przeglądarce.');
      return;
    }
    const sb = supabase;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await sb
        .from('brands')
        .select('id,name,industry,contact,subscription_tier,subscription_active,created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        setRows((data ?? []) as BrandRow[]);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (loading) return <div className="text-base-content/70">Ładowanie marek…</div>;
  if (error) return <div className="alert alert-error">Błąd: {error}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Nazwa</th>
            <th>Branża</th>
            <th>Kontakt</th>
            <th>Pakiet</th>
            <th>Aktywny</th>
            <th>Utworzono</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td className="font-medium">{b.name}</td>
              <td>{b.industry ?? '—'}</td>
              <td className="max-w-xs truncate" title={b.contact ?? ''}>
                {b.contact ?? '—'}
              </td>
              <td>
                <span className="badge badge-ghost">{b.subscription_tier}</span>
              </td>
              <td>{b.subscription_active ? <span className="badge badge-success">tak</span> : <span className="badge">nie</span>}</td>
              <td className="text-sm text-base-content/70">{new Date(b.created_at).toLocaleString('pl-PL')}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-base-content/60">
                Brak danych.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

