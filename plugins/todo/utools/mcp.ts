/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="utools-api-types" />

// Storage key prefixes (must match main app: todo-tasks/<id>, todo-group/<id>)
const TASKS_PREFIX = 'todo-tasks/'
const GROUPS_PREFIX = 'todo-group/'
const NEXT_TASK_SORT_KEY = 'mcp-next-task-sort'
const NEXT_GROUP_SORT_KEY = 'mcp-next-group-sort'

// Extended UToolsApi with registerTool
interface UToolsApiEx extends UToolsApi {
  registerTool: (name: string, handler: (args: any, ctx: any) => Promise<any>) => void
}

// Type definitions
interface TaskDoc {
  text: string
  groupId: string
  completed: boolean
  completed_at?: number
  first_completed_at?: number
  created_at: number
  sort: number
  dueAt?: number
}

interface GroupDoc {
  title: string
  sort: number
  created_at: number
}

// ============ Sort counter helpers ============

function getNextTaskSort(): number {
  const dbStorage = window.utools?.dbStorage
  if (!dbStorage) return 1
  const current = (dbStorage.getItem<number>(NEXT_TASK_SORT_KEY) ?? 0)
  const next = current + 1
  dbStorage.setItem(NEXT_TASK_SORT_KEY, next)
  return next
}

// ============ dbStorage helpers (compatible with main app) ============

function getAllTasks(): (TaskDoc & { _id: string })[] {
  const db = window.utools?.db
  if (!db) return []
  return db.allDocs<{ value: TaskDoc }>()
    .filter(doc => doc._id.startsWith(TASKS_PREFIX) && !(doc as any).$deprecated)
    .map(doc => ({
      _id: doc._id,
      ...((doc as any).value)
    }))
}

function getAllGroups(): (GroupDoc & { _id: string })[] {
  const db = window.utools?.db
  if (!db) return []
  return db.allDocs<GroupDoc>()
    .filter(doc => doc._id.startsWith(GROUPS_PREFIX) && !(doc as any).$deprecated)
    .map(doc => ({
      _id: doc._id,
      ...((doc as any).value || {})
    }))
    .sort((a, b) => a.sort - b.sort)
}

function getTaskById(id: string): (TaskDoc & { _id: string }) | null {
  const fullId = id.startsWith(TASKS_PREFIX) ? id : `${TASKS_PREFIX}${id}`
  const doc = window.utools?.db?.get<{ value: TaskDoc }>(fullId)
  if (!doc || (doc as any).$deprecated) return null
  return {
    _id: doc._id,
    ...((doc as any).value)
  }
}

function getGroupIdByName(name: string): string | null {
  const groups = getAllGroups()
  const group = groups.find(g => g.title === name)
  return group ? group._id : null
}

function getGroupNameById(id: string): string {
  const groups = getAllGroups()
  const group = groups.find(g => g._id === id)
  return group ? group.title : ''
}

function getNextGroupSort(): number {
  const dbStorage = window.utools?.dbStorage
  if (!dbStorage) return 1
  const current = (dbStorage.getItem<number>(NEXT_GROUP_SORT_KEY) ?? 0)
  const next = current + 1
  dbStorage.setItem(NEXT_GROUP_SORT_KEY, next)
  return next
}

function getOrCreateGroup(name: string): string {
  const groups = getAllGroups()
  const existing = groups.find(g => g.title === name)
  if (existing) return existing._id

  const id = Date.now()
  const groupId = `${GROUPS_PREFIX}${id}`
  const group: GroupDoc = {
    title: name,
    sort: getNextGroupSort(),
    created_at: id
  }
  window.utools?.dbStorage?.setItem(groupId, group)
  window.utools?.db?.put({ _id: groupId, value: group })
  return groupId
}

function formatDateTime(ts: number | undefined): string | undefined {
  if (!ts) return undefined
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ============ Tool Handlers ============

const handleTodoGroupList = async () => {
  const groups = getAllGroups()
  return {
    groups: groups.map(g => ({
      name: g.title
    }))
  }
}

const handleTodoSearch = async ({
  query,
  group,
  status,
  dueAt
}: {
  query?: string
  group?: string
  status?: string
  dueAt?: string
}) => {
  let tasks = getAllTasks()

  // 关键词搜索
  if (query) {
    const keyword = query.toLowerCase()
    tasks = tasks.filter(t => t.text.toLowerCase().includes(keyword))
  }

  // 分组筛选
  if (group) {
    const groupId = getGroupIdByName(group)
    if (groupId) {
      tasks = tasks.filter(t => t.groupId === groupId)
    }
  }

  // 状态筛选
  if (status === 'done') {
    tasks = tasks.filter(t => t.completed)
  } else if (status === 'pending') {
    tasks = tasks.filter(t => !t.completed)
  }

  // 结束日期筛选
  if (dueAt) {
    const dueDate = new Date(dueAt).setHours(23, 59, 59, 999)
    tasks = tasks.filter(t => t.dueAt && t.dueAt <= dueDate)
  }

  tasks.sort((a, b) => a.sort - b.sort)

  return {
    tasks: tasks.map(t => ({
      id: t._id,
      text: t.text,
      group: getGroupNameById(t.groupId),
      completed: t.completed,
      dueAt: formatDateTime(t.dueAt),
      completed_at: formatDateTime(t.completed_at),
      created_at: formatDateTime(t.created_at)
    }))
  }
}

const handleTodoCreate = async ({ content, dueAt, group }: { content: string; dueAt?: string; group?: string }) => {
  const id = Date.now()
  const taskId = `${TASKS_PREFIX}${id}`
  const groupId = group ? getOrCreateGroup(group) : `${GROUPS_PREFIX}pending`

  const task: TaskDoc = {
    text: content,
    groupId,
    completed: false,
    created_at: id,
    sort: getNextTaskSort()
  }

  if (dueAt) {
    task.dueAt = new Date(dueAt).setHours(23, 59, 59, 999)
  }

  window.utools?.dbStorage?.setItem(taskId, task)
  window.utools?.db?.put({ _id: taskId, value: task })

  return {
    id: taskId,
    text: task.text,
    group: group ?? '待处理',
    dueAt: formatDateTime(task.dueAt),
    created_at: formatDateTime(task.created_at)
  }
}

const handleTodoUpdate = async ({
  id,
  patch
}: {
  id: string
  patch: { content?: string; status?: string; dueAt?: string; group?: string }
}) => {
  const task = getTaskById(id)
  if (!task) {
    throw new Error(`待办事项不存在: ${id}`)
  }

  const updates: Partial<TaskDoc> = {}

  if (patch.content !== undefined) {
    updates.text = patch.content
  }

  if (patch.status === 'done') {
    updates.completed = true
    updates.completed_at = Date.now()
    if (!task.first_completed_at) {
      updates.first_completed_at = updates.completed_at
    }
  } else if (patch.status === 'pending') {
    updates.completed = false
    updates.completed_at = undefined
  }

  if (patch.dueAt !== undefined) {
    updates.dueAt = patch.dueAt ? new Date(patch.dueAt).setHours(23, 59, 59, 999) : undefined
  }

  if (patch.group !== undefined) {
    updates.groupId = getOrCreateGroup(patch.group)
  }

  if (Object.keys(updates).length > 0) {
    const updated = { ...task, ...updates }
    window.utools?.dbStorage?.setItem(task._id, updated)
    window.utools?.db?.put({ _id: task._id, value: updated })
  }

  return {
    id: task._id,
    text: updates.text ?? task.text,
    group: patch.group ?? getGroupNameById(updates.groupId ?? task.groupId),
    completed: updates.completed ?? task.completed,
    dueAt: formatDateTime(updates.dueAt ?? task.dueAt),
    updated: true
  }
}

// ============ Tool Registry ============

const TOOL_HANDLERS: Record<string, (args: any) => Promise<any>> = {
  todo_group_list: handleTodoGroupList,
  todo_search: handleTodoSearch,
  todo_create: handleTodoCreate,
  todo_update: handleTodoUpdate,
}

let _registerTool: UToolsApiEx['registerTool'] | undefined
let _registered = false

export const registerTools = () => {
  if (_registered) return
  if (!window.utools) return

  if (!_registerTool) {
    _registerTool = (window.utools as UToolsApiEx).registerTool
  }
  if (!_registerTool) return

  for (const [name, handler] of Object.entries(TOOL_HANDLERS)) {
    _registerTool(name, handler)
  }

  _registered = true
}
