import type { Metadata } from "next";
import { pageSocialMetadata } from "@/lib/site-metadata";
import FlightExperience from "./FlightExperience";

export const metadata: Metadata = {
  ...pageSocialMetadata("/whale-flight"),
  title: "고래들의 비상 — GOBIBI × SANG#MUNG",
  description: "고비비의 하늘에서 흰수염고래 무리가 자유롭게 날아오릅니다. 실시간 3D 고래 비행 체험.",
};

export default function WhaleFlightPage() {
  return <FlightExperience />;
}
