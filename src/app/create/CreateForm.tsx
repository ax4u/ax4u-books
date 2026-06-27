"use client";

import { useActionState } from "react";
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

  return (
    <form action={action} className="flex flex-col gap-6">
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
            {["0-2", "3-5", "6-8", "9-12"].map((a) => (
              <option key={a} value={a}>
                {a}세
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
