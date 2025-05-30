import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cron from 'node-cron';

dotenv.config();

// Интерфейс для опроса
interface Poll {
    _id: mongoose.Types.ObjectId;
    question: string;
    options: string[];
    days: string[];
    time: string;
    chatId: number;
    createdBy: number;
    createdAt: Date;
}

// Подключение к БД с проверкой
import { Db } from 'mongodb';

async function getDb(): Promise<Db> {
    try {
        if (mongoose.connection.readyState === 1) {
            if (!mongoose.connection.db) {
                throw new Error('MongoDB connection established, but db is undefined');
            }
            return mongoose.connection.db;
        }

        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('MongoDB connected');

        if (!mongoose.connection.db) {
            throw new Error('MongoDB connected, but db is undefined');
        }
        return mongoose.connection.db;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        throw new Error('Database connection failed');
    }
}

const bot = new Telegraf(process.env.BOT_TOKEN!);

// Проверка прав доступа
function checkAccess(userId: number): { isCreator: boolean; isAdmin: boolean } {
    const admins = (process.env.ADMIN_IDS || '').split(',').filter(Boolean);
    return {
        isCreator: userId.toString() === process.env.CREATOR_ID,
        isAdmin: admins.includes(userId.toString())
    };
}

// 1. Проверка прав
bot.command('myaccess', (ctx) => {
    const { isCreator, isAdmin } = checkAccess(ctx.from.id);
    if (isCreator) {
        return ctx.reply(`✅ Вы создатель бота (ID: ${ctx.from.id})`);
    }
    if (isAdmin) {
        return ctx.reply(`🛠 Вы админ (ID: ${ctx.from.id})`);
    }
    return ctx.reply('❌ У вас нет прав доступа');
});

// 2. Создание опроса
bot.command('newpoll', async (ctx) => {
    const { isCreator, isAdmin } = checkAccess(ctx.from.id);
    if (!isCreator && !isAdmin) {
        return ctx.reply('❌ Только для админов!');
    }

    try {
        const db = await getDb();
        if (!db) {
            return ctx.reply('❌ Ошибка подключения к базе данных');
        }

        const args = ctx.message.text.split('"').map(s => s.trim()).filter(s => s);
        if (args.length < 5) {
            return ctx.reply('❌ Формат: /newpoll "Вопрос" "Вариант1" "Вариант2" Дни Время\nПример: /newpoll "Как дела?" "Хорошо" "Плохо" Пн,Ср 13:00');
        }

        const question = args[1];
        const options = args.slice(2, -1);
        const [days, time] = args[args.length - 1].trim().split(' ');

        const result = await db.collection<Poll>('polls').insertOne({
            _id: new mongoose.Types.ObjectId(),
            question,
            options,
            days: days.split(','),
            time,
            chatId: ctx.chat.id,
            createdBy: ctx.from.id,
            createdAt: new Date()
        });

        await ctx.reply(
            `✅ *Опрос создан*\n` +
            `🆔 ID: \`${result.insertedId}\`\n` +
            `❓ Вопрос: ${question}\n` +
            `📌 Варианты: ${options.join(', ')}\n` +
            `⏰ Расписание: ${days} в ${time}`,
            { parse_mode: 'Markdown' }
        );
    } catch (err) {
        console.error('Poll creation error:', err);
        await ctx.reply('❌ Ошибка при создании опроса');
    }
});

// 3. Просмотр опросов
bot.command('mypolls', async (ctx) => {
    const { isCreator, isAdmin } = checkAccess(ctx.from.id);
    if (!isCreator && !isAdmin) {
        return ctx.reply('❌ Только для админов!');
    }

    try {
        const db = await getDb();
        if (!db) {
            return ctx.reply('❌ Ошибка подключения к базе данных');
        }

        const polls = await db.collection<Poll>('polls')
            .find({ createdBy: ctx.from.id })
            .sort({ createdAt: -1 })
            .toArray();

        if (polls.length === 0) {
            return ctx.reply('ℹ️ У вас нет активных опросов');
        }

        let message = '📅 *Ваши опросы*\n\n';
        polls.forEach(poll => {
            message += `🆔 ID: \`${poll._id}\`\n` +
                `❓ ${poll.question}\n` +
                `📌 ${poll.options.join(', ')}\n` +
                `⏰ ${poll.days.join(', ')} в ${poll.time}\n\n`;
        });

        await ctx.replyWithMarkdown(message);
    } catch (err) {
        console.error('Poll list error:', err);
        await ctx.reply('❌ Ошибка при получении списка опросов');
    }
});

// 4. Удаление опроса
bot.command('delpoll', async (ctx) => {
    const { isCreator, isAdmin } = checkAccess(ctx.from.id);
    if (!isCreator && !isAdmin) {
        return ctx.reply('❌ Только для админов!');
    }

    const pollId = ctx.message.text.split(' ')[1];
    if (!pollId || !mongoose.Types.ObjectId.isValid(pollId)) {
        return ctx.reply('❌ Укажите корректный ID опроса: /delpoll ID_ОПРОСА');
    }

    try {
        const db = await getDb();
        if (!db) {
            return ctx.reply('❌ Ошибка подключения к базе данных');
        }

        const result = await db.collection<Poll>('polls').deleteOne({
            _id: new mongoose.Types.ObjectId(pollId),
            createdBy: ctx.from.id
        });

        if (result.deletedCount === 0) {
            return ctx.reply('❌ Опрос не найден или у вас нет прав на его удаление');
        }

        await ctx.reply('✅ Опрос успешно удален');
    } catch (err) {
        console.error('Poll delete error:', err);
        await ctx.reply('❌ Ошибка при удалении опроса');
    }
});

// 5. Добавление админа
bot.command('addadmin', async (ctx) => {
    const { isCreator } = checkAccess(ctx.from.id);
    if (!isCreator) {
        return ctx.reply('❌ Только создатель может добавлять админов!');
    }

    try {
        let targetId: number;
        let username = 'unknown';

        // Проверяем, является ли команда ответом на сообщение
        if (ctx.message.reply_to_message && ctx.message.reply_to_message.from) {
            targetId = ctx.message.reply_to_message.from.id;
            username = ctx.message.reply_to_message.from.username || username;
        } else {
            const args = ctx.message.text.split(' ');
            if (args.length < 2) {
                return ctx.reply('❌ Ответьте на сообщение пользователя или укажите ID: /addadmin USER_ID');
            }
            targetId = parseInt(args[1]);
        }

        if (!targetId) {
            return ctx.reply('❌ Неверный ID пользователя');
        }

        const admins = (process.env.ADMIN_IDS || '').split(',').filter(Boolean);
        if (!admins.includes(targetId.toString())) {
            admins.push(targetId.toString());
            process.env.ADMIN_IDS = admins.join(',');
        }

        await ctx.reply(`✅ Пользователь @${username} (ID: ${targetId}) добавлен как админ`);
    } catch (err) {
        console.error('Add admin error:', err);
        await ctx.reply('❌ Ошибка при добавлении админа');
    }
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
});

function startScheduler() {
    cron.schedule('* * * * *', async () => {
        try {
            const db = await getDb();
            const now = new Date();
            const day = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][now.getDay()];
            const time = now.toTimeString().slice(0, 5); // формат HH:MM

            const polls = await db.collection<Poll>('polls').find({ days: day, time }).toArray();
            for (const poll of polls) {
                await bot.telegram.sendPoll(
                    poll.chatId,
                    poll.question,
                    poll.options,
                    { is_anonymous: false }
                );
            }
        } catch (err) {
            console.error('Scheduler error:', err);
        }
    });

    console.log('⏰ Шедулер запущен');
}

async function startBot() {
    try {
        await getDb(); // Проверяем подключение к БД перед запуском
        await bot.launch();
        console.log('Бот успешно запущен!');
        startScheduler(); // 👈 запуск шедулера
    } catch (err) {
        console.error('Failed to start bot:', err);
        process.exit(1);
    }
}

startBot();

// Graceful shutdown
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    mongoose.disconnect();
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    mongoose.disconnect();
});
