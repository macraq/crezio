import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface AuthRedirectProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  redirectTo: string;
}

export default function AuthRedirect({ supabaseUrl, supabaseAnonKey, redirectTo }: AuthRedirectProps) {
  useEffect(() => {
    if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      if (window.location.pathname === redirectTo) return;
      window.location.replace(redirectTo);
    });
  }, [supabaseUrl, supabaseAnonKey, redirectTo]);

  return null;
}
