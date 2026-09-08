import type { Metadata } from "next";
import GobibiShell from "@/app/components/gobibi/GobibiShell";
import { pageSocialMetadata } from "@/lib/site-metadata";
import MyWhaleExperience from "./MyWhaleExperience";

export const metadata: Metadata = {
  ...pageSocialMetadata("/my-whale"),
  title: "나의 고래 — 너의 이름으로 시작되는 하늘 | GOBIBI",
  description: "이름을 붙이고, 한 줄을 건네고, 함께 유영해요. 이 브라우저에 머무는 작은 고래 친구, 고비비 나의 고래 무료 베타.",
  alternates: { canonical: "/my-whale" },
};

export default function MyWhalePage() {
  return <GobibiShell theme="cream"><MyWhaleExperience /></GobibiShell>;
}
