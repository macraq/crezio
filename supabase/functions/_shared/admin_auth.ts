import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type AdminAuthResult = {
  userId: string;
  supabaseAdmin: ReturnType<typeof createClient>;
};

export async function requireAdmin(req: Request): Promise<AdminAuthResult> {
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) {
    throw new Error('unauthorized:no_token');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser(jwt);

  if (userError || !user) {
    throw new Error('unauthorized:invalid_session');
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error('forbidden:profile_lookup_failed');
  }

  if (profile?.account_type !== 'admin') {
    throw new Error('forbidden:not_admin');
  }

  return { userId: user.id, supabaseAdmin };
}

