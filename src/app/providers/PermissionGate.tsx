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
            // 1. Xin quyền Thông báo (Notification) - Nếu lỗi thì bỏ qua, không chặn
            if ('Notification' in window) {
                try {
                    await Notification.requestPermission();
                } catch (e) { console.warn("Lỗi xin quyền Noti:", e); }
            }

            // 2. Xin quyền Vị trí (GPS) - Bắt buộc
            try {
                await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        timeout: 10000, // Timeout sau 10s tránh treo app
                        enableHighAccuracy: false // Giảm độ khó để dễ được cấp quyền hơn
                    });
                });
            } catch (e) {
                console.warn("Lỗi GPS:", e);
                // Tùy quyết định Sếp: Có thể throw error để chặn, hoặc message warning rồi cho qua
                // Ở đây ta throw để bắt buộc phải có GPS nếu nghiệp vụ cần
                throw e; 
            }

            // 3. Xin quyền Mic & Camera (Media Stream) - XỬ LÝ MỀM DẺO
            try {
                // Thử xin cả 2
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                // Stop ngay
                stream.getTracks().forEach(track => track.stop());
            } catch (mediaError: any) {
                console.error("Lỗi Media:", mediaError);
                
                // Phân loại lỗi
                if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
                    // Nếu User bấm "Từ chối" -> Chặn luôn, bắt vào cài đặt bật lại
                    throw new Error("Bạn đã từ chối quyền Mic/Camera. Vui lòng vào Cài đặt để bật lại.");
                } else if (mediaError.name === 'NotReadableError') {
                    // [FIX LỖI CỦA SẾP]: Lỗi phần cứng/bận -> Cho qua nhưng cảnh báo
                    message.warning("Không thể khởi động Camera/Mic lúc này (Có thể đang được dùng bởi app khác). Bạn vẫn có thể vào App.");
                } else {
                    // Lỗi khác (VD: Không có Camera) -> Cho qua
                    message.warning("Thiết bị không hỗ trợ đầy đủ Mic/Camera.");
                }
            }

            // NẾU ĐẾN ĐƯỢC ĐÂY LÀ THÀNH CÔNG (Hoặc lỗi không nghiêm trọng)
            localStorage.setItem('app_permissions_granted', 'true');
            message.success("Thiết lập hoàn tất! Đang vào ứng dụng...");
            
            // Delay nhẹ để user đọc thông báo
            setTimeout(() => {
                 setIsGranted(true);
            }, 500);

        } catch (error: any) {
            console.error(error);
            let msg = "Vui lòng cấp quyền để tiếp tục!";
            
            if (error.message) msg = error.message;
            if (error.code === 1) msg = "Quyền Vị trí bị từ chối. Bắt buộc phải bật GPS để chấm công.";

            message.error({ content: msg, duration: 5 });
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
