import cron from "node-cron";
import { Poll } from "../models/Poll";
import { Telegraf } from "telegraf";

export function startPollScheduler(bot: Telegraf) {
    cron.schedule("* * * * *", async () => {
        const now = new Date();
        const moscowNow = new Date(now.getTime() + 3 * 60 * 60 * 1000); // UTC+3

        const currentDay = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][moscowNow.getDay()];
        const currentTime = `${moscowNow.getHours()}:${moscowNow.getMinutes()}`;

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
