import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { usePageTitle } from '@/hooks/use-page-title'
import { TasksScreen } from '@/screens/tasks/tasks-screen'

const searchSchema = z.object({
  assignee: z.string().optional(),
  filter: z
    .enum(['all', 'active', 'blocked', 'overdue', 'today', 'waiting', 'delegated'])
    .optional(),
  create: z.enum(['task']).optional(),
  column: z
    .enum(['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'deleted'])
    .optional(),
})

export const Route = createFileRoute('/tasks')({
  ssr: false,
  validateSearch: searchSchema,
  component: TasksRoute,
})

function TasksRoute() {
  usePageTitle('Tasks')
  return <TasksScreen />
}
