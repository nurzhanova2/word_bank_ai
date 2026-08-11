function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function replaceParagraphText(paragraph: string, text: string): string | undefined {
  let replacedFirst = false;
  const replaced = paragraph.replace(
    /<w:t(?<attributes>\s[^>]*)?>[\s\S]*?<\/w:t>/gu,
    (_full, _attributes, _offset, _input, groups?: { attributes?: string }) => {
      const attributes = groups?.attributes ?? "";
      if (replacedFirst) return `<w:t${attributes}></w:t>`;
      replacedFirst = true;
      const withWhitespace = /\bxml:space=/u.test(attributes) ? attributes : `${attributes} xml:space="preserve"`;
      return `<w:t${withWhitespace}>${escapeXml(text)}</w:t>`;
    }
  );
  return replacedFirst ? replaced : undefined;
}

export function replaceParagraphTextInOoxml(ooxml: string, resultText: string): string | undefined {
  const paragraphs = [...ooxml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu)];
  const lines = resultText.replaceAll("\r\n", "\n").split("\n");
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
