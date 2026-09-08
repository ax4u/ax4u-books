"use client";

import { useActionState, useState } from "react";
import {
  signInAction,
  signUpAction,
  signInWithGoogleAction,
  type AuthState,
} from "@/app/auth/actions";
import { AUTH_UNAVAILABLE, GOOGLE_UNAVAILABLE } from "@/lib/auth-messages";
import ui from "@/app/studio.module.css";

const initial: AuthState = {};

export default function LoginForm({ authAvailable, googleEnabled }: { authAvailable: boolean; googleEnabled: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signinState, signin, signinPending] = useActionState(
    signInAction,
    initial,
  );
  const [signupState, signup, signupPending] = useActionState(
    signUpAction,
    initial,
  );

  const [googleState, google, googlePending] = useActionState(signInWithGoogleAction, initial);
  const busy = signinPending || signupPending || googlePending;

  const isSignin = mode === "signin";
  const state = isSignin ? signinState : signupState;
  const pending = isSignin ? signinPending : signupPending;

  return (
    <div className={ui.loginForm}>
      <div className={ui.modeSwitch} role="group" aria-label="로그인 또는 회원가입 선택">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            disabled={busy}
            aria-pressed={mode === m}
            className={ui.modeButton}
          >
            {m === "signin" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>
      <p className={ui.fieldHint}>
        서비스 이용 전 <a href="/privacy">개인정보처리방침 초안</a>과{" "}
        <a href="/terms">이용약관 초안</a>을 확인해 주세요.
      </p>
      <div className={ui.formIntro}>
        <h2>{isSignin ? "다시 만나 반가워요." : "첫 이야기를 함께 시작해요."}</h2>
        <p>{isSignin ? "로그인하면 내 그림책을 이어서 만날 수 있어요." : "Google 계정 또는 이메일로 고비비에 가입하세요."}</p>
      </div>

      <form action={google} className={ui.formStack} aria-busy={googlePending}>
        <button type="submit" disabled={busy || !googleEnabled} className={ui.secondaryButton} aria-describedby={!googleEnabled ? "google-hint" : undefined}>
          <span aria-hidden="true">G</span>
          {googlePending ? "Google로 이동 중…" : "Google로 계속하기"}
        </button>
        {!googleEnabled && <p id="google-hint" className={ui.fieldHint}>{GOOGLE_UNAVAILABLE}</p>}
        {googleState.error && <p className={ui.errorNotice} role="alert">{googleState.error}</p>}
        <p className={ui.fieldHint}>또는 이메일로 {isSignin ? "로그인" : "회원가입"}</p>
      </form>

      <form action={isSignin ? signin : signup} className={ui.formStack} aria-busy={pending}>
        <label className={ui.field}>
          <span>이메일</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={ui.input}
          />
        </label>

        {(
          <label className={ui.field}>
            <span>비밀번호</span>
            <input
              name="password"
              type="password"
              required
              minLength={isSignin ? undefined : 6}
              autoComplete={isSignin ? "current-password" : "new-password"}
              aria-describedby={isSignin ? undefined : "password-hint"}
              placeholder={isSignin ? "비밀번호를 입력해 주세요" : "6자 이상 입력해 주세요"}
              className={ui.input}
            />
            {!isSignin && <small id="password-hint" className={ui.fieldHint}>비밀번호는 6자 이상이어야 해요.</small>}
          </label>
        )}

        {!authAvailable && <p className={ui.notice}>{AUTH_UNAVAILABLE}</p>}

        {state.success && <p className={ui.notice} role="status">{state.success}</p>}
        {state.error && <p className={ui.errorNotice} role="alert">{state.error}</p>}

        <button type="submit" disabled={busy || !authAvailable} className={ui.primaryButton}>
          {pending ? "처리 중…" : isSignin ? "로그인" : "회원가입"}
          {!pending && <span aria-hidden="true">↗</span>}
        </button>
      </form>
    </div>
  );
}
