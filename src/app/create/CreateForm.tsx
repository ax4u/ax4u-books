"use client";

import { useActionState, useEffect, useState } from "react";
import { createBookAction, type CreateState } from "@/app/books/actions";
import ui from "@/app/studio.module.css";

const initial: CreateState = {};

const styles = [
  { value: "수채화", label: "수채화" },
  { value: "동화풍 카툰", label: "동화풍 카툰" },
  { value: "파스텔 일러스트", label: "파스텔" },
  { value: "3D 렌더링", label: "3D" },
];

export default function CreateForm({ mockPayment }: { mockPayment: boolean }) {
  const [state, action, pending] = useActionState(createBookAction, initial);
  const [characterName, setCharacterName] = useState("");
  const [characterTraits, setCharacterTraits] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (!active) return;
    try { const draft = JSON.parse(localStorage.getItem("ax4u.characterDraft.v1") || "null");
      if (typeof draft?.name === "string") setCharacterName(draft.name.slice(0,40));
      if (typeof draft?.trait === "string") setCharacterTraits(draft.trait.slice(0,120));
    } catch { /* A disabled browser store must not block creation. */ }
    });
    return () => { active = false; };
  }, []);

  return (
    <form action={action} className={ui.createForm} aria-busy={pending}>
      <fieldset className={ui.formSection}>
        <legend><span className={ui.stepNumber}>01</span> 나의 캐릭터 <span className={ui.optional}>선택</span></legend>
        <p className={ui.sectionHint}>이야기의 주인공을 소개해 주세요. 홈에서 적은 캐릭터 초안이 있다면 이곳에 이어져요.</p>
        <label className={ui.field}>
          <span>주인공 이름</span>
          <input name="characterName" maxLength={40} value={characterName} onChange={e=>setCharacterName(e.target.value)} placeholder="어떤 이름으로 불러 줄까요?" className={ui.input} />
        </label>
        <label className={ui.field}>
          <span>외형·성격·특징</span>
          <input name="characterTraits" maxLength={120} value={characterTraits} onChange={e=>setCharacterTraits(e.target.value)} placeholder="예: 노란 우비를 입은 다정한 고양이" aria-describedby="character-hint" className={ui.input} />
        </label>
        <p id="character-hint" className={ui.fieldHint}>이 설정은 이야기와 삽화 제작에 함께 전달됩니다. AI 결과의 외형 일관성은 완성 후 확인해 주세요.</p>
      </fieldset>

      <fieldset className={ui.formSection}>
        <legend><span className={ui.stepNumber}>02</span> 들려주고 싶은 이야기</legend>
        <label className={ui.field}>
          <span>주제 <span className={ui.required}>필수</span></span>
          <textarea
            name="topic"
            required
            rows={4}
            placeholder="예) 우주를 여행하며 친구를 찾는 작은 고양이"
            aria-describedby="topic-hint"
            className={ui.input}
          />
          <small id="topic-hint" className={ui.fieldHint}>주인공이 떠나는 곳, 만나는 친구, 전하고 싶은 마음을 적어 보세요.</small>
        </label>
        <label className={ui.field}>
          <span>그림 스타일</span>
          <select name="style" defaultValue={styles[0].value} className={ui.input}>
            {styles.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className={ui.formSection}>
        <legend><span className={ui.stepNumber}>03</span> 누구를 위한 책인가요?</legend>
        <div className={ui.optionsGrid}>
          <label className={ui.field}>
            <span>페이지 수</span>
            <select name="pageCount" defaultValue="8" className={ui.input}>
              {[4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}쪽</option>)}
            </select>
          </label>
          <label className={ui.field}>
            <span>연령대</span>
            <select name="ageGroup" defaultValue="3-5" className={ui.input}>
              {["0-2", "3-5", "6-8", "9-12", "청소년", "성인", "전 연령"].map((a) => (
                <option key={a} value={a}>{/^\d/.test(a) ? `${a}세` : a}</option>
              ))}
            </select>
          </label>
          <label className={ui.field}>
            <span>언어</span>
            <select name="language" defaultValue="ko" className={ui.input}>
              <option value="ko">한국어</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </label>
        </div>
      </fieldset>

      <div className={ui.submitSection}>
        {mockPayment && <p className={ui.notice}>현재 데모 결제 모드입니다. 실제 결제와 구분해 이용해 주세요.</p>}
        {state.error && <p className={ui.errorNotice} role="alert">{state.error}</p>}
        <button type="submit" disabled={pending} className={ui.primaryButton}>
          {pending ? "결제 페이지로 이동 중…" : mockPayment ? "그림책 만들기 (데모 결제)" : "결제하고 그림책 만들기"}
          {!pending && <span aria-hidden="true">↗</span>}
        </button>
        <p className={ui.submitHint}>결제가 완료되면 AI가 글과 그림을 생성합니다.<br />종이책 인쇄·배송은 포함되지 않습니다.</p>
      </div>
    </form>
  );
}
