import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Redirects to a short-lived signed URL for the attachment.
// RLS on report_attachments + storage.objects enforces access.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: attachment } = await supabase
    .from("report_attachments")
    .select("storage_path, file_name")
    .eq("id", id)
    .maybeSingle();
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, 60, {
      download: attachment.file_name,
    });
  if (error || !signed) {
    return NextResponse.json(
      { error: error?.message ?? "Could not sign URL" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
