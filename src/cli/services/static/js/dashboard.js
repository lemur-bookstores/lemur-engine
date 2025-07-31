// Dashboard JavaScript
class Dashboard {
  constructor() {
    this.chart = null;
    this.updateInterval = 2000; // 2 segundos por defecto
    this.maxDataPoints = 50;
    this.chartData = {
      labels: [],
      datasets: [
        {
          label: "CPU %",
          data: [],
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.1)",
          tension: 0.4,
        },
        {
          label: "Memoria %",
          data: [],
          borderColor: "rgb(255, 99, 132)",
          backgroundColor: "rgba(255, 99, 132, 0.1)",
          tension: 0.4,
        },
        {
          label: "Disco %",
          data: [],
          borderColor: "rgb(255, 205, 86)",
          backgroundColor: "rgba(255, 205, 86, 0.1)",
          tension: 0.4,
        },
      ],
    };

    this.init();
  }

  init() {
    this.initChart();
    this.startUpdating();
    this.setupEventListeners();
  }

  initChart() {
    const ctx = document.getElementById("mainChart");
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: "line",
      data: this.chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function (value) {
                return value + "%";
              },
            },
          },
          x: {
            display: true,
            ticks: {
              maxTicksLimit: 10,
            },
          },
        },
        plugins: {
          legend: {
            position: "top",
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: function (context) {
                return (
                  context.dataset.label +
                  ": " +
                  context.parsed.y.toFixed(1) +
                  "%"
                );
              },
            },
          },
        },
        interaction: {
          mode: "nearest",
          axis: "x",
          intersect: false,
        },
      },
    });
  }

  async fetchMetrics() {
    try {
      const response = await fetch("/metrics");
      if (!response.ok) throw new Error("Failed to fetch metrics");
      return await response.json();
    } catch (error) {
      console.error("Error fetching metrics:", error);
      this.showError("Error al obtener métricas del servidor");
      return null;
    }
  }

  updateMetricCard(metricId, value, unit = "%") {
    const card = document.querySelector(`[data-metric="${metricId}"]`);
    if (!card) return;

    const valueElement = card.querySelector(".metric-value");
    const statusElement = card.querySelector(".status-indicator");

    if (valueElement) {
      valueElement.textContent =
        typeof value === "number" ? value.toFixed(1) : value;
    }

    if (statusElement) {
      statusElement.className =
        "status-indicator " + this.getStatusClass(value);
    }
  }

  getStatusClass(value) {
    if (typeof value !== "number") return "status-good";

    if (value < 60) return "status-good";
    if (value < 80) return "status-warning";
    return "status-critical";
  }

  updateChart(metrics) {
    if (!this.chart || !metrics) return;

    const now = new Date();
    const timeLabel = now.toLocaleTimeString();

    // Agregar nueva etiqueta de tiempo
    this.chartData.labels.push(timeLabel);

    // Agregar nuevos datos
    this.chartData.datasets[0].data.push(metrics.cpu.usage);
    this.chartData.datasets[1].data.push(metrics.memory.usage);
    this.chartData.datasets[2].data.push(metrics.disk.usage);

    // Mantener solo los últimos maxDataPoints
    if (this.chartData.labels.length > this.maxDataPoints) {
      this.chartData.labels.shift();
      this.chartData.datasets.forEach((dataset) => dataset.data.shift());
    }

    this.chart.update("none"); // Actualización sin animación para mejor rendimiento
  }

  async updateDashboard() {
    const metrics = await this.fetchMetrics();
    if (!metrics) return;

    // Actualizar tarjetas de métricas
    this.updateMetricCard("cpu", metrics.cpu.usage);
    this.updateMetricCard("memory", metrics.memory.usage);
    this.updateMetricCard("disk", metrics.disk.usage);

    // Actualizar métrica de red (convertir bytes a MB)
    const networkSpeed =
      (metrics.network.bytesIn + metrics.network.bytesOut) / (1024 * 1024);
    this.updateMetricCard("network", networkSpeed, "MB/s");

    // Actualizar gráfico
    this.updateChart(metrics);

    // Actualizar timestamp
    this.updateTimestamp();
  }

  updateTimestamp() {
    const timestampElement = document.getElementById("lastUpdate");
    if (timestampElement) {
      timestampElement.textContent = new Date().toLocaleString();
    }
  }

  startUpdating() {
    // Actualización inicial
    this.updateDashboard();

    // Configurar actualización periódica
    setInterval(() => {
      this.updateDashboard();
    }, this.updateInterval);
  }

  setupEventListeners() {
    // Manejar cambio de tamaño de ventana
    window.addEventListener("resize", () => {
      if (this.chart) {
        this.chart.resize();
      }
    });

    // Manejar visibilidad de página para optimizar rendimiento
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Pausar actualizaciones cuando la página no es visible
        console.log("Dashboard paused");
      } else {
        // Reanudar actualizaciones
        console.log("Dashboard resumed");
        this.updateDashboard();
      }
    });
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.textContent = message;

    const container = document.querySelector(".container");
    if (container) {
      container.insertBefore(errorDiv, container.firstChild);

      // Remover error después de 5 segundos
      setTimeout(() => {
        errorDiv.remove();
      }, 5000);
    }
  }
}

// Inicializar dashboard cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  new Dashboard();
});
