'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
const key='ax4u.characterDraft.v1';
export default function CharacterDraft(){
 const [name,setName]=useState('');const [trait,setTrait]=useState('호기심 많은');const [ready,setReady]=useState(false);
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active)return;try{const v=JSON.parse(localStorage.getItem(key)||'null');if(v&&typeof v.name==='string')setName(v.name.slice(0,40));if(v&&typeof v.trait==='string')setTrait(v.trait.slice(0,120));}catch{}setReady(true);});return()=>{active=false;};},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem(key,JSON.stringify({name,trait}));}catch{}},[ready,name,trait]);
 return <section id="character-studio" className="mx-auto max-w-5xl px-6 py-16" aria-labelledby="character-title">
 <p className="text-xs font-bold tracking-widest text-blue-700">YOUR FIRST CHARACTER</p><h2 id="character-title" className="my-4 text-3xl font-bold">이름을 불러주세요. 이야기가 시작됩니다.</h2>
 <div className="grid grid-cols-1 gap-8 md:grid-cols-2"><div><label className="flex flex-col gap-2 font-semibold">주인공 이름<input value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder="예: 별이, 우리집 고양이 모모" className="min-w-0 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"/></label>
 <p className="mb-3 mt-5">어떤 친구인가요?</p><div className="flex flex-wrap gap-2">{['호기심 많은','용감한','다정한','엉뚱한'].map(t=><button key={t} type="button" aria-pressed={trait===t} onClick={()=>setTrait(t)} className={`rounded-full border px-4 py-2 ${trait===t?'bg-slate-900 text-white':'bg-white text-slate-900'}`}>{t}</button>)}</div></div>
 <div data-character-preview className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">나의 캐릭터 설정 초안</p><h3 className="my-3 text-2xl font-bold">{trait} {name.trim()||'이름 없는 친구'}</h3><p className="text-slate-600">이 설정을 책 만들기 화면으로 가져가 이야기를 더해보세요.</p><Link href="/create" className="mt-5 inline-block rounded-full bg-blue-700 px-6 py-3 text-white">이 캐릭터로 책 만들기 ↗</Link></div></div>
 <p className="mt-4 text-xs text-slate-500">지금은 이 브라우저에 캐릭터 설정만 저장합니다. AI 이미지 생성이나 결제는 실행되지 않습니다. 디지털 책 제작은 유료이며 인쇄·배송은 별도입니다.</p></section>;
}
