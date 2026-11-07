import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * secret key로 RLS를 우회하는 서버 전용 client.
 * Server Component·Server Action에서만 import한다. SUPABASE_SECRET_KEY는 NEXT_PUBLIC_이 아니므로 브라우저 bundle에서는 비어 있다.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY 환경변수가 없습니다. .env.example을 참고해 서버 전용 secret key를 설정하세요.",
    );
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
