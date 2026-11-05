import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

// Brand fonts for every composition. Change them together with components/video-kit/brand.ts.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--vk-display", weight: ["500", "600", "700", "800"] });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--vk-body", weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--vk-mono", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Video stage",
  robots: { index: false, follow: false },
};

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable} ${mono.variable}`}>{children}</div>;
}
