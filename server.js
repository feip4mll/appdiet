const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 8080);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "google/gemma-2-9b-it:free";
const EXTERNAL_AUTH_BASE_URL = "https://dummyjson.com";
const PROJECT_ROOT = __dirname;
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const DATABASE_PATH = path.join(DATA_DIR, "prime-diet.db");

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DATABASE_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    meal_type TEXT NOT NULL,
    photo_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const sessions = new Map();
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: "Requisicao invalida." });
    return;
  }

  setCorsHeaders(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, `http://localhost:${PORT}`);
  const pathname = requestUrl.pathname;

  if (pathname.startsWith("/api/")) {
    await handleApi(request, response, requestUrl);
    return;
  }

  serveStaticFile(response, pathname);
});

server.listen(PORT, () => {
  console.log(`Prime Diet rodando em http://localhost:${PORT}`);
});

async function handleApi(request, response, requestUrl) {
  try {
    const pathname = requestUrl.pathname;
    const mealPathMatch = pathname.match(/^\/api\/meals\/([^/]+)\/?$/);
    const mealIdFromPath = mealPathMatch ? Number(mealPathMatch[1]) : 0;
    const hasMealIdPath = Number.isInteger(mealIdFromPath) && mealIdFromPath > 0;

    if (request.method === "POST" && pathname === "/api/auth/register") {
      const body = await readJsonBody(request);
      const name = cleanText(body.name);
      const email = cleanText(body.email).toLowerCase();
      const password = String(body.password || "");

      if (!name || !email || password.length < 4) {
        sendJson(response, 400, { error: "Dados invalidos para cadastro." });
        return;
      }

      const passwordHash = hashPassword(password);
      const query = db.prepare(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      );

      try {
        query.run(name, email, passwordHash);
      } catch {
        sendJson(response, 409, { error: "Email ja cadastrado." });
        return;
      }

      sendJson(response, 201, { ok: true });
      return;
    }

    if (request.method === "POST" && pathname === "/api/auth/login") {
      const body = await readJsonBody(request);
      const email = cleanText(body.email).toLowerCase();
      const password = String(body.password || "");

      let user = db
        .prepare("SELECT id, name, email, password_hash FROM users WHERE email = ?")
        .get(email);

      if (!user || user.password_hash !== hashPassword(password)) {
        const externalAuthUser = await verifyExternalLoginWithDummyJson({
          email,
          password,
        });

        if (!externalAuthUser) {
          sendJson(response, 401, { error: "Credenciais invalidas." });
          return;
        }

        const externalName = cleanText(
          `${externalAuthUser.firstName || ""} ${externalAuthUser.lastName || ""}`,
        );
        const resolvedName = externalName || cleanText(externalAuthUser.username) || "Usuario";
        const passwordHash = hashPassword(password);

        if (!user) {
          db.prepare(
            `
              INSERT INTO users (name, email, password_hash)
              VALUES (?, ?, ?)
            `,
          ).run(resolvedName, email, passwordHash);
        } else {
          db.prepare("UPDATE users SET name = ?, password_hash = ? WHERE id = ?").run(
            resolvedName,
            passwordHash,
            user.id,
          );
        }

        user = db
          .prepare("SELECT id, name, email, password_hash FROM users WHERE email = ?")
          .get(email);
      }

      const token = crypto.randomUUID();
      sessions.set(token, { userId: user.id, createdAt: Date.now() });

      sendJson(response, 200, {
        token,
        user: { id: user.id, name: user.name, email: user.email },
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/meals/today") {
      const userId = getUserIdFromAuth(request);
      if (!userId) {
        sendJson(response, 401, { error: "Sessao invalida." });
        return;
      }

      const today = getTodayLocalDateString();
      const meals = db
        .prepare(
          `
            SELECT id, name, calories, meal_type, photo_url, created_at
            FROM meals
            WHERE user_id = ? AND date(created_at) = ?
            ORDER BY created_at DESC
          `,
        )
        .all(userId, today);

      sendJson(response, 200, { meals });
      return;
    }

    if (request.method === "GET" && pathname === "/api/meals/by-date") {
      const userId = getUserIdFromAuth(request);
      if (!userId) {
        sendJson(response, 401, { error: "Sessao invalida." });
        return;
      }

      const selectedDate = String(requestUrl.searchParams.get("date") || "").trim();
      if (!isValidIsoDate(selectedDate)) {
        sendJson(response, 400, { error: "Data invalida. Use formato YYYY-MM-DD." });
        return;
      }

      const today = getTodayLocalDateString();
      if (selectedDate > today) {
        sendJson(response, 400, { error: "Nao e permitido consultar dias futuros." });
        return;
      }

      const meals = db
        .prepare(
          `
            SELECT id, name, calories, meal_type, photo_url, created_at
            FROM meals
            WHERE user_id = ? AND date(created_at) = ?
            ORDER BY created_at DESC
          `,
        )
        .all(userId, selectedDate);

      sendJson(response, 200, { meals, date: selectedDate });
      return;
    }

    if (request.method === "POST" && pathname === "/api/meals") {
      const userId = getUserIdFromAuth(request);
      if (!userId) {
        sendJson(response, 401, { error: "Sessao invalida." });
        return;
      }

      const body = await readJsonBody(request);
      const name = cleanText(body.name);
      const calories = Number(body.calories);
      const mealType = cleanText(body.mealType);
      const photoDataUrl = String(
        body.photoDataUrl ||
          body.photoUrl ||
          body.photo_url ||
          body.photodataurl ||
          "",
      ).trim();
      const normalizedPhoto = photoDataUrl || null;

      if (!name || !Number.isInteger(calories) || calories <= 0 || !mealType) {
        sendJson(response, 400, { error: "Dados invalidos para refeicao." });
        return;
      }

      db.prepare(
        `
          INSERT INTO meals (user_id, name, calories, meal_type, photo_url)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run(userId, name, calories, mealType, normalizedPhoto);

      sendJson(response, 201, { ok: true });
      return;
    }

    if (request.method === "PUT" && hasMealIdPath) {
      const userId = getUserIdFromAuth(request);
      if (!userId) {
        sendJson(response, 401, { error: "Sessao invalida." });
        return;
      }

      const mealId = mealIdFromPath;
      const body = await readJsonBody(request);
      const name = cleanText(body.name);
      const calories = Number(body.calories);
      const mealType = cleanText(body.mealType);
      const photoDataUrl = String(
        body.photoDataUrl ||
          body.photoUrl ||
          body.photo_url ||
          body.photodataurl ||
          "",
      ).trim();
      const normalizedPhoto = photoDataUrl || null;

      if (!name || !Number.isInteger(calories) || calories <= 0 || !mealType) {
        sendJson(response, 400, { error: "Dados invalidos para refeicao." });
        return;
      }

      const updateResult = db.prepare(
        `
          UPDATE meals
          SET name = ?, calories = ?, meal_type = ?, photo_url = ?
          WHERE id = ? AND user_id = ?
        `,
      ).run(name, calories, mealType, normalizedPhoto, mealId, userId);

      if (!updateResult.changes) {
        sendJson(response, 404, { error: "Refeicao nao encontrada." });
        return;
      }

      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "DELETE" && hasMealIdPath) {
      const userId = getUserIdFromAuth(request);
      if (!userId) {
        sendJson(response, 401, { error: "Sessao invalida." });
        return;
      }

      const mealId = mealIdFromPath;
      const deleteResult = db
        .prepare("DELETE FROM meals WHERE id = ? AND user_id = ?")
        .run(mealId, userId);

      if (!deleteResult.changes) {
        sendJson(response, 404, { error: "Refeicao nao encontrada." });
        return;
      }

      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && pathname === "/api/ai/checkpoint") {
      sendJson(response, 200, {
        status: "ready",
        message: "Estrutura pronta para integrar IA de recomendacao de refeicoes.",
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/ai/meal-feedback") {
      const userId = getUserIdFromAuth(request);
      const body = await readJsonBody(request);
      const waterLiters = Number(body.waterLiters || (Number(body.waterMl || 0) / 1000) || 0);
      const userMessage = cleanText(body.userMessage);
      const currentFeedback = cleanText(body.currentFeedback);
      let meals = [];

      if (userId) {
        const today = getTodayLocalDateString();
        meals = db
          .prepare(
            `
              SELECT name, calories, meal_type
              FROM meals
              WHERE user_id = ? AND date(created_at) = ?
              ORDER BY created_at ASC
            `,
          )
          .all(userId, today);
      } else if (Array.isArray(body.meals)) {
        meals = body.meals
          .map((meal) => ({
            name: cleanText(meal && meal.name),
            calories: Number(meal && meal.calories),
            meal_type: cleanText((meal && (meal.meal_type || meal.mealType || meal.type)) || ""),
          }))
          .filter(
            (meal) => meal.name && Number.isFinite(meal.calories) && meal.calories > 0 && meal.meal_type,
          );
      }

      if (!meals.length) {
        sendJson(response, 400, {
          error: "Cadastre pelo menos uma refeicao para gerar feedback.",
        });
        return;
      }

      try {
        const feedback = await getMealFeedbackFromOllama({
          meals,
          waterLiters,
          userMessage,
          currentFeedback,
        });
        sendJson(response, 200, { feedback, source: "ollama" });
      } catch {
        if (!OPENROUTER_API_KEY) {
          const feedback = getLocalMealFeedback({ meals, waterLiters });
          sendJson(response, 200, { feedback, source: "local" });
          return;
        }
        try {
          const feedback = await getMealFeedbackFromOpenRouter({
            meals,
            waterLiters,
            userMessage,
            currentFeedback,
          });
          sendJson(response, 200, { feedback, source: "openrouter" });
        } catch (error) {
          const message =
            error && typeof error.message === "string"
              ? error.message
              : "Falha ao gerar feedback com OpenRouter.";
          sendJson(response, 502, { error: message, source: "openrouter" });
        }
      }
      return;
    }

    sendJson(response, 404, { error: "Rota nao encontrada." });
  } catch {
    sendJson(response, 500, { error: "Erro interno no servidor." });
  }
}

function getUserIdFromAuth(request) {
  const authHeader = request.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return 0;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const session = sessions.get(token);
  return session ? session.userId : 0;
}

function hashPassword(password) {
  return crypto.scryptSync(password, "prime-diet-salt", 32).toString("hex");
}

function cleanText(value) {
  return String(value || "").trim();
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) return;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += String(chunk);
      if (raw.length > 8000000) {
        reject(new Error("Body grande demais."));
      }
    });
    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
    request.on("error", reject);
  });
}

function serveStaticFile(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(PROJECT_ROOT, decodeURIComponent(safePath));
  const normalizedPath = path.normalize(filePath);

  if (!normalizedPath.startsWith(PROJECT_ROOT)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Acesso negado.");
    return;
  }

  if (!fs.existsSync(normalizedPath) || !fs.statSync(normalizedPath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Arquivo nao encontrado.");
    return;
  }

  const extension = path.extname(normalizedPath).toLowerCase();
  const contentType = contentTypes[extension] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(normalizedPath).pipe(response);
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  setCorsHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getTodayLocalDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

async function getMealFeedbackFromOllama({
  meals,
  waterLiters,
  userMessage = "",
  currentFeedback = "",
}) {
  const mealLines = meals
    .map((meal, index) => {
      return `${index + 1}. ${meal.meal_type}: ${meal.name} (${meal.calories} kcal)`;
    })
    .join("\n");

  const promptParts = [
    "Voce e um assistente de dieta.",
    "Gere APENAS um feedback escrito sobre as refeicoes do dia e o que melhorar na dieta.",
    "Responda em portugues do Brasil, curto e objetivo.",
    "Formato obrigatorio:",
    "1) O que esta bom nas refeicoes",
    "2) O que melhorar nas refeicoes da dieta",
    "3) Sugestao pratica para a proxima refeicao",
    "Sem introducao longa, sem diagnostico medico, sem assuntos fora da dieta.",
    "",
    "Dados do usuario hoje:",
    `- Agua: ${waterLiters > 0 ? `${waterLiters}L` : "nao informado"}`,
    "- Refeicoes:",
    mealLines,
  ];
  if (currentFeedback) {
    promptParts.push("", "Feedback anterior da IA:", currentFeedback);
  }
  if (userMessage) {
    promptParts.push(
      "",
      `Usuario respondeu: ${userMessage}`,
      "Agora refine o feedback considerando essa resposta do usuario.",
    );
  }
  const prompt = promptParts.join("\n");

  const apiResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.4,
      },
    }),
  });

  if (!apiResponse.ok) {
    throw new Error(`Falha ao chamar Ollama (${apiResponse.status}).`);
  }

  const data = await apiResponse.json();
  const output = data && typeof data.response === "string" ? data.response.trim() : "";
  if (!output) {
    throw new Error("Resposta vazia da IA local.");
  }
  return output;
}

async function getMealFeedbackFromOpenRouter({
  meals,
  waterLiters,
  userMessage = "",
  currentFeedback = "",
}) {
  const mealLines = meals
    .map((meal, index) => {
      return `${index + 1}. ${meal.meal_type}: ${meal.name} (${meal.calories} kcal)`;
    })
    .join("\n");

  const promptParts = [
    "Voce e um assistente de dieta.",
    "Gere APENAS um feedback escrito sobre as refeicoes do dia e o que melhorar na dieta.",
    "Responda em portugues do Brasil, curto e objetivo.",
    "Formato obrigatorio:",
    "1) O que esta bom nas refeicoes",
    "2) O que melhorar nas refeicoes da dieta",
    "3) Sugestao pratica para a proxima refeicao",
    "Sem introducao longa, sem diagnostico medico, sem assuntos fora da dieta.",
    "",
    "Dados do usuario hoje:",
    `- Agua: ${waterLiters > 0 ? `${waterLiters}L` : "nao informado"}`,
    "- Refeicoes:",
    mealLines,
  ];
  if (currentFeedback) {
    promptParts.push("", "Feedback anterior da IA:", currentFeedback);
  }
  if (userMessage) {
    promptParts.push(
      "",
      `Usuario respondeu: ${userMessage}`,
      "Agora refine o feedback considerando essa resposta do usuario.",
    );
  }
  const prompt = promptParts.join("\n");

  const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 220,
    }),
  });

  if (!apiResponse.ok) {
    let details = "";
    try {
      const errorBody = await apiResponse.json();
      details =
        errorBody && errorBody.error && errorBody.error.message
          ? String(errorBody.error.message)
          : "";
    } catch {}
    const suffix = details ? ` ${details}` : "";
    throw new Error(`Falha ao chamar OpenRouter (${apiResponse.status}).${suffix}`);
  }

  const data = await apiResponse.json();
  const output = readOpenRouterText(data);
  if (!output) {
    throw new Error("Resposta vazia da IA.");
  }

  return output.trim();
}

function readOpenRouterText(data) {
  if (!data || !Array.isArray(data.choices)) {
    return "";
  }

  for (const choice of data.choices) {
    const text =
      choice &&
      choice.message &&
      typeof choice.message.content === "string"
        ? choice.message.content.trim()
        : "";
    if (text) return text;
  }

  return "";
}

function getLocalMealFeedback({ meals, waterLiters }) {
  const totalCalories = meals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
  const mealTypes = new Set(meals.map((meal) => String(meal.meal_type || "")));
  const hasBreakfast = mealTypes.has("Cafe da manha");
  const hasLunch = mealTypes.has("Almoco");
  const hasDinner = mealTypes.has("Jantar");
  const hasMainMeals = hasBreakfast && hasLunch && hasDinner;
  const mealCount = meals.length;
  const dateKey = new Date().toISOString().slice(0, 10);
  const seedBase = `${dateKey}|${mealCount}|${totalCalories}|${waterLiters}|${Array.from(
    mealTypes,
  )
    .sort()
    .join(",")}`;
  const styleVariant = pickVariant(seedBase, ["direto", "coach", "acolhedor"]);

  let positiveIntro = "";
  if (totalCalories >= 1300 && totalCalories <= 2200 && hasMainMeals) {
    positiveIntro =
      styleVariant === "coach"
        ? "Muito bom: seu dia esta bem estruturado em calorias e distribuicao."
        : styleVariant === "acolhedor"
          ? "Seu dia ficou bem organizado, com um padrao alimentar consistente."
          : "Consumo calorico e distribuicao das refeicoes ficaram equilibrados.";
  } else if (totalCalories < 1300) {
    positiveIntro =
      styleVariant === "coach"
        ? "Ponto positivo: houve controle de ingestao calorica ao longo do dia."
        : styleVariant === "acolhedor"
          ? "Voce manteve um dia mais leve em calorias, e isso mostra controle."
          : "O consumo calorico ficou controlado hoje.";
  } else {
    positiveIntro =
      styleVariant === "coach"
        ? "Voce fez o principal: registrou o dia e ganhou visibilidade para ajustar."
        : styleVariant === "acolhedor"
          ? "Registrar as refeicoes ja e um grande acerto para melhorar com clareza."
          : "O registro de refeicoes foi consistente e facilita os proximos ajustes.";
  }

  let positiveSecondary = "";
  if (mealCount >= 3) {
    positiveSecondary =
      styleVariant === "coach"
        ? "Boa frequencia de refeicoes no dia, o que ajuda estabilidade de energia."
        : styleVariant === "acolhedor"
          ? "A frequencia de refeicoes ficou boa e ajuda a manter ritmo no dia."
          : "A frequencia das refeicoes favorece constancia energetica.";
  } else {
    positiveSecondary =
      styleVariant === "coach"
        ? "Mesmo com poucas refeicoes, voce manteve o habito de registro."
        : styleVariant === "acolhedor"
          ? "Mesmo com menos refeicoes, voce manteve o registro ativo."
          : "O habito de registrar o dia segue como um ponto forte.";
  }

  const improveParts = [];
  if (totalCalories > 2200) {
    improveParts.push(
      styleVariant === "coach"
        ? "Total calorico acima da referencia (2000 kcal). Ajuste porcoes e densidade calorica nas proximas escolhas."
        : styleVariant === "acolhedor"
          ? "As calorias passaram da referencia (2000 kcal); uma leve reducao de porcoes ja melhora o equilibrio."
          : "Total calorico acima da referencia (2000 kcal); reduza porcoes e itens mais densos.",
    );
  } else if (totalCalories < 1200) {
    improveParts.push(
      styleVariant === "coach"
        ? "Total calorico muito baixo, com risco de queda de energia e desempenho."
        : styleVariant === "acolhedor"
          ? "As calorias ficaram muito baixas e isso pode afetar energia durante o dia."
          : "Total calorico muito baixo, o que pode reduzir energia e constancia.",
    );
  }

  if (!hasMainMeals) {
    improveParts.push(
      styleVariant === "coach"
        ? "Ainda faltam refeicoes principais no registro; sem isso, a leitura do dia fica incompleta."
        : styleVariant === "acolhedor"
          ? "Faltam refeicoes principais no registro de hoje, e completar isso melhora a orientacao."
          : "Faltam refeicoes principais no registro do dia; complete para melhorar o acompanhamento.",
    );
  }

  if (!Number.isFinite(waterLiters) || waterLiters < 1.5) {
    improveParts.push(
      styleVariant === "coach"
        ? "Hidratacao abaixo do ideal para sustentar performance e recuperacao."
        : styleVariant === "acolhedor"
          ? "A hidratacao ainda esta baixa para o ritmo do dia."
          : "Hidratacao abaixo do ideal para um dia ativo.",
    );
  } else if (waterLiters > 4.5) {
    improveParts.push(
      styleVariant === "coach"
        ? "Hidratacao muito alta; mantenha distribuicao ao longo do dia e ajuste ao seu contexto."
        : styleVariant === "acolhedor"
          ? "A hidratacao ficou bem alta; tente distribuir melhor ao longo do dia."
          : "Hidratacao muito acima do comum; distribua ao longo do dia e ajuste ao seu contexto.",
    );
  }

  const improveText =
    improveParts.length > 0
      ? improveParts.join(" ")
      : styleVariant === "coach"
        ? "Sem pontos criticos hoje. O foco agora e manter regularidade e qualidade de escolhas."
        : styleVariant === "acolhedor"
          ? "Hoje nao houve alertas importantes; mantenha essa constancia."
          : "Sem pontos criticos no momento; mantenha regularidade e consistencia.";

  let nextStep = "";
  if (!Number.isFinite(waterLiters) || waterLiters < 1.5) {
    nextStep =
      styleVariant === "coach"
        ? "Complete mais 500ml de agua ate o fim do dia e registre a proxima refeicao principal."
        : styleVariant === "acolhedor"
          ? "Como proximo passo, beba mais 2 copos de agua e registre a proxima refeicao."
          : "Adicione 2 copos de agua ate o fim do dia e registre a proxima refeicao principal.";
  } else if (!hasMainMeals) {
    nextStep =
      styleVariant === "coach"
        ? "Priorize completar as refeicoes principais que faltam, com porcoes moderadas."
        : styleVariant === "acolhedor"
          ? "Finalize o dia completando as refeicoes principais que faltam com equilibrio."
          : "Complete as refeicoes principais que faltam e mantenha porcoes moderadas.";
  } else if (totalCalories > 2200) {
    nextStep =
      styleVariant === "coach"
        ? "Na proxima refeicao, priorize proteina magra, vegetais e menor densidade calorica."
        : styleVariant === "acolhedor"
          ? "Para fechar melhor o dia, escolha uma refeicao mais leve com proteina e legumes."
          : "Faca a proxima refeicao com proteina magra, legumes e menor carga calorica.";
  } else if (totalCalories < 1200) {
    nextStep =
      styleVariant === "coach"
        ? "Inclua um lanche estrategico com proteina e carboidrato de qualidade."
        : styleVariant === "acolhedor"
          ? "Inclua ainda hoje um lanche com proteina e carboidrato para sustentar energia."
          : "Inclua um lanche com proteina e carboidrato de boa qualidade.";
  } else {
    nextStep =
      styleVariant === "coach"
        ? "Mantenha o padrao atual e finalize o dia acima de 1.8L de hidratacao."
        : styleVariant === "acolhedor"
          ? "Continue no mesmo ritmo e tente encerrar o dia com hidratacao acima de 1.8L."
          : "Mantenha o mesmo padrao e finalize o dia com hidratacao acima de 1.8L.";
  }

  return [
    "1) Pontos positivos",
    `${positiveIntro} ${positiveSecondary}`.trim(),
    "",
    "2) Pontos para melhorar",
    improveText.trim(),
    "",
    "3) Proximo passo pratico para hoje",
    nextStep.trim(),
  ].join("\n");
}

function pickVariant(seed, variants) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const selectedIndex = variants.length ? hash % variants.length : 0;
  return variants[selectedIndex];
}

async function verifyExternalLoginWithDummyJson({ email, password }) {
  if (!email || !password) {
    return null;
  }

  try {
    const searchResponse = await fetch(
      `${EXTERNAL_AUTH_BASE_URL}/users/search?q=${encodeURIComponent(email)}`,
    );
    if (!searchResponse.ok) {
      return null;
    }

    const searchData = await searchResponse.json();
    const users = Array.isArray(searchData.users) ? searchData.users : [];
    const matchedUser = users.find(
      (userItem) =>
        userItem &&
        typeof userItem.email === "string" &&
        userItem.email.toLowerCase() === email.toLowerCase(),
    );
    if (!matchedUser || !matchedUser.username) {
      return null;
    }

    const loginResponse = await fetch(`${EXTERNAL_AUTH_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: String(matchedUser.username),
        password,
        expiresInMins: 30,
      }),
    });
    if (!loginResponse.ok) {
      return null;
    }

    const loginData = await loginResponse.json();
    if (!loginData || !loginData.accessToken) {
      return null;
    }

    return loginData;
  } catch {
    return null;
  }
}
