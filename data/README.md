# PYQ Data Store

This folder is the local database output for the extraction app.

- `questions.json` is the editable canonical store used by the app.
- `questions.ndjson` is an import-friendly export: one complete question object per line.
- `assets/` stores uploaded question figures. Figure records keep their relative URLs, placement, alt text, captions, and inline/below-text positioning.

The schema is intentionally exam-agnostic. `sourceExam` starts as `JEE Advanced`, but future exams can be added by changing `exam`, `year`, `paper`, and source metadata without changing the app structure.
