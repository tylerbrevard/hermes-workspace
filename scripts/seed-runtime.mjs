import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import YAML from 'yaml'

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const PROFILES = path.join(os.homedir(), '.hermes', 'profiles')
const NOW = Date.now()
const swarmPath = path.join(REPO_ROOT, 'swarm.yaml')
const parsed = YAML.parse(fs.readFileSync(swarmPath, 'utf8'))
const workers = Array.isArray(parsed?.workers) ? parsed.workers : []

for (const worker of workers) {
  if (!worker || typeof worker.id !== 'string') continue
  const wid = worker.id
  const role =
    typeof worker.role === 'string' ? worker.role : worker.name || wid
  const task =
    typeof worker.mission === 'string'
      ? worker.mission
      : 'Awaiting orchestrator dispatch'
  const summary = `${role} runtime seeded from swarm.yaml.`
  const cwd = REPO_ROOT
  const dir = path.join(PROFILES, wid)
  fs.mkdirSync(dir, { recursive: true })
  const data = {
    workerId: wid,
    role,
    state: 'idle',
    phase: 'standby',
    currentTask: task,
    activeTool: '',
    cwd,
    lastOutputAt: NOW,
    startedAt: NOW,
    lastCheckIn: new Date(NOW).toISOString(),
    lastSummary: summary,
    lastResult: '',
    nextAction: 'Awaiting orchestrator dispatch',
    needsHuman: false,
    blockedReason: '',
    checkpointStatus: 'none',
    assignedTaskCount: 0,
    cronJobCount: 0,
  }
  fs.writeFileSync(
    path.join(dir, 'runtime.json'),
    JSON.stringify(data, null, 2),
  )
  console.log(`wrote ${wid}: ${role}`)
}
