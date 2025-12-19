// src/lib/firebaseClient.ts
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

// Cấu hình Firebase từ "két sắt" .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Khởi tạo ứng dụng Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo và export dịch vụ Messaging (FCM)
export const messaging = getMessaging(app);

// Export app để dùng cho các dịch vụ khác nếu cần
export default app;
