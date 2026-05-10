import { account } from "@/lib/appwrite";

export async function createAppwriteAuthHeader() {
  const jwt = await account.createJWT();
  return {
    Authorization: `Bearer ${jwt.jwt}`,
  };
}
