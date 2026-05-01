import { headers } from "next/headers";
import { Account, Client, Databases, ID, Query } from "node-appwrite";

const ENDPOINT = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

function requireEnvVar(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name} env variable`);
  }
  return value;
}

function getRequiredEndpoint() {
  return requireEnvVar(ENDPOINT, "APPWRITE_ENDPOINT");
}

function getRequiredProjectId() {
  return requireEnvVar(PROJECT_ID, "APPWRITE_PROJECT_ID");
}

function getJwtFromAuthorizationHeader() {
  const authorization = headers().get("authorization");
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function requireApiKey() {
  return requireEnvVar(API_KEY, "APPWRITE_API_KEY");
}

export function createAdminClient() {
  return new Client()
    .setEndpoint(getRequiredEndpoint())
    .setProject(getRequiredProjectId())
    .setKey(requireApiKey());
}

export function createSessionClient() {
  const jwt = getJwtFromAuthorizationHeader();
  if (!jwt) return null;
  return new Client()
    .setEndpoint(getRequiredEndpoint())
    .setProject(getRequiredProjectId())
    .setJWT(jwt);
}

export function getServerDatabases() {
  return new Databases(createAdminClient());
}

export function getServerAccount() {
  return new Account(createAdminClient());
}

export function getSessionAccount() {
  const sessionClient = createSessionClient();
  if (!sessionClient) return null;
  return new Account(sessionClient);
}

export { ID, Query };
