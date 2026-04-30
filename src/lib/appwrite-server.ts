import { cookies } from "next/headers";
import { Account, Client, Databases, ID, Query } from "node-appwrite";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69dd0a67002485149a3a";
const API_KEY = process.env.APPWRITE_API_KEY || "";

function getSessionFromCookies() {
  const cookieStore = cookies();
  const cookieCandidates = [
    `a_session_${PROJECT_ID}`,
    `a_session_${PROJECT_ID}_legacy`,
  ];

  for (const name of cookieCandidates) {
    const sessionCookie = cookieStore.get(name)?.value;
    if (sessionCookie) return sessionCookie;
  }
  return null;
}

export function createAdminClient() {
  return new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);
}

export function createSessionClient() {
  const session = getSessionFromCookies();
  if (!session) return null;
  return new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setSession(session);
}

const adminClient = createAdminClient();
export const serverDatabases = new Databases(adminClient);
export const serverAccount = new Account(adminClient);

export function getSessionAccount() {
  const sessionClient = createSessionClient();
  if (!sessionClient) return null;
  return new Account(sessionClient);
}

export { ID, Query };
