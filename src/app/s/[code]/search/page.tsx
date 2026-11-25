import { PageEnter } from "@/components/site/PageEnter";
import { SearchScreen } from "@/screens/search/SearchScreen";
import { readSearchParam } from "@/utils/wikiRoutes";

type SharedSearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

/** 공유된 문서 안에서 검색어가 어떤 문서와도 맞지 않을 때 */
export default async function SharedSearchPage({
  searchParams,
}: SharedSearchPageProps) {
  const query = readSearchParam((await searchParams).q);
  return (
    <PageEnter key={query}>
      <SearchScreen query={query} />
    </PageEnter>
  );
}
