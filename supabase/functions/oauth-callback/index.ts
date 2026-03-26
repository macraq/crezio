// GET: callback z OAuth providera (code, state). Wymiana code→token, zapis do social_oauth_connections, redirect do app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getProviderConfig } from '../_shared/provider_config.ts';
import type { OAuthProvider } from '../_shared/provider_config.ts';

const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:4321';
const PROVIDERS: OAuthProvider[] = ['instagram', 'youtube', 'tiktok', 'facebook', 'twitch', 'x'];

function redirectToApp(path: string, params: Record<string, string>) {
  const url = new URL(path, APP_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return Response.redirect(url.toString(), 302);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return redirectToApp('/settings', { oauth_error: errorParam, oauth_message: url.searchParams.get('error_description') || 'Anulowano lub błąd autoryzacji.' });
  }

  if (!code || !state) {
    return redirectToApp('/settings', { oauth_error: 'missing_params' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: stateRow, error: stateError } = await supabase
    .from('oauth_states')
    .select('profile_id, provider, code_verifier')
    .eq('state', state)
    .single();

  if (stateError || !stateRow) {
    return redirectToApp('/settings', { oauth_error: 'invalid_state' });
  }

  const provider = stateRow.provider as OAuthProvider;
  if (!PROVIDERS.includes(provider)) {
    await supabase.from('oauth_states').delete().eq('state', state);
    return redirectToApp('/settings', { oauth_error: 'unknown_provider' });
  }

  const config = getProviderConfig(provider);
  if (!config) {
    await supabase.from('oauth_states').delete().eq('state', state);
    return redirectToApp('/settings', { oauth_error: 'provider_not_configured' });
  }

  const callbackUrl = `${supabaseUrl}/functions/v1/oauth-callback`;
  const clientId = Deno.env.get(config.clientIdEnv)!;
  const clientSecret = Deno.env.get(config.clientSecretEnv)!;

  let tokenRes: Response;
  if (config.usePkce && provider === 'x') {
    const codeVerifier = (stateRow as { code_verifier?: string }).code_verifier;
    if (!codeVerifier) {
      await supabase.from('oauth_states').delete().eq('state', state);
      return redirectToApp('/settings', { oauth_error: 'invalid_state' });
    }
    const tokenBody: Record<string, string> = {
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl,
      code_verifier: codeVerifier,
    };
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams(tokenBody).toString(),
    });
  } else {
    const tokenBody: Record<string, string> = {
      ...(provider === 'tiktok' ? { client_key: clientId } : { client_id: clientId }),
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    };
    tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenBody).toString(),
    });
  }

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Token exchange failed', provider, tokenRes.status, errText);
    await supabase.from('oauth_states').delete().eq('state', state);
    return redirectToApp('/settings', { oauth_error: 'token_exchange_failed' });
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token || null;
  let expiresAt: string | null = null;
  if (tokenData.expires_in) {
    const exp = new Date(Date.now() + tokenData.expires_in * 1000);
    expiresAt = exp.toISOString();
  }

  if (!accessToken) {
    await supabase.from('oauth_states').delete().eq('state', state);
    return redirectToApp('/settings', { oauth_error: 'no_access_token' });
  }

  let username: string | null = null;
  let externalUserId: string | null = null;
  if (provider === 'youtube' && accessToken) {
    try {
      const meRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        const channel = me?.items?.[0];
        if (channel) {
          externalUserId = channel.id;
          username = channel.snippet?.title || channel.snippet?.customUrl || null;
        }
      }
    } catch (_) {
      // optional
    }
  }
  if (provider === 'instagram' && accessToken) {
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
      );
      if (meRes.ok) {
        const me = await meRes.json();
        const page = me?.data?.[0];
        if (page) {
          const igRes = await fetch(
            `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
          );
          if (igRes.ok) {
            const ig = await igRes.json();
            const igAccountId = ig?.instagram_business_account?.id;
            if (igAccountId) {
              externalUserId = igAccountId;
              const profileRes = await fetch(
                `https://graph.instagram.com/v18.0/${igAccountId}?fields=username&access_token=${accessToken}`
              );
              if (profileRes.ok) {
                const profile = await profileRes.json();
                username = profile?.username || null;
              }
            }
          }
        }
      }
    } catch (_) {
      // optional
    }
  }
  if (provider === 'tiktok' && accessToken) {
    try {
      const meRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,username', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        const user = me?.data?.user;
        if (user) {
          externalUserId = user.open_id || null;
          username = user.username || null;
        }
      }
    } catch (_) {
      // optional
    }
  }
  if (provider === 'facebook' && accessToken) {
    try {
      const meRes = await fetch(
        `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${accessToken}`
      );
      if (meRes.ok) {
        const me = await meRes.json();
        externalUserId = me?.id || null;
        username = me?.name || null;
      }
    } catch (_) {
      // optional
    }
  }
  if (provider === 'twitch' && accessToken) {
    try {
      const meRes = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': clientId,
        },
      });
      if (meRes.ok) {
        const json = await meRes.json();
        const user = json?.data?.[0];
        if (user) {
          externalUserId = user.id || null;
          username = user.login || user.display_name || null;
        }
      }
    } catch (_) {
      // optional
    }
  }
  if (provider === 'x' && accessToken) {
    try {
      const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=username', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meRes.ok) {
        const json = await meRes.json();
        const user = json?.data;
        if (user) {
          externalUserId = user.id || null;
          username = user.username || user.name || null;
        }
      }
    } catch (_) {
      // optional
    }
  }

  const { error: upsertError } = await supabase.from('social_oauth_connections').upsert(
    {
      profile_id: stateRow.profile_id,
      provider,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      external_user_id: externalUserId,
      username,
      scopes: config.scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,provider' }
  );

  await supabase.from('oauth_states').delete().eq('state', state);

  if (upsertError) {
    console.error('Upsert social_oauth_connections failed', upsertError);
    return redirectToApp('/settings', { oauth_error: 'save_failed' });
  }

  return redirectToApp('/settings', { oauth_connected: provider });
});
