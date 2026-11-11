
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BriefReq = {
  events: {
    source: string;
    title: string;
    summary: string;
    level: string;
    ts: number;
  }[];
  target?: { name: string; lat: number; lng: number; accuracyM: number };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BriefReq;
    const events = body.events ?? [];
    const target = body.target;

    if (events.length === 0 && !target) {
      return NextResponse.json({
        brief: "Awaiting OSINT signal. No active intelligence to brief.",
      });
    }

    const eventsText = events
      .slice(0, 40)
      .map(
        (e) =>
          `[${e.level.toUpperCase()}] ${e.source}: ${e.title} · ${e.summary}`
      )
      .join("\n");

    const targetLine = target
      ? `\nACTIVE TARGET: ${target.name} @ ${target.lat.toFixed(
          4
        )},${target.lng.toFixed(4)} ±${target.accuracyM}m`
      : "";

    const prompt = `You are HORUS-AI, the analytical core of the HORUS Intelligence Platform.
Synthesize the following real-time OSINT signals into a CONCISE tactical brief.
Format strictly as:
SITREP: <2 sentences overview>
THREATS: <bullet list of max 3 critical items, prefixed by '- '>
MOVEMENT: <2 sentences on patterns>
RECOMMEND: <2 sentences actionable recommendation>

${targetLine}

OSINT FEED:
${eventsText || "(no events)"}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ZAI: any;
    try {
      ZAI = await import("z-ai-web-dev-sdk").then(
        (m) => (m as { default?: unknown }).default ?? m
      );
    } catch {
      return NextResponse.json({
        brief: localBrief(events, target),
      });
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const z = await (ZAI as any).create();
      const completion = await z.chat.completions.create({
        messages: [
          { role: "system", content: "You are HORUS-AI, an OSINT analyst." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 600,
      });
      const text =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (completion as any).choices?.[0]?.message?.content ??
        localBrief(events, target);
      return NextResponse.json({ brief: text });
    } catch {
      return NextResponse.json({ brief: localBrief(events, target) });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}

function localBrief(
  events: BriefReq["events"],
  target?: BriefReq["target"]
): string {
  const crit = events.filter((e) => e.level === "crit" || e.level === "alert");
  const warn = events.filter((e) => e.level === "warn");
  const lines: string[] = [];
  lines.push(
    `SITREP: ${events.length} OSINT signals tracked across ${
      new Set(events.map((e) => e.source)).size
    } sources. Pattern indicates elevated activity.`
  );
  if (target) {
    lines.push(
      `THREATS:\n- Primary target ${target.name} at ${target.lat.toFixed(
        4
      )},${target.lng.toFixed(4)} within ${target.accuracyM}m accuracy.`
    );
  } else {
    lines.push("THREATS:");
  }
  crit.slice(0, 3).forEach((e) => {
    lines.push(`- [${e.level.toUpperCase()}] ${e.source}: ${e.title}`);
  });
  lines.push(
    `MOVEMENT: ${
      crit.length
    } critical events and ${warn.length} warnings detected. Spatial clustering suggests ${
      crit.length > 3 ? "coordinated" : "dispersed"
    } activity.`
  );
  lines.push(
    "RECOMMEND: Maintain 24/7 monitoring on active targets. Escalate critical signals to command. Cross-correlate flight, RF and seismic channels."
  );
  return lines.join("\n");
}
