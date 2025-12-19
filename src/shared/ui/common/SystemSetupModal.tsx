// src/components/common/SystemSetupModal.tsx
import {
  BellOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Modal, Button, Steps, Typography, message, Result } from "antd";
import React, { useEffect, useState } from "react";

const { Text, Paragraph } = Typography;

export const SystemSetupModal: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // --- SỬA LỖI TẠI ĐÂY ---
  // Thay vì: const [permissionStatus, setPermissionStatus] = ...
  // Ta dùng dấu phẩy "," để bỏ qua biến đầu tiên, chỉ lấy hàm setPermissionStatus
  const [, setPermissionStatus] = useState<string>("default");

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Kiểm tra quyền Thông báo
    const checkPermission = () => {
      // Kiểm tra an toàn: Nếu trình duyệt không hỗ trợ Notification thì thôi
      if (typeof Notification === "undefined") return;

      const status = Notification.permission;
      setPermissionStatus(status); // Cập nhật state để trigger re-render

      // Nếu chưa cấp quyền, mở Modal
      if (status !== "granted") {
        setIsModalOpen(true);
        setCurrentStep(0); // Step 0: Xin quyền
      } else {
        // Quyền đã OK, chờ sự kiện cài App
      }
    };

    checkPermission();

    // 2. Lắng nghe sự kiện cài đặt PWA
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Nếu quyền thông báo ok rồi, mà chưa cài app -> Mở modal nhảy sang bước cài app
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        setIsModalOpen(true);
        setCurrentStep(1);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  // HÀNH ĐỘNG 1: XIN QUYỀN THÔNG BÁO
  const requestNotificationPermission = async () => {
    try {
      if (typeof Notification === "undefined") {
        message.error("Trình duyệt không hỗ trợ thông báo.");
        return;
      }

      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission === "granted") {
        message.success("Đã cấp quyền thành công!");
        // Tự động chuyển bước hoặc đóng
        if (deferredPrompt) {
          setCurrentStep(1);
        } else {
          setCurrentStep(2);
        }
      } else {
        message.error(
          "Sếp đã chặn quyền. Vui lòng mở cài đặt trình duyệt để Reset."
        );
      }
    } catch (error) {
      console.error("Lỗi xin quyền:", error);
    }
  };

  // HÀNH ĐỘNG 2: CÀI APP
  const installPWA = async () => {
    if (!deferredPrompt) {
      message.info(
        "Trình duyệt này không hỗ trợ cài tự động hoặc App đã được cài."
      );
      setCurrentStep(2);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setCurrentStep(2);
    }
  };

  // HÀNH ĐỘNG 3: RELOAD
  const handleReload = () => {
    window.location.reload();
  };

  const steps = [
    {
      title: "Cấp Quyền",
      icon: <BellOutlined />,
      content: (
        <div className="text-center py-4">
          <Paragraph>
            Hệ thống cần quyền <b>Thông báo</b> để báo tin đơn hàng tức thì.
          </Paragraph>
          <Button
            type="primary"
            onClick={requestNotificationPermission}
            size="large"
            icon={<BellOutlined />}
          >
            Cho phép Thông báo
          </Button>
        </div>
      ),
    },
    {
      title: "Cài Ứng Dụng",
      icon: <DownloadOutlined />,
      content: (
        <div className="text-center py-4">
          <Paragraph>
            Cài đặt <b>Nam Việt EMS</b> ra màn hình chính để dùng như App thật
            (Full màn hình, mượt hơn).
          </Paragraph>
          {deferredPrompt ? (
            <Button
              type="primary"
              onClick={installPWA}
              size="large"
              icon={<DownloadOutlined />}
            >
              Cài đặt ngay
            </Button>
          ) : (
            <Text type="secondary">
              (Máy Bạn đã cài rồi hoặc không hỗ trợ tự động. Hãy nhấn "Tiếp
              tục")
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Hoàn tất",
      icon: <CheckCircleOutlined />,
      content: (
        <div className="text-center py-4">
          <Result
            status="success"
            title="Sẵn sàng hoạt động!"
            subTitle="Vui lòng khởi động lại để áp dụng mọi thay đổi."
            extra={[
              <Button
                type="primary"
                key="console"
                onClick={handleReload}
                icon={<ReloadOutlined />}
              >
                Khởi động lại ngay
              </Button>,
            ]}
          />
        </div>
      ),
    },
  ];

  if (!isModalOpen) return null;

  return (
    <Modal
      title="⚙️ Thiết lập Hệ thống Nam Việt EMS"
      open={isModalOpen}
      footer={null}
      closable={false}
      maskClosable={false}
      centered
    >
      <Steps
        current={currentStep}
        items={steps.map((s) => ({ title: s.title, icon: s.icon }))}
      />

      <div className="mt-6 border border-gray-100 rounded-lg p-4 bg-gray-50">
        {steps[currentStep].content}
      </div>

      {/* Nút Skip */}
      {currentStep === 1 && !deferredPrompt && (
        <div className="text-right mt-4">
          <Button onClick={() => setCurrentStep(2)}>Bỏ qua bước này</Button>
        </div>
      )}
    </Modal>
  );
};
