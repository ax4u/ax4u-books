/** Approved operating boundary. Reopening requires a reviewed code release, not an env toggle. */
export const FREE_EXHIBITION_ONLY = true;
export const EXHIBITION_ONLY_MESSAGE =
  "현재는 비상업 무료 전시와 캐릭터 체험만 운영합니다. 결제·AI 제작·재생성·인쇄 견적·주문은 제공하지 않습니다.";

export function exhibitionOnlyResponse() {
  // Do not acknowledge payment webhooks as processed or consume request bodies.
  return Response.json(
    { error: "FREE_EXHIBITION_ONLY", message: EXHIBITION_ONLY_MESSAGE },
    { status: 503, headers: { "Cache-Control": "private, no-store" } },
  );
}
