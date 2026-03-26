import { corsHeaders } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/admin_auth.ts';

type Body = {
  campaign_id?: string;
  status?: 'draft' | 'active' | 'applications_closed' | 'ended';
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

  const campaignId = body.campaign_id?.trim();
  const status = body.status;
  if (!campaignId || !isUuid(campaignId)) {
    return new Response(JSON.stringify({ error: 'campaign_id is required (uuid)' }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
  if (!status) {
    return new Response(JSON.stringify({ error: 'status is required' }), {
      status: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userId, supabaseAdmin } = await requireAdmin(req);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('campaigns')
      .update({ status })
      .eq('id', campaignId)
      .select('id,status,updated_at')
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
      action: 'campaign.status_update',
      entity_type: 'campaigns',
      entity_id: campaignId,
    });

    return new Response(JSON.stringify({ ok: true, data: updated }), {
      status: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    const statusCode =
      msg.startsWith('unauthorized:') ? 401 : msg.startsWith('forbidden:') ? 403 : 500;
    const error =
      msg === 'unauthorized:no_token'
        ? 'Brak tokena. Zaloguj się.'
        : msg === 'forbidden:not_admin'
          ? 'Brak uprawnień admina.'
          : 'Błąd serwera.';
    return new Response(JSON.stringify({ error }), {
      status: statusCode,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});

