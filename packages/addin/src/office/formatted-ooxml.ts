function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function decodeXml(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function wordCount(text: string): number {
  return text.trim().match(/\S+/gu)?.length ?? 0;
}

function takeWords(text: string, count: number): [string, string] {
  if (count <= 0) return ["", text];
  let seen = 0;
  for (const match of text.matchAll(/\S+\s*/gu)) {
    seen += 1;
    if (seen === count) {
      const end = match.index! + match[0].length;
      return [text.slice(0, end), text.slice(end)];
    }
  }
  return [text, ""];
}

function replaceParagraphText(paragraph: string, text: string): string | undefined {
  const textNodes = [...paragraph.matchAll(/<w:t(?<attributes>\s[^>]*)?>(?<value>[\s\S]*?)<\/w:t>/gu)];
  if (textNodes.length === 0) return text.length === 0 ? paragraph : undefined;

  let remaining = text;
  let cursor = 0;
  let output = "";
  for (let index = 0; index < textNodes.length; index += 1) {
    const node = textNodes[index]!;
    const isLast = index === textNodes.length - 1;
    const originalWords = wordCount(decodeXml(node.groups?.value ?? ""));
    const [chunk, rest] = isLast ? [remaining, ""] : takeWords(remaining, originalWords);
    const attributes = node.groups?.attributes ?? "";
    const needsPreserve = /^\s|\s$/u.test(chunk);
    const normalizedAttributes = needsPreserve && !/\bxml:space=/u.test(attributes)
      ? `${attributes} xml:space="preserve"`
      : attributes;
    const replacement = `<w:t${normalizedAttributes}>${escapeXml(chunk)}</w:t>`;
    output += paragraph.slice(cursor, node.index!) + replacement;
    cursor = node.index! + node[0].length;
    remaining = rest;
  }
  return output + paragraph.slice(cursor);
}

export function replaceParagraphTextInOoxml(ooxml: string, resultText: string): string | undefined {
  const paragraphs = [...ooxml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu)];
  const lines = resultText.split(/\r\n|\r|\n/u);
  if (paragraphs.length === 0 || paragraphs.length !== lines.length) return undefined;

  let cursor = 0;
  let output = "";
  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index]!;
    const start = paragraph.index!;
    const replacement = replaceParagraphText(paragraph[0], lines[index]!);
    if (!replacement) return undefined;
    output += ooxml.slice(cursor, start) + replacement;
    cursor = start + paragraph[0].length;
  }
  return output + ooxml.slice(cursor);
}
