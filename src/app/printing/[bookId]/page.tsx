import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { lookupPrintBinding, type MappingDatabase, type PreparedBinding } from '@/lib/printing/mapping';
import { providerConfig } from '@/lib/printing/server';
import QuotePanel from './QuotePanel';

export const dynamic = 'force-dynamic';
export default async function PrintingPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const db = await createSupabaseServerClient();
  if (!db) redirect('/login');
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) redirect('/login');
  const { data: book, error } = await db.from('books').select('id,user_id,title,topic,status,options').eq('id', bookId).eq('user_id', auth.user.id).maybeSingle();
  if (error || !book || book.status !== 'completed') notFound();
  let mapping: PreparedBinding | null = null;
  let providerReady = false;
  let environment = '설정 확인 필요';
  let reason = '인쇄 규격과 검수 완료된 표지·내지 PDF의 공급사 연결이 필요합니다.';
  try {
    const config = providerConfig();
    environment = config.environment;
    providerReady = config.enabled && !!config.apiKey && !!process.env.PRINTING_APP_ORIGIN;
    mapping = await lookupPrintBinding(db as unknown as MappingDatabase, auth.user.id, bookId, config.environment);
    if (!providerReady) reason = '서버의 공급사 연결 및 요청 출처 설정이 완료되지 않았습니다. 계약 보유 여부와 서버 연결 상태는 별개입니다.';
    else if (mapping && !mapping.finalized) reason = '표지·내지 PDF의 공급사 최종 확정이 필요합니다.';
  } catch {
    reason = '인쇄 연결 저장소 또는 서버 설정을 확인할 수 없습니다. 관리자 확인 전 견적을 요청하지 않습니다.';
  }
  const ready = providerReady && !!mapping?.finalized;
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
    <Link href={`/books/${bookId}`} className="text-violet-700 underline">← 그림책으로</Link>
    <h1 className="text-3xl font-bold">종이책 인쇄 준비</h1>
    <h2 className="text-xl">{book.title || book.topic}</h2>
    <p className="rounded-xl bg-amber-50 p-4 text-amber-950">준비 상태 확인과 공급사 원가 견적 전용입니다. 소비자 판매·결제·주문·배송 서비스는 제공하지 않습니다.</p>
    <dl className="grid grid-cols-2 gap-3 rounded-xl border p-5">
      <dt>전자책 상태</dt><dd>완성 (인쇄 검수 완료를 의미하지 않음)</dd>
      <dt>공급사 환경</dt><dd>{environment}</dd>
      <dt>인쇄 연결</dt><dd>{mapping ? '현재 원고에 연결됨' : '미연결 또는 원고 변경 후 재검수 필요'}</dd>
      <dt>물리 내지 쪽수</dt><dd>{mapping ? `${mapping.pageCount}쪽` : '미확정 — 전자책 장수와 별도 산정'}</dd>
      <dt>재단 크기</dt><dd>{mapping ? `${mapping.trimWidthMm} × ${mapping.trimHeightMm} mm` : '미확정'}</dd>
      <dt>도련</dt><dd>{mapping ? `${mapping.bleedMm} mm` : '미확정'}</dd>
      <dt>제본 / 표지</dt><dd>{mapping ? `${mapping.bindingType} / ${mapping.coverType}` : '미확정'}</dd>
      <dt>표지·내지 PDF 확정</dt><dd>{mapping?.finalized ? '공급사 확정 기록 있음' : '미완료'}</dd>
    </dl>
    <p className="text-sm text-zinc-600">전자책 PDF는 인쇄용 파일이 아닙니다. 상품별 최소 쪽수·증분, 재단·도련·안전여백, 책등 폭, 이미지 해상도와 표지/내지 분리 검수가 필요합니다. 원고 수정 후에는 재연결·재검수해야 합니다.</p>
    <QuotePanel bookId={bookId} enabled={ready} reason={ready ? '공급사 견적은 최종 소비자 판매가가 아닙니다.' : reason} />
  </main>;
}
