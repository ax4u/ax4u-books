/* eslint-disable @next/next/no-img-element -- Existing optimized same-origin WebP landscape and sprite, also used for local canvas export. */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { STORAGE_KEY, MOODS, parseWhaleState, normalizeWhaleFields, incrementMetric, createFeedbackPayload, type WhaleState, type Mood } from "./whale-state";
import styles from "./my-whale.module.css";

type Snapshot = { ready: boolean; whale: WhaleState | null; warning: string; corrupt: boolean };
const INITIAL: Snapshot = { ready: false, whale: null, warning: "", corrupt: false };
const BLOCKED = "브라우저 저장소를 사용할 수 없어 지금은 임시로 만나요. 새로고침하거나 창을 닫으면 기록이 사라질 수 있어요. 닫기 전에 고래 카드를 내려받아 주세요.";
function createWhaleStore() {
  let snapshot = INITIAL;
  let initialized = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  function save(whale: WhaleState) {
    let warning = snapshot.warning;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(whale)); warning = ""; } catch { warning = BLOCKED; }
    snapshot = { ready: true, whale, warning, corrupt: false };
    emit();
  }
  function load(first: boolean) {
    try {
      const parsed = parseWhaleState(localStorage.getItem(STORAGE_KEY));
      snapshot = { ready: true, whale: parsed.whale, corrupt: parsed.status === "corrupt", warning: "" };
      try { localStorage.setItem(`${STORAGE_KEY}.probe`, "1"); localStorage.removeItem(`${STORAGE_KEY}.probe`); } catch { snapshot = { ...snapshot, warning: BLOCKED }; }
      if (first && parsed.whale) save(incrementMetric(parsed.whale, "visits"));
    } catch { snapshot = { ...snapshot, ready: true, warning: BLOCKED }; }
    emit();
  }
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) load(false); };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener("storage", onStorage);
      if (!initialized) { initialized = true; load(true); }
      return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener("storage", onStorage); };
    },
    save,
    remove() {
      try {
        localStorage.removeItem(STORAGE_KEY);
        if (localStorage.getItem(STORAGE_KEY) !== null) throw new Error("Removal blocked");
        snapshot = { ready: true, whale: null, warning: "", corrupt: false }; emit(); return true;
      } catch {
        snapshot = { ...snapshot, warning: "저장소 접근이 차단되어 삭제를 확인할 수 없어요. 브라우저 설정에서 이 사이트의 데이터를 삭제해 주세요." }; emit(); return false;
      }
    },
  };
}
function subscribeReduced(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function subscribeHidden(callback: () => void) { document.addEventListener("visibilitychange", callback); return () => document.removeEventListener("visibilitychange", callback); }
const getHidden = () => document.hidden;
const serverFalse = () => false;
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number) {
  let line = "";
  for (const character of Array.from(text)) {
    if (context.measureText(line + character).width > width) { context.fillText(line, x, y); y += height; line = character; } else line += character;
  }
  context.fillText(line, x, y);
  return y;
}
const dateLabel = (born: string) => new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(born));

export default function MyWhaleExperience() {
  const [store] = useState(createWhaleStore);
  const { ready, whale, warning, corrupt } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, serverFalse);
  const hidden = useSyncExternalStore(subscribeHidden, getHidden, serverFalse);
  const [paused, setPaused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [cardBusy, setCardBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const sky = useRef<HTMLDivElement>(null);
  const sprite = useRef<HTMLButtonElement>(null);
  const targetPin = useRef<HTMLSpanElement>(null);
  const birthName = useRef<HTMLInputElement>(null);
  const details = useRef<HTMLDialogElement>(null);
  const edit = useRef<HTMLDialogElement>(null);
  const remove = useRef<HTMLDialogElement>(null);
  const feedback = useRef<HTMLDialogElement>(null);
  const editForm = useRef<HTMLFormElement>(null);
  const position = useRef({ x: 60, y: 55 });
  const destination = useRef({ x: 60, y: 55 });
  const manualUntil = useRef(0);
  const still = paused || reduced || hidden || modalOpen;
  const mood = whale?.mood ?? "rest";

  useEffect(() => {
    if (still) return;
    let frame = 0;
    let last = 0;
    let clock = 0;
    const animate = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now; clock += dt;
      if (now > manualUntil.current) {
        const span = mood === "adventure" ? 19 : mood === "together" ? 3 : 9;
        destination.current = { x: 56 + Math.sin(clock / (mood === "adventure" ? 2.8 : 5)) * span, y: 56 + Math.cos(clock / 4) * (mood === "adventure" ? 9 : 3) };
        if (targetPin.current) targetPin.current.style.opacity = "0";
      }
      const rate = mood === "adventure" ? 1.15 : 0.55;
      position.current.x += (destination.current.x - position.current.x) * Math.min(dt * rate, 1);
      position.current.y += (destination.current.y - position.current.y) * Math.min(dt * rate, 1);
      if (sprite.current) { sprite.current.style.left = `${position.current.x}%`; sprite.current.style.top = `${position.current.y}%`; }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [still, mood]);

  function open(dialog: HTMLDialogElement | null) {
    if (!dialog) return;
    setModalOpen(true); dialog.showModal();
  }
  function aim(x: number, y: number) {
    const scene = sky.current;
    if (!scene) return;
    const half = Math.max(15, ((sprite.current?.offsetWidth ?? 180) / scene.clientWidth) * 50 + 3);
    destination.current = { x: Math.max(half, Math.min(100 - half, x)), y: Math.max(43, Math.min(76, y)) };
    manualUntil.current = performance.now() + 7000;
    if (targetPin.current) { targetPin.current.style.left = `${destination.current.x}%`; targetPin.current.style.top = `${destination.current.y}%`; targetPin.current.style.opacity = "1"; }
    if (still && sprite.current) { position.current = { ...destination.current }; sprite.current.style.left = `${position.current.x}%`; sprite.current.style.top = `${position.current.y}%`; }
    const current = store.getSnapshot().whale;
    if (current) store.save(incrementMetric(current, "moves"));
    setStatus(still ? "움직임 없이, 고래의 자리를 옮겼어요." : "그곳으로 함께 가 볼게요.");
  }
  function submitWhale(event: FormEvent<HTMLFormElement>, editing = false) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fields = normalizeWhaleFields(String(data.get("name") ?? ""), String(data.get("line") ?? ""));
    if (!fields) { (editing ? setEditError : setFormError)("이름은 공백 없이 1~20자, 한 줄은 80자 이내로 적어 주세요."); return; }
    const current = store.getSnapshot().whale;
    store.save(current ? { ...current, ...fields } : { version: 1, ...fields, born: new Date().toISOString(), mood: "rest", metrics: { moves: 0, cards: 0, visits: 1 } });
    setFormError(""); setEditError("");
    if (editing) edit.current?.close();
    setStatus(store.getSnapshot().warning ? "이름을 붙였어요. 지금 기록은 임시 상태예요." : "이 브라우저에 이름과 한 줄을 기억해 두었어요.");
    sky.current?.focus({ preventScroll: true });
  }
  function openEdit() {
    const current = store.getSnapshot().whale;
    if (!current || !editForm.current) return;
    (editForm.current.elements.namedItem("name") as HTMLInputElement).value = current.name;
    (editForm.current.elements.namedItem("line") as HTMLTextAreaElement).value = current.line;
    setEditError(""); open(edit.current);
  }
  function chooseMood(next: Mood) {
    const current = store.getSnapshot().whale;
    if (!current) return;
    store.save({ ...current, mood: next });
    setStatus(MOODS[next].line);
  }
  async function saveCard() {
    const current = store.getSnapshot().whale;
    if (!current || cardBusy) return;
    setCardBusy(true);
    try {
      const image = new window.Image(); image.src = "/home/gobibi/whale.webp";
      await image.decode(); await document.fonts.ready;
      const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.fillStyle = "#fff9e9"; context.fillRect(0, 0, 1080, 1350);
      context.fillStyle = "#d8f1d5"; context.fillRect(35, 200, 1010, 590);
      context.fillStyle = "#1649dd";
      const bagel = getComputedStyle(sky.current!).getPropertyValue("--font-gobibi").trim() || "serif";
      const nanum = getComputedStyle(sky.current!).getPropertyValue("--font-nanum-gothic").trim() || "sans-serif";
      context.font = `80px ${bagel}`; context.fillText("MY WHALE", 65, 135);
      context.fillStyle = "#fff9e9"; context.beginPath(); context.ellipse(540, 495, 370, 230, -0.08, 0, Math.PI * 2); context.fill();
      const imageHeight = 930 * image.naturalHeight / image.naturalWidth;
      context.drawImage(image, 75, 500 - imageHeight / 2, 930, imageHeight);
      context.fillStyle = "#12375a"; context.font = `bold 58px ${nanum}`;
      const nameEnd = wrapText(context, current.name, 75, 890, 930, 75);
      context.font = `30px ${nanum}`;
      wrapText(context, current.line || "말하지 않아도 괜찮아. 함께 유영하자.", 75, nameEnd + 70, 930, 44);
      context.font = `22px ${nanum}`; context.fillText(`처음 만난 날 · ${dateLabel(current.born)}`, 75, 1200);
      context.font = `18px ${nanum}`; context.fillText("GOBIBI · 나의 고래 / 무료 베타 · 공통 고래 이미지", 75, 1280);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Empty image")), "image/png"));
      download(blob, "gobibi-my-whale.png");
      // A deletion or replacement in another tab while exporting must not resurrect the old record.
      if (store.getSnapshot().whale === current) store.save(incrementMetric(current, "cards"));
      setStatus("고래 카드 다운로드를 시작했어요. 카드에는 이름과 한 줄이 담겨요. 공유 전 내용을 확인해 주세요.");
    } catch { setStatus("카드를 만들지 못했어요. 이미지가 로드된 뒤 다시 시도해 주세요."); }
    finally { setCardBusy(false); }
  }
  function exportFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = createFeedbackPayload({ returnIntent: data.get("returnIntent"), reason: data.get("reason"), purchaseIntent: data.get("purchaseIntent") }, store.getSnapshot().whale);
    if (!payload) return;
    download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "gobibi-my-whale-feedback.json");
    feedback.current?.close();
    setStatus("소감 JSON 다운로드를 시작했어요. 자동 제출되지 않으며, 이름·이야기·고래 ID는 자동 포함하지 않아요.");
  }
  const closeDialog = () => setModalOpen(false);

  return <main className={styles.experience}>
    <section className={styles.explore} aria-labelledby="my-whale-title">
      <div ref={sky} className={styles.sky} tabIndex={0} role="group" aria-label="고래가 머무는 하늘" aria-describedby="sky-help" data-paused={still} data-mood={mood}
        onClick={event => { if ((event.target as HTMLElement).closest("button,a,[data-ui]")) return; const rect = event.currentTarget.getBoundingClientRect(); aim((event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100); event.currentTarget.focus({ preventScroll: true }); }}
        onKeyDown={event => { if (event.target !== event.currentTarget) return; const delta: Record<string, [number, number]> = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }; if (delta[event.key]) { event.preventDefault(); const [x, y] = delta[event.key]; aim(destination.current.x + x, destination.current.y + y); } }}>
        <img className={styles.landscape} src="/home/gobibi/world.webp" width="1536" height="1024" alt="" fetchPriority="high" draggable={false} />
        <div className={styles.skyWash} aria-hidden="true" />
        <div className={styles.wordmark} aria-hidden="true">MY WHALE</div>
        <div className={styles.plaque} data-ui>
          <div className={styles.eyebrow}><span className={styles.dot} /> A LITTLE FRIEND, A LITTLE SKY</div>
          <div className={styles.titleRow}><h1 id="my-whale-title">나의 고래</h1><span className={styles.beta}>무료 베타</span></div>
          <p className={styles.intro}>이름 하나로 시작되는,<br />너와 고래 사이의 작은 이야기.</p>
          <p className={styles.plaqueSmall}>이름을 붙이고, 한 줄을 건네고.<br />오늘은 이 하늘에서 잠깐 쉬어가요.</p>
          <a href="#first-meeting" className={`${styles.pill} ${styles.yellow}`} style={{ marginTop: 16 }}>{whale ? "우리의 기록 보기" : "이름 지어주기"} <span aria-hidden="true">↓</span></a>
        </div>
        <div className={styles.topTools} data-ui>
          <span className={styles.localPill}><span aria-hidden="true">◌</span> 이 브라우저의 작은 하늘</span>
          <button className={styles.pill} type="button" aria-pressed={paused || reduced} onClick={() => setPaused(value => !value)} disabled={reduced}>{reduced ? "동작 줄이기 적용 중" : paused ? "▷ 다시 유영하기" : "Ⅱ 잠깐 쉬기"}</button>
        </div>
        <span ref={targetPin} className={styles.target} aria-hidden="true">＋</span>
        <button ref={sprite} type="button" className={styles.whale} onClick={() => open(details.current)} aria-label={whale ? `${whale.name} 고래 살펴보기` : "아직 이름 없는 고래 살펴보기"}>
          <span className={styles.whaleFloat}><img src="/home/gobibi/whale.webp" width="1375" height="555" alt="" draggable={false} /><span className={styles.nameTag}>{whale?.name ?? "내 이름을 지어줄래?"}<span aria-hidden="true"> ↗</span></span></span>
        </button>
        <span className={styles.orbitLabel} aria-hidden="true">a sky of your own <span>✳</span></span>
        <nav className={styles.mapLinks} aria-label="고비비의 다른 하늘" data-ui>
          <Link href="/whale-flight" prefetch={false} className={styles.pill}>세상 구경하기 <span aria-hidden="true">↗</span></Link>
          <Link href="/create" prefetch={false} className={`${styles.pill} ${styles.yellow}`}>이야기 작업실 <span aria-hidden="true">↗</span></Link>
        </nav>
        <div className={styles.skyBottom} data-ui><p id="sky-help">빈 하늘을 톡 눌러요 <span>· 하늘에 초점을 두고 방향키로도 이동해요</span></p><button type="button" onClick={() => aim(56, 55)}>가운데로 부르기 ↶</button></div>
      </div>
    </section>

    <section id="first-meeting" className={styles.harbor} aria-labelledby="harbor-title">
      <div className={styles.harborTop}><span className={styles.eyebrow}>YOUR LITTLE LANDING PLACE</span><span className={styles.chapter}>01 — {whale ? "우리의 기록" : "첫 만남"}</span></div>
      {!ready ? <div className={styles.loading} role="status">이 브라우저의 작은 하늘을 열고 있어요…</div> : whale ? <div className={styles.recordGrid}>
        <div className={styles.recordIntro}><span className={styles.stamp} aria-hidden="true">♡</span><div><p className={styles.kicker}>이름을 기억하고 있었어요</p><h2 id="harbor-title">{whale.name}의 하늘</h2><p className={styles.story}>{whale.line || "아직 말하지 않아도 괜찮아요."}</p><p className={styles.date}>처음 만난 날 · {dateLabel(whale.born)}</p></div></div>
        <div className={styles.companion}><p className={styles.fieldTitle}>오늘은 어떻게 날아볼까?</p><div className={styles.moods}>{(Object.entries(MOODS) as [Mood, typeof MOODS[Mood]][]).map(([key, value]) => <button type="button" key={key} aria-pressed={mood === key} onClick={() => chooseMood(key)}><span aria-hidden="true">{value.symbol}</span>{value.label}</button>)}</div><p className={styles.moodLine}>{MOODS[mood].line}</p><div className={styles.metrics}><span>함께 정한 목적지 <b>{whale.metrics.moves}</b>번</span><span>방문 <b>{whale.metrics.visits}</b>번</span><span>카드 <b>{whale.metrics.cards}</b>장</span></div></div>
        <div className={styles.recordActions}><button type="button" className={styles.primary} onClick={saveCard} disabled={cardBusy}>{cardBusy ? "카드에 담는 중…" : "고래 카드 간직하기 ↓"}</button><div className={styles.smallActions}><button type="button" onClick={openEdit}>이름·한 줄 수정</button><button type="button" onClick={() => open(feedback.current)}>만나본 소감</button><button type="button" onClick={() => open(remove.current)}>기록 지우기</button></div><p>PNG 이미지로 내려받아요.<br />이름과 한 줄이 카드에 포함돼요.</p></div>
      </div> : <div className={styles.birthGrid}>
        <div className={styles.birthIntro}><h2 id="harbor-title">처음은,<br />이름을 불러주는 것.</h2><p>거창한 이야기가 아니어도 좋아요.<br />오늘의 마음을 한 줄만 건네볼까요?</p><span className={styles.handNote}>작은 이름, 커다란 친구 ↗</span></div>
        <form className={styles.birthForm} onSubmit={event => submitWhale(event)}>
          <div className={styles.formFields}><label htmlFor="whale-name">고래의 이름 <span>필수 · 20자 이내</span><input ref={birthName} id="whale-name" name="name" placeholder="어떤 이름으로 불러줄까요?" maxLength={20} required autoComplete="off" aria-describedby={formError ? "birth-error" : undefined} /></label><label htmlFor="whale-line">고래에게 건네는 한 줄 <span>선택 · 80자 이내</span><textarea id="whale-line" name="line" placeholder="말하지 않아도 괜찮아. 함께 유영하자." maxLength={80} rows={2} /></label></div>
          {formError && <p id="birth-error" className={styles.error} role="alert">{formError}</p>}
          <div className={styles.birthSubmit}><p>가입 없이, 결제 없이.<br />이 브라우저에서 기억할게요.</p><button type="submit" className={styles.primary}>내 고래로 만나기 <span aria-hidden="true">↗</span></button></div>
        </form>
      </div>}
      {warning && <p className={styles.warning} role="alert">{warning}</p>}
      {corrupt && <p className={styles.warning} role="alert">이전 기록의 형식을 읽지 못했어요. 자동으로 지우지 않았습니다. 새 이름으로 만나면 이 브라우저의 이전 기록을 덮어씁니다.</p>}
      <p className={styles.status} role="status" aria-live="polite" aria-atomic="true">{status}</p>
    </section>

    <section className={styles.notes} aria-labelledby="notes-title"><div><p className={styles.eyebrow}>SMALL PRINT, WITH CARE</p><h2 id="notes-title">우리의 작은 약속</h2></div><div className={styles.noteGrid}><article><span>01 / 이곳에만 머물러요</span><p>이름과 한 줄, 만남 기록은 이 브라우저에 저장돼요. 계정에 연결되거나 다른 기기로 동기화되지 않아요. 사이트 데이터 삭제·시크릿 모드 종료 시 사라질 수 있어요.</p></article><article><span>02 / 같은 모습, 다른 이야기</span><p>지금은 기존 고래 이미지에 이름과 이야기를 붙이는 무료 베타예요. 고유한 외형이나 전 세계에서 단 하나인 고래를 발급하는 서비스는 아니에요.</p></article><article><span>03 / 보내기 전에 알려드려요</span><p>입력한 이름과 한 줄을 서버·주소·분석 이벤트로 보내지 않아요. 사이트에는 기존 Vercel Analytics 방문 통계가 있어요. 카드와 소감 파일은 직접 내려받으며 자동 제출되지 않아요.</p></article></div></section>

    <dialog ref={details} className={styles.dialog} aria-labelledby="details-title" onClose={closeDialog}><div className={styles.dialogHeading}><span className={styles.eyebrow}>HELLO, LITTLE FRIEND</span><button type="button" className={styles.close} aria-label="고래 살펴보기 닫기" onClick={() => details.current?.close()}>×</button></div><img className={styles.dialogWhale} src="/home/gobibi/whale.webp" width="1375" height="555" alt="하늘을 유영하는 파란 고래" /><h2 id="details-title">{whale?.name ?? "아직 이름 없는 고래"}</h2><p className={styles.dialogStory}>{whale?.line || (whale ? "곁에 있어 주는 것만으로 좋아요." : "아래 첫 만남에서 이름을 붙여 주세요.")}</p><p>{whale ? MOODS[whale.mood].line : "이름이 생기기 전에도, 잠깐 같이 날아도 좋아요."}</p>{whale && <p className={styles.date}>처음 만난 날 · {dateLabel(whale.born)}</p>}<button type="button" className={styles.primary} onClick={() => details.current?.close()}>다시 하늘로 ↗</button></dialog>

    <dialog ref={edit} className={styles.dialog} aria-labelledby="edit-title" onClose={closeDialog}><div className={styles.dialogHeading}><span className={styles.eyebrow}>A NEW LITTLE CHAPTER</span><button type="button" className={styles.close} aria-label="수정 창 닫기" onClick={() => edit.current?.close()}>×</button></div><h2 id="edit-title">다시 불러줄 이름</h2><p>처음 만난 날과 함께한 기록은 그대로 남아요.</p><form ref={editForm} className={styles.dialogForm} onSubmit={event => submitWhale(event, true)}><label htmlFor="edit-name">이름 · 20자 이내<input id="edit-name" name="name" maxLength={20} required autoComplete="off" aria-describedby={editError ? "edit-error" : undefined} /></label><label htmlFor="edit-line">한 줄 · 선택, 80자 이내<textarea id="edit-line" name="line" maxLength={80} rows={3} /></label>{editError && <p id="edit-error" className={styles.error} role="alert">{editError}</p>}<button type="submit" className={styles.primary}>이름과 한 줄 저장</button></form></dialog>

    <dialog ref={remove} className={styles.dialog} aria-labelledby="delete-title" aria-describedby="delete-description" onClose={closeDialog}><div className={styles.dialogHeading}><span className={styles.eyebrow}>SAY GOODBYE?</span><button type="button" className={styles.close} aria-label="삭제 창 닫기" onClick={() => remove.current?.close()}>×</button></div><h2 id="delete-title">이 하늘의 기록을 지울까요?</h2><p id="delete-description">이 브라우저의 고래 이름, 한 줄, 만남 기록이 지워져요. 되돌릴 수 없어요. 이미 내려받은 카드와 소감 파일은 지워지지 않아요.</p><div className={styles.deleteActions}><button type="button" className={styles.primary} onClick={() => remove.current?.close()}>아니요, 곁에 둘게요</button><button type="button" className={styles.danger} onClick={() => { const removed = store.remove(); remove.current?.close(); if (removed) { setStatus("이 브라우저의 고래 기록을 지웠어요."); setFormError(""); (feedback.current?.querySelector("form") as HTMLFormElement | null)?.reset(); requestAnimationFrame(() => birthName.current?.focus()); } }}>네, 기록을 지울게요</button></div></dialog>

    <dialog ref={feedback} className={styles.dialog} aria-labelledby="feedback-title" onClose={closeDialog}><div className={styles.dialogHeading}><span className={styles.eyebrow}>A NOTE AFTER OUR FLIGHT</span><button type="button" className={styles.close} aria-label="소감 창 닫기" onClick={() => feedback.current?.close()}>×</button></div><h2 id="feedback-title">고래와 만나보니 어땠나요?</h2><p>소감은 파일로만 내려받아요. 자동 제출·구매·예약은 일어나지 않아요.</p><form className={styles.dialogForm} onSubmit={exportFeedback}><fieldset><legend>다시 만나고 싶나요? <span>(필수)</span></legend><div className={styles.radioChoices}>{[["yes", "다시 보고 싶어요"], ["maybe", "조금 더 만나볼래요"], ["no", "한 번이면 충분해요"]].map(([value, label]) => <label key={value}><input type="radio" name="returnIntent" value={value} required />{label}</label>)}</div></fieldset><label htmlFor="feedback-reason">그렇게 느낀 이유 · 선택<textarea id="feedback-reason" name="reason" rows={3} maxLength={300} placeholder="300자 이내로 적어 주세요." aria-describedby="feedback-privacy" /></label><p id="feedback-privacy" className={styles.finePrint}>이름·고래 이야기·ID는 자동 포함하지 않아요. 이 소감 칸에도 이름이나 연락처 등 개인정보는 적지 말아 주세요. 목적지·카드 횟수와 재방문 여부는 포함돼요.</p><label htmlFor="purchase-intent">언젠가 유료 서비스가 된다면?<select id="purchase-intent" name="purchaseIntent" defaultValue="unsure"><option value="unsure">아직 모르겠어요</option><option value="free-only">무료로만 쓸 것 같아요</option><option value="consider">소액 1회 구매라면 검토해요</option></select></label><button type="submit" className={styles.primary}>소감 JSON 내려받기 ↓</button></form></dialog>
  </main>;
}
