import { Schema, model } from "mongoose";

interface IAdmin {
    userId: number;
    username?: string;
    isCreator: boolean;
}

const AdminSchema = new Schema<IAdmin>({
    userId: { type: Number, required: true, unique: true },
    username: { type: String },
    isCreator: { type: Boolean, default: false },
});

export const Admin = model<IAdmin>("Admin", AdminSchema);
