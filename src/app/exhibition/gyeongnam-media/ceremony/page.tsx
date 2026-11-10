import type { Metadata } from 'next';
import Ceremony from './Ceremony';

export const metadata: Metadata = {
  title: '그림책 완성 축하 세레머니 | 경남시청자미디어센터 · GOBIBI',
  description: '여러분의 그림책 완성을 축하드립니다. 함께 만든 12작품의 표지와 빵빠레로 만나는 축하의 순간.',
  alternates: { canonical: 'https://gobibi.art/exhibition/gyeongnam-media/ceremony' },
};

export default function CeremonyPage() { return <Ceremony />; }
