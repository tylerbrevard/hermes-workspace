import { useEffect } from 'react'
import { playgroundAudio } from '../lib/playground-audio'
import { PlaygroundHeroCanvas } from './playground-hero-canvas'

export function TitleScreen({
  displayName,
  tutorialComplete,
  onChangeDisplayName,
  onCustomize,
  onEnter,
}: {
  displayName: string
  tutorialComplete: boolean
  onChangeDisplayName: (value: string) => void
  onCustomize: () => void
  onEnter: () => void
}) {
  const canEnter = displayName.trim().length > 0

  useEffect(() => {
    playgroundAudio.playTitleEntry()
  }, [])

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 text-white"
      style={{
        background:
          'radial-gradient(circle at 50% 18%, rgba(34,211,238,0.16) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgba(168,85,247,0.18) 0%, transparent 55%), linear-gradient(160deg, #02050a 0%, #050a14 60%, #07101a 100%)',
      }}
    >
      <TitleStars />

      <div
        className="relative z-10 w-full max-w-[1080px] overflow-hidden rounded-[32px] border border-cyan-300/15"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,12,20,0.95) 0%, rgba(4,7,12,0.96) 100%)',
          boxShadow:
            '0 0 0 1px rgba(34,211,238,0.08), 0 30px 80px rgba(0,0,0,0.65), 0 0 80px rgba(34,211,238,0.08)',
        }}
      >
        <div className="relative h-[400px] overflow-hidden">
          <PlaygroundHeroCanvas />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 95%)',
            }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] backdrop-blur-md"
              style={{
                borderColor: 'rgba(250, 204, 21, 0.4)',
                background: 'rgba(0,0,0,0.55)',
                color: '#fde68a',
                boxShadow: '0 0 18px rgba(250,204,21,0.18)',
              }}
            >
              <span style={{ color: '#facc15' }}>✦</span>
              Hermes Agent Realm
              <span className="opacity-60">· Nous Research × Kimi</span>
            </div>
            <img
              src="/assets/hermesworld/art/hermesworld-logo-horizontal.svg"
              alt="HermesWorld"
              width={760}
              height={228}
              fetchPriority="high"
              decoding="async"
              className="mt-2 w-[min(760px,82vw)] max-w-full"
              style={{
                filter:
                  'drop-shadow(0 12px 34px rgba(2,7,11,0.62)) drop-shadow(0 0 34px rgba(245,217,122,0.22))',
              }}
            />
            <pre
              className="mt-3 hidden text-[8px] leading-[1.05] md:block"
              style={{
                color: 'rgba(245,217,122,0.45)',
                fontFamily: '"Menlo", "Monaco", "Courier New", monospace',
                whiteSpace: 'pre',
                margin: 0,
                textShadow: '0 0 8px rgba(245,217,122,0.3)',
              }}
            >{`_   _                             __        __         _     _
| | | | ___ _ __ _ __ ___   ___  __\\ \\      / /__  _ __| | __| |
| |_| |/ _ \\ '__| '_ \` _ \\ / _ \\/ __\\ \\ /\\ / / _ \\| '__| |/ _\` |
|  _  |  __/ |  | | | | | |  __/\\__ \\\\ V  V / (_) | |  | | (_| |
|_| |_|\\___|_|  |_| |_| |_|\\___||___/ \\_/\\_/ \\___/|_|  |_|\\__,_|`}</pre>
            <div
              className="mt-2 text-[10px] font-bold uppercase tracking-[0.45em]"
              style={{ color: 'rgba(245, 217, 122, 0.7)' }}
            >
              — the agent MMO —
            </div>
            <p className="mt-5 max-w-[560px] text-[15px] leading-relaxed text-white/72">
              {displayName.trim().length === 0
                ? 'Step into a shared world of Hermes agents. Train, build, and quest with builders worldwide.'
                : tutorialComplete
                  ? `Welcome back, ${displayName}. Six worlds await.`
                  : `${displayName}, your training awaits. Six worlds. One builder. Forge your path.`}
            </p>
          </div>
        </div>

        <div className="relative grid gap-6 p-7 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-4">
            <div
              className="rounded-2xl border p-5"
              style={{
                borderColor: 'rgba(245, 217, 122, 0.18)',
                background:
                  'linear-gradient(180deg, rgba(245,217,122,0.04) 0%, rgba(0,0,0,0.3) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(245,217,122,0.06)',
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{ color: '#fde68a' }}
              >
                Builder
              </div>
              <input
                value={displayName}
                onChange={(event) =>
                  onChangeDisplayName(event.target.value.slice(0, 24))
                }
                placeholder="Builder name..."
                maxLength={24}
                className="mt-3 w-full rounded-xl border-2 bg-black/40 px-4 py-3.5 text-base text-white outline-none placeholder:text-white/25"
                style={{ borderColor: 'rgba(245,217,122,0.25)' }}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onCustomize}
                  className="flex-shrink-0 rounded-xl border-2 px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] hover:scale-[1.02]"
                  style={{
                    borderColor: 'rgba(255,255,255,0.18)',
                    color: 'rgba(255,255,255,0.85)',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  Avatar
                </button>
                <button
                  type="button"
                  onClick={onEnter}
                  disabled={!canEnter}
                  className="flex-1 rounded-xl border-2 px-6 py-3 text-base font-extrabold uppercase tracking-[0.18em] transition-[color,background-color,border-color,box-shadow,opacity,transform,width,height,max-height] hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
                  style={{
                    borderColor: '#facc15',
                    color: '#0b1320',
                    background:
                      'linear-gradient(180deg, #fde68a 0%, #fbbf24 50%, #d4a017 100%)',
                    boxShadow: canEnter
                      ? '0 0 30px rgba(250,204,21,0.45), inset 0 1px 0 rgba(255,255,255,0.5)'
                      : 'none',
                  }}
                >
                  Enter
                </button>
              </div>
            </div>
            <div className="grid gap-2 text-[12px] sm:grid-cols-3">
              <PremiumFeatureCard
                icon="❁"
                title="Worlds"
                desc="Training Grounds → Forge → Arena"
              />
              <PremiumFeatureCard
                icon="⛔"
                title="Multiplayer"
                desc="Walk with builders worldwide"
              />
              <PremiumFeatureCard
                icon="🔮"
                title="Skills"
                desc="Promptcraft · Memory · Diplomacy"
              />
            </div>
          </div>

          <div
            className="rounded-2xl border p-5 text-sm text-white/80"
            style={{
              borderColor: 'rgba(34,211,238,0.18)',
              background:
                'linear-gradient(180deg, rgba(34,211,238,0.04) 0%, rgba(0,0,0,0.3) 100%)',
            }}
          >
            <div
              className="text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: 'rgba(34,211,238,0.85)' }}
            >
              Path
            </div>
            <ol className="mt-4 space-y-3 text-[13px]">
              {[
                'Meet Athena. Claim the Hermes Sigil.',
                'Equip your kit at the Quartermaster.',
                'Send your first chat message.',
                'Visit the Archive Podium.',
                'Pass through the Forge Gate.',
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold"
                    style={{
                      borderColor: 'rgba(34,211,238,0.35)',
                      color: '#22d3ee',
                      background: 'rgba(34,211,238,0.08)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="leading-tight text-white/75">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

function TitleStars() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 opacity-60">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1px 1px at 20% 30%, white 50%, transparent), radial-gradient(1px 1px at 70% 60%, white 50%, transparent), radial-gradient(1px 1px at 40% 80%, rgba(245,217,122,0.7) 50%, transparent), radial-gradient(2px 2px at 85% 15%, rgba(34,211,238,0.6) 50%, transparent), radial-gradient(1px 1px at 10% 75%, white 50%, transparent), radial-gradient(1.5px 1.5px at 55% 25%, rgba(168,85,247,0.5) 50%, transparent)',
          backgroundSize: '600px 600px',
          animation: 'hermesworld-stars 90s linear infinite',
        }}
      />
      <style>{`
        @keyframes hermesworld-stars {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-600px, -300px); }
        }
      `}</style>
    </div>
  )
}

function PremiumFeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string
  title: string
  desc: string
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.025)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[14px]" style={{ color: '#fbbf24' }}>
          {icon}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white">
          {title}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-white/55">{desc}</div>
    </div>
  )
}
