export const AUTH_UNAVAILABLE = "로그인 서비스를 준비 중이에요. 잠시 후 다시 시도해 주세요.";
export const GOOGLE_UNAVAILABLE = "Google 로그인을 준비 중이에요. 이메일 로그인을 이용해 주세요.";

/** Never expose provider messages, email addresses or database details to users. */
export function authErrorMessage(error: { code?: string; status?: number }): string {
  switch (error.code) {
    case "invalid_credentials": return "이메일 또는 비밀번호가 올바르지 않아요. 다시 확인해 주세요.";
    case "email_not_confirmed": return "이메일 인증이 필요해요. 받은편지함과 스팸함에서 확인 메일을 찾아 주세요.";
    case "user_already_exists":
    case "email_exists": return "가입을 진행할 수 없어요. 이미 가입했다면 로그인하거나 이메일을 확인해 주세요.";
    case "weak_password": return "비밀번호가 보안 조건을 충족하지 않아요. 더 길고 다양한 문자를 사용해 주세요.";
    case "email_address_invalid":
    case "validation_failed": return "이메일과 비밀번호를 다시 확인해 주세요.";
    case "email_address_not_authorized": return "현재 이 주소로 확인 메일을 보낼 수 없어요. 운영자에게 문의해 주세요.";
    case "over_email_send_rate_limit": return "확인 메일 요청이 많아요. 잠시 기다린 뒤 다시 시도해 주세요.";
    case "over_request_rate_limit": return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
    case "signup_disabled": return "지금은 회원가입을 준비 중이에요. 잠시 후 다시 방문해 주세요.";
    case "provider_disabled":
    case "oauth_provider_not_supported": return GOOGLE_UNAVAILABLE;
    default: return error.status === 429
      ? "요청이 너무 많아요. 잠시 후 다시 시도해 주세요."
      : "인증을 완료하지 못했어요. 잠시 후 다시 시도해 주세요. 계속되면 운영자에게 문의해 주세요.";
  }
}

export function authCallbackMessage(code: string): string {
  if (code === "oauth_cancelled") return "Google 로그인이 취소되었어요. 다시 시도해 주세요.";
  if (code === "auth_unavailable") return AUTH_UNAVAILABLE;
  return "인증 링크가 올바르지 않거나 만료되었어요. 로그인을 시작한 브라우저에서 다시 시도해 주세요.";
}
