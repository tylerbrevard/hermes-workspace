;(function () {
  const STORE_KEY = 'hermes.75-day-tracker.v1'
  const CHALLENGES = {
    hard: {
      id: 'hard',
      name: '75 Hard',
      durationDays: 75,
      strict: true,
      waterTarget: '1 gallon',
      restartPolicy:
        'Any missed required task fails the attempt and requires a restart.',
      tasks: [
        [
          'diet',
          'Follow nutrition plan',
          'Stay within the diet or nutrition rules selected for this attempt.',
          true,
        ],
        [
          'no_alcohol_cheat',
          'No alcohol or cheat meals',
          'No alcohol and no off-plan meals.',
          true,
        ],
        [
          'workout_1',
          '45-minute workout',
          'First workout of at least 45 minutes.',
          true,
        ],
        [
          'outdoor_workout',
          '45-minute outdoor workout',
          'Second workout of at least 45 minutes, completed outdoors.',
          true,
        ],
        [
          'water',
          'Drink 1 gallon water',
          'Track plain water toward the daily target.',
          true,
        ],
        [
          'reading',
          'Read 10 pages',
          'Read at least 10 pages from a nonfiction or self-improvement book.',
          true,
        ],
        [
          'photo',
          'Progress photo',
          'Record a daily progress photo or a private reference to it.',
          true,
        ],
      ],
    },
    soft: {
      id: 'soft',
      name: '75 Soft',
      durationDays: 75,
      strict: false,
      waterTarget: '3 liters',
      restartPolicy:
        'Misses are logged as accountability data; the attempt can continue.',
      tasks: [
        [
          'eat_well',
          'Eat well',
          'Make intentional food choices; keep alcohol to social occasions.',
          true,
        ],
        [
          'movement',
          '45 minutes movement',
          'Workout, walk, mobility, or active recovery.',
          true,
        ],
        [
          'water',
          'Drink 3 liters water',
          'Track water toward the daily target.',
          true,
        ],
        [
          'reading',
          'Read 10 pages',
          'Read at least 10 pages from any book.',
          true,
        ],
        [
          'recovery_check',
          'Recovery check',
          'Use one day each week as active recovery when needed.',
          false,
        ],
      ],
    },
  }

  const $ = (id) => document.getElementById(id)
  const els = {
    challengeSelect: $('challengeSelect'),
    startDate: $('startDate'),
    attemptName: $('attemptName'),
    newAttemptButton: $('newAttemptButton'),
    exportButton: $('exportButton'),
    importInput: $('importInput'),
    currentDay: $('currentDay'),
    completedDays: $('completedDays'),
    streak: $('streak'),
    statusText: $('statusText'),
    progressTitle: $('progressTitle'),
    progressDetail: $('progressDetail'),
    progressBar: $('progressBar'),
    trackerNotice: $('trackerNotice'),
    dayGrid: $('dayGrid'),
    todayButton: $('todayButton'),
    selectedDate: $('selectedDate'),
    selectedDay: $('selectedDay'),
    dayCompletion: $('dayCompletion'),
    dayHint: $('dayHint'),
    taskList: $('taskList'),
    dayNotes: $('dayNotes'),
    photoRef: $('photoRef'),
    saveDayButton: $('saveDayButton'),
    markFailedButton: $('markFailedButton'),
    taskTemplate: $('taskTemplate'),
  }

  let state = loadState()
  let selectedDay = getCurrentDayNumber()

  function normalizeTasks(rawTasks) {
    return rawTasks.map(([id, label, detail, required]) => ({
      id,
      label,
      detail,
      required,
    }))
  }

  function defaultAttempt() {
    const today = new Date()
    return {
      id: String(Date.now()),
      name: '75 Day Attempt',
      challengeId: 'hard',
      startDate: toInputDate(today),
      status: 'active',
      failedDay: null,
      days: {},
    }
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
      if (parsed && parsed.attempt) return parsed
    } catch (error) {
      console.warn('Could not read saved tracker state', error)
    }
    return { attempt: defaultAttempt(), history: [] }
  }

  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state, null, 2))
  }

  function toInputDate(date) {
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 10)
  }

  function dateForDay(dayNumber) {
    const date = new Date(state.attempt.startDate + 'T00:00:00')
    date.setDate(date.getDate() + dayNumber - 1)
    return date
  }

  function getCurrentDayNumber() {
    const attempt = state.attempt || defaultAttempt()
    const start = new Date(attempt.startDate + 'T00:00:00')
    const today = new Date()
    const localToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    )
    const diff = Math.floor((localToday - start) / 86400000) + 1
    return Math.min(Math.max(diff, 1), getChallenge().durationDays)
  }

  function getChallenge() {
    return CHALLENGES[state.attempt.challengeId] || CHALLENGES.hard
  }

  function getTasks() {
    return normalizeTasks(getChallenge().tasks)
  }

  function getDay(dayNumber) {
    const key = String(dayNumber)
    if (!state.attempt.days[key]) {
      state.attempt.days[key] = {
        tasks: {},
        notes: '',
        photoRef: '',
        failed: false,
        updatedAt: null,
      }
    }
    return state.attempt.days[key]
  }

  function completionForDay(dayNumber) {
    const day = state.attempt.days[String(dayNumber)]
    const requiredTasks = getTasks().filter((task) => task.required)
    if (!day)
      return {
        done: 0,
        total: requiredTasks.length,
        percent: 0,
        complete: false,
        partial: false,
        failed: false,
      }
    const done = requiredTasks.filter(
      (task) => day.tasks && day.tasks[task.id],
    ).length
    const complete = done === requiredTasks.length
    return {
      done,
      total: requiredTasks.length,
      percent: Math.round((done / requiredTasks.length) * 100),
      complete,
      partial: done > 0 && !complete,
      failed: Boolean(day.failed),
    }
  }

  function renderSetup() {
    els.challengeSelect.innerHTML = ''
    Object.values(CHALLENGES).forEach((challenge) => {
      const option = document.createElement('option')
      option.value = challenge.id
      option.textContent = challenge.name
      els.challengeSelect.append(option)
    })
    els.challengeSelect.value = state.attempt.challengeId
    els.startDate.value = state.attempt.startDate
    els.attemptName.value = state.attempt.name
  }

  function renderSummary() {
    const challenge = getChallenge()
    const current = getCurrentDayNumber()
    let completed = 0
    let streak = 0
    let latestStreak = 0

    for (let day = 1; day <= challenge.durationDays; day += 1) {
      const info = completionForDay(day)
      if (info.complete && !info.failed) {
        completed += 1
        latestStreak += 1
        streak = Math.max(streak, latestStreak)
      } else if (state.attempt.days[String(day)]) {
        latestStreak = 0
      }
    }

    els.currentDay.textContent = `${current} / ${challenge.durationDays}`
    els.completedDays.textContent = String(completed)
    els.streak.textContent = String(streak)
    els.statusText.textContent =
      state.attempt.status === 'failed'
        ? `Failed on day ${state.attempt.failedDay}`
        : 'Active'
    const percent = Math.round((completed / challenge.durationDays) * 100)
    const remaining = Math.max(0, challenge.durationDays - completed)
    const finishDate = dateForDay(challenge.durationDays)
    els.progressTitle.textContent = `${percent}% complete`
    els.progressDetail.textContent =
      state.attempt.status === 'failed'
        ? `${challenge.name} attempt stopped on day ${state.attempt.failedDay}. Export before starting over if you want an archive.`
        : `${remaining} day${remaining === 1 ? '' : 's'} left. Planned finish ${finishDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.`
    els.progressBar.style.width = `${percent}%`
  }

  function renderDayGrid() {
    const challenge = getChallenge()
    els.dayGrid.innerHTML = ''
    for (let day = 1; day <= challenge.durationDays; day += 1) {
      const info = completionForDay(day)
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'day-cell'
      if (day === selectedDay) button.classList.add('selected')
      if (day === getCurrentDayNumber()) button.classList.add('today')
      if (info.failed) button.classList.add('failed')
      else if (info.complete) button.classList.add('done')
      else if (info.partial) button.classList.add('partial')
      button.textContent = String(day)
      button.addEventListener('click', () => {
        selectedDay = day
        render()
      })
      els.dayGrid.append(button)
    }
  }

  function renderSelectedDay() {
    const day = getDay(selectedDay)
    const info = completionForDay(selectedDay)
    const date = dateForDay(selectedDay)

    els.selectedDate.textContent = date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    els.selectedDay.textContent = `Day ${selectedDay}`
    els.dayCompletion.textContent = `${info.percent}%`
    els.dayHint.textContent = info.failed
      ? 'This day is marked failed.'
      : info.complete
        ? 'All required tasks are complete for this day.'
        : `${info.done} of ${info.total} required tasks complete.`
    els.dayNotes.value = day.notes || ''
    els.photoRef.value = day.photoRef || ''
    els.taskList.innerHTML = ''

    getTasks().forEach((task) => {
      const row = els.taskTemplate.content.firstElementChild.cloneNode(true)
      const input = row.querySelector('input')
      row.querySelector('strong').textContent = task.required
        ? task.label
        : `${task.label} (optional)`
      row.querySelector('small').textContent = task.detail
      input.checked = Boolean(day.tasks[task.id])
      input.dataset.taskId = task.id
      els.taskList.append(row)
    })
  }

  function render() {
    renderSetup()
    renderSummary()
    renderDayGrid()
    renderSelectedDay()
  }

  function saveSelectedDay() {
    const day = getDay(selectedDay)
    day.notes = els.dayNotes.value.trim()
    day.photoRef = els.photoRef.value.trim()
    day.tasks = {}
    els.taskList.querySelectorAll("input[type='checkbox']").forEach((input) => {
      day.tasks[input.dataset.taskId] = input.checked
    })
    day.updatedAt = new Date().toISOString()

    const info = completionForDay(selectedDay)
    if (getChallenge().strict && day.failed) {
      state.attempt.status = 'failed'
      state.attempt.failedDay = selectedDay
    } else if (info.complete && state.attempt.status !== 'failed') {
      day.failed = false
    }

    saveState()
    showNotice(`Saved day ${selectedDay}.`)
    render()
  }

  function startAttempt() {
    const existing = state.attempt
    if (existing && Object.keys(existing.days || {}).length > 0) {
      state.history.unshift({
        ...existing,
        archivedAt: new Date().toISOString(),
      })
    }

    state.attempt = {
      id: String(Date.now()),
      name:
        els.attemptName.value.trim() ||
        `${CHALLENGES[els.challengeSelect.value].name} Attempt`,
      challengeId: els.challengeSelect.value,
      startDate: els.startDate.value || toInputDate(new Date()),
      status: 'active',
      failedDay: null,
      days: {},
    }
    selectedDay = getCurrentDayNumber()
    saveState()
    showNotice(`Started ${state.attempt.name}.`)
    render()
  }

  function markFailed() {
    const day = getDay(selectedDay)
    day.failed = true
    day.updatedAt = new Date().toISOString()
    if (getChallenge().strict) {
      state.attempt.status = 'failed'
      state.attempt.failedDay = selectedDay
    }
    saveState()
    showNotice(`Marked day ${selectedDay} failed.`)
    render()
  }

  function exportData() {
    saveSelectedDay()
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = toInputDate(new Date())
    link.href = url
    link.download = `75-day-tracker-${date}.json`
    link.click()
    URL.revokeObjectURL(url)
    showNotice('Export downloaded.')
  }

  function importData(file) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'))
        if (!parsed.attempt || !parsed.attempt.challengeId) {
          throw new Error(
            'Import file does not look like a 75 Day Tracker export.',
          )
        }
        state = parsed
        selectedDay = getCurrentDayNumber()
        saveState()
        showNotice('Import complete.')
        render()
      } catch (error) {
        showNotice(error instanceof Error ? error.message : 'Import failed.')
      }
    }
    reader.readAsText(file)
  }

  let noticeTimer = null
  function showNotice(message) {
    els.trackerNotice.textContent = message
    if (noticeTimer) window.clearTimeout(noticeTimer)
    noticeTimer = window.setTimeout(() => {
      els.trackerNotice.textContent = ''
    }, 3200)
  }

  els.newAttemptButton.addEventListener('click', startAttempt)
  els.saveDayButton.addEventListener('click', saveSelectedDay)
  els.markFailedButton.addEventListener('click', markFailed)
  els.todayButton.addEventListener('click', () => {
    selectedDay = getCurrentDayNumber()
    render()
  })
  els.exportButton.addEventListener('click', exportData)
  els.importInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0]
    if (file) importData(file)
  })

  render()
})()
