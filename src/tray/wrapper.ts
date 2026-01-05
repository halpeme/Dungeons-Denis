import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
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
}

class DungeonsTray {
  private tray: SysTray | null = null;
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
    };

    // Ensure logs directory exists
    if (!fs.existsSync(this.LOG_DIR)) {
      fs.mkdirSync(this.LOG_DIR, { recursive: true });
    }

    this.initializeTray();
  }

  private getCurrentLogFile(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.LOG_DIR, `tray-${date}.log`);
  }

  private initializeTray(): void {
    const iconPath = path.join(__dirname, 'icon.ico');

    const menu = {
      icon: iconPath,
      title: 'Dungeons & Denis',
      tooltip: 'Dungeons & Denis Server',
      items: [
        {
          title: this.server.running ? '● Server Running' : '○ Server Stopped',
          tooltip: 'Server status',
          checked: false,
          enabled: false,
        },
        {
          title: '---',
        },
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
        {
          title: '---',
        },
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
        {
          title: '---',
        },
        {
          title: 'Open GM Controller',
          tooltip: 'Open GM interface in browser',
          checked: false,
          enabled: true,
        },
        {
          title: 'Open Table Display',
          tooltip: 'Open table display in browser',
          checked: false,
          enabled: true,
        },
        {
          title: '---',
        },
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

    this.tray.onClick((action) => {
      this.handleMenuClick(action);
    });

    console.log('🏰 Dungeons & Denis Tray initialized');
    console.log('   Right-click the tray icon to control the server\n');
  }

  private handleMenuClick(action: { item: { title: string } }): void {
    const title = action.item.title;

    switch (title) {
      case 'Start Server':
        this.startServer();
        break;
      case 'Stop Server':
        this.stopServer();
        break;
      case 'Restart Server':
        this.restartServer();
        break;
      case 'View Logs':
        this.viewLogs();
        break;
      case 'Clear Logs':
        this.clearLogs();
        break;
      case 'Open GM Controller':
        this.openURL('http://localhost:3001/gm');
        break;
      case 'Open Table Display':
        this.openURL('http://localhost:3001/table');
        break;
      case 'Exit':
        this.exit();
        break;
    }
  }

  private startServer(): void {
    if (this.server.running) {
      console.log('Server is already running');
      return;
    }

    console.log('Starting server...');
    this.appendLog('[TRAY] Starting server in development mode...');

    // Spawn server in dev mode (tsx watch)
    const serverProcess = spawn('npx', ['tsx', 'watch', 'src/server.ts'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: this.PROJECT_ROOT,
      shell: true,
      windowsHide: true,
    });

    this.server.process = serverProcess;
    this.server.running = true;

    // Capture stdout
    serverProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      lines.forEach((line) => {
        if (line.trim()) {
          this.appendLog(line);
        }
      });
    });

    // Capture stderr
    serverProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      lines.forEach((line) => {
        if (line.trim()) {
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
  }

  private async stopServer(): Promise<void> {
    if (!this.server.running || !this.server.process) {
      console.log('Server is not running');
      return;
    }

    console.log('Stopping server...');
    this.appendLog('[TRAY] Stopping server...');

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill after 5 seconds
        console.log('Server did not stop gracefully, forcing shutdown...');
        this.server.process?.kill('SIGKILL');
        resolve();
      }, 5000);

      this.server.process!.once('exit', () => {
        clearTimeout(timeout);
        console.log('Server stopped');
        resolve();
      });

      // Send SIGTERM for graceful shutdown
      this.server.process!.kill('SIGTERM');
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

    const iconPath = path.join(__dirname, 'icon.ico');

    const menu = {
      icon: iconPath,
      title: 'Dungeons & Denis',
      tooltip: this.server.running ? 'Server Running' : 'Server Stopped',
      items: [
        {
          title: this.server.running ? '● Server Running' : '○ Server Stopped',
          tooltip: 'Server status',
          checked: false,
          enabled: false,
        },
        {
          title: '---',
        },
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
        {
          title: '---',
        },
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
        {
          title: '---',
        },
        {
          title: 'Open GM Controller',
          tooltip: 'Open GM interface in browser',
          checked: false,
          enabled: true,
        },
        {
          title: 'Open Table Display',
          tooltip: 'Open table display in browser',
          checked: false,
          enabled: true,
        },
        {
          title: '---',
        },
        {
          title: 'Exit',
          tooltip: 'Stop server and quit',
          checked: false,
          enabled: true,
        },
      ],
    };

    this.tray.sendAction({
      type: 'update-menu',
      menu,
    });
  }
}

// Start the tray application
new DungeonsTray();
