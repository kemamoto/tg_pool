import { Telegraf } from "telegraf";
import { Poll } from "../models/Poll";
import { Admin } from "../models/Admin";

export function setupPollCommands(bot: Telegraf) {
    bot.command("newpoll", async (ctx) => {
        const admin = await Admin.findOne({ userId: ctx.from.id });
        if (!admin) return ctx.reply("❌ Только админы могут создавать опросы!");

        // Пример: /newpoll "Как дела?" "Хорошо" "Плохо" "Нормально" Пн,Ср,Пт 15:30
        const args = ctx.message.text.split('"').map(s => s.trim()).filter(s => s);

        if (args.length < 6) return ctx.reply("❌ Формат: /newpoll \"Вопрос\" \"Вариант1\" \"Вариант2\" Дни(Пн,Ср) Время(15:30)");

        const question = args[1];
        const options = args.slice(2, -2);
        const days = args[args.length - 2].split(",");
        const time = args[args.length - 1];

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
