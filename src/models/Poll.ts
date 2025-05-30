import { Schema, model } from "mongoose";

interface IPoll {
    chatId: number;
    question: string;
    options: string[];
    scheduledDays: string[]; // ["Monday", "Tuesday"]
    scheduledTime: string;   // "15:30"
    isActive: boolean;
}

const PollSchema = new Schema<IPoll>({
    chatId: { type: Number, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    scheduledDays: { type: [String], required: true },
    scheduledTime: { type: String, required: true },
    isActive: { type: Boolean, default: true },
});

export const Poll = model<IPoll>("Poll", PollSchema);
