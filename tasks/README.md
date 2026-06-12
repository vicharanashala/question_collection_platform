# Tasks

This folder contains task definitions for the Agriculture Knowledge Collection Platform.

## Naming Convention

Task files use the format: `TASK_<count>_<module-name>.md`

- Count is a two-digit sequential number (01, 02, ...) reflecting module order
- Module name is lowercase, underscores separate words
- Examples: `TASK_01_auth.md`, `TASK_07_withdrawal.md`, `TASK_09_admin.md`

## Structure

- `_TASKS.md` — Task index with status tracking
- `TASK_<count>_<module-name>.md` — Individual task files

## Files vs. Folders

| File | Shared? | Notes |
|---|---|---|
| `tasks/README.md` | Yes | This file |
| `tasks/_TASKS.md` | Yes | Task index and status |
| `tasks/TASK_*.md` | Yes | Individual task details, sub-tasks, notes |