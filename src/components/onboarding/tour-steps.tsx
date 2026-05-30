import type { Step } from 'react-joyride'

export const tourSteps: Array<Step> = [
  // Step 1: Welcome
  {
    target: 'body',
    placement: 'center',
    title: 'Hermes Workspace',
    content: (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <img
          src="/claude-avatar.webp"
          alt="Hermes Agent"
          style={{ width: 48, height: 48, borderRadius: 12 }}
        />
        <p style={{ textAlign: 'center', margin: 0 }}>
          Agents, chats, files, and runtime checks in one place.
        </p>
      </div>
    ),
    disableBeacon: true,
  },
  // Step 2: Sidebar
  {
    target: '[data-tour="sidebar-container"]',
    placement: 'right',
    title: 'Sidebar',
    content: 'Pinned pages and collapsible sections.',
  },
  // Step 3: New Session
  {
    target: '[data-tour="new-session"]',
    placement: 'right',
    title: 'New Chat',
    content: 'Start a saved chat session.',
  },
  // Step 4: Dashboard
  {
    target: '[data-tour="dashboard"]',
    placement: 'right',
    title: 'Dashboard',
    content: 'Sessions, usage, and activity.',
  },
  // Step 5: Agent Hub
  {
    target: '[data-tour="agent-hub"]',
    placement: 'right',
    title: 'Agent Hub',
    content: 'Manage agents, profiles, and runtime checks.',
  },
  // Step 7: Skills
  {
    target: '[data-tour="skills"]',
    placement: 'right',
    title: 'Skills Library',
    content: 'Browse and install agent skills.',
  },
  // Step 8: Terminal
  {
    target: '[data-tour="terminal"]',
    placement: 'right',
    title: 'Terminal',
    content: 'Run quick shell commands.',
  },
  // Step 9: Usage Meter (in header)
  {
    target: '[data-tour="usage-meter"]',
    placement: 'bottom',
    title: 'Usage Monitor',
    content: 'Provider usage and cost signals.',
  },
  // Step 10: Settings
  {
    target: '[data-tour="settings"]',
    placement: 'right',
    title: 'Settings',
    content: 'Model, routing, look, alerts, and runtime defaults.',
  },
  // Step 11: Finish
  {
    target: 'body',
    placement: 'center',
    title: 'Ready',
    content: 'Start a chat or open a page. Press ? for shortcuts.',
  },
]
