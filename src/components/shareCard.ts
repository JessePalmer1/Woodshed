import { FeedSession } from "../types";
import { fmtDuration } from "../utils";

/** Render a 1080×1080 share card PNG for a session and trigger a download. */
export function exportShareCard(session: FeedSession, userName: string, instrument: string) {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // warm dark background
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#1c1410");
  grad.addColorStop(1, "#120d0a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // amber glow
  const glow = ctx.createRadialGradient(size * 0.8, size * 0.15, 0, size * 0.8, size * 0.15, 600);
  glow.addColorStop(0, "rgba(240,162,74,0.16)");
  glow.addColorStop(1, "rgba(240,162,74,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const amber = "#f0a24a";
  const cream = "#f3ead9";
  const muted = "#a89a86";

  // logo mark
  ctx.fillStyle = amber;
  ctx.beginPath();
  ctx.moveTo(120, 76);
  ctx.lineTo(184, 120);
  ctx.lineTo(170, 120);
  ctx.lineTo(170, 188);
  ctx.lineTo(70, 188);
  ctx.lineTo(70, 120);
  ctx.lineTo(56, 120);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#16100c";
  ctx.beginPath();
  ctx.arc(106, 160, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(116, 112, 9, 50);
  ctx.fillRect(116, 112, 28, 9);

  ctx.fillStyle = cream;
  ctx.font = "600 56px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("woodshed", 216, 148);
  ctx.fillStyle = muted;
  ctx.font = "400 34px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("practice out loud", 218, 196);

  // headline: duration
  ctx.fillStyle = amber;
  ctx.font = "700 170px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(fmtDuration(session.analysis.durationSec), 70, 460);
  ctx.fillStyle = muted;
  ctx.font = "400 44px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("in the shed", 74, 530);

  // stats line
  const stats: string[] = [];
  if (session.analysis.keyName) stats.push(session.analysis.keyName);
  if (session.analysis.bpm) stats.push(`~${session.analysis.bpm} bpm`);
  if (session.pieceTitles.length) stats.push(session.pieceTitles.join(" · "));
  ctx.fillStyle = cream;
  ctx.font = "500 48px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(stats.join("   •   ") || "open practice", 74, 630, size - 148);

  // waveform
  const peaks = session.analysis.clipPeaks;
  const waveTop = 700;
  const waveH = 190;
  const barW = (size - 148) / peaks.length;
  for (let i = 0; i < peaks.length; i++) {
    const h = Math.max(10, peaks[i] * waveH);
    ctx.fillStyle = i % 3 === 0 ? amber : "rgba(240,162,74,0.55)";
    const x = 74 + i * barW;
    ctx.beginPath();
    ctx.roundRect(x, waveTop + (waveH - h) / 2, barW * 0.6, h, 4);
    ctx.fill();
  }

  // footer
  ctx.fillStyle = cream;
  ctx.font = "600 42px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(`${userName} · ${instrument}`, 74, 1000);
  ctx.fillStyle = muted;
  ctx.font = "400 36px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(
    new Date(session.startedAt).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    74,
    1052
  );

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `woodshed-${new Date(session.startedAt).toISOString().slice(0, 10)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, "image/png");
}
