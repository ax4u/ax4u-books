"use client";

import { useActionState, useEffect, useState } from "react";
import { createBookAction, type CreateState } from "@/app/books/actions";

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
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="grid gap-4 rounded-xl border border-zinc-300 p-4">
        <legend className="px-2 font-semibold">나의 캐릭터 (선택)</legend>
        <label className="flex flex-col gap-2">주인공 이름<input name="characterName" maxLength={40} value={characterName} onChange={e=>setCharacterName(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2"/></label>
        <label className="flex flex-col gap-2">외형·성격·특징<input name="characterTraits" maxLength={120} value={characterTraits} onChange={e=>setCharacterTraits(e.target.value)} placeholder="예: 노란 우비를 입은 다정한 고양이" className="rounded-lg border border-zinc-300 px-3 py-2"/></label>
        <p className="text-xs text-zinc-500">이 설정은 이야기와 삽화 제작에 함께 전달됩니다. AI 결과의 외형 일관성은 완성 후 확인해 주세요.</p>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="font-medium">주제</span>
        <textarea
          name="topic"
          required
          rows={3}
          placeholder="예) 우주를 여행하며 친구를 찾는 작은 고양이"
          className="rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-medium">그림 스타일</span>
        <select
          name="style"
          defaultValue={styles[0].value}
          className="rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {styles.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-6 sm:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="font-medium">페이지 수</span>
          <select
            name="pageCount"
            defaultValue="8"
            className="rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {[4, 6, 8, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n}쪽
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-medium">연령대</span>
          <select
            name="ageGroup"
            defaultValue="3-5"
            className="rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {["0-2", "3-5", "6-8", "9-12", "청소년", "성인", "전 연령"].map((a) => (
              <option key={a} value={a}>
                {/^\d/.test(a) ? `${a}세` : a}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-medium">언어</span>
          <select
            name="language"
            defaultValue="ko"
            className="rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </label>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-violet-600 px-6 py-3.5 text-center font-medium text-white hover:bg-violet-700 disabled:opacity-60"
      >
        {pending
          ? "결제 페이지로 이동 중…"
          : mockPayment
            ? "그림책 만들기 (데모 결제)"
            : "결제하고 그림책 만들기"}
      </button>
      <p className="text-center text-xs text-zinc-500">
        결제가 완료되면 AI가 글과 그림을 생성합니다.
      </p>
    </form>
  );
}
