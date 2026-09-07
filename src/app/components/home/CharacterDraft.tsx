"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import styles from '../../home.module.css';
const key='ax4u.characterDraft.v1';
export default function CharacterDraft(){
 const [name,setName]=useState('');const [trait,setTrait]=useState('호기심 많은');const [ready,setReady]=useState(false);
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active)return;try{const v=JSON.parse(localStorage.getItem(key)||'null');if(v&&typeof v.name==='string')setName(v.name.slice(0,40));if(v&&typeof v.trait==='string')setTrait(v.trait.slice(0,120));}catch{}setReady(true);});return()=>{active=false;};},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem(key,JSON.stringify({name,trait}));}catch{}},[ready,name,trait]);
 return <section id="studio" className={styles.studio} aria-labelledby="character-title"><div className={styles.sectionMeta}><span>03 — THE STORY WORKSHOP</span><span>상멍이의 이야기 작업실</span></div><div className={styles.studioHeading}><h2 id="character-title">어떤 친구와<br/>떠나고 싶나요?</h2><p>이름 하나, 작은 성격 하나.<br/>오늘의 상상을 첫 장에 적어 보세요.</p></div><div id="character-studio" className={styles.storyTable}><div className={styles.draftFields}><label className={styles.nameField}><span>01 / 주인공 이름</span><input aria-label="주인공 이름" value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder="친구의 이름을 불러주세요"/></label><fieldset className={styles.traitField}><legend>02 / 어떤 친구인가요?</legend><div>{['호기심 많은','용감한','다정한','엉뚱한'].map(t=><button key={t} type="button" aria-pressed={trait===t} onClick={()=>setTrait(t)}>{t}</button>)}</div></fieldset></div><div data-character-preview className={styles.draftPreview}><p className={styles.eyebrow}>YOUR STORY STARTS HERE</p><h3>{trait}<br/><strong>{name.trim()||'이름 없는 친구'}</strong>의 이야기</h3><p>아직 쓰이지 않은 모험이 기다리고 있어요.<br/>이 설정을 가져가 이야기를 더해 보세요.</p><Link href="/create" prefetch={false} className={styles.primary}>이 캐릭터로 책 만들기 <span aria-hidden="true">↗</span></Link></div></div><p className={styles.draftNotice}>이 브라우저에 이름과 성격 설정만 저장합니다. AI 이미지 생성이나 결제는 실행되지 않습니다.<br/>디지털 책 제작은 유료이며 인쇄·배송은 별도입니다. 종이책 주문은 준비 중입니다.</p></section>;
}
