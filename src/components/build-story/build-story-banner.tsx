import { useGetLocale } from "@refinedev/core";
import {
  Bot,
  ChevronDown,
  Clock,
  Download,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// "Behind the build" banner for the SCM-family portals. Self-contained and
// bilingual (picks en/zh from the current locale — no i18n keys needed by the
// host app). Shows: which model built the portal + an effective-time Gantt
// (relative time; overlapping bars = parallel), and a collapsible "Roles &
// demo logins" panel with test accounts. Times are estimates. Purely
// presentational — pass a per-app `story`.
// ---------------------------------------------------------------------------

export type BiText = { en: string; zh: string };

export type BuildTrack = {
  label: BiText;
  models: string[];
  start: number; // minutes from t0 (overlapping spans = parallel)
  minutes: number;
};

export type RoleEntry = {
  name: BiText;
  can: BiText;
  account: string;
  password: string;
};

export type BuildStory = {
  models: string[];
  moduleCount?: number;
  intro?: BiText;
  tracks: BuildTrack[];
  roles?: RoleEntry[];
};

const MODEL_TONE: Record<string, string> = {
  "DeepSeek V4 Flash 0731":
    "bg-indigo-500/12 text-indigo-700 ring-indigo-500/20 dark:text-indigo-300",
  "Opus 4.8":
    "bg-violet-500/12 text-violet-700 ring-violet-500/20 dark:text-violet-300",
  "Sonnet 5": "bg-sky-500/12 text-sky-700 ring-sky-500/20 dark:text-sky-300",
};
const MODEL_BAR: Record<string, string> = {
  "DeepSeek V4 Flash 0731": "bg-indigo-500/85",
  "Opus 4.8": "bg-violet-500/85",
  "Sonnet 5": "bg-sky-500/85",
};

function useZh() {
  const getLocale = useGetLocale();
  const l = (getLocale?.() as string) || "en";
  return String(l).toLowerCase().startsWith("zh");
}

function ModelPill({ model }: { model: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        MODEL_TONE[model] ??
          "bg-slate-500/12 text-slate-700 ring-slate-500/20 dark:text-slate-300"
      )}
    >
      {model}
    </span>
  );
}

function fmtDuration(minutes: number, zh: boolean) {
  if (minutes <= 0) return "";
  if (minutes < 60) return `${Math.round(minutes)}${zh ? " 分钟" : " min"}`;
  const h = minutes / 60;
  const hs = Number.isInteger(h) ? `${h}` : h.toFixed(1);
  return `${hs}${zh ? " 小时" : "h"}`;
}

const T = {
  title: { en: "Built by an AI agent", zh: "由 AI Agent 搭建" },
  badge: { en: "100% agent-built", zh: "100% Agent 构建" },
  descFallback: {
    en: "This portal was designed and coded end-to-end by an AI coding agent. It's an open demo: download it and keep customizing it with your own agent.",
    zh: "这个门户从设计到编码全部由 AI 编码 agent 完成。它是一个开放 demo:下载后,用你自己的 agent 继续定制。",
  },
  buildTime: { en: "Build time", zh: "有效搭建" },
  modules: { en: "modules", zh: "个模块" },
  downloadable: {
    en: "Downloadable · agent-editable",
    zh: "可下载 · Agent 可改",
  },
  showTimeline: { en: "See how it was built", zh: "查看构建过程" },
  hideTimeline: { en: "Hide build timeline", zh: "收起构建过程" },
  showRoles: { en: "Roles & demo logins", zh: "角色与体验账号" },
  hideRoles: { en: "Hide roles & logins", zh: "收起角色与账号" },
  role: { en: "Role", zh: "角色" },
  can: { en: "What they can do", zh: "能做什么" },
  account: { en: "Demo account", zh: "体验账号" },
  password: { en: "Password", zh: "密码" },
};

export function BuildStoryBanner({ story }: { story: BuildStory }) {
  const zh = useZh();
  const t = (b: BiText) => (zh ? b.zh : b.en);
  const [openTl, setOpenTl] = useState(false);
  const [openRoles, setOpenRoles] = useState(false);

  const total = Math.max(1, ...story.tracks.map((x) => x.start + x.minutes));

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-transparent to-primary/[0.04] p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight">
                {t(T.title)}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Bot className="size-3" />
                {t(T.badge)}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t(story.intro ?? T.descFallback)}
            </p>
          </div>
        </div>

        {/* summary chips */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip icon={<Clock className="size-3.5" />}>
            <span className="text-muted-foreground">{t(T.buildTime)}</span>
            <span className="font-semibold tabular-nums">
              ≈ {fmtDuration(total, zh)}
            </span>
          </Chip>
          <div className="flex items-center gap-1.5">
            <Bot className="size-3.5 text-muted-foreground" />
            {story.models.map((m) => (
              <ModelPill key={m} model={m} />
            ))}
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
            <Download className="size-3" />
            {t(T.downloadable)}
          </span>
        </div>

        {/* toggles */}
        <div className="flex flex-wrap items-center gap-4 border-t border-border/60 pt-3">
          {story.tracks.length > 0 && (
            <button
              type="button"
              onClick={() => setOpenTl((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown
                className={cn("size-3.5 transition-transform", openTl && "rotate-180")}
              />
              {openTl ? t(T.hideTimeline) : t(T.showTimeline)}
            </button>
          )}
          {story.roles && story.roles.length > 0 && (
            <button
              type="button"
              onClick={() => setOpenRoles((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <KeyRound className="size-3.5" />
              {openRoles ? t(T.hideRoles) : t(T.showRoles)}
            </button>
          )}
        </div>

        {openTl && <Gantt story={story} total={total} zh={zh} t={t} />}
        {openRoles && story.roles && <RolesTable roles={story.roles} zh={zh} t={t} />}
      </div>
    </section>
  );
}

function Gantt({
  story,
  total,
  zh,
  t,
}: {
  story: BuildStory;
  total: number;
  zh: boolean;
  t: (b: BiText) => string;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const ticks: number[] = [];
  for (let x = 0; x <= total + 0.1; x += 30) ticks.push(x);
  if (ticks[ticks.length - 1] < total) ticks.push(total);

  return (
    <div className="grid grid-cols-[9rem_1fr] gap-x-3">
      <div />
      <div className="relative mb-1 h-4">
        {ticks.map((x) => (
          <span
            key={x}
            className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
            style={{ left: `${(x / total) * 100}%` }}
          >
            {x === 0 ? "0" : fmtDuration(x, zh)}
          </span>
        ))}
      </div>
      {story.tracks.map((track, i) => {
        const bar = MODEL_BAR[track.models[0]] ?? "bg-slate-500/85";
        return (
          <div key={i} className="contents">
            <div className="flex min-w-0 flex-col justify-center py-1">
              <span className="truncate text-xs font-medium text-foreground">
                {t(track.label)}
              </span>
              <span className="mt-0.5 flex flex-wrap gap-1">
                {track.models.map((m) => (
                  <ModelPill key={m} model={m} />
                ))}
              </span>
            </div>
            <div className="relative flex items-center py-1">
              {ticks.map((x) => (
                <span
                  key={x}
                  aria-hidden="true"
                  className="absolute top-0 bottom-0 w-px bg-border/40"
                  style={{ left: `${(x / total) * 100}%` }}
                />
              ))}
              <div
                className="absolute flex h-6 items-center overflow-hidden rounded-md"
                style={{
                  left: `${(track.start / total) * 100}%`,
                  width: `${(track.minutes / total) * 100}%`,
                }}
              >
                <div
                  className={cn(
                    "h-full rounded-md shadow-sm transition-[width] duration-700 ease-out",
                    bar
                  )}
                  style={{ width: grown ? "100%" : "0%", transitionDelay: `${i * 90}ms` }}
                />
                <span className="absolute right-1.5 text-[10px] font-medium tabular-nums text-white/95 drop-shadow-sm">
                  {fmtDuration(track.minutes, zh)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RolesTable({
  roles,
  t,
}: {
  roles: RoleEntry[];
  zh: boolean;
  t: (b: BiText) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{t(T.role)}</th>
            <th className="px-3 py-2 font-medium">{t(T.can)}</th>
            <th className="px-3 py-2 font-medium">{t(T.account)}</th>
            <th className="px-3 py-2 font-medium">{t(T.password)}</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r, i) => (
            <tr key={i} className="border-t border-border/40">
              <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">
                {t(r.name)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{t(r.can)}</td>
              <td className="whitespace-nowrap px-3 py-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                  {r.account}
                </code>
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                  {r.password}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background/60 px-2.5 py-1 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </span>
  );
}
