import { MonitorConfig } from "../types";
import { startMonitoring } from "./monitoring";

const config: MonitorConfig = {
  port: 3000,
  host: "localhost",
  updateInterval: 5000,
  dashboard: true,
  logLevel: "info",
  export: {
    format: "json",
    // output: './metrics.json',
  },
  alerts: [
    { metric: "cpu", threshold: 80, operator: ">", action: "log" },
    { metric: "memory", threshold: 90, operator: ">", action: "log" },
  ],
};

(async () => {
  try {
    await startMonitoring(config);
    console.log("Monitoring started...");
  } catch (error: any) {
    console.error("Error starting monitoring:", error);
  }
})();
