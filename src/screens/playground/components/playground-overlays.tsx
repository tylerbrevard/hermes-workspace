import { useEffect, useState } from 'react'

import { Toast } from './toast'
import type { RemotePlayer } from '../hooks/use-playground-multiplayer'
import { useWorkspaceStore } from '@/stores/workspace-store'

type PlaygroundRightRailProps = {
  focusMode: boolean
  adminMode: boolean
  accent: string
  onToggleFocus: () => void
  onOpenInventory: () => void
  onOpenJournal: () => void
  onOpenMap: () => void
  onOpenSettings: () => void
  onToggleAdmin: () => void
}

export function PlaygroundRightRail({
  focusMode,
  adminMode,
  accent,
  onToggleFocus,
  onOpenInventory,
  onOpenJournal,
  onOpenMap,
  onOpenSettings,
  onToggleAdmin,
}: PlaygroundRightRailProps) {
  const hudAccent = accent === '#d9b35f' ? '#F1C56D' : accent
  const railItems: Array<{
    label: string
    glyph: string
    onClick: () => void
    active?: boolean
  }> = [
    {
      label: focusMode ? 'Focus off' : 'Focus',
      glyph: '☤',
      onClick: onToggleFocus,
      active: focusMode,
    },
    { label: 'Inventory', glyph: '▣', onClick: onOpenInventory },
    { label: 'Quests', glyph: '?', onClick: onOpenJournal },
    { label: 'Map', glyph: '◇', onClick: onOpenMap },
    { label: 'World', glyph: '⚙', onClick: onOpenSettings },
    {
      label: adminMode ? 'Admin off' : 'Admin',
      glyph: '⌂',
      onClick: onToggleAdmin,
      active: adminMode,
    },
  ]

  return (
    <div
      className="pointer-events-auto fixed right-[20px] top-[214px] z-[72] hidden flex-col items-center gap-2 rounded-[24px] border px-2 py-3 text-[#F4E9D3] shadow-2xl backdrop-blur-xl md:flex"
      style={{
        borderColor: `${hudAccent}66`,
        background:
          'linear-gradient(180deg, rgba(15,22,34,.9), rgba(10,13,18,.84)), radial-gradient(circle at 50% 0%, rgba(241,197,109,.2), transparent 62%)',
        boxShadow: `0 18px 42px rgba(0,0,0,.62), 0 0 24px ${hudAccent}2e, inset 0 1px 0 rgba(244,233,211,.12)`,
      }}
    >
      {railItems.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          aria-label={item.label}
          title={item.label}
          className="relative flex h-11 w-11 items-center justify-center rounded-[15px] border text-[18px] font-black transition hover:-translate-x-0.5 hover:scale-105"
          style={{
            borderColor: item.active ? hudAccent : 'rgba(184,134,43,.4)',
            color: item.active ? '#0A0D12' : hudAccent,
            background: item.active
              ? 'linear-gradient(180deg, #F1C56D, #B8862B)'
              : 'linear-gradient(180deg, rgba(27,36,51,.72), rgba(10,13,18,.78))',
            boxShadow: item.active
              ? `0 0 18px ${hudAccent}66`
              : 'inset 0 1px 0 rgba(244,233,211,.1)',
          }}
        >
          {item.glyph}
        </button>
      ))}
    </div>
  )
}

export function MobileAbilityControls() {
  const [crouching, setCrouching] = useState(false)
  const emitCrouch = (active: boolean) => {
    setCrouching(active)
    try {
      window.dispatchEvent(
        new CustomEvent('hermesworld-mobile-crouch', { detail: { active } }),
      )
    } catch {}
  }
  const jump = () => {
    try {
      window.dispatchEvent(new CustomEvent('hermesworld-mobile-jump'))
    } catch {}
  }

  return (
    <>
      <button
        type="button"
        onClick={jump}
        className="pointer-events-auto fixed bottom-[138px] right-4 z-[74] h-14 w-14 rounded-full border-2 border-amber-200/40 bg-black/72 text-[11px] font-black uppercase tracking-[0.12em] text-amber-100 shadow-2xl backdrop-blur-xl md:hidden"
      >
        Jump
      </button>
      <button
        type="button"
        onClick={() => emitCrouch(!crouching)}
        className="pointer-events-auto fixed bottom-[104px] left-4 z-[74] rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-xl backdrop-blur-xl md:hidden"
        style={{
          background: crouching ? 'rgba(241,197,109,.24)' : 'rgba(0,0,0,.68)',
          borderColor: crouching
            ? 'rgba(241,197,109,.55)'
            : 'rgba(255,255,255,.15)',
        }}
      >
        {crouching ? 'Crouch on' : 'Crouch'}
      </button>
    </>
  )
}

export function OnboardingHintCard({ open }: { open: boolean }) {
  if (!open) return null
  return (
    <div className="pointer-events-none fixed left-1/2 top-[108px] z-[92] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-amber-200/35 bg-black/76 p-3 text-white shadow-2xl backdrop-blur-xl">
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-200/70">
        Hint
      </div>
      <div className="mt-1 text-sm font-black text-[#F1C56D]">
        Move · Talk · Jump · Crouch
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/72">
        <span>
          <kbd className="text-amber-100">WASD</kbd> Move
        </span>
        <span>
          <kbd className="text-amber-100">E</kbd> Talk
        </span>
        <span>
          <kbd className="text-amber-100">Space</kbd> Jump
        </span>
        <span>
          <kbd className="text-amber-100">Ctrl</kbd> Crouch
        </span>
      </div>
    </div>
  )
}

export function ArchiveBriefingModal({
  open,
  onClose,
  onAcknowledge,
}: {
  open: boolean
  onClose: () => void
  onAcknowledge: () => void
}) {
  if (!open) return null
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] rounded-3xl border border-violet-300/30 bg-[#070b14] p-5 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-200/80">
          Archive
        </div>
        <div className="mt-1 text-xl font-extrabold">Docs + Memory</div>
        <div className="mt-4 space-y-3 text-sm text-white/80">
          <p>
            <strong>Docs:</strong> `docs/playground/README.md` explains the
            worlds, systems, and multiplayer wiring.
          </p>
          <p>
            <strong>Memory:</strong> Hermes saves project intent in
            `memory/goals/...` so the next iteration starts with context,
            recall, and less drift.
          </p>
          <p>
            <strong>Loop:</strong> spec, state, slice, verify.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Close
          </button>
          <button
            onClick={onAcknowledge}
            className="rounded-xl border border-violet-300/40 bg-violet-400/15 px-4 py-2 text-sm font-bold text-violet-100 hover:bg-violet-400/25"
          >
            Mark read
          </button>
        </div>
      </div>
    </div>
  )
}

export function TutorialCompleteModal({
  open,
  onClose,
  onStepThroughForgeGate,
}: {
  open: boolean
  onClose: () => void
  onStepThroughForgeGate: () => void
}) {
  if (!open) return null
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-3xl border border-cyan-300/35 bg-[#070b14] p-5 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">
          Training done
        </div>
        <div className="mt-1 text-xl font-extrabold">Initiate Builder</div>
        <div className="mt-3 space-y-2 text-sm text-white/80">
          <p>Builder loop learned:</p>
          <ul className="space-y-1 text-white/72">
            <li>Movement through the grounds</li>
            <li>Starter gear and loadout basics</li>
            <li>Local chat and nearby builders</li>
            <li>Docs, memory, and briefing recall</li>
            <li>How Hermes turns prompts into builds</li>
          </ul>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Later
          </button>
          <button
            onClick={onStepThroughForgeGate}
            className="rounded-xl border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-400/25"
          >
            Forge gate
          </button>
        </div>
      </div>
    </div>
  )
}

export function ForgeArrivalOverlay({
  open,
  flavor,
  loading,
}: {
  open: boolean
  flavor: string
  loading: boolean
}) {
  if (!open) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[118] flex items-center justify-center bg-[#030712]/78 p-4 backdrop-blur-md">
      <div className="w-full max-w-[560px] rounded-3xl border border-cyan-300/30 bg-[#07131a]/92 p-6 text-center text-white shadow-2xl">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200/80">
          Forge Gate
        </div>
        <div className="mt-2 text-2xl font-extrabold text-cyan-100">
          Generating...
        </div>
        <div className="mt-4 text-sm text-white/76">
          {loading
            ? 'Hardening first blueprint.'
            : flavor}
        </div>
      </div>
    </div>
  )
}

export function NearbyBuildersChip({
  players,
}: {
  players: Array<RemotePlayer>
}) {
  const [pingedId, setPingedId] = useState<string | null>(null)
  const sidebarCollapsed = useWorkspaceStore((s) => s.sidebarCollapsed)
  const chromeLeft = sidebarCollapsed ? 'min(120px, 9vw)' : '320px'

  if (players.length === 0) return null

  return (
    <div
      className="pointer-events-auto fixed top-[210px] z-[70] hidden w-[220px] rounded-2xl border border-white/15 bg-black/65 p-2 text-white shadow-2xl backdrop-blur-xl md:block"
      style={{ left: chromeLeft }}
    >
      <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
        Nearby
      </div>
      <div className="space-y-1">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => {
              setPingedId(player.id)
              window.dispatchEvent(
                new CustomEvent('hermes-playground-ping-remote', {
                  detail: player.id,
                }),
              )
              window.setTimeout(
                () =>
                  setPingedId((current) =>
                    current === player.id ? null : current,
                  ),
                2000,
              )
            }}
            className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/5 px-2 py-1.5 text-left hover:bg-white/10"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: player.color,
                  boxShadow: `0 0 10px ${player.color}`,
                }}
              />
              <span className="text-[11px] font-semibold">{player.name}</span>
            </span>
            <span className="text-[9px] uppercase tracking-[0.12em] text-white/40">
              {pingedId === player.id ? 'pinged' : 'ping'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function LowHpOverlay({ active }: { active: boolean }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90] transition-opacity duration-150"
      style={{
        opacity: active ? 1 : 0,
        background:
          'radial-gradient(circle at center, transparent 56%, rgba(127,29,29,0.16) 76%, rgba(153,27,27,0.32) 100%)',
        animation: active
          ? 'hermes-low-hp-pulse 2.8s ease-in-out infinite'
          : 'none',
      }}
    >
      <style>{`
        @keyframes hermes-low-hp-pulse {
          0%, 100% { opacity: 0.68; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export function CameraPresetToast() {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const onPreset = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as string | undefined
      if (!detail) return
      setName(detail)
      const id = window.setTimeout(() => setName(null), 1400)
      return () => window.clearTimeout(id)
    }
    window.addEventListener('hermes-playground-camera-preset', onPreset)
    return () =>
      window.removeEventListener('hermes-playground-camera-preset', onPreset)
  }, [])

  if (!name) return null
  return (
    <div className="pointer-events-none fixed left-1/2 top-[88px] z-[85] w-[min(86vw,360px)] -translate-x-1/2">
      <Toast title="Camera preset" rarity="common" icon="🎬">
        {name}
      </Toast>
    </div>
  )
}

const HERMES_LORE_LINES = [
  'Hermes carried prompts between the gods of Olympus and the builders of Earth.',
  'A Hermes Agent is just a fast, faithful messenger — with memory.',
  'Promptcraft is the first skill. Diplomacy is the last.',
  'Build small. Ship now. Iterate at the speed of intent.',
  'Memory turns moments into a story. Story turns a tool into a teammate.',
  'The Forge is where prompts harden into tools. The Arena is where they earn their keep.',
  'Six worlds. One builder. Forge your path.',
  'Every NPC here teaches a real Hermes Agent skill. Listen.',
  'Routing is the art of choosing the right tool, the right model, the right moment.',
  'You are not alone. The Agora is full of builders walking the same road.',
]

export function TransitionLoadingScreen({
  active,
  worldName,
}: {
  active: boolean
  worldName: string
}) {
  const [lore, setLore] = useState(HERMES_LORE_LINES[0])

  useEffect(() => {
    if (!active) return
    setLore(
      HERMES_LORE_LINES[Math.floor(Math.random() * HERMES_LORE_LINES.length)],
    )
  }, [active])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center transition-opacity duration-300"
      style={{
        opacity: active ? 1 : 0,
        background:
          'radial-gradient(circle at center, rgba(8,12,20,0.65) 30%, #000 90%)',
      }}
    >
      <div className="flex max-w-[640px] flex-col items-center gap-6 px-8 text-center">
        <div
          className="text-[12px] font-bold uppercase tracking-[0.45em]"
          style={{ color: 'rgba(245, 217, 122, 0.7)' }}
        >
          — entering —
        </div>
        <div
          className="text-[44px] leading-none font-black"
          style={{
            background:
              'linear-gradient(180deg, #ffffff 0%, #f5d97a 50%, #c89c2a 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 0 30px rgba(245,217,122,0.4)',
            fontFamily:
              'Cinzel, "Trajan Pro", "Cormorant Garamond", Georgia, serif',
            letterSpacing: '0.04em',
          }}
        >
          {worldName}
        </div>
        <div className="flex items-center gap-3">
          <div
            className="h-1 w-32 overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, #facc15, transparent)',
                animation: 'hermes-loading-bar 1.4s linear infinite',
                width: '40%',
              }}
            />
          </div>
        </div>
        <p className="max-w-[440px] text-[13px] italic leading-relaxed text-white/65">
          “{lore}”
        </p>
      </div>
      <style>{`@keyframes hermes-loading-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }`}</style>
    </div>
  )
}

export function PlaygroundHelpHud({ worldName }: { worldName: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="pointer-events-auto fixed left-1/2 top-3 z-[60] flex -translate-x-1/2 items-center gap-2">
      <div className="rounded-full border border-white/10 bg-black/55 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/85 backdrop-blur-xl">
        {worldName}
      </div>
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/55 text-[12px] font-bold text-white/80 hover:bg-white/10"
        title="Show controls"
      >
        ?
      </button>
      {open && (
        <div className="rounded-xl border border-white/10 bg-black/85 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/80 backdrop-blur-xl">
          WASD · click · Shift · 1-4 · E · J · M · T · F
        </div>
      )}
    </div>
  )
}

export function PlaygroundUtilityDock({
  audioMuted,
  onCustomize,
  onToggleAudio,
  onReplayNarration,
  onToggleNarration,
  narrationMuted,
}: {
  audioMuted: boolean
  onCustomize: () => void
  onToggleAudio: () => void
  onReplayNarration: () => void
  onToggleNarration: () => void
  narrationMuted: boolean
}) {
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined'
      ? Boolean(document.fullscreenElement)
      : false,
  )

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const captureScreenshot = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `hermesworld-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
      a.click()
    } catch {}
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {}
  }

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {}
  }

  return (
    <div className="pointer-events-auto fixed bottom-[78px] right-3 z-[70] flex flex-col gap-1.5">
      <button
        onClick={captureScreenshot}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/65 text-base text-cyan-100 backdrop-blur-xl hover:bg-cyan-400/20"
        title="Screenshot the world (PNG)"
      >
        📸
      </button>
      <button
        onClick={toggleFullscreen}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/65 text-base text-cyan-100 backdrop-blur-xl hover:bg-cyan-400/20"
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? '⤢' : '⛶'}
      </button>
      <button
        onClick={copyShareLink}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/65 text-base text-cyan-100 backdrop-blur-xl hover:bg-cyan-400/20"
        title="Copy share link"
      >
        🔗
      </button>
      <button
        onClick={onReplayNarration}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/65 text-base text-cyan-100 backdrop-blur-xl hover:bg-cyan-400/20"
        title="Replay world narration"
      >
        📢
      </button>
      <button
        onClick={onToggleNarration}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/65 text-base text-cyan-100 backdrop-blur-xl hover:bg-cyan-400/20"
        title={narrationMuted ? 'Unmute narration' : 'Mute narration'}
      >
        {narrationMuted ? '🔇' : '🗣️'}
      </button>
      <button
        onClick={onToggleAudio}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/65 text-base text-cyan-100 backdrop-blur-xl hover:bg-cyan-400/20"
        title={audioMuted ? 'Unmute audio' : 'Mute audio'}
      >
        {audioMuted ? '🔇' : '🔊'}
      </button>
      <button
        onClick={onCustomize}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/65 text-base text-cyan-100 backdrop-blur-xl hover:bg-cyan-400/20"
        title="Customize avatar (C)"
      >
        👤
      </button>
    </div>
  )
}

export function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050b12] p-6 text-white">
      <div className="max-w-[520px] rounded-3xl border border-amber-300/25 bg-[#070b14] p-5 shadow-2xl">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/80">
          HermesWorld
        </div>
        <div className="mt-1 text-xl font-extrabold">Route fallback active</div>
        <p className="mt-3 text-sm text-white/75">
          3D failed here. Reload or open `/agora`.
        </p>
      </div>
    </div>
  )
}
