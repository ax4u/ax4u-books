import Link from 'next/link';
import styles from './MyWhaleLink.module.css';
export default function MyWhaleLink({ current = false }: { current?: boolean }) {
  return <Link href="/my-whale" className={styles.link} aria-current={current ? 'page' : undefined}>나의 고래 <span aria-hidden="true">↗</span></Link>;
}
