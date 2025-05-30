import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Подключение к БД с обработкой ошибок
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('MongoDB connected');
        return mongoose.connection.db;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        throw err;
    }
}

const bot = new Telegraf(process.env.BOT_TOKEN!);

// Проверка прав
function checkAccess(userId: number): boolean {
    const admins = process.env.ADMIN_IDS?.split(',') || [];
    return (
        userId.toString() === process.env.CREATOR_ID ||
        admins.includes(userId.toString())
    );
}

// Главная команда
bot.command('newpoll', async (ctx) => {
    if (!checkAccess(ctx.from.id)) {
        return ctx.reply('❌ Только для админов!');
    }

    try {
        const db = await connectDB();
        if (!db) throw new Error('No database connection');

        const match = ctx.message.text.match(/^\/newpoll\s+"(.+?)"\s+(.+?)\s+([А-Яа-я,]+)\s+(\d{1,2}:\d{2})$/);

        if (!match) {
            return ctx.reply('❌ Формат: /newpoll "Вопрос" "Вариант1" "Вариант2" ... Дни(Пн,Ср) Время(13:00)');
        }

        const [_, question, optionsStr, daysStr, time] = match;
        const options = optionsStr.split('" "').map(opt => opt.replace(/"/g, ''));
        const days = daysStr.split(',');

        await db.collection('polls').insertOne({
            question,
            options,
            days,
            time,
            chatId: ctx.chat.id,
            createdAt: new Date()
        });

        ctx.reply(`✅ Опрос создан!\nВопрос: ${question}\nВарианты: ${options.join(', ')}\nДни: ${days.join(', ')}\nВремя: ${time}`);
    } catch (err) {
        console.error(err);
        ctx.reply('❌ Ошибка: ' + (err instanceof Error ? err.message : 'Неизвестная ошибка'));
    }
});

bot.launch().then(() => console.log('Бот запущен!'));
