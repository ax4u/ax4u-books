import type { Metadata } from 'next';
import Celebration from './Celebration';
import { celebrationArtwork, celebrationMusic, celebrationNames } from '@/lib/exhibition/celebration';

export const metadata: Metadata = {
  title: '그림책 출판을 축하합니다 | GOBIBI',
  description: '옥주완, 성시아 & 성지아, 김도연, 정하윤 & 정윤서의 그림책 출판을 함께 축하합니다.',
  alternates: { canonical: 'https://gobibi.art/exhibition/celebration' },
};

export default function CelebrationPage() {
  return <Celebration names={[...celebrationNames]} artwork={celebrationArtwork} music={celebrationMusic} />;
}
