import * as path from "path";
import * as fs from "fs/promises";
import { spawn } from "child_process";

export interface TestConfig {
  watch: boolean;
  coverage: boolean;
  updateSnapshots: boolean;
  filter?: string;
  tags?: string[];
  ci: boolean;
  verbose: boolean;
  silent: boolean;
  failFast: boolean;
  timeout: number;
  report: {
    format: string;
    directory: string;
  };
}

export interface TestResults {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

export async function runTests(config: TestConfig): Promise<TestResults> {
  // Validar configuración
  validateConfig(config);

  // Preparar directorio de reportes
  await prepareReportDirectory(config.report.directory);

  // Construir comando de Jest
  const jestArgs = buildJestArguments(config);

  // Ejecutar Jest
  const results = await executeJest(jestArgs, config);

  // Procesar y guardar reportes
  await processReports(results, config);

  return results;
}

function validateConfig(config: TestConfig): void {
  if (config.timeout < 0) {
    throw new Error("El timeout debe ser un número positivo");
  }

  if (config.silent && config.verbose) {
    throw new Error("No se puede usar --silent y --verbose simultáneamente");
  }

  if (!["junit", "json"].includes(config.report.format)) {
    throw new Error('Formato de reporte inválido. Debe ser "junit" o "json"');
  }
}

async function prepareReportDirectory(directory: string): Promise<void> {
  try {
    await fs.access(directory);
  } catch (error: any) {
    await fs.mkdir(directory, { recursive: true });
  }
}

function buildJestArguments(config: TestConfig): string[] {
  const args: string[] = ["--no-cache"];

  if (config.watch) args.push("--watch");
  if (config.coverage) args.push("--coverage");
  if (config.updateSnapshots) args.push("--updateSnapshot");
  if (config.filter) args.push("--testNamePattern", config.filter);
  if (config.tags?.length)
    args.push("--testPathPattern", config.tags.join("|"));
  if (config.ci) args.push("--ci");
  if (config.verbose) args.push("--verbose");
  if (config.silent) args.push("--silent");
  if (config.failFast) args.push("--bail");

  args.push("--testTimeout", config.timeout.toString());

  // Configurar reportes
  if (config.report.format === "junit") {
    args.push(
      "--reporters=jest-junit",
      `--reportersOptions.junit.outputDirectory=${config.report.directory}`,
      "--reportersOptions.junit.outputName=junit.xml",
    );
  } else if (config.report.format === "json") {
    args.push(
      "--json",
      `--outputFile=${path.join(config.report.directory, "test-results.json")}`,
    );
  }

  return args;
}

async function executeJest(
  args: string[],
  config: TestConfig,
): Promise<TestResults> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let output = "";

    const jest = spawn("jest", args, {
      stdio: config.silent ? "pipe" : "inherit",
      shell: true,
    });

    if (config.silent) {
      jest.stdout?.on("data", (data) => {
        output += data.toString();
      });

      jest.stderr?.on("data", (data) => {
        output += data.toString();
      });
    }

    jest.on("error", (error) => {
      reject(new Error(`Error al ejecutar Jest: ${error.message}`));
    });

    jest.on("close", async (_code) => {
      const duration = Date.now() - startTime;

      try {
        const results = await parseTestResults(
          config.report.directory,
          config.report.format,
        );
        results.duration = duration;

        if (config.coverage) {
          results.coverage = await parseCoverageResults();
        }

        resolve(results);
      } catch (error: any) {
        reject(error);
      }
    });
  });
}

async function parseTestResults(
  directory: string,
  format: string,
): Promise<TestResults> {
  try {
    if (format === "json") {
      const resultsPath = path.join(directory, "test-results.json");
      const data = JSON.parse(await fs.readFile(resultsPath, "utf-8"));

      return {
        total: data.numTotalTests,
        passed: data.numPassedTests,
        failed: data.numFailedTests,
        skipped: data.numPendingTests,
        duration: 0, // Se actualiza después
      };
    } else {
      // Para formato junit, parsear XML
      const junitPath = path.join(directory, "junit.xml");
      const content = await fs.readFile(junitPath, "utf-8");

      // Implementar parser XML simple
      const matches = {
        total: content.match(/tests="(\d+)"/)?.[1] || "0",
        failures: content.match(/failures="(\d+)"/)?.[1] || "0",
        skipped: content.match(/skipped="(\d+)"/)?.[1] || "0",
      };

      const total = parseInt(matches.total, 10);
      const failed = parseInt(matches.failures, 10);
      const skipped = parseInt(matches.skipped, 10);

      return {
        total,
        passed: total - failed - skipped,
        failed,
        skipped,
        duration: 0, // Se actualiza después
      };
    }
  } catch (error: any) {
    throw new Error(`Error al parsear resultados: ${error.message}`);
  }
}

async function parseCoverageResults(): Promise<TestResults["coverage"]> {
  try {
    const coveragePath = path.join("coverage", "coverage-final.json");
    const data = JSON.parse(await fs.readFile(coveragePath, "utf-8"));

    let totalLines = 0;
    let coveredLines = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalStatements = 0;
    let coveredStatements = 0;

    Object.values(data).forEach((file: any) => {
      totalStatements += file.s.total;
      coveredStatements += file.s.covered;
      totalBranches += file.b.total;
      coveredBranches += file.b.covered;
      totalFunctions += file.f.total;
      coveredFunctions += file.f.covered;
      totalLines += file.l.total;
      coveredLines += file.l.covered;
    });

    return {
      statements: Math.round((coveredStatements / totalStatements) * 100),
      branches: Math.round((coveredBranches / totalBranches) * 100),
      functions: Math.round((coveredFunctions / totalFunctions) * 100),
      lines: Math.round((coveredLines / totalLines) * 100),
    };
  } catch (error: any) {
    console.warn("No se pudo parsear el reporte de cobertura:", error.message);
    return {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    };
  }
}

async function processReports(
  results: TestResults,
  config: TestConfig,
): Promise<void> {
  // Generar reporte HTML si es necesario
  if (config.coverage) {
    await generateHtmlCoverageReport();
  }

  // Guardar resumen en formato JSON
  const summaryPath = path.join(config.report.directory, "test-summary.json");
  await fs.writeFile(summaryPath, JSON.stringify(results, null, 2));
}

async function generateHtmlCoverageReport(): Promise<void> {
  try {
    // Ejecutar nyc para generar reporte HTML
    await new Promise((resolve, reject) => {
      const nyc = spawn("nyc", ["report", "--reporter=html"], {
        stdio: "inherit",
        shell: true,
      });

      nyc.on("error", reject);
      nyc.on("close", (code) => {
        if (code === 0) resolve(true);
        else reject(new Error(`nyc exited with code ${code}`));
      });
    });
  } catch (error: any) {
    console.warn("No se pudo generar el reporte HTML:", error.message);
  }
}
