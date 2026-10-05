export function intakeErrorMessage(error: unknown): string {
  let data: unknown = (error as { data?: unknown })?.data;
  for (let i = 0; i < 3 && typeof data === "string"; i++) {
    try {
      data = JSON.parse(data);
    } catch {
      data = undefined;
    }
  }
  return (
    (data as { message?: string })?.message ??
    (error instanceof Error && !error.message.includes("[CONVEX")
      ? error.message
      : "The request could not be completed. Try again or contact Ideal.")
  );
}

export async function sendEligibilityFile(
  file: File,
  ticket: { uploadUrl: string; uploadToken: string },
) {
  const response = await fetch(ticket.uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Upload-Token": ticket.uploadToken,
    },
    body: file,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "The upload failed. Please try again.");
  return result as { receiptId: string; duplicate: boolean };
}
