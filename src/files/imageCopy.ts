import { copyIntoAppDocumentsWithUuid } from "./appDocuments";

function resolveImageExtension(uri: string): ".jpg" | ".jpeg" | ".png" {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith(".png")) {
    return ".png";
  }
  if (normalized.endsWith(".jpeg")) {
    return ".jpeg";
  }
  return ".jpg";
}

export async function copyImageToAppDocuments(sourceUri: string): Promise<string> {
  const ext = resolveImageExtension(sourceUri);
  return copyIntoAppDocumentsWithUuid(sourceUri, ext);
}
