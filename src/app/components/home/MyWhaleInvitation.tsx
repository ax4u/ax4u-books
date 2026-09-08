import Link from 'next/link';
import styles from './MyWhaleInvitation.module.css';
export default function MyWhaleInvitation(){
 return <section className={styles.invitation} aria-labelledby="my-whale-invitation"><div className={styles.title}><span>NEW — A WHALE OF YOUR OWN</span><h2 id="my-whale-invitation">이 하늘에,<br/>나의 고래 한 마리.</h2></div><div className={styles.copy}><p>이름을 붙이고, 마음을 건네고, 함께 유영해요.<br/>다시 찾아올 작은 이유가 생길지도 몰라요.</p><small>무료 베타 · 로그인 없이 시작 · 이 브라우저에 저장</small></div><Link href="/my-whale" className={styles.cta}>내 고래 만나기 <span aria-hidden="true">↗</span></Link></section>;
}
