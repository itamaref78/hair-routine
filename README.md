# שגרת צמיחה – PWA

קבצים סטטיים בלבד (ללא build). להרצה מקומית:

    cd hair-app && python3 -m http.server 8080

להתקנה בטלפון יש להגיש מ-HTTPS (למשל GitHub Pages / Netlify / Cloudflare Pages) ולפתוח בדפדפן ← "התקן אפליקציה" / "הוסף למסך הבית".

- `index.html`, `styles.css`, `content.js` (תוכן מדריך + פרוטוקול), `app.js` (לוגיקה)
- `sw.js` – Service Worker (Offline, התראות, periodic sync)
- `manifest.webmanifest`, `icons/`, `fonts/` (Heebo מקומי – עובד ללא אינטרנט)
- נתונים: localStorage (מעקב והגדרות) + IndexedDB (תמונות) – הכל נשאר במכשיר.
- לשינוי גרסה/רענון מטמון: עדכן `VERSION` ב-`sw.js`.
