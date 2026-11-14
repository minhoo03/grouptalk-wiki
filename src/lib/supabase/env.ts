/**
 * NEXT_PUBLIC_이 없는 이름이라 서버에서만 읽힌다. 브라우저 bundle에서는 비어 있으므로
 * client.ts(브라우저 client)를 실제로 쓰게 되면 값을 넘길 방법을 따로 정해야 한다.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.PUBLISHABLE_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getSupabaseEnv() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase 환경변수가 없습니다. .env.example을 참고해 SUPABASE_URL과 PUBLISHABLE_KEY를 설정하세요.",
    );
  }

  return {
    url: supabaseUrl,
    publishableKey: supabasePublishableKey,
  };
}
