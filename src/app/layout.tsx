import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/site/Sidebar";
import { SiteHeader } from "@/components/site/SiteHeader";
import { AppProviders } from "@/providers/AppProviders";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "단톡위키",
  description: "카카오톡 단톡방 대화를 나무위키 스타일 문서로 정리하는 위키",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>
        <AppProviders>
          <div className="min-h-screen w-full bg-paper text-ink">
            <SiteHeader />
            <div className="mx-auto grid max-w-[1320px] gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <main className="min-w-0 rounded-[6px] border-2 border-ink bg-white px-5 py-7 shadow-[5px_5px_0_0_#1E2A28] md:px-9 md:py-9">
                {children}
              </main>
              <Sidebar />
            </div>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
