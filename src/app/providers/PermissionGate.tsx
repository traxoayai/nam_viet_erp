//src/app/providers/PermissionGate.tsx
import React, { useState, useEffect } from 'react';
import { Button, Card, Typography, Space, message } from 'antd';
import { EnvironmentOutlined, AudioOutlined, CameraOutlined, BellOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export const PermissionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Chỉ check trên Mobile hoặc PWA. Trên Desktop có thể nới lỏng nếu muốn.
    // Tạm thời check tất cả để đảm bảo quy trình.
    const [isGranted, setIsGranted] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Kiểm tra xem đã từng cấp quyền chưa (Lưu flag trong localStorage để đỡ hỏi lại mỗi lần F5)
        const hasPermissions = localStorage.getItem('app_permissions_granted');
        if (hasPermissions === 'true') {
            setIsGranted(true);
        }
    }, []);

    const requestAllPermissions = async () => {
        setLoading(true);
        try {
            // 1. Xin quyền Thông báo (Notification)
            if ('Notification' in window) {
                try {
                    await Notification.requestPermission();
                } catch (e) { console.warn("Lỗi xin quyền Noti:", e); }
            }

            // 2. Xin quyền Vị trí (GPS) - [FIX QUAN TRỌNG: KHÔNG CHẶN NẾU LỖI]
            try {
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        timeout: 5000, // Giảm xuống 5s cho nhanh
                        enableHighAccuracy: false
                    });
                });
            } catch (e: any) {
                console.warn("Lỗi GPS:", e);
                // Thay vì chặn (throw e), ta chỉ thông báo và cho qua
                let gpsMsg = "Không lấy được vị trí. Một số tính năng Check-in có thể bị hạn chế.";
                
                if (e.code === 1) { // User denied
                    gpsMsg = "Bạn đã chặn quyền Vị trí. Hãy bật lại trong Cài đặt Safari.";
                }
                
                message.warning({ content: gpsMsg, duration: 4 });
                // KHÔNG throw e ở đây nữa!
            }

            // 3. Xin quyền Mic & Camera (Media Stream)
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                stream.getTracks().forEach(track => track.stop());
            } catch (mediaError: any) {
                console.error("Lỗi Media:", mediaError);
                
                // Vẫn ưu tiên cảnh báo, nhưng không chặn cửa vào App trừ khi Sếp yêu cầu gắt gao
                // Ở đây ta soft-fail luôn cho chắc ăn trên các dòng máy lạ
                if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
                     message.error("Thiếu quyền Mic/Camera. Tính năng Voice/Scan sẽ không hoạt động.");
                } else if (mediaError.name === 'NotReadableError') {
                     message.warning("Thiết bị đang bận (Mic/Cam). Vui lòng thử lại sau.");
                } else {
                     message.warning("Không thể truy cập Mic/Camera.");
                }
            }

            // NẾU CHẠY ĐẾN ĐÂY LÀ ĐÃ CỐ GẮNG HẾT SỨC -> CHO VÀO APP
            localStorage.setItem('app_permissions_granted', 'true');
            message.success("Thiết lập hoàn tất! Đang vào ứng dụng...");
            
            setTimeout(() => {
                 setIsGranted(true);
            }, 500);

        } catch (error: any) {
            // Khối này chỉ chạy nếu có lỗi hệ thống nghiêm trọng khác ngoài các khối try/catch con ở trên
            console.error(error);
            message.error({ content: "Lỗi khởi tạo: " + (error.message || "Không xác định"), duration: 5 });
        } finally {
            setLoading(false);
        }
    };

    if (isGranted) {
        return <>{children}</>;
    }

    return (
        <div style={{
            height: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            background: '#f0f2f5',
            padding: 20
        }}>
            <Card style={{ width: '100%', maxWidth: 400, textAlign: 'center', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <SafetyCertificateOutlined style={{ fontSize: 64, color: '#1890ff', marginBottom: 24 }} />
                <Title level={3}>Yêu cầu Truy cập</Title>
                <Paragraph type="secondary">
                    Để Nam Việt EMS hoạt động chính xác, ứng dụng cần các quyền sau:
                </Paragraph>

                <div style={{ textAlign: 'left', margin: '24px 0', background: '#fafafa', padding: 16, borderRadius: 8 }}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Space><AudioOutlined style={{color: '#1890ff'}}/> <Text strong>Micro:</Text> Nhập liệu bằng giọng nói.</Space>
                        <Space><CameraOutlined style={{color: '#faad14'}}/> <Text strong>Camera:</Text> Quét mã vạch sản phẩm.</Space>
                        <Space><BellOutlined style={{color: '#f5222d'}}/> <Text strong>Thông báo:</Text> Nhận tin tức quan trọng.</Space>
                        <Space><EnvironmentOutlined style={{color: '#52c41a'}}/> <Text strong>Vị trí:</Text> Xác thực địa chỉ Kho và KH.</Space>
                    </Space>
                </div>

                <Button 
                    type="primary" 
                    size="large" 
                    block 
                    onClick={requestAllPermissions} 
                    loading={loading}
                    style={{ height: 48, fontSize: 16, borderRadius: 8 }}
                >
                    Cho phép & Tiếp tục
                </Button>
                
                <div style={{ marginTop: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Nếu không thể nhấn nút, vui lòng kiểm tra Cài đặt quyền riêng tư trên thiết bị.
                    </Text>
                </div>
            </Card>
        </div>
    );
};
