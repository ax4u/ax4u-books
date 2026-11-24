import type { Metadata } from "next";
import GobibiShell from "@/app/components/gobibi/GobibiShell";
import PageHero from "@/app/components/gobibi/PageHero";
import { pageSocialMetadata } from "@/lib/site-metadata";
import JinhaeMapExplorer from "./JinhaeMapExplorer";
import styles from "./porpoise-map.module.css";
import "./jinhae-map.global.css";

const title = "진해 바다 상괭이 지도 — 언제, 어디로 나가야 만날까 | GOBIBI";
const description =
  "진해만 상괭이 먹이사냥 지도. 월·시간대·출항지를 고르면 기대 조우 확률과 추천 수역, 개략 항로를 보여 드려요. 멸치·전어·숭어·학꽁치·갈치·두족류·갑각류 시즌과 현장 수칙, 조사 기관 안내까지.";

export const metadata: Metadata = {
  ...pageSocialMetadata("/jinhae-map"),
  title,
  description,
  openGraph: {
    ...pageSocialMetadata("/jinhae-map").openGraph,
    title,
    description,
  },
  twitter: {
    ...pageSocialMetadata("/jinhae-map").twitter,
    title,
    description,
  },
};

function kstMonth(): number {
  const value = new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "Asia/Seoul" }).format(new Date());
  const month = Number(value);
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : 11;
}

const RULES = [
  {
    title: "오전 8시부터 12시",
    text: "같은 바다에서도 시간이 절반을 바꿔요. 가덕도 일대 드론 조사에서 오전 발견율은 91%를 넘었고, 13~14시에는 55% 수준으로 떨어졌어요. 출항은 가능하면 오전에 잡아 주세요.",
  },
  {
    title: "풍속 3~4m/s, 파고 0.5m 이하",
    text: "상괭이는 등지느러미가 없어 수면 위로 드러나는 부분이 아주 작아요. 너울이 이는 날은 오전이라도 육안 식별이 급격히 어려워져요. 해상예보에서 풍속과 파고를 먼저 확인하세요.",
  },
  {
    title: "500m 전부터 감속, 300m에서 엔진 OFF",
    text: "상괭이는 예민해서 배가 가까이 오면 먼저 피해요. 스팟에 들어서기 전부터 속도를 줄이고, 300m에서 엔진을 끄고 돛으로 천천히 접근하면 무리가 놀라지 않아요.",
  },
  {
    title: "수면 20~30도 아래를 천천히",
    text: "먼 곳을 뚫어지게 보지 말고 가까운 물결을 천천히 훑으세요. 편광 선글라스를 쓰고 두 사람이 좌우를 나눠 보면 놓칠 확률이 줄어요. 잔물결이 갑자기 납작해지는 자리를 보세요.",
  },
  {
    title: "드론은 고도 50~80m에서",
    text: "드론을 함께 띄우면 선박 육안 조사보다 3~6배 더 발견했어요. 다만 무리 위를 오래 머물지 말고 300m 거리를 지키며, 해양포유류 접근 규정을 따라야 해요.",
  },
  {
    title: "만조·간조 1~2시간 전후",
    text: "조류가 움직일 때 먹이활동이 늘어요. 반대로 조류와 바람이 반대면 파고가 금방 높아지니, 물때와 풍향을 함께 보세요.",
  },
];

const ORGS = [
  {
    name: "해양동물생태보전연구소 MARC",
    role: "상괭이의 음향·행동·형태를 연구하고, 남해와 부산에서 시민 과학 강연을 열어요.",
    links: [
      { label: "홈페이지 ↗", href: "https://marckorea718.org/" },
      { label: "인스타그램 ↗", href: "https://www.instagram.com/marckorea718/" },
    ],
  },
  {
    name: "국립수산과학원 고래연구소",
    role: "가덕도와 남해안의 목시·음향 조사, 혼획·분포 조사를 맡는 국가 연구 기관이에요.",
    links: [{ label: "기관 안내 ↗", href: "https://www.nifs.go.kr/contents/actionContentsCons0058.do" }],
  },
  {
    name: "핫핑크돌핀스",
    role: "토종돌고래 상괭이와 남방큰돌고래를 지키는 현장 모니터링 단체예요.",
    links: [
      { label: "홈페이지 ↗", href: "http://hotpinkdolphins.org/" },
      { label: "인스타그램 ↗", href: "https://www.instagram.com/hotpinkdolphins/" },
    ],
  },
  {
    name: "거제자연의벗 · 거제에코투어",
    role: "거제 옥포만 일대에서 상괭이와 숭어떼를 목격하고 기록해요.",
    links: [
      { label: "인스타그램 ↗", href: "https://www.instagram.com/geojedo_captain/" },
      { label: "유튜브 ↗", href: "http://www.youtube.com/@Geojedocaptain" },
    ],
  },
  {
    name: "부산녹색연합",
    role: "가덕도 외양포·대항항 일대 탐사와 해양생태 감시를 이어가요.",
    links: [{ label: "홈페이지 ↗", href: "https://green-busan.org/" }],
  },
  {
    name: "마창진환경운동연합",
    role: "진해만 해양생태 모니터링과 지역 환경 운동을 함께해요.",
    links: [{ label: "홈페이지 ↗", href: "https://mcj.ekfem.or.kr/" }],
  },
];

const SOURCES = [
  {
    title: "해양수산부 보도자료, 「경남 고성군에 상괭이를 위한 해양생물보호구역 생긴다」, 2019-12-30",
    note: "하이면 앞바다 약 2.1㎢를 해양생물보호구역으로 지정. 국내에서 두 번째 해양생물보호구역이에요.",
    href: "https://www.mof.go.kr/doc/ko/selectDoc.do?bbsSeq=10&docSeq=28367&menuSeq=971",
    label: "원문 보기",
  },
  {
    title: "해양수산부 고시 제2019-201호, 「경남 고성군 하이면 해역 해양보호구역 지정고시」, 2019-12-26",
    note: "보호구역의 위치와 범위를 확인할 수 있는 지정 고시예요.",
    href: "https://www.mof.go.kr/doc/ko/selectDoc.do?bbsSeq=9&docSeq=28292&menuSeq=375",
    label: "원문 보기",
  },
  {
    title: "해양수산부 보도자료, 「코드명 '상괭이 보호 대작전'을 실행하라」, 2021-02-02",
    note: "2020년 드론 조사에서 선박 목시조사보다 3~6배 높은 발견율을 기록했어요.",
    href: "https://www.mof.go.kr/doc/ko/selectDoc.do?bbsSeq=10&docSeq=37506&menuSeq=971",
    label: "원문 보기",
  },
  {
    title: "국립수산과학원, 「수과원, 사천시·국립공원공단과 상괭이 보전 협력」, 2025-07-23",
    note: "2023년 남해안 항공 목시조사 자원량은 춘계 3,995마리, 추계 3,163마리로 추정됐어요.",
    href: "https://www.nifs.go.kr/news/actionNewsView.do?NEWS_SEQ=4715",
    label: "원문 보기",
  },
  {
    title: "「음향을 이용한 남해 연안에 서식하는 상괭이의 출현 특성 연구」, 한국수산과학회지, 2021",
    note: "일출과 일몰 무렵 상괭이 출현이 다시 오르는 패턴을 음향으로 확인한 연구예요.",
    href: "https://www.nifs.go.kr/contents/actionContentsCons0058.do",
    label: "연구 목록",
  },
  {
    title: "가덕도 일대 드론·목시 조사 요약",
    note: "오전 8~12시 발견율 91% 이상, 13~14시 55% 수준. 조사 요약값이며 원자료는 조사 기관에 문의해야 해요.",
  },
  {
    title: "진해수협 위판 동향",
    note: "전어 위판이 8~11월에 집중되고 8~9월이 가장 많아요. 지역 어판장 자료로 정리했어요.",
  },
];

export default function JinhaeMapPage() {
  return (
    <GobibiShell theme="sky" className={styles.page}>
      <main id="main">
        <PageHero
          compact
          scene="arrival"
          eyebrow="SANG#MUNG FIELD GUIDE · 진해 바다"
          title={
            <>
              언제, 어디로
              <br />
              나가야 <em>만날까.</em>
            </>
          }
          description={
            <>
              진해만에서 상괭이를 만나려면 시기와 시간, 자리가 함께 맞아야 해요.
              <br />
              조사 자료와 계절 어황을 겹쳐 만든 지도로 오늘의 출항을 골라 보세요.
            </>
          }
        >
          <a className={styles.primaryLink} href="#planner">
            출항 결정판 열기 <span aria-hidden="true">↓</span>
          </a>
          <a className={styles.textLink} href="#map">
            먹이 지도 먼저 보기 <span aria-hidden="true">↗</span>
          </a>
        </PageHero>

        <section className={styles.stats} aria-label="조사로 확인된 숫자">
          <div className={styles.stat}>
            <strong>
              91<small>%+</small>
            </strong>
            <span>
              가덕도 일대 드론 조사
              <br />
              오전 8~12시 발견율
              <em>13~14시는 55% 수준</em>
            </span>
          </div>
          <div className={styles.stat}>
            <strong>
              3~6<small>배</small>
            </strong>
            <span>
              드론을 함께 띄웠을 때
              <br />
              선박 육안 조사 대비 발견율
            </span>
          </div>
          <div className={styles.stat}>
            <strong>
              3,995<small>마리</small>
            </strong>
            <span>
              2023년 남해안 항공 목시조사
              <br />
              상괭이 자원량(춘계)
            </span>
          </div>
          <div className={styles.stat}>
            <strong>
              2.1<small>㎢</small>
            </strong>
            <span>
              고성 하이면
              <br />
              상괭이 해양생물보호구역
              <em>2019년 지정</em>
            </span>
          </div>
        </section>

        <JinhaeMapExplorer initialMonth={kstMonth()} />

        <section id="at-sea" className={styles.band} aria-labelledby="at-sea-title">
          <div className={styles.sectionMeta}>
            <span>04 — AT SEA</span>
            <span>확률을 실제로 끌어올리는 여섯 가지</span>
          </div>
          <div className={styles.sectionHeading}>
            <h2 id="at-sea-title">배 위에서 지키는 것.</h2>
            <p>
              좋은 자리와 시간을 골라도, 배 위의 태도가 마지막 절반을 만들어요.
              <br />
              관측을 약속하는 대신, 기다릴 준비를 해 두세요.
            </p>
          </div>

          <div className={styles.ruleGrid}>
            {RULES.map((rule, index) => (
              <article key={rule.title} className={styles.rule}>
                <span className={styles.ruleNumber} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{rule.title}</h3>
                <p>{rule.text}</p>
              </article>
            ))}
          </div>

          <div className={styles.guideNote}>
            <div>
              <p className={styles.eyebrow}>A SMALL SCRIPT FOR THE DECK</p>
              <h3>배 위에서 건넬 세 마디.</h3>
              <p>
                요트 투어 해설로 쓰기 좋은 짧은 문장이에요. 관측을 약속하지 말고, 기다리는 태도를 전해 주세요.
                <br />
                상괭이는 등지느러미가 없고, 배가 다가오면 먼저 피하는 동물이에요.
              </p>
            </div>
            <div className={styles.guideLines}>
              <p className={styles.guideLine}>
                <span>SCENE 01</span>
                “저기, 물결이 갑자기 납작해진 곳. 상괭이가 숨을 쉬러 올라온 자리예요.”
              </p>
              <p className={styles.guideLine}>
                <span>SCENE 02</span>
                “등지느러미가 없어서 등이 둥글게 미끄러져요. 돌고래와 다른 점이에요.”
              </p>
              <p className={styles.guideLine}>
                <span>SCENE 03</span>
                “우리는 300m 밖에서 기다릴게요. 먼저 다가오는 건, 상괭이 쪽이니까요.”
              </p>
            </div>
          </div>
        </section>

        <section id="who" className={styles.band} aria-labelledby="who-title">
          <div className={styles.sectionMeta}>
            <span>05 — WHO STUDIES THEM</span>
            <span>현장에서 상괭이를 지켜보는 사람들</span>
          </div>
          <div className={styles.sectionHeading}>
            <h2 id="who-title">상괭이를 기록하는 사람들.</h2>
            <p>
              이 지도의 숫자는 이들의 조사와 기록 위에 서 있어요.
              <br />
              더 정확한 소식은 각 기관의 채널에서 확인할 수 있어요.
            </p>
          </div>

          <div className={styles.directory}>
            {ORGS.map((org) => (
              <article key={org.name} className={styles.orgCard}>
                <h3>{org.name}</h3>
                <p className={styles.orgRole}>{org.role}</p>
                <div className={styles.orgLinks}>
                  {org.links.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="sources" className={styles.band} aria-labelledby="sources-title">
          <div className={styles.sectionMeta}>
            <span>06 — SOURCES & NOTES</span>
            <span>숫자가 어디서 왔는지</span>
          </div>
          <div className={styles.sectionHeading}>
            <h2 id="sources-title">확률을 읽는 법.</h2>
            <p>
              이 페이지의 확률은 공개 조사와 계절 어황으로 계산한 추정값이에요.
              <br />
              조우를 보장하지 않으니, 마지막 판단은 바다에서 해 주세요.
            </p>
          </div>

          <div className={styles.noteGrid}>
            <div className={`${styles.noteBox} ${styles.noteMint}`}>
              <h3>숫자를 읽는 법</h3>
              <p>
                <b>기대 확률</b>은 그 달·시간대·출항지에서 가장 가까운 추천 수역의 값이에요. 오전 골든타임을 100으로
                두고, 한낮은 60%, 일몰은 92%로 계산했어요.
              </p>
              <p>
                <b>신뢰도 A/B/C</b>는 그 수역에 쌓인 조사 자료의 밀도예요. <b>±값</b>은 자료 편차를 감안한 범위이고,
                한낮에는 더 넓어져요.
              </p>
              <p>당일 해상 상태와 조업, 조류에 따라 달라지므로 출항 전 현지 안내를 꼭 확인해 주세요.</p>
            </div>
            <div className={`${styles.noteBox} ${styles.noteButter}`}>
              <h3>꼭 지켜 주세요</h3>
              <p>상괭이는 해양보호생물이에요. 포획·유통·판매가 금지되어 있어요.</p>
              <p>무리와는 300m 이상 거리를 두고, 추격·선회·새끼 무리 접근은 하지 않아요.</p>
              <p>고성 하이면 보호구역 안쪽에는 들어가지 않아요. 관측보다 보전이 먼저예요.</p>
              <p>출항 전 기상청 해상예보와 현지 통제 안내를 확인해요.</p>
            </div>
          </div>

          <ol className={styles.sourceList}>
            {SOURCES.map((source) => (
              <li key={source.title} className={styles.sourceItem}>
                <div>
                  {source.title}
                  {source.href ? (
                    <>
                      {" "}
                      <a href={source.href} target="_blank" rel="noopener noreferrer">
                        {source.label} ↗
                      </a>
                    </>
                  ) : null}
                  <small>{source.note}</small>
                </div>
              </li>
            ))}
          </ol>

          <p className={styles.footnote}>
            <b>자료 정리 2026년 11월.</b> 확률표는 새 조사와 계절 어황이 나오면 다시 계산해요. 빠진 자료나 현장 기록이
            있다면 <a href="mailto:7pmbooks@gmail.com">7pmbooks@gmail.com</a>으로 알려 주세요. 이 페이지는 상괭이를 만나러
            가는 사람을 위한 비상업 안내이며, 관측이나 예약을 보장하지 않아요.
          </p>
        </section>
      </main>
    </GobibiShell>
  );
}
