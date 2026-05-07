import { Client, Account, Databases } from "appwrite";

const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
if (!projectId) {
  throw new Error(
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID is not configured. Set it in .env.local before starting the app."
  );
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1")
  .setProject(projectId);

const account = new Account(client);
const databases = new Databases(client);

export { client, account, databases };
