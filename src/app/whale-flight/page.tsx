import type { Metadata } from "next";
import { pageSocialMetadata, SITE_ORIGIN } from "@/lib/site-metadata";
import FlightExperience from "./FlightExperience";

const title = "고래들의 비상 — GOBIBI × SANG#MUNG";
const description = "대왕고래·혹등고래·향고래·범고래와 상괭이 한 마리, 총 열한 마리가 저마다 다른 속도와 유려한 곡선 코스로 구름 사이를 자유롭게 유영하는 고비비 실시간 3D 체험.";
const social = pageSocialMetadata("/whale-flight");
const image = {
  url: `${SITE_ORIGIN}/social/whale-flight-close-v3.jpg`,
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "고래들의 비상 — 상괭이를 포함한 다섯 마리 고래가 황금빛 구름 위를 우아하게 유영하는 키비주얼 일러스트",
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
