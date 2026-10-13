// The one size limit on an attachment, shared by the form that refuses a file
// before anything is saved and the action that refuses it after. 15 MB: a
// scanned receipt or a full workbook, not a video.
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

// Storage keys allow a narrow set of characters. Anything else — a Khmer
// filename, an em dash — becomes an underscore in the key; the original name is
// kept in report_attachments.file_name, which is what everyone sees.
export function storageSafeName(name: string) {
  return name.replace(/[^\w.\- ]/g, "_");
}

// Uploads a report's attachments from the browser, straight to storage.
//
// They used to ride in the form's POST to a server action, and on Vercel a
// function's request body is capped at 4.5 MB: a 6 MB workbook was refused at
// the edge, before any of this app's code ran, and the author saw the error
// page. Storage takes the file directly, so the cap is ours (15 MB) again.
//
// The browser is allowed to do this by the same rules the action ran under:
// the bucket and report_attachments both check can_edit_report(), which lets an
// author write to their own draft. The caller saves the report as a draft first
// for exactly that reason.
//
// One file at a time, and each one recorded as soon as it is up, so a failure
// partway leaves the report holding the files that made it — onUploaded tells
// the form which, so a retry does not send them twice. Returns the first
// failure as a sentence, or null.
export async function uploadAttachmentsFromBrowser(
  reportId: string,
  files: File[],
  onUploaded: (file: File) => void
): Promise<string | null> {
  // Imported here rather than at the top: this module also carries the size
  // limit the server action reads, and the browser client has no business in
  // that bundle.
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "your session has ended. Sign in again and retry";

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return `"${file.name}" is larger than 15 MB`;
    }
    const path = `${reportId}/${crypto.randomUUID()}-${storageSafeName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(path, file, { contentType: file.type || undefined });
    if (uploadError) {
      return `"${file.name}" could not be uploaded (${uploadError.message})`;
    }

    const { error: rowError } = await supabase
      .from("report_attachments")
      .insert({
        report_id: reportId,
        file_name: file.name,
        storage_path: path,
        uploaded_by: user.id,
      });
    if (rowError) {
      await supabase.storage.from("attachments").remove([path]);
      return `"${file.name}" could not be recorded (${rowError.message})`;
    }
    onUploaded(file);
  }
  return null;
}
