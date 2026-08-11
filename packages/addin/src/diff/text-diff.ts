interface WordToken {
  value: string;
  start: number;
  end: number;
}

export function wordTokens(text: string): WordToken[] {
  return [...text.matchAll(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)].map((match) => ({
    value: match[0],
    start: match.index,
    end: match.index + match[0].length
  }));
}

export function changedResultWordIndexes(source: string, result: string): Set<number> {
  const sourceWords = wordTokens(source);
  const resultWords = wordTokens(result);
  const unchanged = new Set<number>();
  const lookAhead = 12;
  let sourceIndex = 0;
  let resultIndex = 0;

  while (sourceIndex < sourceWords.length && resultIndex < resultWords.length) {
    const sourceWord = sourceWords[sourceIndex]!;
    const resultWord = resultWords[resultIndex]!;
    if (sourceWord.value === resultWord.value) {
      unchanged.add(resultIndex);
      sourceIndex += 1;
      resultIndex += 1;
      continue;
    }
    const sourceMatch = sourceWords.slice(sourceIndex + 1, sourceIndex + lookAhead + 1)
      .findIndex((token) => token.value === resultWord.value);
    const resultMatch = resultWords.slice(resultIndex + 1, resultIndex + lookAhead + 1)
      .findIndex((token) => token.value === sourceWord.value);
    if (resultMatch >= 0 && (sourceMatch < 0 || resultMatch <= sourceMatch)) resultIndex += 1;
    else if (sourceMatch >= 0) sourceIndex += 1;
    else {
      sourceIndex += 1;
      resultIndex += 1;
    }
  }
  return new Set(resultWords.map((_token, index) => index).filter((index) => !unchanged.has(index)));
}
