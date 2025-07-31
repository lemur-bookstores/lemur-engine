// Metrics Helper Functions
class MetricsHelper {
  static formatBytes(bytes) {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  static formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  }

  static getHealthStatus(value, thresholds = { warning: 70, critical: 90 }) {
    if (value < thresholds.warning) return "good";
    if (value < thresholds.critical) return "warning";
    return "critical";
  }

  static formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  static calculateNetworkSpeed(current, previous, timeDiff) {
    if (!previous || timeDiff <= 0) return 0;

    const bytesIn = current.bytesIn - previous.bytesIn;
    const bytesOut = current.bytesOut - previous.bytesOut;
    const totalBytes = bytesIn + bytesOut;

    // Convertir a bytes por segundo, luego a MB/s
    return ((totalBytes / timeDiff) * 1000) / (1024 * 1024);
  }

  static getColorForValue(value, type = "usage") {
    switch (type) {
      case "usage":
        if (value < 50) return "#4CAF50"; // Verde
        if (value < 75) return "#FF9800"; // Naranja
        return "#F44336"; // Rojo

      case "temperature":
        if (value < 60) return "#4CAF50";
        if (value < 80) return "#FF9800";
        return "#F44336";

      case "network":
        if (value < 10) return "#4CAF50";
        if (value < 50) return "#2196F3";
        return "#9C27B0";

      default:
        return "#2196F3";
    }
  }

  static async exportMetrics(format = "json") {
    try {
      const response = await fetch(`/metrics?format=${format}`);
      if (!response.ok) throw new Error("Failed to fetch metrics");

      const data = await response.text();
      const blob = new Blob([data], {
        type: format === "json" ? "application/json" : "text/plain",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `metrics-${
        new Date().toISOString().split("T")[0]
      }.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting metrics:", error);
      alert("Error al exportar métricas");
    }
  }

  static createMetricCard(metric) {
    return `
      <div class="metric-card" data-metric="${metric.id}">
        <div class="metric-header">
          <h3 class="metric-title">
            <span class="status-indicator status-good"></span>
            ${metric.title}
          </h3>
        </div>
        <div class="metric-value">
          <span class="value">--</span>
          <span class="metric-unit">${metric.unit}</span>
        </div>
        <div class="metric-chart">
          <canvas id="chart-${metric.id}"></canvas>
        </div>
      </div>
    `;
  }

  static validateMetrics(metrics) {
    if (!metrics || typeof metrics !== "object") {
      return false;
    }

    const requiredFields = [
      "timestamp",
      "cpu",
      "memory",
      "disk",
      "network",
      "process",
    ];
    return requiredFields.every((field) => metrics.hasOwnProperty(field));
  }

  static smoothValue(currentValue, previousValue, smoothingFactor = 0.7) {
    if (previousValue === null || previousValue === undefined) {
      return currentValue;
    }

    return (
      smoothingFactor * currentValue + (1 - smoothingFactor) * previousValue
    );
  }
}

// Exportar para uso global
if (typeof window !== "undefined") {
  window.MetricsHelper = MetricsHelper;
}
