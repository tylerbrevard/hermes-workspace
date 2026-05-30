import { ROLE_NAMES, ROLE_PRESETS } from './lib/swarm2-workflow'

type AvailableModel = {
  id: string
  name: string
  provider: string
}

type Swarm2AddAgentModalProps = {
  open: boolean
  saving: boolean
  error: string | null
  modelsLoading: boolean
  modelsError: boolean
  availableModels: Array<AvailableModel>
  workerId: string
  workerName: string
  workerRole: string
  workerSpecialty: string
  workerModel: string
  workerMission: string
  onClose: () => void
  onSave: () => void
  onWorkerIdChange: (value: string) => void
  onWorkerNameChange: (value: string) => void
  onWorkerRoleChange: (value: string) => void
  onWorkerSpecialtyChange: (value: string) => void
  onWorkerModelChange: (value: string) => void
  onWorkerMissionChange: (value: string) => void
}

export function Swarm2AddAgentModal({
  open,
  saving,
  error,
  modelsLoading,
  modelsError,
  availableModels,
  workerId,
  workerName,
  workerRole,
  workerSpecialty,
  workerModel,
  workerMission,
  onClose,
  onSave,
  onWorkerIdChange,
  onWorkerNameChange,
  onWorkerRoleChange,
  onWorkerSpecialtyChange,
  onWorkerModelChange,
  onWorkerMissionChange,
}: Swarm2AddAgentModalProps) {
  if (!open) return null

  const selectedPreset = ROLE_PRESETS.find(
    (preset) => preset.role === workerRole,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-[var(--theme-border2)] bg-[var(--theme-card)] p-6 shadow-[0_30px_100px_var(--theme-shadow)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--theme-text)]">
              Add Swarm Agent
            </h2>
            <p className="mt-1 text-sm text-[var(--theme-muted-2)]">
              Create a new swarm roster entry and configure its identity.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-1.5 text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
          >
            Close
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-[var(--theme-muted)]">
              Role preset
            </span>
            <select
              value={workerRole}
              onChange={(event) => onWorkerRoleChange(event.target.value)}
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-[var(--theme-text)] outline-none"
            >
              {ROLE_NAMES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
              Presets auto-fill specialty, mission, system prompt, and skill
              stack. Pick “Custom” for a blank slate.
            </p>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--theme-muted)]">
              Worker ID
            </span>
            <input
              value={workerId}
              onChange={(event) => onWorkerIdChange(event.target.value)}
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-[var(--theme-text)] outline-none"
              placeholder="swarmN"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--theme-muted)]">
              Display name
            </span>
            <input
              value={workerName}
              onChange={(event) => onWorkerNameChange(event.target.value)}
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-[var(--theme-text)] outline-none"
              placeholder="e.g. Mirror, Builder"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 flex items-center justify-between text-[var(--theme-muted)]">
              <span>Model</span>
              <span className="text-[10px] text-[var(--theme-muted-2)]">
                {availableModels.length > 0
                  ? `${availableModels.length} available`
                  : modelsLoading
                    ? 'loading…'
                    : '0 found'}
              </span>
            </span>
            <input
              value={workerModel}
              onChange={(event) => onWorkerModelChange(event.target.value)}
              list="swarm-add-models"
              placeholder={
                availableModels.length
                  ? 'Search or pick a detected model…'
                  : modelsLoading
                    ? 'Loading detected models…'
                    : 'No models detected'
              }
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-[var(--theme-text)] outline-none"
            />
            <datalist id="swarm-add-models">
              {availableModels.map((model) => (
                <option key={model.id} value={model.name}>
                  {model.provider}
                </option>
              ))}
            </datalist>
            <p className="mt-1 text-xs text-[var(--theme-muted-2)]">
              Searchable picker backed by /api/models, the same source as chat.{' '}
              {modelsError
                ? 'Model discovery errored, so this is empty until refresh.'
                : 'Start typing to see every detected model from the user’s Hermes config and local providers.'}
            </p>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-[var(--theme-muted)]">
              Specialty
            </span>
            <input
              value={workerSpecialty}
              onChange={(event) => onWorkerSpecialtyChange(event.target.value)}
              className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-[var(--theme-text)] outline-none"
              placeholder={selectedPreset?.specialty || 'short focus area'}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-[var(--theme-muted)]">
              Mission
            </span>
            <textarea
              value={workerMission}
              onChange={(event) => onWorkerMissionChange(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-[var(--theme-text)] outline-none"
              placeholder={
                selectedPreset?.mission || 'standing mission for this worker'
              }
            />
          </label>
          {selectedPreset?.systemPrompt ? (
            <div className="md:col-span-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2 text-xs text-[var(--theme-muted-2)]">
              <div className="mb-1 font-semibold text-[var(--theme-muted)]">
                System prompt (embedded with role)
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">
                {selectedPreset.systemPrompt}
              </div>
              <div className="mt-2 font-semibold text-[var(--theme-muted)]">
                Skills loaded
              </div>
              <div className="font-mono">
                {selectedPreset.skills.join(', ') || '—'}
              </div>
            </div>
          ) : null}
        </div>
        {error ? (
          <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2 text-sm text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !workerId.trim() || !workerName.trim()}
            onClick={onSave}
            className="rounded-lg bg-[var(--theme-accent)] px-4 py-2 text-sm font-medium text-primary-950 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save swarm agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
