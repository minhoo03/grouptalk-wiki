import { PageEnter } from "@/components/site/PageEnter";
import { PersonScreen } from "@/screens/person/PersonScreen";
import { readSearchParam } from "@/utils/wikiRoutes";

type SharedPersonPageProps = {
  searchParams: Promise<{ name?: string | string[] }>;
};

/**
 * 공유된 문서의 인물 문서. 데이터는 `/s/[code]` layout이 준비한다.
 * 인물 이름을 메신저 미리보기로 보내지 않도록 title은 layout 값을 그대로 쓴다.
 */
export default async function SharedPersonPage({
  searchParams,
}: SharedPersonPageProps) {
  const name = readSearchParam((await searchParams).name);
  return (
    <PageEnter key={name}>
      <PersonScreen name={name} />
    </PageEnter>
  );
}
