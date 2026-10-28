# Wild Robot comprehension: setup

The site runs on GitHub Pages. Student results save to a Google Sheet in your school Google account. Setup takes about 15 minutes and only needs doing once.

## 1. Turn on GitHub Pages

1. In this repository on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose the **main** branch and the **/ (root)** folder, then click **Save**.
4. After a minute or two, the page shows your site address. It looks like `https://justinfraser-create.github.io/english/`.

Students use **https://justinfraser-create.github.io/english/wild-robot/**. Your teacher results page is **https://justinfraser-create.github.io/english/wild-robot/teacher.html**. It is not linked from the student pages.

## 2. Create the results Google Sheet

1. Sign in to Google with your school account and create a new, blank Google Sheet. Name it something like *Wild Robot results*.
2. In the Sheet, open **Extensions → Apps Script**.
3. Delete the starter code. Copy everything from `wild-robot/apps-script/Code.gs` in this repository and paste it in. Click **Save**.
4. Set your teacher key:
   - Click **Project Settings** (the cog on the left).
   - Under **Script properties**, click **Add script property**.
   - Property: `TEACHER_KEY`. Value: a password only you know (not one you use anywhere else).
   - Click **Save script properties**.
5. Deploy the script:
   - Click **Deploy → New deployment**.
   - Click the cog beside **Select type** and choose **Web app**.
   - **Execute as:** *Me*.
   - **Who has access:** *Anyone*.
   - Click **Deploy**. Google asks you to authorise the script: choose your account, then **Advanced → Go to (project name)** and **Allow**.
6. Copy the **Web app URL**. It ends in `/exec`.

> If **Anyone** isn't offered under *Who has access*, your school's Google admin has restricted it. Ask them to allow it for this script. Without it, results can't save from students' devices.

## 3. Connect the site to the Sheet

1. In this repository, open `wild-robot/config.js` and click the pencil icon to edit it.
2. Paste the web app URL between the quotation marks: `scriptUrl: "https://script.google.com/macros/s/.../exec",`
3. Optional, but recommended: add your class list so students choose their name instead of typing it, which keeps results tidy: `classList: ["Ava", "Ben", "Chloe"]`
4. Click **Commit changes**. The live site updates within a minute or two.

## 4. Check it works

1. Open the site, do Chapter 50 yourself, and finish it. The results screen should say **"Your results have been sent to your teacher."**
2. Open the Google Sheet. A **Results** tab appears with your row.
3. Open `teacher.html`, enter your teacher key and check your result appears.
4. Delete your test row from the Sheet when you're done.

## Using the teacher results page

- Pick a chapter to see each student's computer-marked score, how they went in each of the six reading skills, and whether their written answers still need marking.
- Select a student to see every answer: first answers, number of tries, and whether they needed clues to find the evidence.
- Enter written-answer marks there and click **Save written marks**. The total updates, and the marks are saved in the Sheet.
- **Questions to re-teach** lists the five questions with the fewest correct first answers, with the most common wrong answer.
- Scores in the class averages use each student's first try at a chapter. Repeat tries are labelled **Try 2**, **Try 3** and so on.
- **Lock** forgets the teacher key on that device.

## Changing the script later

After you edit `Code.gs`, use **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. This keeps the same web app URL, so `wild-robot/config.js` doesn't need changing.

## Privacy

- Results contain students' first names and answers. They are stored only in your Google Sheet.
- The GitHub repository is public, but it holds no student data.
- The teacher page and the Sheet's data are protected by your teacher key. Check your school's policy on storing student work in Google Sheets.
