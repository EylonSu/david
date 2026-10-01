# דוד מדבר · David Speaks

אפליקציית תרגול דיבור (PWA, עברית, RTL) לילד בן 3 עם אפרקסיה. ההורה מקליט מילים ותמונות בפאנל הניהול, והילד משחק: רואה תמונה, שומע את ההקלטה, מנסה לומר את המילה ומקבל כוכב וחגיגה.

A Hebrew RTL speech-practice PWA for a toddler with childhood apraxia of speech. The app is offline-first: data lives in IndexedDB on the device and, after the parent signs in with Google in the admin panel, syncs to Firebase (Firestore for metadata, Cloud Storage for images/audio/video). The child mode never requires sign-in.

## Firebase setup / הקמה ב-Firebase (one-time)
Firebase is Google Cloud: a Firebase project is a GCP project. Everything below stays within the free tier.

1. **Project / פרויקט:** in the [Firebase console](https://console.firebase.google.com/) add Firebase to your existing GCP project (or create one) and register a **Web app** to get its config.
2. **Billing / חיוב:** switch to the **Blaze** plan. Then in GCP **Billing → Budgets & alerts** create a **$1** budget with alerts at 50%, 90% and 100%. Expected cost is $0; the alert catches anything unexpected.
3. **Auth / התחברות:** enable the **Google** provider. In Auth → Settings → Authorized domains add `<project>.web.app`. Use `<project>.web.app` as `authDomain` so sign-in stays on the same origin.
4. **Firestore:** create the `(default)` database in **`us-central1`**.
5. **Storage:** create the default bucket in **`us-central1`** (only US regions get the free tier). Replace `YOUR_PROJECT_ID` in `cors.json`, then apply it:
   ```bash
   gcloud storage buckets update gs://<bucket> --cors-file=cors.json
   ```
6. *(Optional)* In GCP → APIs & Services → Credentials, restrict the browser API key to the `https://<project>.web.app/*` HTTP referrer.
7. **Repo placeholders:** set your project id in `.firebaserc` (`YOUR_PROJECT_ID`) and your Gmail address in `firestore.rules` and `storage.rules` (`YOUR_EMAIL@gmail.com`). Only that account can read/write `users/{uid}/…`.
8. **Deploy rules / פריסת חוקים** (again whenever they change):
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules,storage
   ```

## GitHub setup / הקמה ב-GitHub
Every push to `main` builds and deploys to Firebase Hosting (`https://<project>.web.app`) via `.github/workflows/deploy.yml`.

1. **Secret:** create a service account key for Hosting deploys (easiest: `npx firebase-tools init hosting:github`, or GCP → IAM → Service accounts with the *Firebase Hosting Admin* role → JSON key). Save the JSON as repo secret **`FIREBASE_SERVICE_ACCOUNT`** (Settings → Secrets and variables → Actions → Secrets).
2. **Variables:** under Settings → Secrets and variables → Actions → **Variables**, add the Web app config (the workflow writes them to `.env` at build time):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN` (`<project>.web.app`)
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_APP_ID`

   This config is public by design; the security rules are what protect the data.
3. For local development copy `.env.example` to `.env` and fill in the same values.

## Migrating existing data / העברת נתונים מ-GitHub Pages
The move from GitHub Pages to `web.app` is a new origin, so browser storage does not carry over.

1. On the device that has the data, open the old GitHub Pages app and **export a ZIP backup** from the admin panel.
2. Open `https://<project>.web.app`, add it to the home screen again, and **import the ZIP**.
3. In the admin panel → **סנכרון**, sign in with Google. Everything is pushed to the cloud.
4. On other devices, just open the app and sign in.
5. Disable GitHub Pages (repo **Settings → Pages**).

## Install on Android / התקנה באנדרואיד
- Open the URL in **Chrome** → menu ⋮ → **Add to Home screen / הוספה למסך הבית**.
- **Screen pinning tip / הצמדת מסך:** Settings → Security → App pinning (הצמדת אפליקציה). Open the app, open Recents, tap the app icon → Pin. This keeps the child inside the game.

## Sync & backup / סנכרון וגיבוי
אחרי התחברות עם Google בפאנל הניהול, התמונות, ההקלטות, השיעורים וההגדרות מסונכרנים לענן ובין המכשירים. האפליקציה ממשיכה לעבוד גם בלי אינטרנט, והשינויים נשלחים כשהחיבור חוזר. גיבוי ZIP עדיין זמין כרשת ביטחון נוספת.
After signing in, data syncs to Firebase and across devices; offline changes are pushed when the device is back online (last write wins). ZIP export/import remains as an extra safety net, and importing a ZIP also syncs to the cloud.

## Local development
```bash
npm install
npm run dev       # dev server
npm run build     # production build (base /, override with VITE_BASE)
npm run preview   # serve the build (with service worker)
```

## Attribution
Emoji graphics by [OpenMoji](https://openmoji.org/) – the open-source emoji and icon project. License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Background removal uses [MediaPipe](https://github.com/google-ai-edge/mediapipe) (tasks-vision + Selfie Segmenter model) by Google. License: [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0).

Noise suppression uses [RNNoise](https://github.com/xiph/rnnoise) by Xiph.Org / Jean-Marc Valin, via [@shiguredo/rnnoise-wasm](https://github.com/shiguredo/rnnoise-wasm). License: [BSD 3-Clause](https://github.com/xiph/rnnoise/blob/master/COPYING).
