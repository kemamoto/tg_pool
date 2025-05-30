import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import dotenv from "dotenv";
import connectDB from "./db";
import { setupAdminCommands } from "./commands/admin";
import { setupPollCommands } from "./commands/poll";
import { setupScheduleCommands } from "./commands/schedule";
import { startPollScheduler } from "./cron/scheduler";
import { Admin } from "./models/Admin"; // Добавляем импорт модели

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const CREATOR_ID = parseInt(process.env.CREATOR_ID!); // Получаем ID из .env
const bot = new Telegraf(BOT_TOKEN);

// Подключение к БД
connectDB();

// Инициализация создателя (добавляем этот блок)
async function initializeCreator() {
    try {
        const creatorExists = await Admin.exists({ userId: CREATOR_ID });
        if (!creatorExists) {
            await Admin.create({
                userId: CREATOR_ID,
                username: 'creator', // или process.env.CREATOR_USERNAME
                isCreator: true
            });
            console.log(`Creator ${CREATOR_ID} initialized`);
        }
    } catch (err) {
        console.error('Failed to initialize creator:', err);
    }
}

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

// Инициализация и запуск (изменяем этот блок)
initializeCreator().then(() => {
    bot.launch().then(() => console.log("Bot started!"));
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
