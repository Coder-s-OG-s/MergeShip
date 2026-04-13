import { Client, Account, Databases } from "appwrite";

const client = new Client()
    .setEndpoint("https://sgp.cloud.appwrite.io/v1")
    .setProject("69dd0a67002485149a3a");

const account = new Account(client);
const databases = new Databases(client);

export { client, account, databases };
