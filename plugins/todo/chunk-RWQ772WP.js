"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }// public/utools/mcp.ts
var TASKS_PREFIX = "todo-tasks/";
var GROUPS_PREFIX = "todo-group/";
var NEXT_TASK_SORT_KEY = "mcp-next-task-sort";
var NEXT_GROUP_SORT_KEY = "mcp-next-group-sort";
function getNextTaskSort() {
  var _a;
  const dbStorage = (_a = window.utools) == null ? void 0 : _a.dbStorage;
  if (!dbStorage) return 1;
  const current = _nullishCoalesce(dbStorage.getItem(NEXT_TASK_SORT_KEY), () => ( 0));
  const next = current + 1;
  dbStorage.setItem(NEXT_TASK_SORT_KEY, next);
  return next;
}
function getAllTasks() {
  var _a;
  const db = (_a = window.utools) == null ? void 0 : _a.db;
  if (!db) return [];
  return db.allDocs().filter((doc) => doc._id.startsWith(TASKS_PREFIX) && !doc.$deprecated).map((doc) => ({
    _id: doc._id,
    ...doc.value
  }));
}
function getAllGroups() {
  var _a;
  const db = (_a = window.utools) == null ? void 0 : _a.db;
  if (!db) return [];
  return db.allDocs().filter((doc) => doc._id.startsWith(GROUPS_PREFIX) && !doc.$deprecated).map((doc) => ({
    _id: doc._id,
    ...doc.value || {}
  })).sort((a, b) => a.sort - b.sort);
}
function getTaskById(id) {
  var _a, _b;
  const fullId = id.startsWith(TASKS_PREFIX) ? id : `${TASKS_PREFIX}${id}`;
  const doc = (_b = (_a = window.utools) == null ? void 0 : _a.db) == null ? void 0 : _b.get(fullId);
  if (!doc || doc.$deprecated) return null;
  return {
    _id: doc._id,
    ...doc.value
  };
}
function getGroupIdByName(name) {
  const groups = getAllGroups();
  const group = groups.find((g) => g.title === name);
  return group ? group._id : null;
}
function getGroupNameById(id) {
  const groups = getAllGroups();
  const group = groups.find((g) => g._id === id);
  return group ? group.title : "";
}
function getNextGroupSort() {
  var _a;
  const dbStorage = (_a = window.utools) == null ? void 0 : _a.dbStorage;
  if (!dbStorage) return 1;
  const current = _nullishCoalesce(dbStorage.getItem(NEXT_GROUP_SORT_KEY), () => ( 0));
  const next = current + 1;
  dbStorage.setItem(NEXT_GROUP_SORT_KEY, next);
  return next;
}
function getOrCreateGroup(name) {
  var _a, _b, _c, _d;
  const groups = getAllGroups();
  const existing = groups.find((g) => g.title === name);
  if (existing) return existing._id;
  const id = Date.now();
  const groupId = `${GROUPS_PREFIX}${id}`;
  const group = {
    title: name,
    sort: getNextGroupSort(),
    created_at: id
  };
  (_b = (_a = window.utools) == null ? void 0 : _a.dbStorage) == null ? void 0 : _b.setItem(groupId, group);
  (_d = (_c = window.utools) == null ? void 0 : _c.db) == null ? void 0 : _d.put({ _id: groupId, value: group });
  return groupId;
}
function formatDateTime(ts) {
  if (!ts) return void 0;
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
var handleTodoGroupList = async () => {
  const groups = getAllGroups();
  return {
    groups: groups.map((g) => ({
      name: g.title
    }))
  };
};
var handleTodoSearch = async ({
  query,
  group,
  status,
  dueAt
}) => {
  let tasks = getAllTasks();
  if (query) {
    const keyword = query.toLowerCase();
    tasks = tasks.filter((t) => t.text.toLowerCase().includes(keyword));
  }
  if (group) {
    const groupId = getGroupIdByName(group);
    if (groupId) {
      tasks = tasks.filter((t) => t.groupId === groupId);
    }
  }
  if (status === "done") {
    tasks = tasks.filter((t) => t.completed);
  } else if (status === "pending") {
    tasks = tasks.filter((t) => !t.completed);
  }
  if (dueAt) {
    const dueDate = new Date(dueAt).setHours(23, 59, 59, 999);
    tasks = tasks.filter((t) => t.dueAt && t.dueAt <= dueDate);
  }
  tasks.sort((a, b) => a.sort - b.sort);
  return {
    tasks: tasks.map((t) => ({
      id: t._id,
      text: t.text,
      group: getGroupNameById(t.groupId),
      completed: t.completed,
      dueAt: formatDateTime(t.dueAt),
      completed_at: formatDateTime(t.completed_at),
      created_at: formatDateTime(t.created_at)
    }))
  };
};
var handleTodoCreate = async ({ content, dueAt, group }) => {
  var _a, _b, _c, _d;
  const id = Date.now();
  const taskId = `${TASKS_PREFIX}${id}`;
  const groupId = group ? getOrCreateGroup(group) : `${GROUPS_PREFIX}pending`;
  const task = {
    text: content,
    groupId,
    completed: false,
    created_at: id,
    sort: getNextTaskSort()
  };
  if (dueAt) {
    task.dueAt = new Date(dueAt).setHours(23, 59, 59, 999);
  }
  (_b = (_a = window.utools) == null ? void 0 : _a.dbStorage) == null ? void 0 : _b.setItem(taskId, task);
  (_d = (_c = window.utools) == null ? void 0 : _c.db) == null ? void 0 : _d.put({ _id: taskId, value: task });
  return {
    id: taskId,
    text: task.text,
    group: _nullishCoalesce(group, () => ( "\u5F85\u5904\u7406")),
    dueAt: formatDateTime(task.dueAt),
    created_at: formatDateTime(task.created_at)
  };
};
var handleTodoUpdate = async ({
  id,
  patch
}) => {
  var _a, _b, _c, _d;
  const task = getTaskById(id);
  if (!task) {
    throw new Error(`\u5F85\u529E\u4E8B\u9879\u4E0D\u5B58\u5728: ${id}`);
  }
  const updates = {};
  if (patch.content !== void 0) {
    updates.text = patch.content;
  }
  if (patch.status === "done") {
    updates.completed = true;
    updates.completed_at = Date.now();
    if (!task.first_completed_at) {
      updates.first_completed_at = updates.completed_at;
    }
  } else if (patch.status === "pending") {
    updates.completed = false;
    updates.completed_at = void 0;
  }
  if (patch.dueAt !== void 0) {
    updates.dueAt = patch.dueAt ? new Date(patch.dueAt).setHours(23, 59, 59, 999) : void 0;
  }
  if (patch.group !== void 0) {
    updates.groupId = getOrCreateGroup(patch.group);
  }
  if (Object.keys(updates).length > 0) {
    const updated = { ...task, ...updates };
    (_b = (_a = window.utools) == null ? void 0 : _a.dbStorage) == null ? void 0 : _b.setItem(task._id, updated);
    (_d = (_c = window.utools) == null ? void 0 : _c.db) == null ? void 0 : _d.put({ _id: task._id, value: updated });
  }
  return {
    id: task._id,
    text: _nullishCoalesce(updates.text, () => ( task.text)),
    group: _nullishCoalesce(patch.group, () => ( getGroupNameById(_nullishCoalesce(updates.groupId, () => ( task.groupId))))),
    completed: _nullishCoalesce(updates.completed, () => ( task.completed)),
    dueAt: formatDateTime(_nullishCoalesce(updates.dueAt, () => ( task.dueAt))),
    updated: true
  };
};
var TOOL_HANDLERS = {
  todo_group_list: handleTodoGroupList,
  todo_search: handleTodoSearch,
  todo_create: handleTodoCreate,
  todo_update: handleTodoUpdate
};
var _registerTool;
var _registered = false;
var registerTools = () => {
  if (_registered) return;
  if (!window.utools) return;
  if (!_registerTool) {
    _registerTool = window.utools.registerTool;
  }
  if (!_registerTool) return;
  for (const [name, handler] of Object.entries(TOOL_HANDLERS)) {
    _registerTool(name, handler);
  }
  _registered = true;
};



exports.registerTools = registerTools;
