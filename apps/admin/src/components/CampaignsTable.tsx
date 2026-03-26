import { useEffect, useMemo, useState } from 'react';
import { getAdminAuthedClient } from '@/lib/supabaseBrowser';

type CampaignRow = {
  id: string;
  brand_id: string;
  name: string;
  status: 'draft' | 'active' | 'applications_closed' | 'ended';
  start_date: string;
  end_applications_date: string;
  end_date: string;
  auto_status_change: boolean;
  created_at: string;
};

interface CampaignsTableProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function CampaignsTable({ supabaseUrl, supabaseAnonKey }: CampaignsTableProps) {
  const supabase = useMemo(() => getAdminAuthedClient(supabaseUrl, supabaseAnonKey), [supabaseUrl, supabaseAnonKey]);
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        .from('campaigns')
        .select('id,brand_id,name,status,start_date,end_applications_date,end_date,auto_status_change,created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        setRows((data ?? []) as CampaignRow[]);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function updateStatus(campaignId: string, status: CampaignRow['status']) {
    if (!supabase) return;
    setSavingId(campaignId);
    setSaveError(null);
    const { data, error: fnError } = await supabase.functions.invoke('admin-campaign-status', {
      body: { campaign_id: campaignId, status },
    });
    if (fnError) {
      setSavingId(null);
      setSaveError(fnError.message);
      return;
    }
    if (!data?.ok) {
      setSavingId(null);
      setSaveError(data?.error ?? 'Nie udało się zapisać.');
      return;
    }
    const updated = data.data as { id: string; status: CampaignRow['status'] };
    setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, status: updated.status } : r)));
    setSavingId(null);
  }

  if (loading) return <div className="text-base-content/70">Ładowanie kampanii…</div>;
  if (error) return <div className="alert alert-error">Błąd: {error}</div>;

  return (
    <div className="overflow-x-auto">
      {saveError && <div className="alert alert-error mb-4">Błąd zapisu: {saveError}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Nazwa</th>
            <th>Status</th>
            <th>Start</th>
            <th>Koniec aplikacji</th>
            <th>Koniec</th>
            <th>Auto status</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="font-medium">{c.name}</td>
              <td>
                <span className="badge badge-ghost">{c.status}</span>
              </td>
              <td className="text-sm">{new Date(c.start_date).toLocaleString('pl-PL')}</td>
              <td className="text-sm">{new Date(c.end_applications_date).toLocaleString('pl-PL')}</td>
              <td className="text-sm">{new Date(c.end_date).toLocaleString('pl-PL')}</td>
              <td>{c.auto_status_change ? <span className="badge badge-success">tak</span> : <span className="badge">nie</span>}</td>
              <td>
                <select
                  className="select select-bordered select-sm"
                  value={c.status}
                  disabled={savingId === c.id}
                  onChange={(e) => updateStatus(c.id, e.target.value as CampaignRow['status'])}
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="applications_closed">applications_closed</option>
                  <option value="ended">ended</option>
                </select>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-base-content/60">
                Brak danych.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

