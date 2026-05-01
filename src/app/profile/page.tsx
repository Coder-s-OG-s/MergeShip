"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createAppwriteAuthHeader } from "@/lib/appwrite-auth";

type MeResponse = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  profile: {
    github_id: string | null;
    github_handle: string | null;
    username: string;
    avatar_url: string;
    joined_at: string;
    default_level: "L1";
  };
};

export default function ProfilePage() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const authHeaders = await createAppwriteAuthHeader();
        const response = await fetch("/api/me", {
          cache: "no-store",
          headers: authHeaders,
        });
        if (!response.ok) {
          throw new Error("Please sign in to view your profile.");
        }
        const payload = (await response.json()) as MeResponse;
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-300">
        Loading your contributor profile...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-300">
        <p>{error || "Profile not available."}</p>
        <Link href="/onboarding" className="underline">
          Go to onboarding
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dark-900 text-white p-8">
      <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold mb-6">Contributor Profile</h1>
        <div className="space-y-3 text-sm">
          <p><span className="text-gray-400">Name:</span> {data.user.name}</p>
          <p><span className="text-gray-400">Email:</span> {data.user.email}</p>
          <p><span className="text-gray-400">Username:</span> {data.profile.username}</p>
          <p><span className="text-gray-400">GitHub Handle:</span> {data.profile.github_handle || "Not available"}</p>
          <p><span className="text-gray-400">GitHub ID:</span> {data.profile.github_id || "Not available"}</p>
          <p><span className="text-gray-400">Default Level:</span> {data.profile.default_level}</p>
          <p><span className="text-gray-400">Joined At:</span> {new Date(data.profile.joined_at).toLocaleString()}</p>
        </div>
      </div>
    </main>
  );
}
