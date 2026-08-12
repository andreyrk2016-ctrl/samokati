# Как включить настоящие аккаунты и вход через Google (Firebase)

Сейчас профиль покупателя сохраняется только в его браузере.
Чтобы аккаунты работали с любого устройства и появился вход через
Google — подключите бесплатную базу Firebase (это сервис Google).
Займёт ~5 минут.

## Шаги

1. Откройте **console.firebase.google.com** и войдите в свой Google-аккаунт.
2. **Create a project** → любое название (например `proscooter`) →
   Google Analytics можно выключить → Create.
3. Слева **Build → Authentication → Get started**:
   - включите **Google** (Enable → выберите свою почту → Save);
   - включите **Email/Password** (Enable → Save).
4. Там же вкладка **Settings → Authorized domains → Add domain** →
   добавьте адрес сайта: `andreyrk2016-ctrl.github.io`
5. Слева **Build → Firestore Database → Create database** →
   режим **Production** → Next → Enable. Затем вкладка **Rules**,
   замените текст на этот и нажмите Publish:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /favorites/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

6. Шестерёнка (Project settings) → внизу **Your apps** → значок `</>`
   (Web) → любое имя → Register app. Появится код с `firebaseConfig` —
   **скопируйте его целиком и пришлите Клоду** (это публичные ключи,
   их можно показывать).

После этого в файл `firebase-config.js` вписывается ваш конфиг —
и вход через Google + синхронизация «Моих товаров» заработают сами.
