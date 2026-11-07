import { Fragment } from "react";

import type { Rich } from "@/types/wiki";
import { personPath } from "@/utils/wikiRoutes";
import { FootnoteRef } from "./FootnoteRef";
import { WikiLink } from "./WikiLink";

type InlineRichProps = {
  content: Rich;
};

export function InlineRich({ content }: InlineRichProps) {
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
              <WikiLink key={index} href={personPath(part.name)}>
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
