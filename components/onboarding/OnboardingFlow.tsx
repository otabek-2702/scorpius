"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, GraduationCap, Link2, Phone, Sparkles, Star } from "lucide-react";
import { saveProfile } from "@/lib/profile";

interface Profile {
  username: string;
  grade: number;
  age: number;
  parentPhone: string;
  interests: string[];
  favouriteSubject: string;
  hardestSubject: string;
  goal: string;
  painPoint: string;
  subInterests: Record<string, string>;
}

const INTERESTS = [
  "Futbol",
  "Super-qahramonlar",
  "Video o'yinlar",
  "Kosmos",
  "Musiqa",
  "Tabiat",
  "Texnologiya",
  "San'at",
];

/** Sub-category branches — when one of these interests is picked, a follow-up
 *  step asks the student which specific favourite they like most. Captured into
 *  profile.subInterests for lesson-flavour personalization. */
const SUB_INTERESTS: Record<string, string[]> = {
  "Super-qahramonlar": ["Batman", "Spider-Man", "Iron Man", "Thor"],
  "Avtomobillar": ["Mercedes", "BMW", "Tesla", "Lamborghini"],
  "Futbol": ["Real Madrid", "Barcelona", "Liverpool", "Bayern"],
  "Video o'yinlar": ["Minecraft", "Fortnite", "GTA", "FIFA"],
};

/** Pain-validation options — high-signal answers that drive empathy-first copy on
 *  the personalising screen ("Sizning eng qiyin daqiqangiz — biz buni hal qilamiz"). */
const PAIN_POINTS = [
  "Tushuntirish yo'q — javobni ko'rsatib bera olmaydilar",
  "Yolg'iz qoldim — biror joyda tiqilib qolaman",
  "Dars uzun va zerikarli",
  "Vaqtim yo'q — kasplar to'plangan",
  "Boshqa sabab",
];

const SUBJECTS = [
  "Matematika",
  "Fizika",
  "Ona tili",
  "Adabiyot",
  "Tarix",
  "Tabiiy fan",
  "Ingliz tili",
  "Informatika",
  "Geografiya",
];

const GOALS = [
  "Baholarimni yaxshilash",
  "Imtihonga tayyorlanish",
  "Yangi narsa o'rganish",
  "Sevimli fanni chuqurroq bilish",
];

const STARS = [
  { top: 8, left: 16, s: 2 },
  { top: 14, left: 78, s: 1.5 },
  { top: 26, left: 40, s: 1 },
  { top: 33, left: 88, s: 2 },
  { top: 47, left: 9, s: 1.5 },
  { top: 58, left: 70, s: 1 },
  { top: 66, left: 28, s: 2 },
  { top: 74, left: 90, s: 1.5 },
  { top: 82, left: 52, s: 1 },
  { top: 90, left: 20, s: 1.5 },
];

function Frame({
  step,
  totalSteps,
  onBack,
  children,
}: {
  step: number;
  totalSteps: number;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {STARS.map((st, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-star-bright"
            style={{ top: `${st.top}%`, left: `${st.left}%`, width: st.s, height: st.s, opacity: 0.4 }}
          />
        ))}
      </div>

      <div className="absolute left-0 right-0 top-5 flex items-center justify-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === step ? 22 : 7,
              backgroundColor: i <= step ? "var(--color-antares-500)" : "var(--color-void-600)",
            }}
          />
        ))}
      </div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Orqaga"
          className="absolute left-5 top-11 flex h-9 w-9 items-center justify-center rounded-full border border-void-600 text-void-300 transition hover:text-void-100 active:scale-[0.97]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <div key={step} className="rise-in relative w-full max-w-[440px]">
        {children}
      </div>
    </main>
  );
}

function Field(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-14 w-full rounded-[14px] border border-void-500 bg-void-700 px-4 text-lg text-void-100 outline-none transition-colors placeholder:text-void-400 focus:border-antares-500"
    />
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-7 inline-flex h-[52px] w-full items-center justify-center rounded-full bg-antares-500 text-[1.05rem] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.97] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-11 w-11 rounded-full text-sm font-semibold transition active:scale-[0.94] " +
        (active
          ? "bg-antares-500 text-void-100"
          : "border border-void-600 text-void-200 hover:border-void-400")
      }
    >
      {label}
    </button>
  );
}

/** Top-of-funnel gate: commit to the personalised flow, or bail to /learn fast. */
function GateStep({ onPick }: { onPick: (personalised: boolean) => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-antares-500/12">
        <Sparkles className="h-7 w-7 text-antares-500" />
      </div>
      <h1 className="mt-5 text-[1.7rem] font-semibold leading-tight text-void-100">
        Darslarni sizga moslaymizmi?
      </h1>
      <p className="mt-2 text-void-300">
        Bir-ikki daqiqada qiziqishlaringizni so&apos;rab chiqamiz — keyin har bir
        dars siz uchun yoziladi. Yoki to&apos;g&apos;ridan-to&apos;g&apos;ri
        ko&apos;rishni boshlang.
      </p>
      <button
        type="button"
        onClick={() => onPick(true)}
        className="mt-7 inline-flex h-[58px] w-full items-center justify-center rounded-full bg-antares-500 text-[1.1rem] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.98]"
      >
        Ha, mos darslarim bo&apos;lsin
      </button>
      <button
        type="button"
        onClick={() => onPick(false)}
        className="mt-3 inline-flex h-[52px] w-full items-center justify-center rounded-full border border-void-600 text-[1rem] font-semibold text-void-200 transition hover:border-void-400 active:scale-[0.98]"
      >
        Tezkor — keyinroq sozlayman
      </button>
      <p className="mt-5 text-[11.5px] uppercase tracking-[0.14em] text-void-400">
        Ikkinchisini har doim sozlamalardan ochasiz
      </p>
    </div>
  );
}

function AccountStep({ onNext }: { onNext: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const ok = username.trim().length >= 2;
  return (
    <div>
      <h1 className="text-[1.7rem] font-semibold text-void-100">Sizni nima deb chaqiraylik?</h1>
      <p className="mt-2 text-void-300">
        Haqiqiy ism shart emas — o&apos;zingizga yoqqan nomni tanlang.
      </p>
      <div className="mt-6">
        <Field
          placeholder="Ismingiz yoki taxallus"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <PrimaryButton disabled={!ok} onClick={() => onNext(username.trim())}>
        Davom etish
      </PrimaryButton>
    </div>
  );
}

function ProfileStep({ onNext }: { onNext: (grade: number, age: number) => void }) {
  const [grade, setGrade] = useState(6);
  const [age, setAge] = useState(12);
  return (
    <div>
      <div className="flex items-center gap-2 text-void-300">
        <GraduationCap className="h-5 w-5" />
        <span className="text-sm font-medium">Sinf va yosh</span>
      </div>
      <h1 className="mt-3 text-[1.7rem] font-semibold text-void-100">
        Nechanchi sinfda o&apos;qiysiz?
      </h1>
      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Chip key={i} label={i + 1} active={grade === i + 1} onClick={() => setGrade(i + 1)} />
        ))}
      </div>
      <p className="mt-6 text-sm font-medium text-void-300">Yoshingiz</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Chip key={i} label={i + 7} active={age === i + 7} onClick={() => setAge(i + 7)} />
        ))}
      </div>
      <PrimaryButton onClick={() => onNext(grade, age)}>Davom etish</PrimaryButton>
    </div>
  );
}

/** Pain-validation step — captures the student's current biggest study struggle. */
function PainStep({ onNext }: { onNext: (pain: string) => void }) {
  const [pick, setPick] = useState("");
  return (
    <div>
      <h1 className="text-[1.7rem] font-semibold text-void-100">
        Hozir o&apos;qishda nima eng qiyin?
      </h1>
      <p className="mt-2 text-void-300">
        Bilamiz — keyin shu joyda yordam beramiz. Eng yaqinini tanlang.
      </p>
      <div className="mt-5 flex flex-col gap-2.5">
        {PAIN_POINTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPick(p)}
            className={
              "rounded-[14px] border px-4 py-3.5 text-left text-[15.5px] font-medium leading-snug transition active:scale-[0.99] " +
              (pick === p
                ? "border-antares-500 bg-antares-50 text-void-100"
                : "border-void-500 bg-void-700 text-void-100 hover:border-void-400")
            }
          >
            {p}
          </button>
        ))}
      </div>
      <PrimaryButton disabled={!pick} onClick={() => onNext(pick)}>
        Davom etish
      </PrimaryButton>
    </div>
  );
}

/** Honest "coming-soon" notice for emaktab integration. We do not fake-connect
 *  — beta integration is in progress with emaktab.uz; until that ships, this
 *  card sets the right expectation rather than lying with a setTimeout. */
function EmaktabStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-void-600">
        <Link2 className="h-7 w-7 text-void-200" />
      </div>
      <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-antares-500/12 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-antares-700">
        Tez orada · beta
      </span>
      <h1 className="mt-3 text-[1.7rem] font-semibold leading-tight text-void-100">
        emaktab.uz ulanishi
      </h1>
      <p className="mt-2 max-w-[26rem] text-void-300">
        Scorpius emaktab bilan rasmiy ulanish ustida ishlamoqda — bo&apos;lib
        bilan baholaringiz va dars jadvalingiz avtomatik tortib olinadi. Hozir
        — namuna profil bilan davom eting.
      </p>
      <PrimaryButton onClick={onNext}>Tushundim — davom etish</PrimaryButton>
      <button
        type="button"
        onClick={onNext}
        className="mt-3 w-full text-sm text-void-300 transition-colors hover:text-void-100"
      >
        O&apos;tkazib yuborish
      </button>
    </div>
  );
}

function ParentStep({ onNext }: { onNext: (phone: string) => void }) {
  const [phone, setPhone] = useState("");
  return (
    <div>
      <div className="flex items-center gap-2 text-void-300">
        <Phone className="h-5 w-5" />
        <span className="text-sm font-medium">Ota-ona aloqasi</span>
      </div>
      <h1 className="mt-3 text-[1.7rem] font-semibold text-void-100">
        Ota-onangizning raqami
      </h1>
      <p className="mt-2 text-void-300">
        Ota-onangiz yutuqlaringiz haqida qisqa hisobot oladi.
      </p>
      <div className="mt-6">
        <Field
          type="tel"
          inputMode="tel"
          placeholder="+998 90 123 45 67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <PrimaryButton onClick={() => onNext(phone.trim())}>Davom etish</PrimaryButton>
      <button
        type="button"
        onClick={() => onNext("")}
        className="mt-3 w-full text-sm text-void-300 transition-colors hover:text-void-100"
      >
        Hozircha o&apos;tkazib yuborish
      </button>
    </div>
  );
}

/** Interest step — chip-grid multi-select. One screen, faster than the prior
 *  Tinder-style swipe deck. Brand list comes from INTERESTS; "Avtomobillar" is
 *  available here too because its sub-branch is interesting in lessons. */
function InterestStep({ onNext }: { onNext: (interests: string[]) => void }) {
  const ALL = [...INTERESTS, "Avtomobillar"];
  const [picked, setPicked] = useState<string[]>([]);
  function toggle(s: string) {
    setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  }
  return (
    <div>
      <h1 className="text-[1.7rem] font-semibold text-void-100">
        Nimalar sizga qiziq?
      </h1>
      <p className="mt-2 text-void-300">
        Eng yoqqanlarini tanlang — darslarda misollar shu yo&apos;nalishda yoziladi.
      </p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        {ALL.map((s) => {
          const active = picked.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={
                "rounded-full px-4 py-2.5 text-sm font-medium transition active:scale-[0.96] " +
                (active
                  ? "bg-antares-500 text-void-100"
                  : "border border-void-600 text-void-200 hover:border-void-400")
              }
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex items-center gap-1.5 text-void-300">
        <Star className="h-4 w-4 text-star-bright" fill="currentColor" />
        <span className="text-[12.5px]">
          {picked.length === 0
            ? "Kamida bittasini tanlang"
            : `${picked.length} ta tanlandi`}
        </span>
      </div>
      <PrimaryButton disabled={picked.length === 0} onClick={() => onNext(picked)}>
        Davom etish
      </PrimaryButton>
    </div>
  );
}

/** Sub-interest branching step — only shown if the user picked an interest with
 *  a configured sub-category (Superhero/Car/Football/Games). Asks the favourite
 *  within each picked interest, one card at a time. */
function SubInterestStep({
  branchableInterests,
  onNext,
}: {
  branchableInterests: string[];
  onNext: (subs: Record<string, string>) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const current = branchableInterests[index];
  const options = SUB_INTERESTS[current] ?? [];

  function pick(option: string) {
    const next = { ...picks, [current]: option };
    setPicks(next);
    if (index + 1 >= branchableInterests.length) {
      onNext(next);
    } else {
      setIndex(index + 1);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm text-void-300">
        <span>Sevimlilaringiz</span>
        <span>
          {index + 1} / {branchableInterests.length}
        </span>
      </div>
      <h1 className="mt-3 text-[1.7rem] font-semibold leading-snug text-void-100">
        {current} — sevimlingiz qaysi?
      </h1>
      <p className="mt-2 text-void-300">
        Lessonlarda misollar shu qahramon/komanda atrofida yoziladi.
      </p>
      <div className="mt-5 flex flex-col gap-2.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => pick(opt)}
            className="rounded-[14px] border border-void-500 bg-void-700 px-4 py-4 text-left text-[1.05rem] font-medium text-void-100 transition active:scale-[0.98] hover:border-antares-500"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function SubjectsStep({
  onNext,
}: {
  onNext: (favourite: string, hardest: string) => void;
}) {
  const [favourite, setFavourite] = useState("");
  const [hardest, setHardest] = useState("");

  function chipRow(selected: string, set: (s: string) => void) {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => set(s)}
            className={
              "rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-[0.96] " +
              (selected === s
                ? "bg-antares-500 text-void-100"
                : "border border-void-600 text-void-200 hover:border-void-400")
            }
          >
            {s}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[1.7rem] font-semibold text-void-100">Fanlaringiz haqida</h1>
      <p className="mt-4 text-sm font-medium text-void-300">Sevimli faningiz</p>
      {chipRow(favourite, setFavourite)}
      <p className="mt-5 text-sm font-medium text-void-300">Eng qiyin faningiz</p>
      {chipRow(hardest, setHardest)}
      <PrimaryButton disabled={!favourite || !hardest} onClick={() => onNext(favourite, hardest)}>
        Davom etish
      </PrimaryButton>
    </div>
  );
}

function GoalStep({ onNext }: { onNext: (goal: string) => void }) {
  const [goal, setGoal] = useState("");
  return (
    <div>
      <h1 className="text-[1.7rem] font-semibold text-void-100">Maqsadingiz nima?</h1>
      <p className="mt-2 text-void-300">
        Scorpius darslaringizni shu maqsadga yo&apos;naltiradi.
      </p>
      <div className="mt-5 flex flex-col gap-3">
        {GOALS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGoal(g)}
            className={
              "rounded-[14px] border px-4 py-3.5 text-left text-base font-medium transition active:scale-[0.99] " +
              (goal === g
                ? "border-antares-500 bg-antares-50 text-void-100"
                : "border-void-500 bg-void-700 text-void-100 hover:border-void-400")
            }
          >
            {g}
          </button>
        ))}
      </div>
      <PrimaryButton disabled={!goal} onClick={() => onNext(goal)}>
        Davom etish
      </PrimaryButton>
    </div>
  );
}

function RevealStep({ profile, onFinish }: { profile: Profile; onFinish: () => void }) {
  const n = Math.max(profile.interests.length, 3);
  return (
    <div className="text-center">
      <div className="relative mx-auto h-28 w-28">
        {Array.from({ length: n }).map((_, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          return (
            <span
              key={i}
              className="absolute h-2 w-2 rounded-full bg-star-bright"
              style={{
                left: `calc(50% + ${Math.cos(angle) * 46}px - 4px)`,
                top: `calc(50% + ${Math.sin(angle) * 46}px - 4px)`,
              }}
            />
          );
        })}
        <span
          className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-antares-500"
          style={{ boxShadow: "0 0 28px 6px rgba(232,162,26,0.55)" }}
        />
      </div>
      <h1 className="mt-6 text-[1.8rem] font-semibold text-void-100">
        Mana — sizning osmoningiz
      </h1>
      <p className="mt-2 text-void-200">
        Hozircha kichik — lekin har bir o&apos;rgangan mavzuingiz unga yangi yulduz qo&apos;shadi.
      </p>
      <PrimaryButton onClick={onFinish}>Birinchi darsni boshlash</PrimaryButton>
    </div>
  );
}

/** Step IDs for the personalised path. The order here drives the progress dots
 *  and the back-button behaviour. The quick (non-personalised) path skips
 *  everything between 'profile' and 'reveal'. */
const FULL_STEPS = [
  "gate",
  "account",
  "profile",
  "pain",
  "emaktab",
  "parent",
  "interests",
  "subInterests",
  "subjects",
  "goal",
  "reveal",
] as const;
const QUICK_STEPS = ["gate", "account", "profile", "reveal"] as const;
type StepId = (typeof FULL_STEPS)[number];

export function OnboardingFlow() {
  const router = useRouter();
  const [personalised, setPersonalised] = useState(true);
  const [stepId, setStepId] = useState<StepId>("gate");
  const [history, setHistory] = useState<StepId[]>([]);
  const [profile, setProfile] = useState<Profile>({
    username: "",
    grade: 6,
    age: 12,
    parentPhone: "",
    interests: [],
    favouriteSubject: "",
    hardestSubject: "",
    goal: "",
    painPoint: "",
    subInterests: {},
  });

  const steps: readonly StepId[] = personalised ? FULL_STEPS : QUICK_STEPS;
  const stepIndex = steps.indexOf(stepId);
  const stepCount = steps.length;

  function goNext(nextId: StepId) {
    setHistory((h) => [...h, stepId]);
    setStepId(nextId);
  }
  function goBack() {
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (prev !== undefined) {
        setStepId(prev);
        return h.slice(0, -1);
      }
      return h;
    });
  }

  // Compute which interests have a sub-branch — drives whether SubInterestStep shows.
  const branchableInterests = profile.interests.filter((i) => SUB_INTERESTS[i]);

  function finish(finalProfile: Profile) {
    saveProfile({
      name: finalProfile.username,
      grade: finalProfile.grade,
      interests: finalProfile.interests,
      favouriteSubject: finalProfile.favouriteSubject,
      goal: finalProfile.goal,
      ...(finalProfile.painPoint ? { painPoint: finalProfile.painPoint } : {}),
      ...(Object.keys(finalProfile.subInterests).length > 0
        ? { subInterests: finalProfile.subInterests }
        : {}),
    });
    router.push(personalised ? "/personalizing" : "/learn");
  }

  return (
    <Frame
      step={stepIndex}
      totalSteps={stepCount}
      onBack={history.length > 0 ? goBack : undefined}
    >
      {stepId === "gate" && (
        <GateStep
          onPick={(p) => {
            setPersonalised(p);
            goNext("account");
          }}
        />
      )}
      {stepId === "account" && (
        <AccountStep
          onNext={(username) => {
            const next = { ...profile, username };
            setProfile(next);
            // Quick path: ask grade, then go straight to reveal.
            goNext("profile");
          }}
        />
      )}
      {stepId === "profile" && (
        <ProfileStep
          onNext={(grade, age) => {
            setProfile((p) => ({ ...p, grade, age }));
            goNext(personalised ? "pain" : "reveal");
          }}
        />
      )}
      {stepId === "pain" && (
        <PainStep
          onNext={(painPoint) => {
            setProfile((p) => ({ ...p, painPoint }));
            goNext("emaktab");
          }}
        />
      )}
      {stepId === "emaktab" && <EmaktabStep onNext={() => goNext("parent")} />}
      {stepId === "parent" && (
        <ParentStep
          onNext={(parentPhone) => {
            setProfile((p) => ({ ...p, parentPhone }));
            goNext("interests");
          }}
        />
      )}
      {stepId === "interests" && (
        <InterestStep
          onNext={(interests) => {
            setProfile((p) => ({ ...p, interests }));
            // Only show the sub-interest step if the user picked at least one
            // interest with a configured sub-branch.
            const nextBranchable = interests.filter((i) => SUB_INTERESTS[i]);
            goNext(nextBranchable.length > 0 ? "subInterests" : "subjects");
          }}
        />
      )}
      {stepId === "subInterests" && branchableInterests.length > 0 && (
        <SubInterestStep
          branchableInterests={branchableInterests}
          onNext={(subs) => {
            setProfile((p) => ({ ...p, subInterests: subs }));
            goNext("subjects");
          }}
        />
      )}
      {stepId === "subjects" && (
        <SubjectsStep
          onNext={(favouriteSubject, hardestSubject) => {
            setProfile((p) => ({ ...p, favouriteSubject, hardestSubject }));
            goNext("goal");
          }}
        />
      )}
      {stepId === "goal" && (
        <GoalStep
          onNext={(goal) => {
            const next = { ...profile, goal };
            setProfile(next);
            setStepId("reveal");
            setHistory((h) => [...h, "goal"]);
          }}
        />
      )}
      {stepId === "reveal" && <RevealStep profile={profile} onFinish={() => finish(profile)} />}
    </Frame>
  );
}
