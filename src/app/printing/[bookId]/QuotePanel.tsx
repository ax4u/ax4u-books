"use client";
import { useState } from 'react';
import ui from '@/app/studio.module.css';

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
  return (
    <section className={ui.quotePanel} aria-labelledby="quote-title" aria-busy={busy}>
      <div className={ui.quoteHeading}>
        <p className={ui.eyebrow}>SUPPLIER ESTIMATE</p>
        <span className={ui.statusBadge} data-status={enabled ? 'completed' : 'draft'}>{enabled ? '견적 확인 가능' : '연결 준비 중'}</span>
      </div>
      <h2 id="quote-title">공급사 원가 견적</h2>
      <p id="quote-reason" className={ui.quoteReason}>{reason}</p>
      <label className={ui.field}>
        <span>수량</span>
        <input aria-label="인쇄 견적 수량" aria-describedby="quote-quantity-hint quote-reason" className={ui.input} type="number" min={1} max={200} value={quantity} disabled={!enabled || busy} onChange={e => setQuantity(Number(e.target.value))} />
        <small id="quote-quantity-hint" className={ui.fieldHint}>1~200권 사이의 정수를 입력해 주세요.</small>
      </label>
      <button type="button" className={ui.primaryButton} disabled={!enabled || busy || !Number.isInteger(quantity) || quantity < 1 || quantity > 200} onClick={quote}>{busy ? '견적 확인 중…' : '견적 확인 (주문 아님)'}</button>
      <p className={ui.fieldHint}>견적 확인만으로 주문되거나 금액이 차감되지 않습니다.</p>
      <p role="status" aria-live="polite" aria-atomic="true" className={message ? ui.quoteMessage : ui.srOnly}>{message}</p>
    </section>
  );
}
