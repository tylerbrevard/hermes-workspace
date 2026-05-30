import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { PlaygroundActionBar } from './components/playground-actionbar'
import { PlaygroundChat } from './components/playground-chat'
import { PlaygroundHud } from './components/playground-hud'
import { PlaygroundMinimap } from './components/playground-minimap'
import {
  ArchiveBriefingModal,
  CameraPresetToast,
  ForgeArrivalOverlay,
  LowHpOverlay,
  MobileAbilityControls,
  NearbyBuildersChip,
  OnboardingHintCard,
  PlaygroundHelpHud,
  PlaygroundRightRail,
  PlaygroundUtilityDock,
  RouteFallback,
  TransitionLoadingScreen,
  TutorialCompleteModal,
} from './components/playground-overlays'
import { TitleScreen } from './components/playground-title-screen'
import { PlaygroundWorld3D } from './components/playground-world-3d'
import { FpsCounter } from './components/fps-counter'
import { KeyboardShortcutsOverlay } from './components/keyboard-shortcuts-overlay'
import { PhotosensitiveWarningSplash } from './components/photosensitive-warning-splash'
import { useHermesWorldSettings } from './components/hermesworld-settings'
import { usePlaygroundRpg } from './hooks/use-playground-rpg'
import {
  playgroundAudio,
  usePlaygroundAudioMuted,
} from './lib/playground-audio'
import {
  autoNarrateWorld,
  cancelNarration,
  isNarrationMuted,
  narrateWorldNow,
  setNarrationMuted,
} from './lib/playground-narration'
import { PLAYGROUND_WORLDS, itemById } from './lib/playground-rpg'
import type { ChatMessage } from './components/playground-chat'
import type { ReactNode } from 'react'
import type { PlaygroundItemId, PlaygroundWorldId } from './lib/playground-rpg'
import type { RemotePlayer } from './hooks/use-playground-multiplayer'

const PlaygroundAdminPanel = lazy(() =>
  import('./components/playground-admin-panel').then((module) => ({
    default: module.PlaygroundAdminPanel,
  })),
)
const PlaygroundCustomizer = lazy(() =>
  import('./components/playground-customizer').then((module) => ({
    default: module.PlaygroundCustomizer,
  })),
)
const PlaygroundDialog = lazy(() =>
  import('./components/playground-dialog').then((module) => ({
    default: module.PlaygroundDialog,
  })),
)
const PlaygroundJournal = lazy(() =>
  import('./components/playground-journal').then((module) => ({
    default: module.PlaygroundJournal,
  })),
)
const PlaygroundMap = lazy(() =>
  import('./components/playground-map').then((module) => ({
    default: module.PlaygroundMap,
  })),
)
const PlaygroundSidePanel = lazy(() =>
  import('./components/playground-sidepanel').then((module) => ({
    default: module.PlaygroundSidePanel,
  })),
)
const SettingsPanel = lazy(() =>
  import('./components/settings-panel').then((module) => ({
    default: module.SettingsPanel,
  })),
)

function LazyPanelBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>
}

const WORLD_META: Record<PlaygroundWorldId, { name: string; accent: string }> =
  {
    training: { name: 'Training Grounds', accent: '#5eead4' },
    agora: { name: 'Agora Commons', accent: '#d9b35f' },
    forge: { name: 'The Forge', accent: '#22d3ee' },
    grove: { name: 'The Grove', accent: '#34d399' },
    oracle: { name: 'Oracle Temple', accent: '#a78bfa' },
    arena: { name: 'Benchmark Arena', accent: '#fb7185' },
  }

const FORGE_INTRO_STORAGE_KEY = 'hermes-playground-forge-intro-seen'
const FORGE_FALLBACK_FLAVOR =
  'The Forge wakes with a lattice of cyan sparks as half-finished tools hum themselves into being around you.'

type ForgeIntroState =
  | { open: false; flavor: string; loading: false }
  | { open: true; flavor: string; loading: boolean }

class PlaygroundErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Playground render failed', error)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

export function PlaygroundScreen() {
  const rpg = usePlaygroundRpg()
  const audioMuted = usePlaygroundAudioMuted()
  const [settings] = useHermesWorldSettings()
  const [launched, setLaunched] = useState(false)
  const [world, setWorld] = useState<PlaygroundWorldId>(
    rpg.state.playerProfile.lastZone,
  )
  const [dialogNpc, setDialogNpc] = useState<string | null>(null)
  const [nearbyNpc, setNearbyNpc] = useState<string | null>(null)
  const [journalOpen, setJournalOpen] = useState(false)
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [onboardingHintOpen, setOnboardingHintOpen] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(true)
  const [messages, setMessages] = useState<Array<ChatMessage>>([])
  const [mapOpen, setMapOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [tutorialCompleteOpen, setTutorialCompleteOpen] = useState(false)
  const [forgeIntro, setForgeIntro] = useState<ForgeIntroState>({
    open: false,
    flavor: '',
    loading: false,
  })
  const [transitioning, setTransitioning] = useState(false)
  const [monsterHp, setMonsterHp] = useState(44)
  const [remotePlayers, setRemotePlayers] = useState<
    Record<string, RemotePlayer>
  >({})
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)
  const [objectivePulseKey, setObjectivePulseKey] = useState(0)
  // Focus mode — hides side rail (Quest Tracker, Inventory panel, Builders Nearby chip)
  // so the player can see the world while playing/recording.
  // Auto-engages on first movement; toggle with F.
  const [focusMode, setFocusMode] = useState(false)
  const focusModeAutoEngagedRef = useRef(false)
  // Narration mute (Web Speech API). Initialized from persisted state.
  const [narrationMuted, setNarrationMutedState] = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  useEffect(() => {
    setNarrationMutedState(isNarrationMuted())
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('admin') === '1'
    const fromStorage =
      window.localStorage.getItem('hermes-playground-admin') === '1'
    setAdminMode(fromUrl || fromStorage)
  }, [])
  const toggleAdminMode = () => {
    setAdminMode((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        if (next) window.localStorage.setItem('hermes-playground-admin', '1')
        else window.localStorage.removeItem('hermes-playground-admin')
      }
      return next
    })
  }
  const heardToastIds = useRef<Set<string>>(new Set())
  const completedTutorialRef = useRef(false)
  const lowHpArmedRef = useRef(true)
  const forgeIntroSeenRef = useRef(false)
  const objectiveSignatureRef = useRef<string>('')
  const monsterHpMax = 44

  const activeQuest = rpg.activeQuest
  const currentObjective = rpg.currentObjective
  const forgeUnlocked = rpg.state.unlockedWorlds.includes('forge')
  const monsterDefeated = rpg.state.completedQuests.includes(
    'training-bonus-wisp',
  )
  const remotePlayersInZone = useMemo(
    () =>
      Object.values(remotePlayers).filter((player) => player.world === world),
    [remotePlayers, world],
  )
  // Diplomacy: mark meet-builder objective the first time we see another
  // live player in our world.
  useEffect(() => {
    if (remotePlayersInZone.length > 0) {
      rpg.markObjective('agora-diplomacy', 'meet-builder')
    }
  }, [remotePlayersInZone.length, rpg])
  const lowHpThreshold = rpg.state.hpMax * 0.25
  const lowHpRecoverThreshold = rpg.state.hpMax * 0.3
  const lowHpActive = rpg.state.hp <= lowHpThreshold

  useEffect(() => {
    if (typeof window === 'undefined') return
    forgeIntroSeenRef.current =
      window.localStorage.getItem(FORGE_INTRO_STORAGE_KEY) === '1'
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sync = () => setIsNarrow(window.innerWidth < 760)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  useEffect(() => {
    setWorld(rpg.state.playerProfile.lastZone)
  }, [rpg.state.playerProfile.lastZone])

  useEffect(() => {
    if (rpg.state.playerProfile.lastZone !== world) rpg.setLastZone(world)
  }, [rpg, rpg.state.playerProfile.lastZone, world])

  useEffect(() => {
    if (!monsterDefeated) setMonsterHp(monsterHpMax)
  }, [monsterDefeated, world])

  useEffect(() => {
    const completed = rpg.state.completedQuests.includes('training-q5')
    if (completed && !completedTutorialRef.current) {
      completedTutorialRef.current = true
      setTutorialCompleteOpen(true)
      playgroundAudio.playQuestComplete()
      window.setTimeout(() => playgroundAudio.playPortalUnlock(), 120)
    }
    if (!completed) {
      completedTutorialRef.current = false
    }
  }, [rpg.state.completedQuests])

  useEffect(() => {
    const signature = `${activeQuest?.id ?? 'done'}:${currentObjective?.id ?? 'idle'}`
    if (signature !== objectiveSignatureRef.current) {
      objectiveSignatureRef.current = signature
      setObjectivePulseKey((value) => value + 1)
    }
  }, [activeQuest?.id, currentObjective?.id])

  useEffect(() => {
    if (
      activeQuest?.id === 'training-q1' &&
      rpg.state.playerProfile.questProgress['training-q1'].completedObjectives
        .length > 0 &&
      !rpg.state.completedQuests.includes('training-q1')
    ) {
      setOnboardingHintOpen(true)
      const id = window.setTimeout(() => setOnboardingHintOpen(false), 8000)
      const onJump = () => setOnboardingHintOpen(false)
      window.addEventListener('hermesworld-player-jumped', onJump, {
        once: true,
      })
      return () => {
        window.clearTimeout(id)
        window.removeEventListener('hermesworld-player-jumped', onJump)
      }
    }
  }, [
    activeQuest?.id,
    rpg.state.playerProfile.questProgress,
    rpg.state.completedQuests,
  ])

  useEffect(() => {
    for (const toast of rpg.toasts) {
      if (heardToastIds.current.has(toast.id)) continue
      heardToastIds.current.add(toast.id)
      if (toast.kind === 'quest' || toast.kind === 'title')
        playgroundAudio.playQuestComplete()
      if (toast.kind === 'item') playgroundAudio.playRewardPickup()
    }
  }, [rpg.toasts])

  useEffect(() => {
    if (rpg.state.hp <= lowHpThreshold && lowHpArmedRef.current) {
      lowHpArmedRef.current = false
      playgroundAudio.playLowHpWarning()
      return
    }
    if (rpg.state.hp > lowHpRecoverThreshold) {
      lowHpArmedRef.current = true
    }
  }, [lowHpRecoverThreshold, lowHpThreshold, rpg.state.hp])

  useEffect(() => {
    if (!launched) {
      playgroundAudio.setAmbient(null)
      return
    }
    if (world === 'training' || world === 'forge') {
      playgroundAudio.setAmbient(world)
      return
    }
    playgroundAudio.setAmbient(null)
  }, [launched, world, audioMuted])

  // Auto-narrate each world the first time you enter it (per session).
  // Cancels prior narration when you change worlds.
  useEffect(() => {
    if (!launched) return
    cancelNarration()
    autoNarrateWorld(world)
  }, [launched, world])

  useEffect(() => {
    ;(window as any).__hermesPlaygroundOpenDialog = (id: string) =>
      setDialogNpc(id)
    return () => {
      try {
        delete (window as any).__hermesPlaygroundOpenDialog
      } catch {}
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        if (event.key === 'Escape') target.blur()
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'j') setJournalOpen((value) => !value)
      if (key === 'c') setCustomizerOpen((value) => !value)
      if (key === 'm') setMapOpen((value) => !value)
      if (key === 'i') setMobileMenuOpen((value) => !value)
      if (key === 'n') setMobileMenuOpen((value) => !value)
      if (key === 'k') setMobileMenuOpen((value) => !value)
      if (key === 'e' && nearbyNpc && !dialogNpc) setDialogNpc(nearbyNpc)
      if (key === 'Enter') setChatCollapsed(false)
      if (key === '/') setChatCollapsed(false)
      if (key === 't') setChatCollapsed(false)
      if (key === 'f') setFocusMode((value) => !value)
      // Auto-engage focus mode on first movement so the world isn't blocked by panels
      const movementKeys = [
        'w',
        'a',
        's',
        'd',
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
      ]
      if (movementKeys.includes(key) && !focusModeAutoEngagedRef.current) {
        focusModeAutoEngagedRef.current = true
        setFocusMode(true)
      }
      if (event.key === 'Escape') {
        const closingAny =
          journalOpen ||
          !!dialogNpc ||
          mapOpen ||
          archiveOpen ||
          tutorialCompleteOpen ||
          settingsOpen
        if (!closingAny) {
          setSettingsOpen(true)
          return
        }
        setSettingsOpen(false)
        setJournalOpen(false)
        setDialogNpc(null)
        setMapOpen(false)
        setArchiveOpen(false)
        setTutorialCompleteOpen(false)
        // Esc also bails out of focus mode so the rail comes back
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    archiveOpen,
    dialogNpc,
    journalOpen,
    mapOpen,
    nearbyNpc,
    settingsOpen,
    tutorialCompleteOpen,
  ])

  const equippedVisuals = useMemo(() => {
    const weapon = rpg.state.playerProfile.equipped.weapon
      ? itemById(rpg.state.playerProfile.equipped.weapon)
      : null
    const cloak = rpg.state.playerProfile.equipped.cloak
      ? itemById(rpg.state.playerProfile.equipped.cloak)
      : null
    const head = rpg.state.playerProfile.equipped.head
      ? itemById(rpg.state.playerProfile.equipped.head)
      : null
    const artifact = rpg.state.playerProfile.equipped.artifact
      ? itemById(rpg.state.playerProfile.equipped.artifact)
      : null
    return {
      accent:
        artifact?.accent ||
        head?.accent ||
        weapon?.accent ||
        rpg.state.playerProfile.avatarConfig.outfitAccent,
      cape: cloak?.accent || rpg.state.playerProfile.avatarConfig.cape,
      artifact: artifact?.accent || null,
      weapon:
        weapon?.id === 'training-blade'
          ? 'sword'
          : rpg.state.playerProfile.avatarConfig.weapon,
      helmet:
        head?.id === 'initiate-circlet'
          ? 'circlet'
          : rpg.state.playerProfile.avatarConfig.helmet,
    } as const
  }, [rpg.state.playerProfile])

  function addChatMessage(message: ChatMessage) {
    setMessages((prev) => {
      // Dedupe: if we already have this (author + body + ts within 2s), skip.
      const dupe = prev.some(
        (m) =>
          m.authorId === message.authorId &&
          m.body === message.body &&
          Math.abs(m.ts - message.ts) < 2000,
      )
      if (dupe) return prev
      return [...prev, message].slice(-40)
    })
  }

  function sendChat(body: string) {
    const ts = Date.now()
    addChatMessage({
      id: `${ts}-${Math.random()}`,
      authorId: 'self',
      authorName: rpg.state.playerProfile.displayName || 'You',
      body,
      ts,
      color: '#a7f3d0',
    })
    rpg.markObjective('training-q3', 'send-local-chat')
    // Diplomacy: if there's a remote player nearby in this world, count it.
    if (remotePlayersInZone.length > 0) {
      rpg.markObjective('agora-diplomacy', 'meet-builder')
      rpg.markObjective('agora-diplomacy', 'exchange-chat')
    }
    // Speech bubble over our own head too, so we see what we said in-world.
    try {
      window.dispatchEvent(
        new CustomEvent('hermes-playground-self-chat-bubble', { detail: body }),
      )
    } catch {}
    try {
      ;(window as any).__hermesPlaygroundSendChat?.(body)
    } catch {}
  }

  function handleIncomingChat(msg: {
    id: string
    name: string
    color: string
    text: string
    ts: number
  }) {
    // Defensive: never accept a chat that we sent ourselves — the server tries
    // to filter, but old chat ring entries from previous selfIds can leak.
    if (msg.name === (rpg.state.playerProfile.displayName || 'You')) return
    addChatMessage({
      id: `${msg.ts}-${msg.id}`,
      authorId: msg.id,
      authorName: msg.name,
      body: msg.text,
      ts: msg.ts,
      color: msg.color,
    })
  }

  function attackMonster(damage: number, costBacklash = true) {
    if (world !== 'training' || monsterDefeated) return false
    if (costBacklash) {
      const playerDamage = Math.floor(Math.random() * 4) + 1
      rpg.damagePlayer(playerDamage)
    }
    playgroundAudio.playHit()
    setMonsterHp((current) => {
      const next = Math.max(0, current - damage)
      if (next === 0) {
        playgroundAudio.playDefeat()
        rpg.markObjective('training-bonus-wisp', 'defeat-wisp')
        rpg.recordDefeat(35, 'wisp-core')
        rpg.markObjective('training-bonus-wisp', 'collect-core')
      }
      return next
    })
    return true
  }

  function handleCast(actionId: string) {
    switch (actionId) {
      case 'strike':
        return attackMonster(10 + Math.floor(Math.random() * 4))
      case 'dash':
        rpg.useMp(8)
        window.dispatchEvent(new CustomEvent('hermes-playground-dash'))
        return true
      case 'bolt':
        rpg.useMp(15)
        return attackMonster(18 + Math.floor(Math.random() * 6), false)
      case 'summon':
        rpg.useMp(20)
        // Spawn a 60-second familiar via custom event — the world component listens.
        window.dispatchEvent(
          new CustomEvent('hermes-playground-summon-familiar', {
            detail: { durationMs: 60000, color: '#a78bfa' },
          }),
        )
        rpg.markObjective('forge-summon', 'enter-forge-bonus')
        rpg.markObjective('forge-summon', 'summon-familiar')
        return true
      default:
        return false
    }
  }

  function handleQuestZone(id: string) {
    if (id === 'archive-podium') {
      rpg.markObjective('training-q4', 'visit-archive')
      setArchiveOpen(true)
      return
    }
    if (id === 'forge-gate') {
      rpg.markObjective('training-q5', 'visit-forge-gate')
      return
    }
    if (['grove-ritual', 'oracle-riddle', 'arena-duel'].includes(id)) {
      rpg.completeQuestById(id)
    }
  }

  function handlePortal() {
    if (world === 'training' && !forgeUnlocked) return
    if (world === 'training') {
      void enterForgeFromTraining()
      return
    }
    const order: Array<PlaygroundWorldId> = [
      'training',
      'forge',
      'agora',
      'grove',
      'oracle',
      'arena',
    ]
    const unlocked = order.filter((id) => rpg.state.unlockedWorlds.includes(id))
    const currentIndex = unlocked.indexOf(world)
    const next = unlocked[(currentIndex + 1) % unlocked.length] ?? world
    playgroundAudio.playPortalWhoosh()
    setTransitioning(true)
    window.setTimeout(() => {
      setWorld(next)
      window.setTimeout(() => setTransitioning(false), 350)
    }, 280)
  }

  function onDialogChoice(npcId: string, choiceId: string) {
    if (npcId === 'athena' && choiceId === 'training-sigil') {
      rpg.markObjective('training-q1', 'speak-athena')
      rpg.markObjective('training-q1', 'claim-sigil')
    }
    if (
      (npcId === 'athena' && choiceId === 'training-build') ||
      (npcId === 'pan' && choiceId === 'forge-tool')
    ) {
      rpg.markObjective('training-q5', 'build-something')
    }
  }

  async function enterForgeFromTraining() {
    playgroundAudio.playPortalWhoosh()
    setTransitioning(true)
    const showIntro = !forgeIntroSeenRef.current
    if (showIntro) {
      setForgeIntro({ open: true, flavor: '', loading: true })
      const flavor = await generateForgeFlavor()
      setForgeIntro({ open: true, flavor, loading: false })
    }
    window.setTimeout(
      () => {
        setWorld('forge')
        rpg.setLastZone('forge')
        if (showIntro) {
          forgeIntroSeenRef.current = true
          try {
            window.localStorage.setItem(FORGE_INTRO_STORAGE_KEY, '1')
          } catch {}
        }
        window.setTimeout(() => {
          setTransitioning(false)
          if (showIntro) {
            window.setTimeout(
              () => setForgeIntro({ open: false, flavor: '', loading: false }),
              1700,
            )
          }
        }, 350)
      },
      showIntro ? 1650 : 280,
    )
  }

  async function generateForgeFlavor() {
    try {
      const r = await fetch('/api/playground-npc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          npcId: 'pan',
          playerMessage:
            'Give me a 1-2 sentence in-world world-generation line for a builder first entering the Forge through the Training Grounds gate. Focus on neon tools, prompts hardening into artifacts, and arrival energy.',
          history: [],
        }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const data = (await r.json()) as { reply?: string }
      return data.reply?.trim() || FORGE_FALLBACK_FLAVOR
    } catch {
      return FORGE_FALLBACK_FLAVOR
    }
  }

  if (!launched) {
    return (
      <>
        <TitleScreen
          displayName={rpg.state.playerProfile.displayName}
          tutorialComplete={rpg.state.completedQuests.includes('training-q5')}
          onChangeDisplayName={rpg.setDisplayName}
          onCustomize={() => setCustomizerOpen(true)}
          onEnter={() => setLaunched(true)}
        />
        {customizerOpen ? (
          <LazyPanelBoundary>
            <PlaygroundCustomizer
              open={customizerOpen}
              onClose={() => setCustomizerOpen(false)}
              value={rpg.state.playerProfile.avatarConfig}
              onChange={rpg.setAvatarConfig}
            />
          </LazyPanelBoundary>
        ) : null}
      </>
    )
  }

  return (
    <PlaygroundErrorBoundary fallback={<RouteFallback />}>
      <div
        className="relative overflow-hidden"
        style={{
          width: '100%',
          height: '100vh',
          minHeight: 640,
          background: '#07131a',
          color: 'white',
        }}
      >
        <PlaygroundWorld3D
          worldId={world}
          onPortal={handlePortal}
          onQuestZone={handleQuestZone}
          onNpcNearChange={setNearbyNpc}
          playerName={rpg.state.playerProfile.displayName || 'Builder'}
          playerAvatar={rpg.state.playerProfile.avatarConfig}
          playerAccent={equippedVisuals.accent}
          playerCape={equippedVisuals.cape}
          playerArtifact={equippedVisuals.artifact}
          playerWeapon={equippedVisuals.weapon}
          playerHelmet={equippedVisuals.helmet}
          portalLabel={world === 'training' ? 'Forge Gate' : 'World Portal'}
          portalLocked={world === 'training' && !forgeUnlocked}
          multiplayerName={rpg.state.playerProfile.displayName || undefined}
          monsterHp={monsterHp}
          monsterHpMax={monsterHpMax}
          monsterDefeated={monsterDefeated}
          onMonsterAttack={() => {
            attackMonster(8 + Math.floor(Math.random() * 5))
          }}
          onIncomingChat={handleIncomingChat}
          onRemotePlayersChange={setRemotePlayers}
          objectiveTargetId={currentObjective?.target ?? null}
          objectivePulseKey={objectivePulseKey}
        />

        {dialogNpc ? (
          <LazyPanelBoundary>
            <PlaygroundDialog
              npcId={dialogNpc}
              activeQuest={activeQuest ?? null}
              onClose={() => setDialogNpc(null)}
              onCompleteQuest={(questId) => rpg.completeQuestById(questId)}
              onGrantItems={(items) => rpg.grantItems(items)}
              onGrantSkillXp={(skills) => rpg.grantSkillXp(skills)}
              onChoice={onDialogChoice}
            />
          </LazyPanelBoundary>
        ) : null}
        {journalOpen ? (
          <LazyPanelBoundary>
            <PlaygroundJournal
              open={journalOpen}
              onClose={() => setJournalOpen(false)}
              state={rpg.state}
            />
          </LazyPanelBoundary>
        ) : null}
        {customizerOpen ? (
          <LazyPanelBoundary>
            <PlaygroundCustomizer
              open={customizerOpen}
              onClose={() => setCustomizerOpen(false)}
              value={rpg.state.playerProfile.avatarConfig}
              onChange={rpg.setAvatarConfig}
            />
          </LazyPanelBoundary>
        ) : null}
        {mapOpen ? (
          <LazyPanelBoundary>
            <PlaygroundMap
              open={mapOpen}
              onClose={() => setMapOpen(false)}
              currentWorld={world}
              unlocked={rpg.state.unlockedWorlds}
              onTravel={(id) => {
                if (!rpg.state.unlockedWorlds.includes(id)) return
                setTransitioning(true)
                window.setTimeout(() => {
                  setWorld(id)
                  setMapOpen(false)
                  window.setTimeout(() => setTransitioning(false), 350)
                }, 280)
              }}
            />
          </LazyPanelBoundary>
        ) : null}
        <PlaygroundChat
          worldId={world}
          messages={messages}
          onSend={sendChat}
          collapsed={chatCollapsed}
          onToggle={() => setChatCollapsed((value) => !value)}
        />
        <PlaygroundActionBar
          onCast={handleCast}
          hp={rpg.state.hp}
          hpMax={rpg.state.hpMax}
          mp={rpg.state.mp}
          mpMax={rpg.state.mpMax}
          sp={rpg.state.sp}
          spMax={rpg.state.spMax}
        />
        <PlaygroundMinimap
          worldId={world}
          worldName={WORLD_META[world].name}
          worldAccent={WORLD_META[world].accent}
        />
        <PlaygroundRightRail
          focusMode={focusMode}
          adminMode={adminMode}
          accent={WORLD_META[world].accent}
          onToggleFocus={() => setFocusMode((value) => !value)}
          onOpenInventory={rpg.openInventory}
          onOpenJournal={() => setJournalOpen(true)}
          onOpenMap={() => setMapOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleAdmin={toggleAdminMode}
        />
        <FpsCounter enabled={settings.performance.fpsCounter} />
        <PlaygroundHud
          state={rpg.state}
          activeQuestTitle={activeQuest?.title ?? 'Training Complete'}
          objectiveLabel={
            currentObjective?.label ??
            'Forge Gate unlocked. Keep exploring the Playground.'
          }
          objectiveHint={currentObjective?.hint}
          objectiveTarget={currentObjective?.target ?? null}
          levelProgress={rpg.levelProgress}
          currentWorld={world}
          worldAccent={WORLD_META[world].accent}
          toasts={rpg.toasts}
        />
        {/* Online chip removed — the chat header now shows live player count + NPC count. */}
        {!focusMode && <NearbyBuildersChip players={remotePlayersInZone} />}
        {!focusMode && (!isNarrow || mobileMenuOpen) ? (
          <LazyPanelBoundary>
            <PlaygroundSidePanel
              state={rpg.state}
              currentWorld={world}
              worlds={PLAYGROUND_WORLDS}
              onSelectWorld={(next) => {
                if (rpg.state.unlockedWorlds.includes(next)) setWorld(next)
              }}
              onReset={rpg.resetRpg}
              onReplayTutorial={() => {
                rpg.replayTutorial()
                setTutorialCompleteOpen(false)
                setArchiveOpen(false)
                setJournalOpen(false)
                setMapOpen(false)
                setMobileMenuOpen(false)
                setWorld('training')
                try {
                  window.localStorage.removeItem(FORGE_INTRO_STORAGE_KEY)
                } catch {}
                forgeIntroSeenRef.current = false
              }}
              onOpenInventory={rpg.openInventory}
              onEquipItem={rpg.equipItem}
              onUnequipSlot={rpg.unequipSlot}
              worldAccent={WORLD_META[world].accent}
              open={!isNarrow || mobileMenuOpen}
              onOpenChange={setMobileMenuOpen}
            />
          </LazyPanelBoundary>
        ) : null}
        {/* Focus mode toggle — eyeball icon (sits in the gap between minimap and quest tracker) */}
        <button
          type="button"
          onClick={() => setFocusMode((v) => !v)}
          aria-label={
            focusMode
              ? 'Exit focus mode (F or Esc)'
              : 'Focus mode — hide side rail (F)'
          }
          title={
            focusMode
              ? 'Exit focus mode (F or Esc)'
              : 'Focus mode — hide side rail (F)'
          }
          className="pointer-events-auto fixed right-3 top-[230px] z-[71] hidden h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/70 text-[16px] text-white shadow-xl backdrop-blur-xl md:flex"
          style={{
            boxShadow: focusMode
              ? `0 0 14px ${WORLD_META[world].accent}88`
              : '0 8px 22px rgba(0,0,0,.55)',
            borderColor: focusMode
              ? WORLD_META[world].accent
              : 'rgba(255,255,255,0.15)',
          }}
        >
          <span
            aria-hidden="true"
            style={{ filter: focusMode ? 'none' : 'grayscale(0.4)' }}
          >
            {focusMode ? '👁️' : '👁'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open world options"
          title="World (Esc)"
          className="pointer-events-auto fixed right-3 top-[314px] z-[71] hidden h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/70 text-[15px] text-white shadow-xl backdrop-blur-xl md:flex"
          style={{
            boxShadow: '0 8px 22px rgba(0,0,0,.55)',
            borderColor: 'rgba(241,197,109,0.42)',
          }}
        >
          ⚙
        </button>
        <button
          type="button"
          onClick={toggleAdminMode}
          aria-label={adminMode ? 'Hide admin panel' : 'Show admin panel'}
          title={adminMode ? 'Hide admin panel' : 'Show admin panel'}
          className="pointer-events-auto fixed right-3 top-[314px] z-[71] hidden h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/70 text-[15px] text-white shadow-xl backdrop-blur-xl md:flex"
          style={{
            boxShadow: adminMode
              ? '0 0 14px rgba(251,191,36,0.55)'
              : '0 8px 22px rgba(0,0,0,.55)',
            borderColor: adminMode
              ? 'rgba(251,191,36,0.6)'
              : 'rgba(255,255,255,0.15)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            {adminMode ? <path d="m9 12 2 2 4-4" /> : null}
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="pointer-events-auto fixed right-3 top-12 z-[72] rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white shadow-xl backdrop-blur-xl md:hidden"
        >
          Menu
        </button>
        <KeyboardShortcutsOverlay />
        <MobileAbilityControls />
        <OnboardingHintCard open={onboardingHintOpen} />
        <PhotosensitiveWarningSplash
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {settingsOpen ? (
          <LazyPanelBoundary>
            <SettingsPanel
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              signedInName={rpg.state.playerProfile.displayName || null}
            />
          </LazyPanelBoundary>
        ) : null}
        <PlaygroundHelpHud worldName={WORLD_META[world].name} />
        {adminMode ? (
          <LazyPanelBoundary>
            <PlaygroundAdminPanel />
          </LazyPanelBoundary>
        ) : null}
        <PlaygroundUtilityDock
          audioMuted={audioMuted}
          narrationMuted={narrationMuted}
          onCustomize={() => setCustomizerOpen(true)}
          onToggleAudio={() => playgroundAudio.toggleMuted()}
          onReplayNarration={() => narrateWorldNow(world)}
          onToggleNarration={() => {
            const next = !narrationMuted
            setNarrationMuted(next)
            setNarrationMutedState(next)
          }}
        />
        <ArchiveBriefingModal
          open={archiveOpen}
          onClose={() => setArchiveOpen(false)}
          onAcknowledge={() => {
            rpg.markObjective('training-q4', 'inspect-memory')
            setArchiveOpen(false)
          }}
        />
        <TutorialCompleteModal
          open={tutorialCompleteOpen}
          onClose={() => setTutorialCompleteOpen(false)}
          onStepThroughForgeGate={() => {
            setTutorialCompleteOpen(false)
            if (world === 'training' && forgeUnlocked) {
              void enterForgeFromTraining()
              return
            }
            setWorld('training')
          }}
        />
        <ForgeArrivalOverlay
          open={forgeIntro.open}
          flavor={forgeIntro.flavor}
          loading={forgeIntro.loading}
        />
        <LowHpOverlay active={lowHpActive} />
        <CameraPresetToast />
        <TransitionLoadingScreen
          active={transitioning}
          worldName={WORLD_META[world].name}
        />
      </div>
    </PlaygroundErrorBoundary>
  )
}
