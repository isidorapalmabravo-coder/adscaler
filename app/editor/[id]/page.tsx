import { notFound } from "next/navigation";
import { getEdit } from "@/lib/db";
import { requireUser, ownEdit } from "@/lib/auth";
import { AppShell } from "@/components/ui";
import { EditorClient } from "@/components/EditorClient";
import { expiresAt, purgeOldEdits, ensureSpeech } from "@/lib/video-edit";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  purgeOldEdits();
  const { id } = await params;
  const me = await requireUser();
  let job;
  try {
    job = ownEdit(me, id);
  } catch {
    notFound();
  }
  await ensureSpeech(job);
  job = getEdit(id)!;
  const expires = expiresAt(job).toLocaleDateString("es-CL", { day: "numeric", month: "long" });
  return (
    <AppShell>
      <EditorClient initial={job} expires={expires} />
    </AppShell>
  );
}
