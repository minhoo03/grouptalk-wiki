import { NotFoundDocument } from "@/components/wiki/NotFoundDocument";

type SearchScreenProps = {
  query: string;
};

/** header 검색이 어떤 문서와도 맞지 않을 때 이동하는 "없는 문서" 화면 */
export function SearchScreen({ query }: SearchScreenProps) {
  return <NotFoundDocument query={query} />;
}
