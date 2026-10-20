"use server";
import { redirect } from "next/navigation";
import { mutate, newId } from "@/lib/db";
import { requireUser, ownVideo } from "@/lib/auth";
import type { EditSlot } from "@/lib/types";

const slot = (text: string): EditSlot => ({ id: newId().slice(0, 8), text: text.trim().slice(0, 600) });

/** Crea un montaje desde un video de la app (cada toma trae su guion) o desde un guion pegado (una línea = una toma). */
export async function createEdit(form: FormData) {
  const me = await requireUser();
  const videoId = String(form.get("videoId") || "");
  const script = String(form.get("script") || "");
  let title = String(form.get("title") || "").trim();
  let slots: EditSlot[] = [];
  let source: string | undefined;
  let kind: "ugc" | "broll" = String(form.get("kind") || "") === "broll" ? "broll" : "ugc";

  if (videoId) {
    const v = ownVideo(me, videoId);
    if (v?.analysis) {
      slots = v.analysis.shots.map((s) => slot(s.audio || ""));
      title = title || v.title;
      source = v.id;
      kind = v.type;
    }
  }
  if (!slots.length && script.trim()) {
    slots = script.split(/\n+/).map((l) => l.trim()).filter(Boolean).map(slot);
  }
  if (!slots.length) slots = [slot(""), slot("")];

  const id = newId();
  mutate((db) => {
    db.edits.unshift({
      id,
      ownerId: me.id,
      title: title || "Montaje sin nombre",
      videoId: source,
      slots,
      kind,
      smartTrim: true,
      subtitles: true,
      subStyle: "blanco",
      subFont: "montserrat",
      status: "draft",
      createdAt: new Date().toISOString(),
    });
  });
  redirect(`/editor/${id}`);
}
