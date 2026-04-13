"use client";

import { useEffect } from "react";
import { client } from "@/lib/appwrite";

export function AppwriteProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Automatically ping the Appwrite backend server to verify the setup
    client.ping()
      .then(() => {
        console.log("Appwrite: Connection verified successfully.");
      })
      .catch((err) => {
        console.error("Appwrite: Failed to verify connection.", err);
      });
  }, []);

  return <>{children}</>;
}
