import { RefreshCw, Rocket, User } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { account } from "@/lib/appwrite";
import { Models } from "appwrite";

export function DashboardHeader({ onSync, isSyncing }: { onSync: () => void; isSyncing?: boolean }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const session = await account.get();
        setUser(session);
      } catch (error) {
        console.error("Failed to fetch user", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
      >
        <h1 className="text-4xl font-display font-black text-white mb-2 tracking-tight">
          Welcome back, <span className="text-[#D8B4FE]">{loading ? "..." : (user?.name || "Captain")}</span>
        </h1>
        <p className="text-[#8B7E9F] font-bold text-xs uppercase tracking-[0.2em]">
          {loading ? "Syncing..." : "Your dashboard is optimized with cached GitHub intelligence."}
        </p>
      </motion.div>
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-5 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-white/5 text-[#D8B4FE] border border-white/5 hover:bg-white/10"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync Data
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05, shadow: "0 0 20px rgba(216, 180, 254, 0.4)" }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all bg-[#D8B4FE] text-[#15111A] shadow-xl shadow-[#D8B4FE]/10"
        >
          <Rocket className="w-5 h-5" />
          Get Today's Issues
        </motion.button>
      </div>
    </div>
  );
}
