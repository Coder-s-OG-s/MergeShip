import React, { useState, useMemo } from "react";
interface Issue { id: string; title: string; xpReward: number; }
export const IssueXpFilter = ({ issues, onFilterChange }) => {
  const [sortBy, setSortBy] = useState("default");
  const [minXp, setMinXp] = useState("");
  const filtered = useMemo(() => {
    let r = [...issues];
    if (minXp) r = r.filter(i => i.xpReward >= parseInt(minXp));
    if (sortBy === "xp-desc") r.sort((a,b) => b.xpReward - a.xpReward);
    if (sortBy === "xp-asc") r.sort((a,b) => a.xpReward - b.xpReward);
    return r;
  }, [issues, sortBy, minXp]);
  return (<div><select value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="default">Default</option><option value="xp-desc">XP High-Low</option><option value="xp-asc">XP Low-High</option></select><input placeholder="Min XP" value={minXp} onChange={e => setMinXp(e.target.value)} /></div>);
};
