type HomeScreenProps = {
  isSupabaseConfigured: boolean;
};

export function HomeScreen({ isSupabaseConfigured }: HomeScreenProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
      <div className="max-w-3xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Next.js + Supabase starter
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            GroupTalk Wiki
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            그룹의 대화와 결정 사항을 정리하는 위키를 만들기 위한 기본
            프로젝트입니다. 화면, 데이터 경계와 설계 근거를 함께 관리합니다.
          </p>
        </div>

        <section
          aria-labelledby="setup-status"
          className="rounded-2xl border bg-card p-6 text-card-foreground shadow-sm"
        >
          <h2 id="setup-status" className="text-lg font-semibold">
            Supabase 연결 상태
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isSupabaseConfigured
              ? "환경변수가 설정되었습니다. 이제 인증과 데이터 스키마를 연결할 수 있습니다."
              : ".env.example을 .env.local로 복사하고 Supabase URL과 publishable key를 입력하세요."}
          </p>
        </section>
      </div>
    </main>
  );
}
