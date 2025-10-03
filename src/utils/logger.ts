export type LogLevel = 'INFO' | 'ERROR' | 'DEBUG' | 'NETWORK';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

type LogListener = (logs: LogEntry[]) => void;

class Logger {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();

  private addLog(level: LogLevel, message: string, data?: any) {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour12: false }),
      level,
      message,
      data,
    };
    this.logs.push(newLog);
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.logs]));
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]); // Immediately provide current logs
    return () => this.listeners.delete(listener);
  }

  info(message: string, data?: any) {
    this.addLog('INFO', message, data);
    console.log(message, data || '');
  }

  error(message: string, data?: any) {
    this.addLog('ERROR', message, data);
    console.error(message, data || '');
  }
  
  debug(message: string, data?: any) {
    this.addLog('DEBUG', message, data);
    console.debug(message, data || '');
  }
  
  network(message: string, data?: any) {
    this.addLog('NETWORK', message, data);
    console.info(`[NETWORK] ${message}`, data || '');
  }

  clear() {
    this.logs = [];
    this.notifyListeners();
    console.log("Logs cleared.");
  }
}

export const logger = new Logger();
