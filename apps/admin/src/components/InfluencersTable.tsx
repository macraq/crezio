import { useEffect, useMemo, useState } from 'react';
import { getAdminAuthedClient } from '@/lib/supabaseBrowser';

type InfluencerRow = {
  profile_id: string;
  category: string | null;
  location: string | null;
  followers_count: number | null;
  engagement_rate: number | null;
  profile_completion_pct: number | null;
  is_premium: boolean;
  last_verified_at: string | null;
  updated_at: string;
};

interface InfluencersTableProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function InfluencersTable({ supabaseUrl, supabaseAnonKey }: InfluencersTableProps) {
  const supabase = useMemo(() => getAdminAuthedClient(supabaseUrl, supabaseAnonKey), [supabaseUrl, supabaseAnonKey]);
  const [rows, setRows] = useState<InfluencerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [edit, setEdit] = useState<{
    open: boolean;
    influencerId: string | null;
    followers: string;
    engagementRatePct: string;
    isPremium: boolean;
  }>({ open: false, influencerId: null, followers: '', engagementRatePct: '', isPremium: false });

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
      // Uwaga: część influencerów może istnieć tylko w `profiles` (jeszcze bez wiersza w `influencer_profiles`).
      // Dlatego listujemy po `profiles` i dołączamy opcjonalne dane z `influencer_profiles`.
      const { data, error: err } = await sb
        .from('profiles')
        .select(
          'id,account_type,influencer_profiles(profile_id,category,location,followers_count,engagement_rate,profile_completion_pct,is_premium,last_verified_at,updated_at)'
        )
        .eq('account_type', 'influencer')
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setRows([]);
      } else {
        const mapped = ((data ?? []) as Array<{
          id: string;
          influencer_profiles:
            | null
            | Array<{
                profile_id: string;
                category: string | null;
                location: string | null;
                followers_count: number | null;
                engagement_rate: number | null;
                profile_completion_pct: number | null;
                is_premium: boolean;
                last_verified_at: string | null;
                updated_at: string;
              }>;
        }>).map((p) => {
          const ip = Array.isArray(p.influencer_profiles) ? p.influencer_profiles[0] : null;
          return {
            profile_id: p.id,
            category: ip?.category ?? null,
            location: ip?.location ?? null,
            followers_count: ip?.followers_count ?? null,
            engagement_rate: ip?.engagement_rate ?? null,
            profile_completion_pct: ip?.profile_completion_pct ?? null,
            is_premium: ip?.is_premium ?? false,
            last_verified_at: ip?.last_verified_at ?? null,
            updated_at: ip?.updated_at ?? new Date(0).toISOString(),
          } satisfies InfluencerRow;
        });
        setRows(mapped);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function openEdit(row: InfluencerRow) {
    setSaveError(null);
    setEdit({
      open: true,
      influencerId: row.profile_id,
      followers: row.followers_count == null ? '' : String(row.followers_count),
      engagementRatePct: row.engagement_rate == null ? '' : String(Math.round(row.engagement_rate * 10000) / 100),
      isPremium: row.is_premium,
    });
  }

  async function submitEdit() {
    if (!supabase) return;
    if (!edit.influencerId) return;
    setSaving(true);
    setSaveError(null);

    const followers =
      edit.followers.trim() === '' ? null : Number.isFinite(Number(edit.followers)) ? Number(edit.followers) : NaN;
    const erPct =
      edit.engagementRatePct.trim() === ''
        ? null
        : Number.isFinite(Number(edit.engagementRatePct))
          ? Number(edit.engagementRatePct)
          : NaN;

    if (followers !== null && (Number.isNaN(followers) || followers < 0)) {
      setSaving(false);
      setSaveError('Followers musi być liczbą >= 0 (albo puste).');
      return;
    }
    if (erPct !== null && (Number.isNaN(erPct) || erPct < 0 || erPct > 100)) {
      setSaving(false);
      setSaveError('ER (%) musi być w zakresie 0–100 (albo puste).');
      return;
    }

    const payload = {
      influencer_id: edit.influencerId,
      followers_count: followers,
      engagement_rate: erPct == null ? null : erPct / 100,
      is_premium: edit.isPremium,
      last_verified_at: new Date().toISOString(),
    };

    const { data, error: fnError } = await supabase.functions.invoke('admin-influencer-metrics', { body: payload });
    if (fnError) {
      setSaving(false);
      setSaveError(fnError.message);
      return;
    }
    if (!data?.ok) {
      setSaving(false);
      setSaveError(data?.error ?? 'Nie udało się zapisać.');
      return;
    }

    const updated = data.data as Partial<InfluencerRow> & { profile_id: string };
    setRows((prev) => prev.map((r) => (r.profile_id === updated.profile_id ? { ...r, ...updated } as InfluencerRow : r)));
    setSaving(false);
    setEdit((s) => ({ ...s, open: false, influencerId: null }));
  }

  if (loading) return <div className="text-base-content/70">Ładowanie influencerów…</div>;
  if (error) return <div className="alert alert-error">Błąd: {error}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Kategoria</th>
            <th>Lokalizacja</th>
            <th>Followers</th>
            <th>ER</th>
            <th>Premium</th>
            <th>Completion</th>
            <th>Verified</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.profile_id}>
              <td className="font-mono text-xs" title={i.profile_id}>
                {i.profile_id.slice(0, 8)}
              </td>
              <td>{i.category ?? '—'}</td>
              <td>{i.location ?? '—'}</td>
              <td>{i.followers_count ?? '—'}</td>
              <td>{i.engagement_rate == null ? '—' : (i.engagement_rate * 100).toFixed(2) + '%'}</td>
              <td>{i.is_premium ? <span className="badge badge-success">tak</span> : <span className="badge">nie</span>}</td>
              <td>{i.profile_completion_pct == null ? '—' : `${i.profile_completion_pct}%`}</td>
              <td className="text-sm">{i.last_verified_at ? new Date(i.last_verified_at).toLocaleString('pl-PL') : '—'}</td>
              <td>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => openEdit(i)}>
                  Edytuj metryki
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-base-content/60">
                Brak danych.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {edit.open && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-semibold text-lg">Ręczna aktualizacja metryk</h3>
            <p className="text-sm text-base-content/70 mt-1">
              Zapis idzie przez Edge Function i loguje akcję w <code>audit_logs</code>.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              {saveError && <div className="alert alert-error text-sm">{saveError}</div>}
              <label className="form-control">
                <span className="label-text">Followers</span>
                <input
                  className="input input-bordered"
                  inputMode="numeric"
                  value={edit.followers}
                  onChange={(e) => setEdit((s) => ({ ...s, followers: e.target.value }))}
                  placeholder="np. 12000"
                />
              </label>
              <label className="form-control">
                <span className="label-text">Engagement Rate (%)</span>
                <input
                  className="input input-bordered"
                  inputMode="decimal"
                  value={edit.engagementRatePct}
                  onChange={(e) => setEdit((s) => ({ ...s, engagementRatePct: e.target.value }))}
                  placeholder="np. 3.25"
                />
              </label>
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={edit.isPremium}
                  onChange={(e) => setEdit((s) => ({ ...s, isPremium: e.target.checked }))}
                />
                <span className="label-text">Premium</span>
              </label>
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSaveError(null);
                  setEdit({ open: false, influencerId: null, followers: '', engagementRatePct: '', isPremium: false });
                }}
                disabled={saving}
              >
                Anuluj
              </button>
              <button type="button" className="btn btn-primary" onClick={submitEdit} disabled={saving}>
                {saving ? 'Zapisywanie…' : 'Zapisz'}
              </button>
            </div>
          </div>
          <button className="modal-backdrop" aria-label="close" onClick={() => setEdit((s) => ({ ...s, open: false }))} />
        </div>
      )}
    </div>
  );
}

