"use client";

import { useActionState, useState } from "react";
import {
  signInAction,
  signUpAction,
  type AuthState,
} from "@/app/auth/actions";

const initial: AuthState = {};

export default function LoginForm({ mockMode }: { mockMode: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signinState, signin, signinPending] = useActionState(
    signInAction,
    initial,
  );
  const [signupState, signup, signupPending] = useActionState(
    signUpAction,
    initial,
  );

  const isSignin = mode === "signin";
  const state = isSignin ? signinState : signupState;
  const pending = isSignin ? signinPending : signupPending;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex rounded-full bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full py-2 font-medium transition ${
              mode === m
                ? "bg-white shadow dark:bg-zinc-700"
                : "text-zinc-500"
            }`}
          >
            {m === "signin" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      <form action={isSignin ? signin : signup} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          이메일
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        {!mockMode && (
          <label className="flex flex-col gap-1 text-sm">
            비밀번호
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        )}

        {mockMode && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            데모 모드: 비밀번호 없이 이메일만으로 로그인됩니다.
          </p>
        )}

        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-violet-600 px-5 py-3 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {pending
            ? "처리 중…"
            : isSignin
              ? "로그인"
              : "회원가입"}
        </button>
      </form>
    </div>
  );
}
