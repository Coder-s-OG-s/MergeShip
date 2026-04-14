import { Client, Databases, ID, Query } from "node-appwrite";

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1")
    .setProject(process.env.APPWRITE_PROJECT_ID || "69dd0a67002485149a3a")
    .setKey(process.env.APPWRITE_API_KEY || "");

export const serverDatabases = new Databases(client);
export { ID, Query };
