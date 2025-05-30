import { Telegraf } from "telegraf";
import { Admin } from "../models/Admin";

export function setupAdminCommands(bot: Telegraf) {
    bot.command("addadmin", async (ctx) => {
        const creator = await Admin.findOne({ userId: ctx.from.id, isCreator: true });
        if (!creator) return ctx.reply("❌ Только создатель может добавлять админов!");

        const replyTarget = ctx.message.reply_to_message?.from;
        if (!replyTarget) return ctx.reply("❌ Ответьте на сообщение пользователя!");

        const newAdmin = new Admin({
            userId: replyTarget.id,
            username: replyTarget.username,
            isCreator: false,
        });

        await newAdmin.save();
        ctx.reply(`✅ @${replyTarget.username} теперь админ!`);
    });
}
