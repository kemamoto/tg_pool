import { Telegraf } from "telegraf";
import { Poll } from "../models/Poll";
import { Admin } from "../models/Admin";

export function setupPollCommands(bot: Telegraf) {
    bot.command("newpoll", async (ctx) => {
        const admin = await Admin.findOne({ userId: ctx.from.id });
        if (!admin) return ctx.reply("❌ Только админы могут создавать опросы!");

        // Пример: /newpoll "Как дела?" "Хорошо" "Плохо" "Нормально" Пн,Ср,Пт 15:30
        const args = ctx.message.text.match(/"([^"]+)"/g); // Захватываем всё в кавычках

        if (!args || args.length < 4) return ctx.reply("❌ Формат: /newpoll \"Вопрос\" \"Вариант1\" \"Вариант2\" Дни(Пн,Ср) Время(15:30)");

        const question = args[0].slice(1, -1); // Убираем кавычки
        const options = args.slice(1, -2).map(option => option.slice(1, -1)); // Убираем кавычки у вариантов
        const days = args[args.length - 2].split(","); // Дни
        const time = args[args.length - 1].slice(1, -1); // Время (убираем кавычки)

        // Проверим, что все данные корректны
        if (!question || options.length < 2 || days.length === 0 || !time) {
            return ctx.reply("❌ Формат: /newpoll \"Вопрос\" \"Вариант1\" \"Вариант2\" Дни(Пн,Ср) Время(15:30)");
        }

        const poll = new Poll({
            chatId: ctx.chat.id,
            question,
            options,
            scheduledDays: days,
            scheduledTime: time,
        });

        await poll.save();
        ctx.reply(`✅ Опрос создан и будет отправляться в ${days.join(", ")} в ${time}`);
    });
}
