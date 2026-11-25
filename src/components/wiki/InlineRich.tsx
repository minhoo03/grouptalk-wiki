import { Fragment } from "react";

import { useWikiRoutes } from "@/hooks/useWikiRoutes";
import type { Rich } from "@/types/wiki";
import { FootnoteRef } from "@/components/wiki/FootnoteRef";
import { WikiLink } from "@/components/wiki/WikiLink";

type InlineRichProps = {
  content: Rich;
};

export function InlineRich({ content }: InlineRichProps) {
  const routes = useWikiRoutes();

  return (
    <>
      {content.map((part, index) => {
        if (typeof part === "string")
          return <Fragment key={index}>{part}</Fragment>;

        switch (part.t) {
          case "b":
            return <b key={index}>{part.text}</b>;
          case "del":
            return <del key={index}>{part.text}</del>;
          case "muted":
            return (
              <span key={index} className="text-subtle">
                {part.text}
              </span>
            );
          case "link":
            return (
              <WikiLink key={index} href={routes.person(part.name)}>
                {part.name}
              </WikiLink>
            );
          case "anchor":
            return (
              <a
                key={index}
                href={`#${part.id}`}
                className="text-link hover:underline"
              >
                {part.text}
              </a>
            );
          case "fn":
            return <FootnoteRef key={index} n={part.n} />;
        }
      })}
    </>
  );
}
