import cron from "node-cron";
import { Poll } from "../models/Poll";
import { Telegraf } from "telegraf";

export function startPollScheduler(bot: Telegraf) {
    cron.schedule("* * * * *", async () => {
        const now = new Date();
        const currentDay = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][now.getDay()];
        const currentTime = `${now.getHours()}:${now.getMinutes()}`;

        const polls = await Poll.find({
            scheduledDays: currentDay,
            scheduledTime: currentTime,
            isActive: true,
        });

        for (const poll of polls) {
            await bot.telegram.sendPoll(
                poll.chatId,
                poll.question,
                poll.options,
                { is_anonymous: false }
            );
        }
    });
}
