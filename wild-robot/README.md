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
| `chapter-53.html` | One page per chapter (same format as Chapters 50 and 51) |
| `chapters-55-57.html` | One question set for the independent reading group Chapters 55–57 |
| `quiz.js`, `quiz.css` | Shared quiz engine and styles |
| `config.js` | Settings: Google Apps Script URL and optional class list |
| `teacher.html`, `teacher.js` | Teacher results page (needs the teacher key) |
| `apps-script/Code.gs` | Google Apps Script that saves results to a Google Sheet |

## Adding a chapter

Copy a chapter page, rename it (e.g. `chapter-52.html`), update the banner and the `window.CHAPTER` data, then add a link on `index.html`. The teacher page picks up new chapters automatically.

