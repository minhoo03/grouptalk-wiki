import type { Metadata } from "next";

import { PageEnter } from "@/components/site/PageEnter";
import { PersonScreen } from "@/screens/person/PersonScreen";
import { readSearchParam } from "@/utils/wikiRoutes";

type PersonPageProps = {
  searchParams: Promise<{ name?: string | string[] }>;
};

export async function generateMetadata({
  searchParams,
}: PersonPageProps): Promise<Metadata> {
  const name = readSearchParam((await searchParams).name);
  return { title: name ? `${name} | 단톡위키` : "단톡위키" };
}

export default async function PersonPage({ searchParams }: PersonPageProps) {
  const name = readSearchParam((await searchParams).name);
  // 인물만 바뀌어도 원본처럼 문서 상태(펼침·별표·열람 시각)를 초기화하고 전환 효과를 다시 실행한다.
  return (
    <PageEnter key={name}>
      <PersonScreen name={name} />
    </PageEnter>
  );
}
