import { corsHeaders } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/admin_auth.ts';

type Body = {
  influencer_id?: string;
  followers_count?: number | null;
  engagement_rate?: number | null;
  is_premium?: boolean;
  last_verified_at?: string | null;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: 'Nieprawidłowy JSON' }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  const influencerId = body.influencer_id?.trim();
  if (!influencerId || !isUuid(influencerId)) {
    return new Response(JSON.stringify({ error: 'influencer_id is required (uuid)' }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userId, supabaseAdmin } = await requireAdmin(req);

    const patch: Record<string, unknown> = {};
    if ('followers_count' in body) patch.followers_count = body.followers_count;
    if ('engagement_rate' in body) patch.engagement_rate = body.engagement_rate;
    if ('is_premium' in body) patch.is_premium = body.is_premium;
    if ('last_verified_at' in body) patch.last_verified_at = body.last_verified_at;

    if (Object.keys(patch).length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    if (typeof patch.followers_count === 'number' && patch.followers_count < 0) {
      return new Response(JSON.stringify({ error: 'followers_count must be >= 0' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
    if (typeof patch.engagement_rate === 'number' && (patch.engagement_rate < 0 || patch.engagement_rate > 1)) {
      return new Response(JSON.stringify({ error: 'engagement_rate must be in [0,1]' }), {
        status: 400,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('influencer_profiles')
      .update(patch)
      .eq('profile_id', influencerId)
      .select('profile_id,followers_count,engagement_rate,is_premium,last_verified_at,updated_at')
      .maybeSingle();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: userId,
      actor_type: 'admin',
      action: 'influencer.metrics_override',
      entity_type: 'influencer_profiles',
      entity_id: influencerId,
    });

    return new Response(JSON.stringify({ ok: true, data: updated }), {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    const status =
      msg.startsWith('unauthorized:') ? 401 : msg.startsWith('forbidden:') ? 403 : 500;
    const error =
      msg === 'unauthorized:no_token'
        ? 'Brak tokena. Zaloguj się.'
        : msg === 'forbidden:not_admin'
          ? 'Brak uprawnień admina.'
          : 'Błąd serwera.';
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});

