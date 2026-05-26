import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import {
  mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, createReadStream
} from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const app = express();

// Allow requests from GitHub Pages and any localhost for dev
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / server-to-server
    const allowed = [
      /^https?:\/\/localhost/,
      /\.github\.io$/,
      /\.up\.railway\.app$/,
    ];
    cb(null, allowed.some(r => r.test(origin)));
  },
}));

app.use(express.json({ limit: '25mb' }));

const WORK_DIR = '/tmp/builds';
mkdirSync(WORK_DIR, { recursive: true });

// jobId → { status, buildDir, jarPath, jarName, error, log, createdAt }
const JOBS = new Map();

// Simple per-IP rate limit: max 1 active compile per IP
const IP_ACTIVE = new Map();

// Cleanup jobs older than 1 hour every 20 minutes
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of JOBS) {
    if (job.createdAt < cutoff) {
      try { if (existsSync(job.buildDir)) rmSync(job.buildDir, { recursive: true, force: true }); } catch {}
      JOBS.delete(id);
    }
  }
}, 20 * 60 * 1000);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract Java package name from source code */
function extractPackage(src) {
  const m = src.match(/^\s*package\s+([\w.]+)\s*;/m);
  return m ? m[1] : 'com.meumod';
}

/** Build a minimal settings.gradle with Fabric repos if none provided */
function defaultSettings(projectName = 'meumod') {
  return `pluginManagement {
    repositories {
        maven { url 'https://maven.fabricmc.net/' }
        gradlePluginPortal()
        mavenCentral()
    }
}
rootProject.name = '${projectName}'
`;
}

/** Append a line to the job log and cap at 10 KB */
function appendLog(jobId, text) {
  const job = JOBS.get(jobId);
  if (!job) return;
  job.log = (job.log + text).slice(-10_000);
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, jobs: JOBS.size, uptime: Math.floor(process.uptime()) });
});

app.post('/compilar', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  // Rate limit: one active job per IP
  if (IP_ACTIVE.get(ip)) {
    return res.status(429).json({ error: 'Você já tem uma compilação em andamento. Aguarde ela terminar.' });
  }

  // Max 5 concurrent jobs globally
  const active = [...JOBS.values()].filter(j => j.status === 'compiling').length;
  if (active >= 5) {
    return res.status(503).json({ error: 'Servidor ocupado. Tente novamente em alguns minutos.' });
  }

  const { files } = req.body;
  if (!files || typeof files !== 'object') {
    return res.status(400).json({ error: 'Envie os arquivos no campo "files".' });
  }
  if (!files['build.gradle']) {
    return res.status(400).json({ error: 'O arquivo build.gradle é obrigatório.' });
  }

  const jobId = randomUUID();
  const buildDir = join(WORK_DIR, jobId);
  JOBS.set(jobId, { status: 'compiling', buildDir, log: '', createdAt: Date.now() });
  IP_ACTIVE.set(ip, jobId);

  res.json({ jobId, status: 'compiling' });

  // ── Async build ────────────────────────────────────────────────────────────
  (async () => {
    try {
      // Detect package name from any .java file
      const javaSource = Object.entries(files)
        .find(([n, v]) => n.endsWith('.java') && typeof v === 'string')?.[1] ?? '';
      const packageName = extractPackage(javaSource);
      const packagePath = packageName.replace(/\./g, '/');

      const javaDir      = join(buildDir, `src/main/java/${packagePath}`);
      const resourcesDir = join(buildDir, 'src/main/resources');
      mkdirSync(javaDir,      { recursive: true });
      mkdirSync(resourcesDir, { recursive: true });

      // Write each file into the correct location
      for (const [name, content] of Object.entries(files)) {
        if (typeof content !== 'string' || !content.trim()) continue;
        if (name.endsWith('.java')) {
          writeFileSync(join(javaDir, name), content, 'utf8');
        } else if (name === 'fabric.mod.json' || name === 'mods.toml') {
          writeFileSync(join(resourcesDir, name), content, 'utf8');
        } else if (['build.gradle', 'gradle.properties', 'settings.gradle'].includes(name)) {
          writeFileSync(join(buildDir, name), content, 'utf8');
        }
      }

      // Ensure settings.gradle has the Fabric plugin repo
      if (!files['settings.gradle']) {
        writeFileSync(join(buildDir, 'settings.gradle'), defaultSettings(), 'utf8');
      }

      // ── Run Gradle ──────────────────────────────────────────────────────────
      await new Promise((resolve, reject) => {
        const proc = spawn(
          'gradle',
          ['build', '--no-daemon', '-x', 'test', '--warning-mode=none', '--stacktrace'],
          {
            cwd: buildDir,
            env: {
              ...process.env,
              GRADLE_USER_HOME: '/gradle-cache',
              GRADLE_OPTS: '-Dorg.gradle.daemon=false -Dorg.gradle.jvmargs=-Xmx512m -Dfile.encoding=UTF-8',
              JAVA_TOOL_OPTIONS: '-Xmx256m',
            },
          }
        );

        proc.stdout.on('data', d => appendLog(jobId, d.toString()));
        proc.stderr.on('data', d => appendLog(jobId, d.toString()));

        const timeout = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error('Tempo limite de compilação excedido (10 min). Seu mod pode ser muito grande ou ter dependências incomuns.'));
        }, 10 * 60 * 1000);

        proc.on('close', code => {
          clearTimeout(timeout);
          if (code === 0) resolve();
          else reject(new Error(`Gradle saiu com código ${code}.\n${JOBS.get(jobId)?.log?.slice(-3000)}`));
        });
        proc.on('error', reject);
      });

      // ── Find the output .jar ───────────────────────────────────────────────
      const libsDir = join(buildDir, 'build/libs');
      const jars = readdirSync(libsDir).filter(
        f => f.endsWith('.jar') && !f.includes('-sources') && !f.includes('-dev')
      );
      if (!jars.length) throw new Error('Nenhum .jar encontrado em build/libs após compilação.');

      const job = JOBS.get(jobId);
      if (job) {
        job.status  = 'ready';
        job.jarPath = join(libsDir, jars[0]);
        job.jarName = jars[0];
      }
    } catch (err) {
      const job = JOBS.get(jobId);
      if (job) {
        job.status = 'error';
        job.error  = err.message;
      }
    } finally {
      IP_ACTIVE.delete(ip);
    }
  })();
});

app.get('/status/:jobId', (req, res) => {
  const job = JOBS.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado ou expirado (máx 1h).' });
  res.json({
    status: job.status,
    error:  job.error  ?? null,
    log:    job.log?.slice(-800) ?? '',
  });
});

app.get('/baixar/:jobId', (req, res) => {
  const job = JOBS.get(req.params.jobId);
  if (!job || job.status !== 'ready' || !existsSync(job.jarPath)) {
    return res.status(404).json({ error: 'Arquivo não disponível. Ele pode ter expirado.' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${job.jarName}"`);
  res.setHeader('Content-Type', 'application/java-archive');
  createReadStream(job.jarPath).pipe(res);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ModForge compile server running on port ${PORT}`);
  console.log(`Gradle cache: ${process.env.GRADLE_USER_HOME ?? '~/.gradle'}`);
});
