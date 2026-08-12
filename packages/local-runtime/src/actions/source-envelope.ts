const xmlEntities: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;"
};

export function encodeSourceData(source: string): string {
  return source.replace(/[&<>]/gu, (character) => xmlEntities[character] ?? character);
}

export function decodeSourceData(result: string): string {
  return result
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
