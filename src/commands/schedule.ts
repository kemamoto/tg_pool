// src/commands/schedule.ts
import { Telegraf } from "telegraf";
import { Poll } from "../models/Poll";
import { Admin } from "../models/Admin";

export function setupScheduleCommands(bot: Telegraf) {
    // Установка/изменение расписания для существующего опроса
    bot.command("setschedule", async (ctx) => {
        const admin = await Admin.findOne({ userId: ctx.from.id });
        if (!admin) return ctx.reply("❌ Только админы могут настраивать расписание!");

        // Формат: /setschedule [ID_опроса] [Дни] [Время]
        // Пример: /setschedule 123 Пн,Ср,Пт 15:30
        const args = ctx.message.text.split(' ');

        if (args.length < 4) {
            return ctx.reply("❌ Формат: /setschedule [ID_опроса] [Дни(Пн,Ср,Пт)] [Время(15:30)]");
        }

        const pollId = args[1];
        const days = args[2].split(',');
        const time = args[3];

        try {
            const updatedPoll = await Poll.findByIdAndUpdate(
                pollId,
                { scheduledDays: days, scheduledTime: time },
                { new: true }
            );

            if (!updatedPoll) {
                return ctx.reply("❌ Опрос с таким ID не найден!");
            }

            ctx.reply(`✅ Расписание обновлено: ${days.join(", ")} в ${time}`);
        } catch (err) {
            console.error(err);
            ctx.reply("❌ Ошибка при обновлении расписания");
        }
    });

    // Просмотр текущего расписания
    bot.command("viewschedule", async (ctx) => {
        const polls = await Poll.find({ chatId: ctx.chat.id });

        if (polls.length === 0) {
            return ctx.reply("ℹ️ В этом чате нет активных опросов");
        }

        let message = "📅 Текущее расписание опросов:\n\n";
        polls.forEach(poll => {
            message += `🆔 ${poll._id}\n` +
                `❓ ${poll.question}\n` +
                `⏰ ${poll.scheduledDays.join(", ")} в ${poll.scheduledTime}\n\n`;
        });

        ctx.reply(message);
    });

    // Удаление опроса из расписания
    bot.command("removeschedule", async (ctx) => {
        const admin = await Admin.findOne({ userId: ctx.from.id });
        if (!admin) return ctx.reply("❌ Только админы могут удалять опросы!");

        // Формат: /removeschedule [ID_опроса]
        const args = ctx.message.text.split(' ');

        if (args.length < 2) {
            return ctx.reply("❌ Формат: /removeschedule [ID_опроса]");
        }

        try {
            const deletedPoll = await Poll.findByIdAndDelete(args[1]);

            if (!deletedPoll) {
                return ctx.reply("❌ Опрос с таким ID не найден!");
            }

            ctx.reply("✅ Опрос удален из расписания");
        } catch (err) {
            console.error(err);
            ctx.reply("❌ Ошибка при удалении опроса");
        }
    });
}
