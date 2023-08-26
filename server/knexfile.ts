import dotenv from "dotenv";
import { buildConfig } from "./src/knex_config.js";
dotenv.config();

const config = buildConfig(process.env);

export default config;
