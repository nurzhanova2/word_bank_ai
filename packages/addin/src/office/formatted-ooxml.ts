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

function dominantRunProperties(ooxml: string): string {
  const weights = new Map<string, number>();
  for (const run of ooxml.matchAll(/<w:r(?:\s[^>]*)?>(?<content>[\s\S]*?)<\/w:r>/gu)) {
    const content = run.groups?.content ?? "";
    const properties = content.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/u)?.[0] ?? "";
    const visibleText = [...content.matchAll(/<w:t(?:\s[^>]*)?>(?<value>[\s\S]*?)<\/w:t>/gu)]
      .map((node) => decodeXml(node.groups?.value ?? "")).join("");
    if (visibleText.trim()) weights.set(properties, (weights.get(properties) ?? 0) + visibleText.length);
  }
  return [...weights.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
}

export function buildStyledAppendOoxml(sourceOoxml: string, text: string): string | undefined {
  const body = sourceOoxml.match(/(?<open><w:body(?:\s[^>]*)?>)(?<content>[\s\S]*?)(?<close><\/w:body>)/u);
  const firstParagraph = sourceOoxml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/u)?.[0];
  if (!body?.groups || !firstParagraph) return undefined;
  const paragraphProperties = firstParagraph.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/u)?.[0]
    ?.replace(/<w:numPr(?:\s[^>]*)?>[\s\S]*?<\/w:numPr>/gu, "") ?? "";
  const runProperties = dominantRunProperties(sourceOoxml);
  const paragraphs = text.split(/\r\n|\r|\n/u).map((line) => {
    const preserve = /^\s|\s$/u.test(line) ? ' xml:space="preserve"' : "";
    return `<w:p>${paragraphProperties}<w:r>${runProperties}<w:t${preserve}>${escapeXml(line)}</w:t></w:r></w:p>`;
  }).join("");
  const sectionProperties = (body.groups.content ?? "").match(/<w:sectPr(?:\s[^>]*)?>[\s\S]*?<\/w:sectPr>/u)?.[0] ?? "";
  return sourceOoxml.slice(0, body.index!)
    + body.groups.open + paragraphs + sectionProperties + body.groups.close
    + sourceOoxml.slice(body.index! + body[0].length);
}
