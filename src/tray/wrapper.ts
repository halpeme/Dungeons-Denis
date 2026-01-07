import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SysTray = require('systray2').default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerState {
  process: ChildProcess | null;
  running: boolean;
  logBuffer: string[];
  logFile: string;
  localIP: string;
}

class DungeonsTray {
  private tray: typeof SysTray | null = null;
  private server: ServerState;
  private readonly MAX_BUFFER_LINES = 1000;
  private readonly LOG_DIR: string;
  private readonly PROJECT_ROOT: string;

  constructor() {
    this.PROJECT_ROOT = path.join(__dirname, '../..');
    this.LOG_DIR = path.join(this.PROJECT_ROOT, 'logs');
    this.server = {
      process: null,
      running: false,
      logBuffer: [],
      logFile: this.getCurrentLogFile(),
      localIP: this.getLocalIPAddress(),
    };

    // Ensure logs directory exists
    if (!fs.existsSync(this.LOG_DIR)) {
      fs.mkdirSync(this.LOG_DIR, { recursive: true });
    }

    this.initializeTray();
  }

  private getLocalIPAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }

  private getCurrentLogFile(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.LOG_DIR, `tray-${date}.log`);
  }

  private getIconBase64(): string {
    // systray2 requires Base64-encoded icon data
    const iconPath = path.join(__dirname, 'icon.ico');
    if (fs.existsSync(iconPath)) {
      const iconData = fs.readFileSync(iconPath);
      return iconData.toString('base64');
    }
    // Fallback: return empty string (will use default icon)
    console.warn('Icon file not found:', iconPath);
    return '';
  }

  private initializeTray(): void {
    const iconBase64 = this.getIconBase64();
    const ip = this.server.localIP;

    const menu = {
      icon: iconBase64,
      title: 'Dungeons & Denis',
      tooltip: 'Dungeons & Denis Server',
      items: [
        {
          title: this.server.running ? '● Server Running' : '○ Server Stopped',
          tooltip: 'Server status',
          checked: false,
          enabled: false,
        },
        SysTray.separator,
        {
          title: 'Start Server',
          tooltip: 'Start the Dungeons & Denis server',
          checked: false,
          enabled: !this.server.running,
        },
        {
          title: 'Stop Server',
          tooltip: 'Stop the server gracefully',
          checked: false,
          enabled: this.server.running,
        },
        {
          title: 'Restart Server',
          tooltip: 'Restart the server',
          checked: false,
          enabled: this.server.running,
        },
        SysTray.separator,
        {
          title: 'View Logs',
          tooltip: 'Open log file in Notepad',
          checked: false,
          enabled: true,
        },
        {
          title: 'Clear Logs',
          tooltip: 'Clear the current log file',
          checked: false,
          enabled: true,
        },
        SysTray.separator,
        {
          title: `Open GM Controller (${ip})`,
          tooltip: `Open http://${ip}:3001/gm`,
          checked: false,
          enabled: true,
        },
        {
          title: `Open Table Display (${ip})`,
          tooltip: `Open http://${ip}:3001/table`,
          checked: false,
          enabled: true,
        },
        SysTray.separator,
        {
          title: 'Exit',
          tooltip: 'Stop server and quit',
          checked: false,
          enabled: true,
        },
      ],
    };

    this.tray = new SysTray({
      menu,
      debug: false,
      copyDir: true,
    });

    this.tray.onClick((action: { item: { title: string } }) => {
      this.handleMenuClick(action);
    });

    console.log('🏰 Dungeons & Denis Tray initialized');
    console.log(`   Host: http://${ip}:3001`);
    console.log('   Right-click the tray icon to control the server\n');

    // Auto-start server as requested
    // Wait a moment for Tray to initialize effectively (prevents race conditions with cleanup logic)
    setTimeout(() => {
      this.startServer().catch(err => {
        console.error('Failed to auto-start server:', err);
      });
    }, 1500);
  }

  private handleMenuClick(action: { item: { title: string } }): void {
    const title = action.item.title;

    const ip = this.server.localIP;

    if (title === 'Start Server') {
      this.startServer();
    } else if (title === 'Stop Server') {
      this.stopServer();
    } else if (title === 'Restart Server') {
      this.restartServer();
    } else if (title === 'View Logs') {
      this.viewLogs();
    } else if (title === 'Clear Logs') {
      this.clearLogs();
    } else if (title.startsWith('Open GM Controller')) {
      this.openURL(`http://${ip}:3001/gm`);
    } else if (title.startsWith('Open Table Display')) {
      this.openURL(`http://${ip}:3001/table`);
    } else if (title === 'Exit') {
      this.exit();
    }
  }

  private isProductionMode(): boolean {
    // Check if we're running from a dist-release bundle (portable Node.js)
    // In production, the structure is: dist-release/app/dist/tray/wrapper.js
    // __dirname would be dist-release/app/dist/tray
    const appDir = path.join(this.PROJECT_ROOT);
    const parentDir = path.dirname(appDir);
    return fs.existsSync(path.join(parentDir, 'node', 'node.exe'));
  }

  private async cleanupRunningInstance(): Promise<void> {
    const PORT = 3001;
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      // Find PID listing on port 3001
      exec(`netstat -ano | findstr :${PORT}`, (error: any, stdout: string) => {
        try {
          if (error || !stdout) {
            resolve();
            return;
          }

          // Parse PID (last token of the line)
          // TCP    0.0.0.0:3001           0.0.0.0:0              LISTENING       1234
          const lines = stdout.trim().split('\n');
          const pidsToKill = new Set<string>();

          lines.forEach(line => {
            // Line format: TCP    0.0.0.0:3001           0.0.0.0:0              LISTENING       1234
            if (line.includes('LISTENING')) {
              const parts = line.trim().split(/\s+/);
              // parts[1] is Local Address (e.g., 0.0.0.0:3001 or [::]:3001)
              const localAddress = parts[1];
              const pid = parts[parts.length - 1];

              // Strict check: Must strictly end with :3001
              if (localAddress && localAddress.endsWith(`:${PORT}`) && pid && /^\d+$/.test(pid) && pid !== '0') {
                pidsToKill.add(pid);
              }
            }
          });

          if (pidsToKill.size === 0) {
            resolve();
            return;
          }

          console.log(`Found running instances on port ${PORT}, cleaning up...`);
          this.appendLog(`[TRAY] Cleaning up ${pidsToKill.size} existing process(es) on port ${PORT}`);

          let killed = 0;
          pidsToKill.forEach(pid => {
            exec(`taskkill /F /T /PID ${pid}`, () => {
              killed++;
              if (killed === pidsToKill.size) {
                // Wait a moment for OS to release the port
                setTimeout(resolve, 1000);
              }
            });
          });
        } catch (err: any) {
          console.error('Error during cleanup:', err);
          this.appendLog(`[WARN] Cleanup failed: ${err.message}`);
          resolve(); // Resolve anyway to allow server to try starting
        }
      });
    });
  }

  private async startServer(): Promise<void> {
    if (this.server.running) {
      console.log('Server is already running');
      return;
    }

    // Proactive cleanup as requested
    await this.cleanupRunningInstance();

    const isProduction = this.isProductionMode();
    console.log(`Starting server in ${isProduction ? 'production' : 'development'} mode...`);
    this.appendLog(`[TRAY] Starting server in ${isProduction ? 'production' : 'development'} mode...`);

    let serverProcess;

    try {
      if (isProduction) {
        // In production, use the bundled node.exe to run compiled server.js
        const nodeExe = path.join(this.PROJECT_ROOT, '..', 'node', 'node.exe');
        const serverScript = path.join(this.PROJECT_ROOT, 'dist', 'server.js');

        console.log(`Node exe: ${nodeExe}`);
        console.log(`Server script: ${serverScript}`);
        this.appendLog(`[TRAY] Node: ${nodeExe}`);
        this.appendLog(`[TRAY] Script: ${serverScript}`);

        if (!fs.existsSync(nodeExe)) {
          this.appendLog(`[ERROR] node.exe not found at: ${nodeExe}`);
          console.error('node.exe not found');
          return;
        }

        if (!fs.existsSync(serverScript)) {
          this.appendLog(`[ERROR] server.js not found at: ${serverScript}`);
          console.error('server.js not found');
          return;
        }

        serverProcess = spawn(nodeExe, [serverScript], {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: this.PROJECT_ROOT,
          windowsHide: true,
          env: { ...process.env, NODE_ENV: 'production' }
        });
      } else {
        // In development, use tsx watch for hot reloading
        serverProcess = spawn('npx', ['tsx', 'watch', 'src/server.ts'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: this.PROJECT_ROOT,
          shell: true,
          windowsHide: true,
        });
      }

      serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err);
        this.appendLog(`[ERROR] Failed to start server: ${err.message}`);
        this.server.running = false;
        this.server.process = null;
        this.updateMenu();
      });

      this.server.process = serverProcess;
      this.server.running = true;

      // Capture stdout
      serverProcess.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        lines.forEach((line) => {
          if (line.trim()) {
            console.log(line.trim()); // Mirror to console
            this.appendLog(line);
          }
        });
      });

      // Capture stderr
      serverProcess.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        lines.forEach((line) => {
          if (line.trim()) {
            console.error(line.trim()); // Mirror to console
            this.appendLog(`[ERROR] ${line}`);
          }
        });
      });

      // Handle process exit
      serverProcess.on('exit', (code) => {
        this.server.running = false;
        this.server.process = null;

        if (code !== 0 && code !== null) {
          const msg = `[TRAY] Server crashed with exit code: ${code}`;
          this.appendLog(msg);
          console.error(msg);
        } else {
          this.appendLog('[TRAY] Server stopped');
        }

        this.updateMenu();
      });

      this.updateMenu();
    } catch (err: any) {
      console.error('Failed to spawn server process:', err);
      this.appendLog(`[ERROR] Failed to spawn server process: ${err.message}`);
      this.server.running = false;
      this.server.process = null;
      this.updateMenu();
    }
  }

  private async stopServer(): Promise<void> {
    if (!this.server.running || !this.server.process) {
      console.log('Server is not running');
      return;
    }

    console.log('Stopping server...');
    this.appendLog('[TRAY] Stopping server...');

    const pid = this.server.process.pid;
    if (!pid) return;

    return new Promise<void>((resolve) => {
      // Use taskkill to kill the process tree (/T) forcefully (/F)
      // This ensures all child processes (like node spawning another node) are killed
      const killCommand = `taskkill /F /T /PID ${pid}`;

      const { exec } = require('child_process');
      exec(killCommand, (error: any) => {
        if (error) {
          // It might have already exited, or we don't have permission
          // Fallback to regular kill
          this.appendLog(`[WARN] taskkill failed: ${error.message}, trying process.kill`);
          try {
            this.server.process?.kill('SIGKILL');
          } catch (e) {
            // Ignore
          }
        } else {
          this.appendLog('[TRAY] Server process tree terminated successfully');
        }

        // Wait a tiny bit to ensure it's gone
        setTimeout(() => {
          this.server.running = false;
          this.server.process = null;
          console.log('Server stopped');

          // Re-enable start button
          this.updateMenu();
          resolve();
        }, 500);
      });
    });
  }

  private async restartServer(): Promise<void> {
    console.log('Restarting server...');
    this.appendLog('[TRAY] Restarting server...');
    await this.stopServer();
    // Wait a bit before starting again
    setTimeout(() => this.startServer(), 1000);
  }

  private appendLog(line: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${line}`;

    // Add to circular buffer
    this.server.logBuffer.push(logLine);
    if (this.server.logBuffer.length > this.MAX_BUFFER_LINES) {
      this.server.logBuffer.shift();
    }

    // Append to log file
    try {
      fs.appendFileSync(this.server.logFile, logLine + '\n');
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  private viewLogs(): void {
    console.log('Opening logs...');

    // Ensure log file exists
    if (!fs.existsSync(this.server.logFile)) {
      fs.writeFileSync(this.server.logFile, '');
    }

    // Open in Notepad
    spawn('notepad.exe', [this.server.logFile], { detached: true, stdio: 'ignore' }).unref();
  }

  private clearLogs(): void {
    console.log('Clearing logs...');
    this.server.logBuffer = [];

    try {
      fs.writeFileSync(this.server.logFile, '');
      this.appendLog('[TRAY] Logs cleared');
    } catch (err) {
      console.error('Failed to clear log file:', err);
    }
  }

  private openURL(url: string): void {
    console.log(`Opening ${url}...`);
    spawn('cmd', ['/c', 'start', url], { detached: true, stdio: 'ignore', shell: true }).unref();
  }

  private async exit(): Promise<void> {
    console.log('Exiting...');
    this.appendLog('[TRAY] Exiting tray application...');

    // Stop server if running
    if (this.server.running) {
      await this.stopServer();
    }

    // Kill tray
    if (this.tray) {
      this.tray.kill();
    }

    process.exit(0);
  }

  private updateMenu(): void {
    if (!this.tray) return;

    // Menu item indices (0-based):
    // 0: Status
    // 1: ---
    // 2: Start Server
    // 3: Stop Server
    // 4: Restart Server
    // 5-11: Other items...

    // Update status text (item 0)
    this.tray.sendAction({
      type: 'update-item',
      item: {
        title: this.server.running ? '● Server Running' : '○ Server Stopped',
        tooltip: 'Server status',
        checked: false,
        enabled: false,
      },
      seq_id: 0,
    });

    // Update Start Server (item 2)
    this.tray.sendAction({
      type: 'update-item',
      item: {
        title: 'Start Server',
        tooltip: 'Start the Dungeons & Denis server',
        checked: false,
        enabled: !this.server.running,
      },
      seq_id: 2,
    });

    // Update Stop Server (item 3)
    this.tray.sendAction({
      type: 'update-item',
      item: {
        title: 'Stop Server',
        tooltip: 'Stop the server gracefully',
        checked: false,
        enabled: this.server.running,
      },
      seq_id: 3,
    });

    // Update Restart Server (item 4)
    this.tray.sendAction({
      type: 'update-item',
      item: {
        title: 'Restart Server',
        tooltip: 'Restart the server',
        checked: false,
        enabled: this.server.running,
      },
      seq_id: 4,
    });

    // Update tooltip
    this.tray.sendAction({
      type: 'update-menu',
      menu: {
        tooltip: this.server.running ? 'Server Running' : 'Server Stopped',
      },
    });
  }
}

// Start the tray application
const app = new DungeonsTray();

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Log to file if possible, but we might lose context of the app instance
  // So we just try to keep running or at least log to stderr which we might capture
  try {
    const fs = require('fs');
    const path = require('path');
    const logDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..', 'logs');
    const logFile = path.join(logDir, 'crash.log');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${err.stack}\n`);
  } catch (e) {
    // Ignore logging error
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  try {
    const fs = require('fs');
    const path = require('path');
    const logDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..', 'logs');
    const logFile = path.join(logDir, 'crash.log');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason}\n`);
  } catch (e) {
    // Ignore
  }
});
