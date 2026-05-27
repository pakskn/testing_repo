function durationToSeconds(dur) {
  if (!dur) return 0
  const parts = dur.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

const vids = [
  { duration: "40:13" },
  { duration: "20:24" },
  { duration: "16:18" },
  { duration: "3:45:02" },
  { duration: "21:54" },
  { duration: "30:07" },
  { duration: "38:38" },
  { duration: "19:28" },
  { duration: "1:03" },
  { duration: "30:03" }
];

const noShorts = vids.filter(v => durationToSeconds(v.duration) > 60);
const longVids = noShorts.filter(v => durationToSeconds(v.duration) >= 180);
const finalVids = longVids.length > 0 ? longVids : noShorts.length > 0 ? noShorts : vids;

console.log("Final length:", finalVids.length);
