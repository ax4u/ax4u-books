import { getSessionUser } from "@/lib/auth";
import { signOutAction } from "@/app/auth/actions";
import BrandNavigation from "./gobibi/BrandNavigation";
export default async function Header() {
  const user = await getSessionUser();
  return <BrandNavigation authenticated={Boolean(user)}>{user && <form action={signOutAction}><button type="submit">로그아웃</button></form>}</BrandNavigation>;
}
