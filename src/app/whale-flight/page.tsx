import type { Metadata } from "next";
import { pageSocialMetadata } from "@/lib/site-metadata";
import FlightExperience from "./FlightExperience";

export const metadata: Metadata = {
  ...pageSocialMetadata("/whale-flight"),
  title: "고래들의 비상 — GOBIBI × SANG#MUNG",
  description: "대왕고래부터 큰돌고래까지, 서로 다른 고래류 10종이 고비비 하늘을 헤엄칩니다. 실시간 3D 비행과 동일 축척 크기 비교.",
};

export default function WhaleFlightPage() {
  return <FlightExperience />;
}
