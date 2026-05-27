import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import {
  mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, createReadStream
} from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
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

const JOBS = new Map();
const IP_ACTIVE = new Map();

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of JOBS) {
    if (job.createdAt < cutoff) {
      try { if (existsSync(job.buildDir)) rmSync(job.buildDir, { recursive: true, force: true }); } catch {}
      JOBS.delete(id);
    }
  }
}, 20 * 60 * 1000);

function extractPackage(src) {
  const m = src.match(/^\s*package\s+([\w.]+)\s*;/m);
  return m ? m[1] : 'com.meumod';
}

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

function appendLog(jobId, text) {
  const job = JOBS.get(jobId);
  if (!job) return;
  job.log = (job.log + text).slice(-10_000);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, jobs: JOBS.size, uptime: Math.floor(process.uptime()), gemini: !!process.env.GEMINI_API_KEY });
});

// ── ForgeAI: generate mod code with Gemini ────────────────────────────────────
app.post('/gerar-mod', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'ForgeAI não está ativo. Adicione GEMINI_API_KEY nas variáveis do Railway.',
      setup: 'https://aistudio.google.com/apikey',
    });
  }

  const { description, version = '1.20.4', loader = 'fabric' } = req.body;
  if (!description?.trim()) {
    return res.status(400).json({ error: 'Descrição do mod é obrigatória.' });
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const loaderVersions = {
      fabric:   { api: '0.100.8+1.20.4', yarn: '1.20.4+build.3', loom: '1.6-SNAPSHOT' },
      forge:    { api: '49.0.38',         yarn: '',                loom: ''             },
      neoforge: { api: '20.4.237',        yarn: '',                loom: ''             },
      spigot:   { api: '1.20.4-R0.1-SNAPSHOT', yarn: '',          loom: ''             },
      cobblemon:{ api: '1.5.2+1.20.1',    yarn: '1.20.1+build.10',loom: '1.6-SNAPSHOT' },
    };
    const lv = loaderVersions[loader] ?? loaderVersions.fabric;

    const fabricBuildGradle = `plugins {
    id 'fabric-loom' version '${lv.loom}'
    id 'maven-publish'
}
version = '1.0.0'
group = 'com.modforge.mod'
base { archivesName = 'modforge-mod' }
repositories { maven { url 'https://maven.fabricmc.net/' } }
dependencies {
    minecraft 'com.mojang:minecraft:${version}'
    mappings "net.fabricmc:yarn:${lv.yarn}:v2"
    modImplementation "net.fabricmc:fabric-loader:0.15.11"
    modImplementation "net.fabricmc.fabric-api:fabric-api:${lv.api}"
}
java {
    toolchain { languageVersion = JavaLanguageVersion.of(21) }
    withSourcesJar()
}
jar { from('LICENSE') }
`;

    const prompt = `Você é um desenvolvedor especialista de mods de Minecraft.
Crie um mod completo e funcional para Minecraft ${loader} versão ${version}.

Descrição do mod: ${description}

Requisitos técnicos:
- Loader: ${loader}
- Versão Minecraft: ${version}
- Package: com.modforge.mod
- Mod ID: modforge_mod
- Toda a lógica deve ser implementada (sem TODO ou placeholder)
- Use a API correta para a versão ${version}
- Comentários em português

ATENÇÃO: Retorne SOMENTE um JSON válido com os nomes dos arquivos como chaves.
Sem markdown, sem blocos de código, sem explicações — apenas o JSON puro.

Formato esperado:
{
  "MeuMod.java": "<conteúdo completo do arquivo Java principal>",
  "fabric.mod.json": "<metadados do mod>",
  "build.gradle": "<aqui use exatamente este conteúdo: ${fabricBuildGradle.replace(/`/g, '').slice(0,200)}...>",
  "gradle.properties": "org.gradle.jvmargs=-Xmx1G\norg.gradle.parallel=true",
  "settings.gradle": "pluginManagement {\n  repositories {\n    maven { url 'https://maven.fabricmc.net/' }\n    gradlePluginPortal()\n    mavenCentral()\n  }\n}\nrootProject.name = 'modforge-mod'"
}

build.gradle DEVE ter exatamente:
${fabricBuildGradle}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('A IA não gerou JSON válido. Tente uma descrição mais simples.');
    }

    let files;
    try {
      files = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Erro ao interpretar resposta da IA. Tente novamente.');
    }

    if (!files['MeuMod.java'] && !files['ModMain.java'] && !Object.keys(files).some(k => k.endsWith('.java'))) {
      throw new Error('A IA não gerou o arquivo Java principal. Tente uma descrição mais detalhada.');
    }

    res.json({ files, version, loader });
  } catch (err) {
    const msg = err.message ?? 'Erro ao gerar o mod com IA.';
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key')) {
      res.status(503).json({ error: 'Chave Gemini inválida. Verifique GEMINI_API_KEY no Railway.' });
    } else if (msg.includes('RATE_LIMIT') || msg.includes('quota')) {
      res.status(429).json({ error: 'Limite de uso da IA atingido. Aguarde 1 minuto e tente novamente.' });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ── Compile ───────────────────────────────────────────────────────────────────
app.post('/compilar', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  if (IP_ACTIVE.get(ip)) {
    return res.status(429).json({ error: 'Você já tem uma compilação em andamento. Aguarde ela terminar.' });
  }

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

  (async () => {
    try {
      const javaSource = Object.entries(files)
        .find(([n, v]) => n.endsWith('.java') && typeof v === 'string')?.[1] ?? '';
      const packageName = extractPackage(javaSource);
      const packagePath = packageName.replace(/\./g, '/');

      const javaDir      = join(buildDir, `src/main/java/${packagePath}`);
      const resourcesDir = join(buildDir, 'src/main/resources');
      mkdirSync(javaDir,      { recursive: true });
      mkdirSync(resourcesDir, { recursive: true });

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

      if (!files['settings.gradle']) {
        writeFileSync(join(buildDir, 'settings.gradle'), defaultSettings(), 'utf8');
      }

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
          reject(new Error('Tempo limite excedido (10 min). Seu mod pode ser muito grande ou ter dependências incomuns.'));
        }, 10 * 60 * 1000);

        proc.on('close', code => {
          clearTimeout(timeout);
          if (code === 0) resolve();
          else reject(new Error(`Gradle saiu com código ${code}.\n${JOBS.get(jobId)?.log?.slice(-3000)}`));
        });
        proc.on('error', reject);
      });

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
      if (job) { job.status = 'error'; job.error = err.message; }
    } finally {
      IP_ACTIVE.delete(ip);
    }
  })();
});

app.get('/status/:jobId', (req, res) => {
  const job = JOBS.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job não encontrado ou expirado (máx 1h).' });
  res.json({ status: job.status, error: job.error ?? null, log: job.log?.slice(-800) ?? '' });
});

app.get('/baixar/:jobId', (req, res) => {
  const job = JOBS.get(req.params.jobId);
  if (!job || job.status !== 'ready' || !existsSync(job.jarPath)) {
    return res.status(404).json({ error: 'Arquivo não disponível. Ele pode ter expirado (máx 1h).' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${job.jarName}"`);
  res.setHeader('Content-Type', 'application/java-archive');
  createReadStream(job.jarPath).pipe(res);
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ModForge compile server running on port ${PORT}`);
  console.log(`Gemini AI: ${process.env.GEMINI_API_KEY ? 'ENABLED' : 'disabled (add GEMINI_API_KEY)'}`);
});
