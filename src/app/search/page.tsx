import type { Metadata } from "next";

import { PageEnter } from "@/components/site/PageEnter";
import { SearchScreen } from "@/screens/search/SearchScreen";
import { readSearchParam } from "@/utils/wikiRoutes";

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export const metadata: Metadata = {
  title: "검색 | 단톡위키",
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = readSearchParam((await searchParams).q);
  return (
    <PageEnter key={query}>
      <SearchScreen query={query} />
    </PageEnter>
  );
}
