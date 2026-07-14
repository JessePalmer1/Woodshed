/**
 * Client-side content helpers: starter repertoire suggestions for onboarding
 * and the auto-caption generator for drafted posts. (The seed community and
 * its reactions live server-side now — see server/bots.ts.)
 */

import { SessionAnalysis } from "../types";
import { pick } from "../utils";

export const STARTER_PIECES: Record<string, string[]> = {
  Piano: ["Clair de Lune", "Für Elise", "Autumn Leaves", "River Flows in You"],
  Guitar: ["Blackbird", "Little Wing", "Classical Gas", "Wonderwall"],
  Violin: ["Meditation from Thaïs", "Bach Partita No. 2", "Czardas"],
  Bass: ["Autumn Leaves", "Walking lines in F", "Teen Town"],
  Saxophone: ["Donna Lee", "Careless Whisper", "Body and Soul"],
  Drums: ["Paradiddle drills", "Take Five groove", "Rosanna shuffle"],
  Voice: ["Autumn Leaves", "At Last", "Hallelujah"],
  Trumpet: ["Blue Bossa", "Long tones", "Clarke studies"],
  Other: ["Scales & drills", "Current piece"],
};

/** Auto-draft a caption for the user's session. */
export function autoCaption(
  analysis: SessionAnalysis,
  pieceTitles: string[],
  streakDays: number
): string {
  const mins = Math.round(analysis.durationSec / 60);
  let lead: string;
  if (pieceTitles.length > 0) {
    lead = `Worked ${pieceTitles.join(" + ")}`;
  } else if (analysis.keyName) {
    lead = `Mostly living in ${analysis.keyName} today`;
  } else {
    lead = `${mins} minutes in the shed`;
  }
  const flavor = [
    "Slow is smooth, smooth is fast.",
    "The hard bar is getting less hard.",
    "Calling that progress.",
    "One more pass tomorrow.",
    "Starting to sound like music.",
  ];
  const tail = streakDays >= 3 ? `Day ${streakDays} in a row 🔥` : pick(flavor);
  return `${lead}. ${tail}`;
}
