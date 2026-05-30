import { useEffect, useMemo, useState } from 'react'
import { WaveChatPanelsShowcase } from './components/wave-chat-panels-showcase'
import { withBasePath } from '@/lib/base-path'

const HERMES_WORLD_ORIGIN = 'https://hermes-world.ai'

export function HermesWorldEmbed() {
  const [loaded, setLoaded] = useState(false)
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [photosensitiveMode, setPhotosensitiveMode] = useState(true)
  const [safeMode, setSafeMode] = useState(false)
  const [capability, setCapability] = useState('checking')
  const [showHelp, setShowHelp] = useState(false)
  const showPanelShowcase =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('panels') === 'wave-chat'
  const src = useMemo(() => {
    const url = new URL('/play/', HERMES_WORLD_ORIGIN)
    url.searchParams.set('embed', 'workspace')
    url.searchParams.set('source', 'hermes-workspace')
    if (reducedMotion) url.searchParams.set('reducedMotion', '1')
    if (photosensitiveMode) url.searchParams.set('photosensitive', '1')
    if (safeMode) url.searchParams.set('safeMode', '1')
    return url.toString()
  }, [photosensitiveMode, reducedMotion, safeMode])

  useEffect(() => {
    const timeout = window.setTimeout(() => setLoadTimedOut(true), 8000)
    return () => window.clearTimeout(timeout)
  }, [src])

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const webgl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      setCapability(webgl ? 'WebGL' : 'No WebGL')
    } catch {
      setCapability('No WebGL')
    }
  }, [])

  if (showPanelShowcase) {
    return <WaveChatPanelsShowcase />
  }

  return (
    <main className="relative h-full min-h-0 overflow-hidden bg-[#050015] text-white">
      {!loaded && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050015]">
          <div className="max-w-sm rounded-xl border border-white/12 bg-black/45 px-6 py-5 text-center shadow-2xl backdrop-blur-xl">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200/70">
              Workspace embed
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight">
              Opening world...
            </div>
            <div className="mt-2 text-sm text-white/58">
              hermes-world.ai
            </div>
            {loadTimedOut ? (
              <div className="mt-4 rounded-lg border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-left text-xs text-amber-100">
                Still loading. Try Full if assets are blocked.
              </div>
            ) : null}
          </div>
        </div>
      )}
      <div className="absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-xl border border-white/12 bg-black/55 px-3 py-2 text-xs font-semibold text-white/72 backdrop-blur max-sm:gap-1.5 max-sm:px-2.5 max-sm:text-[11px]">
        <a
          href={withBasePath('/dashboard')}
          className="text-cyan-100 hover:text-white"
        >
          Workspace
        </a>
        <span className="hidden text-white/25 sm:inline">|</span>
        <span className="hidden sm:inline">World</span>
        <span className="rounded-full bg-white/10 px-2 py-1">
          {loaded ? 'Loaded' : loadTimedOut ? 'Slow' : 'Loading'}
        </span>
        <span className="hidden rounded-full bg-white/10 px-2 py-1 sm:inline-flex">
          WS
        </span>
        <span className="hidden rounded-full bg-white/10 px-2 py-1 sm:inline-flex">
          Assets {loaded ? 'ready' : 'load'}
        </span>
        <span className="hidden rounded-full bg-white/10 px-2 py-1 sm:inline-flex">
          {loaded ? '100%' : loadTimedOut ? 'Blocked' : 'Pending'}
        </span>
        <span className="rounded-full bg-white/10 px-2 py-1">{capability}</span>
        <span className="hidden rounded-full bg-white/10 px-2 py-1 sm:inline-flex">
          Local
        </span>
        <span className="hidden rounded-full bg-white/10 px-2 py-1 sm:inline-flex">
          30+
        </span>
        <span className="hidden rounded-full bg-white/10 px-2 py-1 sm:inline-flex">
          512MB
        </span>
        {loadTimedOut ? (
          <span className="hidden rounded-full bg-amber-300/20 px-2 py-1 text-amber-100 sm:inline-flex">
            Timeout
          </span>
        ) : null}
      </div>
      <iframe
        title="HermesWorld"
        src={src}
        className="h-full w-full border-0 bg-[#050015]"
        allow="fullscreen; clipboard-read; clipboard-write; gamepad"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setLoaded(true)}
      />
      <div className="absolute bottom-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/12 bg-black/55 px-3 py-2 text-xs font-semibold text-white/72 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-white/10 px-3 py-2 text-white/55">
            Links
          </span>
          <a
            href={withBasePath('/conductor')}
            className="rounded-lg bg-white/10 px-3 py-2"
          >
            Conductor
          </a>
          <a
            href={withBasePath('/swarm')}
            className="rounded-lg bg-white/10 px-3 py-2"
          >
            Swarm
          </a>
          <a
            href={withBasePath('/memory')}
            className="rounded-lg bg-white/10 px-3 py-2"
          >
            Memory
          </a>
          <a
            href={withBasePath('/skills')}
            className="rounded-lg bg-white/10 px-3 py-2"
          >
            Skills
          </a>
          <a
            href={`${HERMES_WORLD_ORIGIN}/play/?scene=agora`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-white/10 px-3 py-2"
          >
            Agora
          </a>
          <a
            href={`${HERMES_WORLD_ORIGIN}/play/?scene=forge`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-white/10 px-3 py-2"
          >
            Forge
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHelp((current) => !current)}
            className="rounded-lg bg-white/10 px-3 py-2"
          >
            Controls
          </button>
          <a
            href={withBasePath('/lily?help=hermesworld')}
            className="rounded-lg bg-white/10 px-3 py-2"
          >
            LILY
          </a>
          <label className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            Motion
          </label>
          <label className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <input
              type="checkbox"
              checked={photosensitiveMode}
              onChange={(event) => setPhotosensitiveMode(event.target.checked)}
            />
            Photosafe
          </label>
          <label className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <input
              type="checkbox"
              checked={safeMode}
              onChange={(event) => setSafeMode(event.target.checked)}
            />
            Safe
          </label>
          <a
            href={`${HERMES_WORLD_ORIGIN}/play/`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-cyan-200/40 bg-cyan-200 px-3 py-2 font-black uppercase tracking-[0.14em] text-[#06121a] transition hover:bg-white"
          >
            Full
          </a>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-3 top-24 z-30 hidden rounded-xl border border-amber-200/20 bg-black/65 px-3 py-2 text-xs font-semibold text-amber-50 backdrop-blur max-sm:block">
        Rotate for full view. Full for touch.
      </div>
      <section className="absolute right-3 top-24 z-30 hidden w-[min(360px,calc(100%-1.5rem))] rounded-xl border border-white/12 bg-black/60 px-3 py-3 text-xs text-white/72 backdrop-blur sm:block">
        <h2 className="font-bold uppercase tracking-[0.16em] text-white/82">
          Launch
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/10 px-2 py-1">hermes-world.ai</span>
          <span className="rounded-full bg-white/10 px-2 py-1">workspace</span>
          <span className="rounded-full bg-white/10 px-2 py-1">iframe</span>
        </div>
      </section>
      {showHelp ? (
        <section className="absolute bottom-24 right-3 z-40 w-[min(360px,calc(100%-1.5rem))] rounded-xl border border-white/12 bg-black/70 px-3 py-3 text-xs text-white/78 backdrop-blur">
          <h2 className="font-bold uppercase tracking-[0.16em] text-white/86">
            Controls
          </h2>
          <div className="mt-2 grid gap-1">
            <span>Move: WASD / arrows / stick</span>
            <span>Talk: E / Enter / primary</span>
            <span>Camera: drag / right stick</span>
            <span>Menu: Esc / Tab / Start</span>
          </div>
        </section>
      ) : null}
    </main>
  )
}
