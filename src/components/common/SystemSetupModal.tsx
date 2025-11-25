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
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermission>(Notification.permission);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null); // Biến lưu sự kiện cài PWA

  useEffect(() => {
    // 1. Kiểm tra quyền Thông báo
    const checkPermission = () => {
      const status = Notification.permission;
      setPermissionStatus(status);

      // Nếu chưa cấp quyền HOẶC chưa cài App (logic cài app check sau), mở Modal
      if (status !== "granted") {
        setIsModalOpen(true);
        setCurrentStep(0); // Step 0: Xin quyền
      } else {
        // Nếu đã cấp quyền, kiểm tra xem có sự kiện cài App không
        // (Lưu ý: Nếu App đã cài rồi, deferredPrompt sẽ null -> Modal không hiện -> Tốt)
      }
    };

    checkPermission();

    // 2. Lắng nghe sự kiện cài đặt PWA (Chỉ Chrome/Android hỗ trợ tốt)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Nếu quyền thông báo ok rồi, mà chưa cài app -> Mở modal nhảy sang bước cài app
      if (Notification.permission === "granted") {
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
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission === "granted") {
        message.success("Đã cấp quyền thành công!");
        // Tự động chuyển bước hoặc đóng nếu không có PWA prompt
        if (deferredPrompt) {
          setCurrentStep(1);
        } else {
          // Nếu không thể cài App (ví dụ trên iOS hoặc đã cài), hiện bước Hoàn tất
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
              (Máy Sếp đã cài rồi hoặc không hỗ trợ tự động. Hãy nhấn "Tiếp
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

  // Nếu user đã làm xong hết (Quyền OK, ko còn prompt cài app), thì không render gì cả
  if (!isModalOpen) return null;

  return (
    <Modal
      title="⚙️ Thiết lập Hệ thống Nam Việt EMS"
      open={isModalOpen}
      footer={null} // Tắt footer mặc định để custom trong content
      closable={false} // Không cho tắt, bắt buộc làm
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

      {/* Nút Skip (Dành cho trường hợp kẹt - Tùy chọn) */}
      {currentStep === 1 && !deferredPrompt && (
        <div className="text-right mt-4">
          <Button onClick={() => setCurrentStep(2)}>Bỏ qua bước này</Button>
        </div>
      )}
    </Modal>
  );
};
