# Word acceptance checklist

Automated coverage is recorded in the test suite. The following Microsoft Word checks require a real desktop Word session and are therefore **NOT RUN** in this environment.

| ID | Scenario | Input | Expected | Automated coverage | Manual status |
| -- | -- | -- | -- | -- | -- |
| W01 | Rewrite | RU paragraph | Preview, then explicit replace | transform contract | NOT RUN |
| W02 | Shorten | EN paragraph | Shorter preview, explicit replace | result gates | NOT RUN |
| W03 | Formalize | business text | Meaning preserved | prompt/result tests | NOT RUN |
| W04 | Translate | RU to KK | Protected data preserved | translation tests | NOT RUN |
| W05 | Expand | short text | No invented requisites | result tests | NOT RUN |
| W06 | Tone | neutral text | Selected tone preview | registry tests | NOT RUN |
| W07 | Summary | multi-paragraph | Styled append after selection | OOXML tests | NOT RUN |
| W08 | Grammar RU | one error | Individual fix available | grammar tests | NOT RUN |
| W09 | Grammar EN | one error | Individual fix available | grammar tests | NOT RUN |
| W10 | Grammar KK | Hunspell candidate | Review-only, never auto-applied | grammar tests | NOT RUN |
| W11 | Grammar mixed | RU + KK + EN | Global offsets stay correct | language tests | NOT RUN |
| W12 | Fix all | multiple fixes | Right-to-left application | diff tests | NOT RUN |
| W13 | Reject | partial grammar fixes | Original selection restored | UI flow | NOT RUN |
| W14 | Bold | bold run | Bold remains scoped | OOXML test | NOT RUN |
| W15 | Italic | italic run | Italic remains scoped | OOXML test | NOT RUN |
| W16 | Mixed formatting | multiple runs | Runs remain formatted | OOXML test | NOT RUN |
| W17 | Font/color | styled paragraph | Style retained | Word style tests | NOT RUN |
| W18 | Alignment | centered paragraph | Alignment retained | Word style tests | NOT RUN |
| W19 | Indentation | indented paragraph | Indentation retained | Word style tests | NOT RUN |
| W20 | Spacing | custom spacing | Spacing retained | Word style tests | NOT RUN |
| W21 | Multiple paragraphs | paragraph selection | Count retained or safe fallback | OOXML tests | NOT RUN |
| W22 | Table cell | formatted cell | No corruption or clear error | manual regression | NOT RUN |
| W23 | Hyperlink | linked text | No corruption or clear error | manual regression | NOT RUN |
| W24 | Field/content control | controlled text | No corruption or clear error | manual regression | NOT RUN |
| W25 | Tracked revisions | revised text | No corruption or clear error | manual regression | NOT RUN |
