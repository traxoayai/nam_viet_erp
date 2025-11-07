// src/App.tsx
import { useEffect } from "react";
import { useRoutes } from "react-router-dom";

import routes from "./router";
import { useAuthStore } from "./stores/authStore";

import { supabase } from "@/lib/supabaseClient";

function App() {
  const element = useRoutes(routes);
  const { setSession, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // 1. Lấy session hiện tại ngay khi app tải
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Lắng nghe mọi thay đổi về Auth (Login, Logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // Dọn dẹp listener khi component bị hủy
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return <>{element}</>;
}

export default App;
