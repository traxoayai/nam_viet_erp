// src/components/layouts/OnboardingLayout.tsx
import { Layout } from "antd";
import { Outlet } from "react-router-dom";
// XÓA: import OnboardingGatekeeper from "@/components/auth/OnboardingGatekeeper";

const OnboardingLayout: React.FC = () => {
  return (
    // XÓA BỎ Gatekeeper
    <Layout style={{ minHeight: "100vh" }}>
            <Outlet />   {" "}
    </Layout>
  );
};

export default OnboardingLayout;
