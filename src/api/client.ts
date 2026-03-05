import axios from "axios";
import { config } from "../config/config";

export const api = axios.create({
    baseURL: config.VITE_API_URL,
    headers: {
        "X-API-Key": config.VITE_API_KEY,
    },
});
