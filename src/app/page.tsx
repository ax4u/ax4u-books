import Link from 'next/link';
import Header from '@/app/components/Header';
import StoryScene from './components/home/StoryScene';
import styles from './home.module.css';
import CharacterDraft from './components/home/CharacterDraft';

export default function Home() {
 return <div className={styles.home}><Header/><main>
  <section className={styles.hero} aria-labelledby="hero-title">
   <div className={styles.heroCopy}>
    <p className={styles.eyebrow}><span/> YOUR CHARACTER. YOUR STORY.</p>
    <h1 id="hero-title">상상하던<br/>주인공이,<br/><span>내 책 밖으로.</span></h1>
    <p className={styles.intro}>작은 낙서 하나, 마음속 친구 하나.<br/>나만의 캐릭터로 이야기를 만들고,<br/>언제든 펼쳐 볼 그림책으로 간직하세요.</p>
    <div className={styles.heroActions}><Link href="/create" className={styles.primary}>나의 그림책 만들기 <span>↗</span></Link><Link href="/exhibition" className={styles.secondary}>오픈 그림책 전시회 <span>→</span></Link></div>
    <p className={styles.heroFoot}>캐릭터 구상부터 온라인 그림책까지.<br/>종이책 제작은 선택 사항이며, 사양과 가격은 준비 중이에요.</p>
   </div>
   <StoryScene/>
  </section>
  <div className={styles.chapterLine}><span>IMAGINATION, BOUND TOGETHER.</span><span>작은 상상이 한 권이 되는 곳 <i>↓</i></span></div>
  <CharacterDraft/>
  <section className={styles.journey} aria-labelledby="journey-title">
   <div className={styles.sectionHead}><p className={styles.eyebrow}>FROM A SPARK TO A BOOK</p><h2 id="journey-title">주인공은 나답게.<br/>이야기는 자유롭게.</h2><p>처음부터 완벽할 필요 없어요.<br/>좋아하는 친구와 떠나고 싶은 세계만 있으면 돼요.</p></div>
   <div className={styles.steps}>{[
    ['01','CHARACTER','나만의 주인공','이름과 성격, 좋아하는 것을 정해요. 작은 특징이 특별한 친구를 만들어요.','✳'],
    ['02','STORY','함께 쓰는 모험','떠나고 싶은 곳과 전하고 싶은 마음을 이야기의 씨앗으로 담아요.','⌁'],
    ['03','ONLINE BOOK','언제든 펼치는 책','그림책을 온라인으로 읽고, 완성된 이야기를 다시 만나세요.','▤'],
    ['04','OPTIONAL PRINT','손끝에 닿는 이야기','종이책 제작은 선택 사항이에요. 제작 사양과 가격, 주문 연결을 준비하고 있어요.','↗']
   ].map(([n,en,title,body,icon])=><article key={n} className={styles.step}><div className={styles.stepTop}><span>{n} / {en}</span><i aria-hidden="true">{icon}</i></div><h3>{title}</h3><p>{body}</p>{n==='04'&&<span className={styles.comingSoon}>인쇄 주문 준비 중</span>}</article>)}</div>
  </section>
  <section className={styles.exhibition}><div><p className={styles.eyebrow}>THE OPEN BOOKSHELF</p><h2>어떤 세계가 펼쳐질까?</h2><p>공개된 그림책을 한 장씩 넘겨 보세요.<br/>다음 이야기의 주인공은 당신의 캐릭터일지도 몰라요.</p><Link href="/exhibition" className={styles.primary}>전시회에서 그림책 읽기 <span>↗</span></Link></div><div className={styles.bookDisplay} aria-hidden="true"><div className={styles.displayBook}><small>A STORY OF<br/>LITTLE WONDERS</small><strong>작은 친구의<br/>커다란 세계</strong><span>✳</span><small>OPEN YOUR IMAGINATION</small></div><span className={styles.bookLabel}>새로운 세계는<br/>첫 장에서 시작돼요.</span></div></section>
  <footer className={styles.footer}><span>AX4U Books</span><p>캐릭터에서 이야기로, 이야기에서 한 권의 책으로.</p><Link href="/create">첫 이야기 시작하기 ↗</Link></footer>
 </main></div>;
}
