import type { Metadata } from "next";
import { pageSocialMetadata } from "@/lib/site-metadata";
import FlightExperience from "./FlightExperience";

export const metadata: Metadata = {
  ...pageSocialMetadata("/whale-flight"),
  title: "고래들의 비상 — GOBIBI × SANG#MUNG",
  description: "대왕고래·혹등고래·향고래·범고래·상괭이, 다섯 종 백 마리가 서로를 피하고 무리를 지으며 깊은 고비비 하늘을 자유롭게 헤엄치는 실시간 3D 체험.",
};

export default function WhaleFlightPage() {
  return <FlightExperience />;
}
