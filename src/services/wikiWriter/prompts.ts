import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * prompts/ 폴더의 Markdown 지시문을 읽는다. 구조와 규칙은 prompts/README.md를 따른다.
 * 서버 전용. 배포 시 이 폴더가 함께 포함되도록 next.config.ts의 outputFileTracingIncludes에 등록했다.
 */

const PROMPT_DIR = path.join(
  process.cwd(),
  "src",
  "services",
  "wikiWriter",
  "prompts",
);

export type DocumentPrompts = {
  /** _document.md */
  document: string;
  /** 섹션 key → 섹션 지시문. 파일이 있는 섹션만 LLM이 쓴다. */
  sections: Map<string, string>;
};

export type WikiPrompts = {
  style: string;
  room: DocumentPrompts;
  person: DocumentPrompts;
};

async function readText(...segments: string[]) {
  return (await readFile(path.join(PROMPT_DIR, ...segments), "utf8")).trim();
}

async function readDocumentPrompts(folder: string): Promise<DocumentPrompts> {
  const files = await readdir(path.join(PROMPT_DIR, folder));
  const sectionFiles = files.filter(
    (file) => file.endsWith(".md") && !file.startsWith("_"),
  );
  const sections = new Map<string, string>();
  for (const file of sectionFiles) {
    sections.set(file.slice(0, -".md".length), await readText(folder, file));
  }
  return { document: await readText(folder, "_document.md"), sections };
}

async function readPrompts(): Promise<WikiPrompts> {
  const [style, room, person] = await Promise.all([
    readText("style.md"),
    readDocumentPrompts("room"),
    readDocumentPrompts("person"),
  ]);
  return { style, room, person };
}

let cached: Promise<WikiPrompts> | null = null;

/** 운영에서는 한 번만 읽고, 개발 중에는 Markdown 수정이 바로 반영되도록 매번 읽는다. */
export function loadPrompts(): Promise<WikiPrompts> {
  if (process.env.NODE_ENV === "development") return readPrompts();
  cached ??= readPrompts().catch((error: unknown) => {
    cached = null;
    throw error;
  });
  return cached;
}
