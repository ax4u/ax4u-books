"use client";
import { useState } from 'react';
export default function QuotePanel({ bookId, enabled, reason }: { bookId: string; enabled: boolean; reason: string }) {
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function quote() {
    if (!enabled || busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/printing/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId, quantity }), cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) { setMessage('견적을 확인할 수 없습니다. 연결·PDF 확정 상태 및 상품별 쪽수를 확인해 주세요.'); return; }
      const amount = result.data?.paidCreditAmount;
      if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error('Invalid quote');
      setMessage(`공급사 예상 비용: ${amount.toLocaleString('ko-KR')}원 (소비자 판매가 아님, 주문·차감 없음)`);
    } catch { setMessage('견적 연결에 실패했습니다. 잠시 후 다시 확인해 주세요.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border p-5">
    <h2 className="text-lg font-semibold">공급사 원가 견적</h2>
    <p>{reason}</p>
    <label className="block">수량 <input aria-label="인쇄 견적 수량" className="ml-2 w-24 rounded border p-2" type="number" min={1} max={200} value={quantity} disabled={!enabled || busy} onChange={e => setQuantity(Number(e.target.value))} /></label>
    <button className="rounded-full bg-violet-700 px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!enabled || busy || !Number.isInteger(quantity) || quantity < 1 || quantity > 200} onClick={quote}>{busy ? '견적 확인 중…' : '견적 확인 (주문 아님)'}</button>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
