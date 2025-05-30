import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import dotenv from "dotenv";
import connectDB from "./db";
import { setupAdminCommands } from "./commands/admin";
import { setupPollCommands } from "./commands/poll";
import { setupScheduleCommands } from "./commands/schedule";
import { startPollScheduler } from "./cron/scheduler";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const bot = new Telegraf(BOT_TOKEN);

// Подключение к БД
connectDB();

// Регистрация команд
setupAdminCommands(bot);
setupPollCommands(bot);
setupScheduleCommands(bot);

// Запуск планировщика опросов
startPollScheduler(bot);

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
});

// Запуск бота
bot.launch().then(() => console.log("Bot started!"));

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
