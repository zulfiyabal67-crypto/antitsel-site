const API = "https://api.telegram.org";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("Antitsel Telegram bot worker is ready.", { status: 200 });
    }

    if (url.pathname === "/setup" && request.method === "POST") {
      if (!env.SETUP_KEY || request.headers.get("x-setup-key") !== env.SETUP_KEY) {
        return new Response("Unauthorized", { status: 401 });
      }
      if (!env.TELEGRAM_BOT_TOKEN || !env.WORKER_URL || !env.WEBHOOK_SECRET) {
        return new Response("Missing TELEGRAM_BOT_TOKEN, WORKER_URL, or WEBHOOK_SECRET secret.", { status: 400 });
      }
      const result = await telegram(env, "setWebhook", {
        url: env.WORKER_URL.replace(/\/$/, "") + "/webhook",
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message", "callback_query"]
      });
      return Response.json(result);
    }

    if (url.pathname !== "/webhook" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.WEBHOOK_SECRET) {
      return new Response("Bot is not configured.", { status: 503 });
    }
    if (request.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    try {
      if (update.callback_query) {
        await handleCallback(update.callback_query, env);
      } else if (update.message) {
        await handleMessage(update.message, env);
      }
    } catch (error) {
      console.error("Telegram update handling failed:", error?.message || error);
    }
    return new Response("ok");
  }
};

async function handleMessage(message, env) {
  if (!message.chat?.id || !message.text) return;
  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text === "/start" || text === "/help") {
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text: "Здравствуйте! Мы поможем вам узнать об услугах и оставить заявку на консультацию. Выберите, что вас интересует:",
      reply_markup: mainKeyboard()
    });
    return;
  }

  if (text === "/cancel") {
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text: "Хорошо, начнём заново. Чем мы можем помочь?",
      reply_markup: mainKeyboard()
    });
    return;
  }

  if (env.ADMIN_CHAT_ID) {
    const username = message.from?.username ? "@" + message.from.username : "не указан";
    const name = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || "не указано";
    await telegram(env, "sendMessage", {
      chat_id: env.ADMIN_CHAT_ID,
      text: "Новое обращение из бота «Антицель»\\nИмя в Telegram: " + name +
        "\\nUsername: " + username +
        "\\nTelegram ID: " + message.from?.id +
        "\\n\\nСообщение клиента:\\n" + text
    });
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text: "Спасибо за обращение! Мы получили ваше сообщение и свяжемся с вами, если вы оставили контакт для связи.",
      reply_markup: mainKeyboard()
    });
    return;
  }

  await telegram(env, "sendMessage", {
    chat_id: chatId,
    text: "Бот пока настраивается, поэтому мы ещё не можем принять заявку. Пожалуйста, попробуйте немного позже.",
    reply_markup: mainKeyboard()
  });
}

async function handleCallback(query, env) {
  const chatId = query.message?.chat?.id;
  if (!chatId) return;
  await telegram(env, "answerCallbackQuery", { callback_query_id: query.id });

  if (query.data === "book") {
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text: "Чтобы оставить заявку, отправьте одним сообщением:\n1. Как к вам обращаться\n2. Какая услуга интересует: диагностическая сессия, коуч-сессия или пакет из 4 сессий\n3. Удобные дни и время, а также ваш часовой пояс\n4. Как с вами связаться, например ваш @username.\n\nПожалуйста, не указывайте конфиденциальные сведения о здоровье и другие лишние личные данные. Мы ответим вам, чтобы согласовать дальнейшие шаги."
    });
    return;
  }

  if (query.data === "services") {
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text: "Услуги и стоимость:\n• Диагностическая сессия — 50 €\n• Коуч-сессия — 100 €\n• Пакет из 4 сессий — 350 €\n\nСтоимость указана в евро. Оплата возможна в национальных валютах по актуальному курсу на день оплаты.\n\nЧтобы оставить заявку, нажмите «Записаться».",
      reply_markup: mainKeyboard()
    });
    return;
  }

  if (query.data === "contact") {
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text: "Напишите здесь ваш вопрос. Мы получим сообщение и ответим вам. Также можно обратиться через Telegram-канал Школы Антицели: https://t.me/antigoalschool",
      reply_markup: mainKeyboard()
    });
  }
}

function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Записаться", callback_data: "book" }],
      [{ text: "Услуги и стоимость", callback_data: "services" }],
      [{ text: "Задать вопрос", callback_data: "contact" }]
    ]
  };
}

async function telegram(env, method, payload) {
  const response = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    console.error("Telegram API error:", method, data.description || response.status);
    throw new Error(data.description || `Telegram API returned ${response.status}`);
  }
  return data;
}
