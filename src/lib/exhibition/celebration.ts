// Live user follow-up: display 옥주완 as 옥주완 (옥수수); included by coordinator during this release.
export const celebrationNames = ['옥주완 (옥수수)', '성시아 & 성지아', '김도연', '정하윤 & 정윤서'] as const;

// Four user-supplied attachments explicitly approved for this celebration only.
// This does not restore the withdrawn planet-friends reader/catalog/originals.
export const celebrationArtwork = [
  { src: '/celebration-art/attachment-1.webp', width: 1722, height: 913, title: '수수의 팝콘 가게', author: '옥주완 (옥수수)' },
  { src: '/celebration-art/attachment-2.webp', width: 1721, height: 914, title: '행성 친구들의 우당당탕 여행', author: '성시아 & 성지아' },
  { src: '/celebration-art/attachment-3.webp', width: 1254, height: 1254, title: '후추&베리', author: '정하윤 & 정윤서' },
  { src: '/celebration-art/attachment-4.webp', width: 1200, height: 1200, title: '보리의 첫 물놀이', author: '김도연' },
];

export const celebrationMusic = {
  src: '/audio/celebration/mozart-k545-musopen.mp3',
  title: 'Mozart · Piano Sonata No. 16, K.545 — I. Allegro',
  credit: 'Musopen',
  source: 'https://commons.wikimedia.org/wiki/File:Wolfgang_Amadeus_Mozart_-_sonata_no._16_in_c_major,_k.545_%27sonata_facile%27_-_i._allegro.ogg',
  license: 'Public domain · Musopen / Wikimedia Commons (VRT 2008012110017088)',
};
