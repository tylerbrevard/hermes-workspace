import { readJsonStorage, writeJsonStorage } from '@/lib/typed-storage'

export type ApprovalRequest = {
  id: string
  agentId: string
  agentName: string
  action: string
  context: string
  requestedAt: number
  status: 'pending' | 'approved' | 'denied'
  resolvedAt?: number
  /** Where this approval came from — 'agent' (parsed from SSE) or 'gateway' (polled from gateway API) */
  source?: 'agent' | 'gateway'
  /** Raw gateway approval ID for resolving via the gateway API */
  gatewayApprovalId?: string
}

const APPROVALS_KEY = 'clawsuite:approvals'

function isApprovalRequest(value: unknown): value is ApprovalRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Partial<ApprovalRequest>
  return (
    typeof item.id === 'string' &&
    typeof item.agentId === 'string' &&
    typeof item.agentName === 'string' &&
    typeof item.action === 'string' &&
    typeof item.context === 'string' &&
    typeof item.requestedAt === 'number' &&
    (item.status === 'pending' ||
      item.status === 'approved' ||
      item.status === 'denied')
  )
}

function isApprovalRequestArray(
  value: unknown,
): value is Array<ApprovalRequest> {
  return Array.isArray(value) && value.every(isApprovalRequest)
}

export function loadApprovals(): Array<ApprovalRequest> {
  const all = readJsonStorage(APPROVALS_KEY, [], isApprovalRequestArray).value
  // Auto-archive resolved items older than 24h
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  return all.filter(
    (approval) =>
      approval.status === 'pending' ||
      (approval.resolvedAt != null && approval.resolvedAt > cutoff),
  )
}

export function saveApprovals(approvals: Array<ApprovalRequest>): void {
  writeJsonStorage(APPROVALS_KEY, approvals)
}

export function addApproval(
  req: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>,
): ApprovalRequest {
  const newReq: ApprovalRequest = {
    ...req,
    id: `apr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    requestedAt: Date.now(),
    status: 'pending',
  }
  const current = loadApprovals()
  saveApprovals([newReq, ...current])
  return newReq
}
