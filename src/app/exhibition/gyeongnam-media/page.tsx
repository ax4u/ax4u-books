import type { Metadata } from 'next';
import GobibiShell from '@/app/components/gobibi/GobibiShell';
import Celebration from './Celebration';

export const metadata: Metadata = {
  title: '경남시청자미디어센터 AI 에이전트 활용 플립북(디지털그림책) 만들기 | GOBIBI',
  description: '우리의 이야기가 책이 된 날. 경남시청자미디어센터 수강생들의 디지털그림책 출판을 축하합니다. 완성된 플립북 9권과 표지 전시 3작품을 만나보세요.',
  alternates: { canonical: 'https://gobibi.art/exhibition/gyeongnam-media' },
};

export default function GyeongnamMediaPage() {
  return <GobibiShell theme="cream"><Celebration /></GobibiShell>;
}
