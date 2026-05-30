import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ConductorPhaseRouter } from './conductor-phase-router'
import {
  buildDirectoryPathFromSegments,
  buildProjectPathCandidates,
  deriveSessionStatus,
  extractProjectPath,
  formatElapsedTime,
  getAgentPersona,
  getDirectoryPathSegments,
  getLastAssistantMessage,
  getOutputDisplayName,
  loadConductorGoalDraft,
  loadConductorLaunchDraft,
  persistConductorLaunchDraft,
  truncateContinuationText,
  usePreviewAvailability,
} from './conductor-ui'
import { useConductorGateway } from './hooks/use-conductor-gateway'
import {
  CONDUCTOR_GOAL_DRAFT_STORAGE_KEY,
  CONDUCTOR_LAUNCH_DRAFT_STORAGE_KEY,
  DEFAULT_MISSION_CONSTRAINTS,
  DEFAULT_MISSION_HANDOFF,
  DEFAULT_MISSION_VERIFICATION,
  TYLER_RECURRING_WORKFLOW_TEMPLATES,
  buildConductorRouteDiagnostics,
  buildMissionPrompt,
  buildMissionReadinessChecklist,
  buildPortablePlanPreview,
  getMissionExecutionGuard,
  getMissionReadinessSummary,
  getWorkerAvailabilitySummary,
  parseMissionLaunchDraft,
  serializeMissionLaunchDraft,
  validateMissionLaunchDraft,
} from './conductor-workflow'
import type {
  FileBrowserEntry,
  HistoryMessage,
  MissionCostWorker,
  QUICK_ACTIONS,
  QuickActionId,
} from './conductor-ui'
import type { AgentWorkingRow } from './components/agents-working-panel'
import type { GatewaySession } from '@/lib/gateway-api'
import type { MissionHistoryEntry } from './hooks/use-conductor-gateway'
import type { ConductorPhase, MissionLaunchDraft } from './conductor-workflow'

export function Conductor() {
  const conductor = useConductorGateway()
  const [goalDraft, setGoalDraft] = useState(() => loadConductorGoalDraft())
  const [constraintsDraft, setConstraintsDraft] = useState(
    () => loadConductorLaunchDraft().constraints,
  )
  const [verificationDraft, setVerificationDraft] = useState(
    () => loadConductorLaunchDraft().verification,
  )
  const [handoffTargetDraft, setHandoffTargetDraft] = useState(
    () => loadConductorLaunchDraft().handoffTarget,
  )
  const [missionModalOpen, setMissionModalOpen] = useState(false)
  const [portablePlanCopied, setPortablePlanCopied] = useState(false)
  const [continueDraft, setContinueDraft] = useState('')
  const [continueModalOpen, setContinueModalOpen] = useState(false)
  const [selectedAction, setSelectedAction] = useState<QuickActionId>('build')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activityFilter, setActivityFilter] = useState<
    'all' | 'completed' | 'failed' | 'active' | 'blocked' | 'review-needed'
  >('all')
  const [activityPage, setActivityPage] = useState(0)
  const [completeCostExpanded, setCompleteCostExpanded] = useState(true)
  const [historyCostExpanded, setHistoryCostExpanded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [directoryBrowserOpen, setDirectoryBrowserOpen] = useState(false)
  const [directoryBrowserPath, setDirectoryBrowserPath] = useState('~')
  const [directoryBrowserEntries, setDirectoryBrowserEntries] = useState<
    Array<FileBrowserEntry>
  >([])
  const [directoryBrowserLoading, setDirectoryBrowserLoading] = useState(false)
  const [directoryBrowserError, setDirectoryBrowserError] = useState<
    string | null
  >(null)
  const modelsQuery = useQuery({
    queryKey: ['conductor', 'models'],
    queryFn: async () => {
      const res = await fetch('/api/models')
      const data = (await res.json()) as {
        ok?: boolean
        models?: Array<{ id?: string; provider?: string; name?: string }>
      }
      return data.models ?? []
    },
    enabled: settingsOpen,
    staleTime: 60_000,
  })
  const availableModels = modelsQuery.data ?? []

  useEffect(() => {
    if (!directoryBrowserOpen) return

    let cancelled = false

    const loadDirectory = async () => {
      setDirectoryBrowserLoading(true)
      setDirectoryBrowserError(null)

      try {
        const res = await fetch(
          `/api/files?path=${encodeURIComponent(directoryBrowserPath)}`,
        )
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          root?: string
          entries?: Array<FileBrowserEntry>
        }

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load directory')
        }

        if (cancelled) return
        setDirectoryBrowserPath(
          typeof data.root === 'string' && data.root.trim()
            ? data.root
            : directoryBrowserPath,
        )
        setDirectoryBrowserEntries(
          Array.isArray(data.entries)
            ? data.entries.filter((entry) => entry?.type === 'folder')
            : [],
        )
      } catch (error) {
        if (cancelled) return
        setDirectoryBrowserEntries([])
        setDirectoryBrowserError(
          error instanceof Error ? error.message : 'Failed to load directory',
        )
      } finally {
        if (!cancelled) {
          setDirectoryBrowserLoading(false)
        }
      }
    }

    void loadDirectory()

    return () => {
      cancelled = true
    }
  }, [directoryBrowserOpen, directoryBrowserPath])

  useEffect(() => {
    if (
      conductor.phase === 'idle' ||
      conductor.phase === 'complete' ||
      conductor.isPaused
    )
      return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [conductor.isPaused, conductor.phase])

  useEffect(() => {
    if (!conductor.isPaused) return
    setNow(conductor.pausedAtMs ?? Date.now())
  }, [conductor.isPaused, conductor.pausedAtMs])

  // Set body background to match Conductor theme so no gray shows behind keyboard/tab bar
  useEffect(() => {
    const prev = document.body.style.backgroundColor
    document.body.style.backgroundColor = 'var(--color-surface)'
    return () => {
      document.body.style.backgroundColor = prev
    }
  }, [])

  const phase: ConductorPhase = useMemo(() => {
    if (conductor.phase === 'idle') return 'home'
    if (conductor.phase === 'decomposing') return 'preview'
    if (conductor.phase === 'running') return 'active'
    return 'complete'
  }, [conductor.phase])
  const launchDraft = useMemo<MissionLaunchDraft>(
    () => ({
      goal: goalDraft,
      constraints: constraintsDraft,
      verification: verificationDraft,
      handoffTarget: handoffTargetDraft,
    }),
    [constraintsDraft, goalDraft, handoffTargetDraft, verificationDraft],
  )
  const launchValidation = useMemo(
    () => validateMissionLaunchDraft(launchDraft),
    [launchDraft],
  )
  useEffect(() => {
    persistConductorLaunchDraft(launchDraft)
  }, [launchDraft])

  const handleNewMission = () => {
    conductor.resetMission()
    setGoalDraft('')
    setConstraintsDraft(DEFAULT_MISSION_CONSTRAINTS)
    setVerificationDraft(DEFAULT_MISSION_VERIFICATION)
    setHandoffTargetDraft(DEFAULT_MISSION_HANDOFF)
    persistConductorLaunchDraft({
      goal: '',
      constraints: '',
      verification: '',
      handoffTarget: '',
    })
    setMissionModalOpen(false)
    setContinueDraft('')
    setContinueModalOpen(false)
    setSelectedTaskId(null)
  }

  const handleSubmit = async () => {
    if (!launchValidation.valid) return
    const missionPrompt = buildMissionPrompt(launchDraft)
    setMissionModalOpen(false)
    setContinueDraft('')
    await conductor.sendMission(missionPrompt)
    setGoalDraft('')
    persistConductorLaunchDraft({
      goal: '',
      constraints: '',
      verification: '',
      handoffTarget: '',
    })
  }

  const copyPortablePlan = async () => {
    try {
      await navigator.clipboard.writeText(portablePlanPreview)
      setPortablePlanCopied(true)
      window.setTimeout(() => setPortablePlanCopied(false), 1800)
    } catch {
      setPortablePlanCopied(false)
    }
  }

  const handleQuickActionSelect = (action: (typeof QUICK_ACTIONS)[number]) => {
    setSelectedAction(action.id)
    setGoalDraft((current) => {
      const trimmed = current.trim()
      if (!trimmed) return `${action.label}: `
      if (trimmed.toLowerCase().startsWith(`${action.label.toLowerCase()}:`))
        return current
      return `${action.label}: ${trimmed}`
    })
  }

  const handleContinueMission = async () => {
    const trimmedInstructions = continueDraft.trim()
    if (!trimmedInstructions) return

    const continuationSummarySource =
      completeSummary ??
      Object.values(conductor.workerOutputs).find((output) => output.trim()) ??
      conductor.workers
        .map((worker) =>
          getLastAssistantMessage(
            worker.raw.messages as Array<HistoryMessage> | undefined,
          ),
        )
        .find((output) => output.trim()) ??
      conductor.streamText

    const combinedPrompt = [
      'CONTINUATION OF PREVIOUS MISSION',
      `Original goal: ${conductor.goal}`,
      `Previous output summary: ${truncateContinuationText(continuationSummarySource ?? '')}`,
      `New instructions: ${trimmedInstructions}`,
      '',
      'Please continue building on the previous work.',
    ].join('\n')

    setContinueDraft('')
    setContinueModalOpen(false)
    await conductor.sendMission(combinedPrompt)
  }

  const updateSettings = (
    patch: Partial<typeof conductor.conductorSettings>,
  ) => {
    conductor.setConductorSettings({ ...conductor.conductorSettings, ...patch })
  }

  const openDirectoryBrowser = () => {
    setDirectoryBrowserPath(
      conductor.conductorSettings.projectsDir.trim() || '~',
    )
    setDirectoryBrowserEntries([])
    setDirectoryBrowserError(null)
    setDirectoryBrowserOpen(true)
  }

  const closeDirectoryBrowser = () => {
    setDirectoryBrowserOpen(false)
    setDirectoryBrowserLoading(false)
    setDirectoryBrowserError(null)
  }

  const directoryBreadcrumbs = useMemo(() => {
    const segments = getDirectoryPathSegments(directoryBrowserPath)
    return segments.map((segment, index) => ({
      label: segment === '/' ? 'Root' : segment,
      path: buildDirectoryPathFromSegments(segments.slice(0, index + 1)),
    }))
  }, [directoryBrowserPath])

  const totalWorkers = conductor.workers.length
  const completedWorkers = conductor.workers.filter(
    (worker) => worker.status === 'complete',
  ).length
  const activeWorkerCount = conductor.activeWorkers.length
  const missionProgress =
    totalWorkers > 0 ? Math.round((completedWorkers / totalWorkers) * 100) : 0
  const totalTokens = conductor.workers.reduce(
    (sum, worker) => sum + worker.totalTokens,
    0,
  )
  const gatewayStale =
    conductor.phase !== 'idle' &&
    totalWorkers > 0 &&
    conductor.workers.every((worker) => worker.status === 'stale')
  const workerAvailabilitySummary = getWorkerAvailabilitySummary({
    workers: totalWorkers,
    activeWorkers: activeWorkerCount,
    staleGateway: gatewayStale,
  })
  const executionGuard = getMissionExecutionGuard(goalDraft || conductor.goal)
  const readinessChecklist = useMemo(
    () =>
      buildMissionReadinessChecklist({
        draft: launchDraft,
        projectsDir: conductor.conductorSettings.projectsDir,
        orchestratorModel: conductor.conductorSettings.orchestratorModel,
        workerModel: conductor.conductorSettings.workerModel,
        supervised: conductor.conductorSettings.supervised,
        workerAvailabilitySummary,
        executionGuard,
      }),
    [
      conductor.conductorSettings.orchestratorModel,
      conductor.conductorSettings.projectsDir,
      conductor.conductorSettings.supervised,
      conductor.conductorSettings.workerModel,
      executionGuard,
      launchDraft,
      workerAvailabilitySummary,
    ],
  )
  const readinessSummary = useMemo(
    () => getMissionReadinessSummary(readinessChecklist),
    [readinessChecklist],
  )
  const portablePlanPreview = useMemo(
    () => buildPortablePlanPreview(launchDraft, readinessChecklist),
    [launchDraft, readinessChecklist],
  )
  const missionCheckpointSummary = useMemo(() => {
    const filesTouched = conductor.tasks.filter((task) =>
      extractProjectPath(task.output ?? ''),
    ).length
    const commandsRun = conductor.tasks.filter((task) =>
      /command|shell|run|test|build/i.test(
        `${task.title} ${task.output ?? ''}`,
      ),
    ).length
    return `Checkpoint timeline: ${conductor.tasks.length} tasks, ${filesTouched} files touched, ${commandsRun} commands run`
  }, [conductor.tasks])
  const selectedHistoryEntry = conductor.selectedHistoryEntry
  const completeMissionCostWorkers = useMemo<Array<MissionCostWorker>>(
    () =>
      conductor.workers.map((worker, index) => {
        const persona = getAgentPersona(index)
        return {
          id: worker.key,
          label: worker.label,
          totalTokens: worker.totalTokens,
          personaEmoji: persona.emoji,
          personaName: persona.name,
        }
      }),
    [conductor.workers],
  )
  const historyMissionCostWorkers = useMemo<Array<MissionCostWorker>>(
    () =>
      (selectedHistoryEntry?.workerDetails ?? []).map((worker, index) => ({
        id: `${selectedHistoryEntry?.id ?? 'history'}-${index}`,
        label: worker.label,
        totalTokens: worker.totalTokens,
        personaEmoji: worker.personaEmoji,
        personaName: worker.personaName,
      })),
    [selectedHistoryEntry],
  )
  const OFFICE_NAMES = ['Nova', 'Pixel', 'Blaze', 'Echo', 'Sage', 'Drift']
  const homeOfficeRows = useMemo<Array<AgentWorkingRow>>(() => {
    const sessions = conductor.recentSessions
    if (sessions.length === 0) {
      return OFFICE_NAMES.slice(0, 3).map((name, i) => ({
        id: `placeholder-${i}`,
        name,
        modelId: 'auto',
        status: 'idle' as const,
        lastLine: 'Waiting for work…',
        taskCount: 0,
        roleDescription: 'Worker',
      }))
    }
    return sessions.slice(0, 6).map((session, i) => {
      const s = session
      const updatedAt =
        typeof s.updatedAt === 'string'
          ? new Date(s.updatedAt).getTime()
          : typeof s.updatedAt === 'number'
            ? s.updatedAt
            : 0
      const statusText = `${s.status ?? ''} ${s.kind ?? ''}`.toLowerCase()
      const status = /error|failed/.test(statusText)
        ? ('error' as const)
        : /pause/.test(statusText)
          ? ('paused' as const)
          : Date.now() - updatedAt < 120_000
            ? ('active' as const)
            : ('idle' as const)
      return {
        id: s.key ?? `session-${i}`,
        name: OFFICE_NAMES[i % OFFICE_NAMES.length],
        modelId: s.model ?? 'auto',
        status,
        lastLine: s.task ?? s.label ?? s.title ?? s.derivedTitle ?? 'Working…',
        lastAt: updatedAt || undefined,
        taskCount: 0,
        roleDescription: s.label ?? 'Worker',
        sessionKey: s.key ?? undefined,
      }
    })
  }, [conductor.recentSessions])

  const officeAgentRows = useMemo<Array<AgentWorkingRow>>(() => {
    if (conductor.workers.length > 0) {
      return conductor.workers.map((worker, index) => {
        const persona = getAgentPersona(index)
        const currentTask = conductor.tasks.find(
          (task) => task.workerKey === worker.key && task.status === 'running',
        )?.title
        const lastLine =
          conductor.workerOutputs[worker.key] ??
          getLastAssistantMessage(
            worker.raw.messages as Array<HistoryMessage> | undefined,
          )
        const isWorkerPaused =
          conductor.isPaused &&
          (worker.status === 'running' || worker.status === 'idle')

        return {
          id: worker.key,
          name: persona.name,
          modelId: worker.model || 'auto',
          roleDescription: worker.displayName,
          status: isWorkerPaused
            ? 'paused'
            : worker.status === 'complete'
              ? 'idle'
              : worker.status === 'stale'
                ? 'error'
                : 'active',
          lastLine: isWorkerPaused ? 'Paused' : lastLine,
          lastAt: worker.updatedAt
            ? new Date(worker.updatedAt).getTime()
            : undefined,
          taskCount: conductor.tasks.filter(
            (task) => task.workerKey === worker.key,
          ).length,
          currentTask: isWorkerPaused ? 'Paused' : currentTask,
          sessionKey: worker.key,
        }
      })
    }

    return [
      {
        id: 'conductor-placeholder-agent',
        name: 'Nova',
        modelId: conductor.conductorSettings.workerModel || 'auto',
        roleDescription: 'Waiting for workers',
        status: 'spawning',
        lastLine: conductor.goal || 'Preparing the office…',
        taskCount: 0,
        currentTask: conductor.goal || 'Preparing the office…',
        sessionKey: 'conductor-placeholder-agent',
      },
    ]
  }, [
    conductor.conductorSettings.workerModel,
    conductor.goal,
    conductor.isPaused,
    conductor.tasks,
    conductor.workerOutputs,
    conductor.workers,
  ])

  const completePhaseProjectPath = useMemo(() => {
    const workerOutputTexts = [
      ...Object.values(conductor.workerOutputs),
      ...conductor.workers.map((worker) =>
        getLastAssistantMessage(
          worker.raw.messages as Array<HistoryMessage> | undefined,
        ),
      ),
    ].filter(Boolean)

    for (const text of workerOutputTexts) {
      const extractedPath = extractProjectPath(text)
      if (extractedPath) return extractedPath
    }

    for (const task of conductor.tasks) {
      if (!task.output) continue
      const extractedPath = extractProjectPath(task.output)
      if (extractedPath) return extractedPath
    }

    const streamPath = extractProjectPath(conductor.streamText)
    if (streamPath) return streamPath

    const candidates = buildProjectPathCandidates(
      conductor.workers,
      conductor.missionStartedAt,
    )
    return candidates[0] ?? null
  }, [
    conductor.tasks,
    conductor.streamText,
    conductor.workerOutputs,
    conductor.workers,
    conductor.missionStartedAt,
  ])
  const completePhaseOutputLabel = useMemo(
    () => getOutputDisplayName(completePhaseProjectPath),
    [completePhaseProjectPath],
  )

  const previewUrl = completePhaseProjectPath
    ? `/api/preview-file?path=${encodeURIComponent(`${completePhaseProjectPath}/index.html`)}`
    : null

  const selectedHistoryOutputPath = useMemo(() => {
    const entry = conductor.selectedHistoryEntry
    if (!entry) return null
    if (entry.outputPath) return entry.outputPath
    if (entry.projectPath) return entry.projectPath
    const extractedOutputPath =
      extractProjectPath(entry.outputText ?? '') ??
      extractProjectPath(entry.streamText ?? '')
    if (extractedOutputPath) return extractedOutputPath
    const candidates = buildProjectPathCandidates(
      (entry.workerDetails ?? []).map((worker) => ({ label: worker.label })),
      entry.startedAt,
    )
    return candidates[0] ?? null
  }, [conductor.selectedHistoryEntry])
  const selectedHistoryOutputLabel = useMemo(
    () => getOutputDisplayName(selectedHistoryOutputPath),
    [selectedHistoryOutputPath],
  )
  const selectedHistoryPreviewUrl = selectedHistoryOutputPath
    ? `/api/preview-file?path=${encodeURIComponent(`${selectedHistoryOutputPath}/index.html`)}`
    : null

  // Skip preview probe for history entries — /tmp files are ephemeral and won't exist later.
  // Only probe if the mission just completed (still in complete phase with matching output path).
  const isLiveCompletePreview =
    phase === 'complete' &&
    !!completePhaseProjectPath &&
    selectedHistoryOutputPath === completePhaseProjectPath
  const selectedHistoryPreview = usePreviewAvailability(
    selectedHistoryPreviewUrl,
    !!conductor.selectedHistoryEntry && isLiveCompletePreview,
  )
  const previewState = usePreviewAvailability(previewUrl, phase === 'complete')

  const completedTaskOutputs = useMemo(() => {
    return conductor.tasks
      .filter((task) => task.output)
      .map((task) => ({
        ...task,
        extractedPath: extractProjectPath(task.output ?? ''),
        previewUrl: (() => {
          const extractedPath = extractProjectPath(task.output ?? '')
          return extractedPath
            ? `/api/preview-file?path=${encodeURIComponent(`${extractedPath}/index.html`)}`
            : null
        })(),
        previewText: (task.output ?? '').trim().slice(0, 200),
      }))
  }, [conductor.tasks])

  const completeSummary = useMemo(() => {
    if (phase !== 'complete') return null
    const isFailed = !!conductor.streamError
    const lines = [
      isFailed
        ? `❌ ${conductor.streamError}`
        : '✅ Mission completed successfully',
      '',
      `**Goal:** ${conductor.goal}`,
      `**Duration:** ${formatElapsedTime(conductor.missionStartedAt, conductor.completedAt ? new Date(conductor.completedAt).getTime() : now)}`,
    ]
    if (totalWorkers > 0) {
      lines.push(
        `**Workers:** ${totalWorkers} ran · ${totalTokens.toLocaleString()} tokens`,
      )
    }
    if (completePhaseProjectPath) {
      lines.push(`**Output:** ${completePhaseOutputLabel}`)
    }
    return lines.join('\n')
  }, [
    phase,
    completePhaseProjectPath,
    completePhaseOutputLabel,
    totalWorkers,
    conductor.goal,
    totalTokens,
    conductor.missionStartedAt,
    now,
  ])
  const continuationPreview = useMemo(() => {
    const summarySource =
      completeSummary ??
      Object.values(conductor.workerOutputs).find((output) => output.trim()) ??
      conductor.workers
        .map((worker) =>
          getLastAssistantMessage(
            worker.raw.messages as Array<HistoryMessage> | undefined,
          ),
        )
        .find((output) => output.trim()) ??
      conductor.streamText
    return truncateContinuationText(summarySource ?? '')
  }, [
    completeSummary,
    conductor.streamText,
    conductor.workerOutputs,
    conductor.workers,
  ])
  const continuationModalPreview = useMemo(
    () => truncateContinuationText(continuationPreview, 200),
    [continuationPreview],
  )
  const hasMissionHistory = conductor.missionHistory.length > 0
  const canResetSavedState = hasMissionHistory || conductor.hasPersistedMission
  const filteredHistory = (() => {
    const history = conductor.missionHistory
    if (activityFilter === 'all') return history
    return history.filter((entry) => entry.status === activityFilter)
  })()
  const filteredSessions = (() => {
    const sessions = conductor.recentSessions
    if (activityFilter === 'all') return sessions
    return sessions
      .filter((session) =>
        ((session.label as string) ?? '').startsWith('worker-'),
      )
      .filter((session) => deriveSessionStatus(session) === activityFilter)
  })()
  const activityItems: Array<MissionHistoryEntry | GatewaySession> =
    hasMissionHistory ? filteredHistory : filteredSessions
  const ACTIVITY_PAGE_SIZE = 3
  const activityTotalPages = Math.max(
    1,
    Math.ceil(activityItems.length / ACTIVITY_PAGE_SIZE),
  )
  const safeActivityPage = Math.min(activityPage, activityTotalPages - 1)
  const visibleActivityItems = activityItems.slice(
    safeActivityPage * ACTIVITY_PAGE_SIZE,
    (safeActivityPage + 1) * ACTIVITY_PAGE_SIZE,
  )

  useEffect(() => {
    if (!selectedTaskId) return
    if (conductor.tasks.some((task) => task.id === selectedTaskId)) return
    setSelectedTaskId(null)
  }, [conductor.tasks, selectedTaskId])

  useEffect(() => {
    if (phase !== 'complete') return
    setCompleteCostExpanded(true)
  }, [phase, conductor.completedAt])

  useEffect(() => {
    if (!selectedHistoryEntry) return
    setHistoryCostExpanded(false)
  }, [selectedHistoryEntry])

  return (
    <ConductorPhaseRouter
      phase={phase}
      selectedHistoryEntry={selectedHistoryEntry}
      selectedHistoryOutputPath={selectedHistoryOutputPath}
      selectedHistoryPreview={selectedHistoryPreview}
      selectedHistoryOutputLabel={selectedHistoryOutputLabel}
      historyMissionCostWorkers={historyMissionCostWorkers}
      historyCostExpanded={historyCostExpanded}
      setHistoryCostExpanded={setHistoryCostExpanded}
      handleNewMission={handleNewMission}
      conductor={conductor}
      readinessSummary={readinessSummary}
      readinessChecklist={readinessChecklist}
      launchValidation={launchValidation}
      goalDraft={goalDraft}
      setGoalDraft={setGoalDraft}
      handleSubmit={handleSubmit}
      setMissionModalOpen={setMissionModalOpen}
      homeOfficeRows={homeOfficeRows}
      workerAvailabilitySummary={workerAvailabilitySummary}
      executionGuard={executionGuard}
      missionCheckpointSummary={missionCheckpointSummary}
      copyPortablePlan={copyPortablePlan}
      portablePlanCopied={portablePlanCopied}
      activityFilter={activityFilter}
      setActivityFilter={setActivityFilter}
      setActivityPage={setActivityPage}
      setContinueModalOpen={setContinueModalOpen}
      setSelectedAction={setSelectedAction}
      activityTotalPages={activityTotalPages}
      safeActivityPage={safeActivityPage}
      visibleActivityItems={visibleActivityItems}
      hasMissionHistory={hasMissionHistory}
      missionModalOpen={missionModalOpen}
      selectedAction={selectedAction}
      handleQuickActionSelect={handleQuickActionSelect}
      constraintsDraft={constraintsDraft}
      setConstraintsDraft={setConstraintsDraft}
      verificationDraft={verificationDraft}
      setVerificationDraft={setVerificationDraft}
      handoffTargetDraft={handoffTargetDraft}
      setHandoffTargetDraft={setHandoffTargetDraft}
      settingsOpen={settingsOpen}
      setSettingsOpen={setSettingsOpen}
      availableModels={availableModels}
      updateSettings={updateSettings}
      openDirectoryBrowser={openDirectoryBrowser}
      canResetSavedState={canResetSavedState}
      setContinueDraft={setContinueDraft}
      setSelectedTaskId={setSelectedTaskId}
      directoryBrowserOpen={directoryBrowserOpen}
      closeDirectoryBrowser={closeDirectoryBrowser}
      directoryBrowserPath={directoryBrowserPath}
      setDirectoryBrowserPath={setDirectoryBrowserPath}
      directoryBrowserLoading={directoryBrowserLoading}
      directoryBreadcrumbs={directoryBreadcrumbs}
      directoryBrowserError={directoryBrowserError}
      directoryBrowserEntries={directoryBrowserEntries}
      now={now}
      completeSummary={completeSummary}
      previewState={previewState}
      previewUrl={previewUrl}
      completePhaseProjectPath={completePhaseProjectPath}
      completePhaseOutputLabel={completePhaseOutputLabel}
      completedTaskOutputs={completedTaskOutputs}
      completeMissionCostWorkers={completeMissionCostWorkers}
      totalTokens={totalTokens}
      completeCostExpanded={completeCostExpanded}
      setCompleteCostExpanded={setCompleteCostExpanded}
      totalWorkers={totalWorkers}
      completedWorkers={completedWorkers}
      activeWorkerCount={activeWorkerCount}
      missionProgress={missionProgress}
      officeAgentRows={officeAgentRows}
      selectedTaskId={selectedTaskId}
      continueModalOpen={continueModalOpen}
      continuationModalPreview={continuationModalPreview}
      continueDraft={continueDraft}
      handleContinueMission={handleContinueMission}
    />
  )
}
