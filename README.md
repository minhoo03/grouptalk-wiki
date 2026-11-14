# GroupTalk Wiki

그룹의 대화, 문서와 결정 사항을 정리하는 협업 위키 프로젝트다. 기존 React 보일러플레이트의 구조·설계 컨벤션을 유지하면서 Next.js App Router와 Supabase SSR 환경으로 변환했다.

## 기술 스택

- Next.js 16 App Router, React 19, TypeScript 5.9
- Supabase JS, `@supabase/ssr`
- TanStack Query 5, Zustand 5
- React Hook Form, Zod 4
- Tailwind CSS 4, shadcn/ui
- ESLint 9, pnpm

Next.js 16에서는 기존 Middleware가 `proxy.ts`로 변경됐다. Supabase는 브라우저와 서버 클라이언트를 분리하고 Proxy에서 cookie session을 갱신하는 공식 SSR 구성을 따른다.

근거: [Next.js 설치](https://nextjs.org/docs/app/getting-started/installation), [Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy), [Supabase SSR client 구성](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)

## 시작하기

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

개발 서버 기본 주소는 `http://localhost:3000`이다.

## Supabase 환경변수

Supabase Dashboard의 Connect 화면에서 프로젝트 URL과 publishable key를 확인해 `.env.local`에 입력한다.

```bash
SUPABASE_URL=
PUBLISHABLE_KEY=
```

두 값은 `NEXT_PUBLIC_`이 없어 서버에서만 읽힌다. 브라우저 Supabase client(`src/lib/supabase/client.ts`)를 쓰게 되면 두 값을 브라우저에 넘길 방법을 따로 정해야 한다. service role key나 secret key를 `NEXT_PUBLIC_` 변수에 넣지 않는다. 인증·권한은 Supabase RLS와 서버에서 검증한 claims를 기준으로 설계한다.

환경변수가 없는 초기 상태에서도 홈 화면과 빌드는 동작한다. Supabase client를 실제로 호출하기 전에는 두 값을 반드시 설정해야 한다.

## 주요 구조

```text
src/
├── app/
│   ├── layout.tsx             Root layout과 Provider 연결
│   └── page.tsx               route와 screen을 연결하는 얇은 진입점
├── lib/
│   └── supabase/
│       ├── client.ts          Client Component용 browser client
│       ├── server.ts          Server Component·Action·Route용 server client
│       ├── proxy.ts           cookie session 갱신
│       └── env.ts             환경변수 경계
├── providers/
│   ├── AppProviders.tsx
│   └── QueryProvider.tsx
├── screens/
│   └── home/
│       └── HomeScreen.tsx
├── styles/
│   └── globals.css
├── utils/
│   └── cn.ts
└── proxy.ts                   Next.js 16 Proxy 진입점
```

`app`은 route와 Next.js 경계를 소유하고, 실제 화면 구현은 `screens`에 둔다. 상호작용이 필요한 가장 작은 경계에만 `"use client"`를 사용한다.

## 스크립트

| 명령어           | 설명                             |
| ---------------- | -------------------------------- |
| `pnpm dev`       | Next.js 개발 서버 실행           |
| `pnpm typecheck` | TypeScript 정적 검사             |
| `pnpm lint`      | ESLint 검사                      |
| `pnpm build`     | 프로덕션 빌드                    |
| `pnpm start`     | 빌드 결과 실행                   |
| `pnpm check`     | 타입 검사, lint와 빌드 통합 검증 |

현재 테스트 도구는 설치되어 있지 않다. 도입할 때는 `docs/dev-guidelines/TEST_DESIGN_DIALOGUE.md`로 범위를 먼저 합의하고, 함수·컴포넌트에는 Vitest와 Testing Library, 브라우저 흐름에는 Playwright를 기본 후보로 검토한다.

## 컨벤션

- AI 작업 진입점: [CLAUDE.md](./CLAUDE.md), [AGENTS.md](./AGENTS.md)
- 전체 컨벤션 지도: [docs/CONVENTIONS.md](./docs/CONVENTIONS.md)
- 문제 정의와 설계 검증: [문제 해결 컨벤션](./docs/dev-guidelines/ENGINEERING_PROBLEM_SOLVING.md)
- 구조와 코드 소유권: [프로젝트 구조 가이드](./docs/dev-guidelines/FRONTEND-PROJECT-STRUCTURE-GUIDE.md)
- 컴포넌트와 import: [컴포넌트 코딩 가이드](./docs/dev-guidelines/FRONTEND-COMPONENT-CODING-GUIDE.md)
- 상태·React 원리·오류·타입·품질: [React 애플리케이션 컨벤션](./docs/dev-guidelines/REACT-APPLICATION-CONVENTIONS.md)
- AI와 함께하는 테스트 범위 결정: [테스트 설계 대화](./docs/dev-guidelines/TEST_DESIGN_DIALOGUE.md)
- Playwright 실패 증거와 AI 검증: [웹 테스트 실패 증거](./docs/dev-guidelines/WEB_TEST_FAILURE_EVIDENCE.md)

GitHub 저장소는 [`minhoo03/grouptalk-wiki`](https://github.com/minhoo03/grouptalk-wiki)이며, 기본 브랜치는 `main`이다.
