# Document processing

The runtime contains deterministic document snapshots, 10,000-character Unicode-safe chunks, sequential processing, retry, cancellation, and map-reduce summary orchestration. A result is only available when every chunk from the immutable snapshot validates; cancellation or a chunk failure produces no applicable aggregate result.

The Word task-pane still exposes the established selection-only UI. Word’s current Office.js integration has no reliable logical-section abstraction in this project, so section/document reading and range-level apply UI remain pending rather than being represented as full Word-section support. Table, field, hyperlink, content-control, and revision handling must continue to use controlled fallback until that UI layer is added and manually accepted.
