import { useEffect, useMemo, useState } from 'react';
import { getAdminAuthedClient } from '@/lib/supabaseBrowser';

type AuditLogRow = {
  id: string;
  actor_id: string | null;
  actor_type: 'influencer' | 'brand' | 'admin' | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

interface AuditLogsTableProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function AuditLogsTable({ supabaseUrl, supabaseAnonKey }: AuditLogsTableProps) {
  const supabase = useMemo(() => getAdminAuthedClient(supabaseUrl, supabaseAnonKey), [supabaseUrl, supabaseAnonKey]);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
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
        .from('audit_logs')
        .select('id,actor_id,actor_type,action,entity_type,entity_id,created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        setRows((data ?? []) as AuditLogRow[]);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (loading) return <div className="text-base-content/70">Ładowanie logów…</div>;
  if (error) return <div className="alert alert-error">Błąd: {error}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Czas</th>
            <th>Actor</th>
            <th>Akcja</th>
            <th>Encja</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td className="text-sm">{new Date(l.created_at).toLocaleString('pl-PL')}</td>
              <td className="text-sm">
                <span className="badge badge-ghost">{l.actor_type ?? '—'}</span>
                <span className="ml-2 text-base-content/70">{l.actor_id ? l.actor_id.slice(0, 8) : '—'}</span>
              </td>
              <td className="font-mono text-xs">{l.action}</td>
              <td className="text-sm">
                {l.entity_type ?? '—'}
                {l.entity_id ? <span className="ml-2 text-base-content/70">{l.entity_id.slice(0, 8)}</span> : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center text-base-content/60">
                Brak danych.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

