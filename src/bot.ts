import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Подключение к БД
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
function checkAccess(userId: number): { isCreator: boolean; isAdmin: boolean } {
    const admins = process.env.ADMIN_IDS?.split(',') || [];
    return {
        isCreator: userId.toString() === process.env.CREATOR_ID,
        isAdmin: admins.includes(userId.toString())
    };
}

// 1. Проверка прав
bot.command('myaccess', (ctx) => {
    const { isCreator, isAdmin } = checkAccess(ctx.from.id);
    if (isCreator) {
        ctx.reply(`✅ Вы создатель бота (ID: ${ctx.from.id})`);
    } else if (isAdmin) {
        ctx.reply(`🛠 Вы админ (ID: ${ctx.from.id})`);
    } else {
        ctx.reply('❌ У вас нет прав доступа');
    }
});

// 2. Создание опроса
bot.command('newpoll', async (ctx) => {
    const { isCreator, isAdmin } = checkAccess(ctx.from.id);
    if (!isCreator && !isAdmin) return ctx.reply('❌ Только для админов!');

    try {
        const db = await connectDB();
        const match = ctx.message.text.match(/^\/newpoll\s+"(.+?)"\s+(.+?)\s+([А-Яа-я,]+)\s+(\d{1,2}:\d{2})$/);

        if (!match) {
            return ctx.reply('❌ Формат: /newpoll "Вопрос" "Вариант1" "Вариант2" ... Дни(Пн,Ср) Время(13:00)');
        }

        const [_, question, optionsStr, daysStr, time] = match;
        const options = optionsStr.split('" "').map(opt => opt.replace(/"/g, ''));
        const days = daysStr.split(',');

        const result = await db.collection('polls').insertOne({
            question,
            options,
            days,
            time,
            chatId: ctx.chat.id,
            createdBy: ctx.from.id,
            createdAt: new Date()
        });

        ctx.reply(`✅ Опрос создан (ID: ${result.insertedId})!\n` +
            `Вопрос: ${question}\n` +
            `Варианты: ${options.join(', ')}\n` +
            `Дни: ${days.join(', ')}\n` +
            `Время: ${time}`);
    } catch (err) {
        console.error(err);
        ctx.reply('❌ Ошибка при создании опроса');
    }
});

// 3. Просмотр опросов
bot.command('mypolls', async (ctx) => {
    const { isCreator, isAdmin } = checkAccess(ctx.from.id);
    if (!isCreator && !isAdmin) return ctx.reply('❌ Только для админов!');

    try {
        const db = await connectDB();
        const polls = await db.collection('polls')
            .find({ createdBy: ctx.from.id })
            .sort({ createdAt: -1 })
            .toArray();

        if (polls.length === 0) {
            return ctx.reply('ℹ️ У вас нет активных опросов');
        }

        let message = '📅 Ваши опросы:\n\n';
        polls.forEach((poll, index) => {
            message += `🆔 ID: ${poll._id}\n` +
                `❓ Вопрос: ${poll.question}\n` +
                `📌 Варианты: ${poll.options.join(', ')}\n` +
                `⏰ Когда: ${poll.days.join(', ')} в ${poll.time}\n\n`;
        });

        ctx.reply(message);
    } catch (err) {
        console.error(err);
        ctx.reply('❌ Ошибка при получении опросов');
    }
});

// 4. Удаление опроса
bot.command('delpoll', async (ctx) => {
    const { isCreator, isAdmin } = checkAccess(ctx.from.id);
    if (!isCreator && !isAdmin) return ctx.reply('❌ Только для админов!');

    const pollId = ctx.message.text.split(' ')[1];
    if (!pollId) return ctx.reply('❌ Укажите ID опроса: /delpoll ID_ОПРОСА');

    try {
        const db = await connectDB();
        const result = await db.collection('polls').deleteOne({
            _id: new mongoose.Types.ObjectId(pollId),
            createdBy: ctx.from.id
        });

        if (result.deletedCount === 0) {
            return ctx.reply('❌ Опрос не найден или у вас нет прав');
        }

        ctx.reply('✅ Опрос успешно удален');
    } catch (err) {
        console.error(err);
        ctx.reply('❌ Ошибка при удалении опроса');
    }
});

// 5. Добавление админа
bot.command('addadmin', async (ctx) => {
    const { isCreator } = checkAccess(ctx.from.id);
    if (!isCreator) return ctx.reply('❌ Только создатель может добавлять админов!');

    const targetUser = ctx.message.reply_to_message?.from ||
        { id: parseInt(ctx.message.text.split(' ')[1]), username: 'unknown' };

    if (!targetUser.id) return ctx.reply('❌ Ответьте на сообщение пользователя или укажите его ID');

    try {
        const admins = process.env.ADMIN_IDS?.split(',') || [];
        if (!admins.includes(targetUser.id.toString())) {
            admins.push(targetUser.id.toString());
            process.env.ADMIN_IDS = admins.join(',');
        }

        ctx.reply(`✅ Пользователь @${targetUser.username || targetUser.id} добавлен как админ`);
    } catch (err) {
        console.error(err);
        ctx.reply('❌ Ошибка при добавлении админа');
    }
});

bot.launch().then(() => console.log('Бот запущен!'));
