import { Client, Account, Databases } from "appwrite";

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1")
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "69dd0a67002485149a3a");

const account = new Account(client);
const databases = new Databases(client);

export { client, account, databases };
