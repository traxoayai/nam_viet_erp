// src/contexts/AuthProvider.tsx
import { Session, User } from "@supabase/supabase-js";
import { Spin } from "antd";
import React, { createContext, useContext, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Lấy session ban đầu (Chạy 1 lần duy nhất)
    const initSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Auth Init Error:", error);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // 2. Lắng nghe sự kiện (Singleton Listener)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Chỉ cập nhật nếu session thực sự thay đổi để tránh re-render thừa
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#f0f2f5",
        }}
      >
        <Spin size="large" tip="Đang kết nối hệ thống..." />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth phải dùng trong AuthProvider");
  }
  return context;
};
