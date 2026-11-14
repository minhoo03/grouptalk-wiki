"use client";

import Link from "next/link";
import { useState } from "react";

import type { PersonProfile } from "@/types/chat";
import { personPath } from "@/utils/wikiRoutes";
import { PixelAvatar } from "@/components/wiki/PixelAvatar";

type MemberNavboxProps = {
  roomTitle: string;
  people: PersonProfile[];
  currentName?: string;
};

export function MemberNavbox({
  roomTitle,
  people,
  currentName,
}: MemberNavboxProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-[6px] border-2 border-namu">
      <p className="bg-namu px-4 py-2.5 text-center font-pixel text-lg text-white">
        {roomTitle} 등장인물
      </p>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="w-full border-b border-line py-1.5 text-center text-sm font-bold text-ink hover:bg-paper"
      >
        [ 펼치기 · 접기 ]
      </button>
      {isOpen && (
        <ul className="grid grid-cols-2 sm:grid-cols-4">
          {people.map((person) => {
            const isCurrent = person.name === currentName;
            return (
              <li key={person.name} className="border-r border-b border-line">
                <Link
                  href={personPath(person.name)}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`flex w-full flex-col items-center gap-1.5 px-2 py-3 transition-colors duration-150 ${isCurrent ? "bg-paper" : "hover:bg-paper"}`}
                >
                  <PixelAvatar name={person.name} size="sm" />
                  <span
                    className={`text-sm ${isCurrent ? "font-bold text-ink" : "text-link"}`}
                  >
                    {person.name}
                  </span>
                  <span className="text-xs text-subtle">
                    {person.badges[0]?.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
