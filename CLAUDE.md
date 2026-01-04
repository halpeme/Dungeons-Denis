# CLAUDE.md - Project Instructions

## Critical Warnings

### DO NOT use `taskkill` to kill Node processes broadly
Using `taskkill /F /IM node.exe` or similar commands will kill ALL Node processes on the system, including Claude Code itself, causing a crash.

**Safe alternatives:**
1. Use `Ctrl+C` in the terminal running the process
2. Kill specific PIDs only: `taskkill /F /PID <specific-pid>`
3. Let the user handle process termination manually
4. Use process managers that track their own spawned processes

**Never run:**
- `taskkill /F /IM node.exe` (kills ALL node processes)
- `taskkill /F /IM cmd.exe` (may kill Claude Code's shell)
