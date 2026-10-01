# דוד מדבר · David Speaks

אפליקציית תרגול דיבור (PWA, עברית, RTL) לילד בן 3 עם אפרקסיה. ההורה מקליט מילים ותמונות בפאנל הניהול, והילד משחק: רואה תמונה, שומע את ההקלטה, מנסה לומר את המילה ומקבל כוכב וחגיגה.

A Hebrew RTL speech-practice PWA for a toddler with childhood apraxia of speech. All data (pictures, recordings) stays on the device in IndexedDB.

## GitHub setup / הקמה ב-GitHub
1. Create a repo (e.g. `david`) and push this project to the `main` branch.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` builds and deploys. The URL will be `https://<user>.github.io/<repo>/`.

## Install on Android / התקנה באנדרואיד
- Open the URL in **Chrome** → menu ⋮ → **Add to Home screen / הוספה למסך הבית**.
- **Screen pinning tip / הצמדת מסך:** Settings → Security → App pinning (הצמדת אפליקציה). Open the app, open Recents, tap the app icon → Pin. This keeps the child inside the game.

## Backup reminder / גיבוי
הנתונים נשמרים רק במכשיר. מחיקת נתוני הדפדפן או החלפת טלפון תמחק את ההקלטות — **ייצאו גיבוי (ZIP) מפאנל הניהול באופן קבוע** ושמרו אותו בדרייב/מייל.
Data lives only on the device — export a ZIP backup from the admin panel regularly.

## Local development
```bash
npm install
npm run dev       # dev server
npm run build     # production build (base /david/, override with VITE_BASE)
npm run preview   # serve the build (with service worker)
```

## Attribution
Emoji graphics by [OpenMoji](https://openmoji.org/) – the open-source emoji and icon project. License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
