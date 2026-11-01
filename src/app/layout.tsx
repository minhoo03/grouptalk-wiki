import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/providers/AppProviders";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "GroupTalk Wiki",
  description: "그룹의 대화와 결정 사항을 정리하는 협업 위키",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
