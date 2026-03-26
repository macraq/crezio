// POST: zwraca redirect_url do OAuth providera. Wywołanie z frontu z Authorization: Bearer <session.access_token>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getProviderConfig } from '../_shared/provider_config.ts';
import type { OAuthProvider } from '../_shared/provider_config.ts';

const PROVIDERS: OAuthProvider[] = ['instagram', 'youtube', 'tiktok', 'facebook', 'twitch', 'x'];

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('Origin')) });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Brak tokena. Zaloguj się.' }), {
      status: 401,
      headers: { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' },
    });
  }

  let body: { provider?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Nieprawidłowy JSON' }), {
      status: 400,
      headers: { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' },
    });
  }

  const provider = (body?.provider ?? '').toLowerCase() as OAuthProvider;
  if (!PROVIDERS.includes(provider)) {
    return new Response(JSON.stringify({ error: 'Nieobsługiwany provider' }), {
      status: 400,
      headers: { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' },
    });
  }

  const config = getProviderConfig(provider);
  if (!config) {
    return new Response(
      JSON.stringify({ error: `OAuth dla ${provider} nie jest skonfigurowany (brak client_id/secret w env).` }),
      {
        status: 503,
        headers: { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' },
      }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Sesja nieprawidłowa lub wygasła.' }), {
      status: 401,
      headers: { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' },
    });
  }

  const callbackUrl = `${supabaseUrl}/functions/v1/oauth-callback`;
  const state = crypto.randomUUID();

  let codeVerifier: string | null = null;
  if (config.usePkce) {
    const array = new Uint8Array(64);
    crypto.getRandomValues(array);
    codeVerifier = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 64);
  }

  const { error: insertError } = await supabase.from('oauth_states').insert({
    state,
    profile_id: user.id,
    provider,
    ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: 'Nie udało się utworzyć sesji OAuth.' }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' },
    });
  }

  const clientId = Deno.env.get(config.clientIdEnv)!;
  const scope = config.scopes.join(
    provider === 'youtube' || provider === 'twitch' || provider === 'x' ? ' ' : ','
  );
  const clientIdKey = config.authClientIdKey ?? 'client_id';
  const params: Record<string, string> = {
    [clientIdKey]: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope,
    state,
    ...(provider === 'youtube' ? { access_type: 'offline', prompt: 'consent' } : {}),
  };
  if (config.usePkce && codeVerifier) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(codeVerifier)
    );
    const hash = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    params.code_challenge = hash;
    params.code_challenge_method = 'S256';
  }
  const redirectUrl = `${config.authUrl}?${new URLSearchParams(params).toString()}`;

  return new Response(JSON.stringify({ redirect_url: redirectUrl }), {
    status: 200,
    headers: { ...corsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' },
  });
});
