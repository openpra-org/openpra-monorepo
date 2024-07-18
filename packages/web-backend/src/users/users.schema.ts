import * as mongoose from "mongoose";

export const UsersGqlSchema = new mongoose.Schema({
  username: String,
  password: String,
});
