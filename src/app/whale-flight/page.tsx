import type { Metadata } from "next";
import { pageSocialMetadata, SITE_ORIGIN } from "@/lib/site-metadata";
import FlightExperience from "./FlightExperience";

const title = "고래들의 비상 — GOBIBI × SANG#MUNG";
const description = "대왕고래·혹등고래·향고래·범고래·상괭이, 다섯 종 백 마리가 서로를 피하고 무리를 지으며 깊은 고비비 하늘을 자유롭게 헤엄치는 실시간 3D 체험.";
const social = pageSocialMetadata("/whale-flight");
const image = {
  url: `${SITE_ORIGIN}/social/whale-flight-keyvisual-v1.jpg`,
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "고래들의 비상 — 황금빛 구름과 하늘섬 위로 고래 무리가 자유롭게 비상하는 실제 3D 체험 장면",
};

export const metadata: Metadata = {
  ...social,
  title,
  description,
  openGraph: {
    ...social.openGraph,
    title,
    description,
    images: [image],
  },
  twitter: {
    ...social.twitter,
    title,
    description,
    images: [{ url: image.url, alt: image.alt }],
  },
};

export default function WhaleFlightPage() {
  return <FlightExperience />;
}
