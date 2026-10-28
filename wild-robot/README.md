# The Wild Robot: chapter comprehension

Year 4 comprehension quizzes for *The Wild Robot* by Peter Brown, aligned to NSW English K–10 (Stage 2). Students need their own copy of the novel; the site does not reproduce the book's text.

**First time? Follow [SETUP.md](SETUP.md).**

## How a quiz works

1. **Find it first.** Each question gives a clue. The student finds the sentence in their book, chooses its page and types its first three words. Wrong tries get stronger clues, but the sentence is never revealed, and the answers stay locked until they find it.
2. **Answer.** A wrong answer gets a clue, not the correct answer, and the student tries again until they get it right. Marks are only earned on the first try.
3. **Written responses** are marked by the teacher on `teacher.html`.

Every chapter covers six reading skills: locating directly stated information, connecting ideas, vocabulary in context, main idea or purpose, inferring character feelings or motives, and analysing text structure and language features.

## Files

| File | What it is |
|---|---|
| `index.html` | Chapter list (student home page) |
| `chapter-50.html`, `chapter-51.html` | One page per chapter: the questions are in the `window.CHAPTER` block |
| `chapters-53-55-57.html` | Combined page for Chapters 53 and 55–57 (see below) |
| `quiz.js`, `quiz.css` | Shared quiz engine and styles |
| `config.js` | Settings: Google Apps Script URL and optional class list |
| `teacher.html`, `teacher.js` | Teacher results page (needs the teacher key) |
| `apps-script/Code.gs` | Google Apps Script that saves results to a Google Sheet |

## Adding a chapter

Copy a chapter page, rename it (e.g. `chapter-52.html`), update the banner and the `window.CHAPTER` data, then add a link on `index.html`. The teacher page picks up new chapters automatically.

## Combining chapters on one page

`chapters-53-55-57.html` shows how. In the `window.CHAPTER` block:

- `number` is the first chapter (53). Results save and group under this number, so don't also make a separate page with the same number.
- `label` (e.g. `"Chapters 53 & 55–57"`) replaces "Chapter 53" on the student and teacher pages.
- `parts` lists each chapter with its own title and pages.
- Each question has `part: 55` (etc.). Its page buttons only show that chapter's pages, and the question shows which chapter it is about. Questions that cover several chapters use `parts: "Chapters 55–57"` instead and show every page.

