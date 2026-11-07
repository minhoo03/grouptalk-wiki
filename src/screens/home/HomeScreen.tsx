import { DocHeader } from "@/components/wiki/DocHeader";
import { TableOfContents } from "@/components/wiki/TableOfContents";
import { WikiNotice } from "@/components/wiki/WikiNotice";
import { WikiSection } from "@/components/wiki/WikiSection";
import { ChatUploadPanel } from "./components/ChatUploadPanel";

const TOC = [
  { id: "h-1", number: "1", title: "개요" },
  { id: "h-2", number: "2", title: "대화 내보내는 법" },
  { id: "h-3", number: "3", title: "문서에 기록되는 것" },
  { id: "h-4", number: "4", title: "개인정보" },
];

export function HomeScreen() {
  return (
    <>
      <DocHeader
        title="단톡위키:대문"
        categories={[{ label: "단톡위키" }, { label: "대문" }]}
      />

      <div className="mt-5 space-y-3">
        <WikiNotice kind="lock">
          이 문서는 보호되어 있습니다. 대신 아래에 대화를 올리면 여러분만의
          문서가 생성됩니다.
        </WikiNotice>
      </div>

      <ChatUploadPanel />

      <div className="mt-10">
        <TableOfContents items={TOC} />
      </div>

      <WikiSection id="h-1" number="1" title="개요">
        <p>
          <b>단톡위키</b>는 친구들과 나눈 카카오톡 대화를 바탕으로 문서를 작성해
          주는 위키다. 대화 파일을 올리면 단톡방 문서 하나와 구성원별 인물
          문서가 생성되며, 각 인물의 발언량, 말버릇, 활동 시간대 등이 기록된다.{" "}
          <del>친구의 흑역사가 영구 박제될 수 있으니 주의</del>
        </p>
      </WikiSection>

      <WikiSection id="h-2" number="2" title="대화 내보내는 법">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            <b>PC 카카오톡</b> — 채팅방 우측 상단 메뉴(≡) → <b>대화 내용</b> →{" "}
            <b>대화 내보내기</b> → .csv 파일로 저장
          </li>
          <li>
            저장된 파일은 보통{" "}
            <code className="rounded-[4px] bg-paper px-1">
              KakaoTalk_Chat_방이름_날짜.csv
            </code>{" "}
            형태이며, 파일명에서 단톡방 이름을 읽어 온다.
          </li>
          <li>
            Date, User, Message 열로 이루어진 CSV라면 다른 방식으로 만든 파일도
            인식된다. <del>기존 .txt 파일도 몰래 지원한다</del>
          </li>
          <li>저장한 .csv 파일을 위 상자에 올리면 끝.</li>
        </ul>
      </WikiSection>

      <WikiSection id="h-3" number="3" title="문서에 기록되는 것">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>
            특징: 발언량, 웃음 빈도, 야행성, 메시지 길이, 질문 빈도를 구성원끼리
            비교
          </li>
          <li>별명: 단톡방의 실세, 리액션 담당, 새벽 출몰러, 눈팅족 등</li>
          <li>어록: 자주 반복하는 말과 가장 긴 메시지</li>
          <li>인간관계: 누구의 말을 가장 자주 받아 주는지</li>
        </ul>
      </WikiSection>

      <WikiSection id="h-4" number="4" title="개인정보">
        <p>
          올린 대화는 지금 보고 있는 브라우저 안에서 분석되며, 원본 파일은
          서버로 전송되지 않는다. 다만 문서 서술을 AI(Google Gemini)가 쓰도록
          계산된 통계와 <b>일부 대표 발언(최대 300개)</b>을 서버를 거쳐 AI에
          보낸다. 단톡방 문서에서 <b>공유</b>를 누른 경우에만 완성된 문서가
          암호화되어 서버에 저장되고, 링크를 만든 지 1일이 지나면 자동으로
          삭제된다.
        </p>
      </WikiSection>
    </>
  );
}
