"use client";

import { useEffect, useState } from "react";
import { account } from "@/lib/appwrite";
import { Models, OAuthProvider } from "appwrite";
import { User, LogOut, Github } from "lucide-react";
import Link from "next/link";

export default function AuthStatus() {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const session = await account.get();
        setUser(session);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  const handleLogin = () => {
    // Replace 'http://localhost:3000' with your production URL when deploying
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin + '/onboarding' : '';
    account.createOAuth2Session(
      OAuthProvider.Github,
      redirectUrl, 
      redirectUrl
    );
  };

  const handleLogout = async () => {
    await account.deleteSession('current');
    setUser(null);
    window.location.reload();
  };

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
          <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
            <User className="w-3 h-3 text-purple-400" />
          </div>
          <span className="text-xs font-medium text-gray-300">{user.name || user.email}</span>
        </Link>
        <button 
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={handleLogin}
      className="btn-primary flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold"
    >
      <Github className="w-4 h-4" />
      Sign In
    </button>
  );
}
