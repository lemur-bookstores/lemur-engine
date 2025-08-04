export class Logger {
  constructor(private context: string) {}

  public debug(message: string, meta?: Record<string, any>): void {
    this.log("debug", message, meta);
  }

  public info(message: string, meta?: Record<string, any>): void {
    this.log("info", message, meta);
  }

  public warn(message: string, meta?: Record<string, any>): void {
    this.log("warn", message, meta);
  }

  public error(message: string, meta?: Record<string, any>): void {
    this.log("error", message, meta);
  }

  private log(
    level: string,
    message: string,
    meta?: Record<string, any>,
  ): void {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(
      `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${metaString}`,
    );
  }
}
