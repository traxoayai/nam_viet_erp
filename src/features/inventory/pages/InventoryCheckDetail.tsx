// src/features/inventory/pages/InventoryCheckDetail.tsx
import { useEffect, useRef } from 'react';
import { Layout, Button, Typography, InputNumber, Row, Col, Tag, Space, message, Modal } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, AudioOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useInventoryCheckStore } from '../stores/useInventoryCheckStore';
import { useAuth } from '@/app/contexts/AuthProvider';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { parseVoiceCommand } from '@/shared/utils/voiceUtils';

const { Header, Content, Footer } = Layout;
const { Text, Title } = Typography;

export const InventoryCheckDetail = () => {
    const navigate = useNavigate();
    const { id } = useParams(); 
    const { user } = useAuth();
    
    const { 
        items, activeSession, fetchSessionDetails, 
        updateItemQuantity, activeItemId, setActiveItem, moveToNextItem, completeSession,
        saveCheckInfo, cancelSession
    } = useInventoryCheckStore();

    // Ref để quản lý Auto-Scroll
    const itemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

    // Voice Simulation State - Now controlled by SpeechRecognition
    // const [isListening, setIsListening] = useState(false); // Removed manual state

    // 1. Load dữ liệu khi vào trang
    useEffect(() => {
        if (id) fetchSessionDetails(Number(id));
    }, [id]);

    // 2. Logic Auto-Scroll: Khi activeItemId đổi -> Cuộn tới đó
    useEffect(() => {
        if (activeItemId && itemRefs.current[activeItemId]) {
            itemRefs.current[activeItemId]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center', // Căn thẻ vào giữa màn hình điện thoại
            });
        }
    }, [activeItemId]);

    // --- VOICE LOGIC START ---
    const { 
        transcript, 
        listening, 
        resetTranscript, 
        browserSupportsSpeechRecognition,
        isMicrophoneAvailable 
    } = useSpeechRecognition();

    // Thêm useEffect để debug trạng thái Mic khi vào trang
    useEffect(() => {
        if (!browserSupportsSpeechRecognition) {
            console.error("Trình duyệt không hỗ trợ Speech Recognition");
            message.error("Thiết bị này không hỗ trợ nhận diện giọng nói!");
        }
        if (!isMicrophoneAvailable) {
            console.warn("Chưa tìm thấy Microphone hoặc chưa cấp quyền.");
        }
    }, [browserSupportsSpeechRecognition, isMicrophoneAvailable]);
    
    // Tự động bật Mic khi vào chế độ nghe
    const toggleListening = () => {
        if (listening) {
            console.log("User: Stop Listening");
            SpeechRecognition.stopListening();
        } else {
            console.log("User: Start Listening");
            resetTranscript();
            SpeechRecognition.startListening({ 
                language: 'vi-VN', 
                continuous: true 
            }).catch((err) => {
                console.error("Lỗi khởi động Mic:", err);
                message.error("Không thể bật Mic. Vui lòng kiểm tra quyền truy cập.");
            });
            
            message.info("Đang nghe... (Nói số lượng)");
        }
    };

    // Xử lý kết quả nhận dạng
    useEffect(() => {
        if (!transcript) return;

        // Debounce nhẹ để người dùng nói xong câu (500ms ngắt quãng)
        const timer = setTimeout(() => {
            const command = parseVoiceCommand(transcript);
            console.log("Voice Command:", command, "Text:", transcript);

            if (command.type === 'NEXT' || command.type === 'CONFIRM') {
                message.success('Đã xác nhận (Next)');
                moveToNextItem();
                resetTranscript();
            } 
            else if (command.type === 'UPDATE' && activeItemId) {
                // [FIX 1]: Ép kiểu 'any' để TypeScript nhận diện được box và unit
                const cmd = command as any;

                // Lấy item hiện tại để biết số cũ
                const currentItem = items.find(i => i.id === activeItemId);
                if (currentItem) {
                    const rate = currentItem.retail_unit_rate || 1;
                    const currentBox = Math.floor(currentItem.actual_quantity / rate);
                    const currentUnit = currentItem.actual_quantity % rate;

                    // [FIX 2]: Dùng biến 'cmd' thay vì 'command' & Logic check null chuẩn
                    const newBox = cmd.box != null ? cmd.box : currentBox;
                    const newUnit = cmd.unit != null ? cmd.unit : currentUnit;

                    updateItemQuantity(activeItemId, newBox, newUnit);
                    message.success(`Đã nhập: ${newBox} chẵn, ${newUnit} lẻ`);
                    
                    resetTranscript();
                }
            }
            else if (command.type === 'COMPLETE') {
                // onComplete(); // Tạm tắt để tránh rủi ro
                resetTranscript();
            }
        }, 800); // Đợi 800ms sau khi ngừng nói

        return () => clearTimeout(timer);
    }, [transcript, activeItemId, items]);
    // --- VOICE LOGIC END ---

    // --- SUB-COMPONENT: CARD SẢN PHẨM ---
    const ItemCard = ({ item }: { item: any }) => {
        const isActive = item.id === activeItemId;
        
        // Tính toán hiển thị Hộp/Lẻ từ tổng actual_quantity
        const rate = item.retail_unit_rate || 1;
        const boxQty = Math.floor(item.actual_quantity / rate);
        const unitQty = item.actual_quantity % rate;

        // Tính tồn máy để hiển thị tham khảo
        const sysBox = Math.floor(item.system_quantity / rate);
        const sysUnit = item.system_quantity % rate;

        return (
            <div 
                ref={(el) => { itemRefs.current[item.id] = el; }}
                onClick={() => setActiveItem(item.id)}
                style={{
                    marginBottom: 16,
                    border: isActive ? '2px solid #1890ff' : '1px solid #e8e8e8',
                    borderRadius: 12, // Bo tròn nhiều hơn cho giống Mobile App
                    padding: 16,
                    backgroundColor: isActive ? '#f0f5ff' : '#fff',
                    transition: 'all 0.3s',
                    transform: isActive ? 'scale(1.02)' : 'scale(1)', // Phóng to nhẹ khi focus
                    boxShadow: isActive ? '0 8px 16px rgba(24,144,255,0.2)' : '0 2px 4px rgba(0,0,0,0.05)'
                }}
            >
                {/* Header Card */}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 8}}>
                    <div style={{flex: 1}}>
                         {/* Vị trí in đậm to rõ */}
                        <Tag color="geekblue" style={{fontSize: 14, padding: '4px 8px', marginBottom: 6, fontWeight: 700}}>
                            📍 {item.location_snapshot || 'Chưa xếp vị trí'}
                        </Tag>
                        <Title level={5} style={{margin: 0, lineHeight: 1.3}}>{item.product_name}</Title>
                        <Text type="secondary" style={{fontSize: 12}}>Lô: {item.batch_code} | HSD: {item.expiry_date}</Text>
                    </div>
                </div>

                {/* Phần so sánh & Nhập liệu */}
                <div style={{background: '#fafafa', padding: 10, borderRadius: 8}}>
                    {/* Dòng Tồn máy (Reference) */}
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom: 8, fontSize: 13, color:'#888'}}>
                        <span>Tồn máy:</span>
                        <span><b>{sysBox}</b> {item.large_unit} {sysUnit > 0 && ` - ${sysUnit} ${item.unit}`}</span>
                    </div>

                    {/* Dòng Input (Nhập liệu kép) */}
                    <Row gutter={12}>
                        <Col span={12}>
                            <div style={{fontSize: 12, marginBottom: 4, fontWeight: 500}}>
                                SL {item.large_unit} (Chẵn)
                            </div>
                            <InputNumber 
                                type="number"
                                size="large" // Nút to dễ bấm
                                style={{width: '100%'}} 
                                value={boxQty}
                                min={0}
                                onChange={(val) => updateItemQuantity(item.id, val || 0, unitQty)}
                                // Khi active thì ô nhập sáng lên
                                className={isActive ? "input-active-glow" : ""}
                            />
                        </Col>
                        <Col span={12}>
                             <div style={{fontSize: 12, marginBottom: 4, fontWeight: 500}}>
                                SL {item.unit} (Lẻ)
                            </div>
                            <InputNumber 
                                type="number"
                                size="large" 
                                style={{width: '100%'}} 
                                value={unitQty}
                                min={0}
                                max={rate - 1} // Không cho nhập quá quy đổi lẻ
                                onChange={(val) => updateItemQuantity(item.id, boxQty, val || 0)}
                            />
                        </Col>
                    </Row>

                    {/* Dòng Chênh lệch (Feedback Real-time) */}
                    <div style={{marginTop: 8, textAlign:'right', height: 20}}>
                        {item.diff_quantity !== 0 ? (
                            <Text type={item.diff_quantity > 0 ? "success" : "danger"} strong>
                                {item.diff_quantity > 0 ? "Thừa" : "Thiếu"}: {item.diff_quantity > 0 ? "+" : ""}{item.diff_quantity} {item.unit}
                            </Text>
                        ) : (
                            <Text type="success" style={{fontSize: 12}}><CheckCircleOutlined /> Khớp số liệu</Text>
                        )}
                    </div>
                </div>

                {/* Voice Indicator (Chỉ hiện khi Active) */}
                {isActive && (
                    <div style={{marginTop: 8, textAlign:'center', color:'#1890ff', fontSize: 12, display:'flex', alignItems:'center', justifyContent:'center', gap: 6}}>
                        <AudioOutlined /> <span>{listening ? transcript || "Đang nghe..." : "Nhấn Mic để nói lệnh"}</span>
                    </div>
                )}
            </div>
        );
    };

    // Hàm xử lý hoàn tất
    const onComplete = () => {
        Modal.confirm({
            title: 'Hoàn tất kiểm kê?',
            content: 'Hệ thống sẽ cập nhật lại tồn kho theo số liệu bạn đã nhập. Hành động này không thể hoàn tác.',
            onOk: () => user && completeSession(user.id)
        });
    };

    // Logic Hủy
    const onCancelSession = () => {
        Modal.confirm({
            title: 'Hủy phiếu kiểm kê?',
            content: 'Dữ liệu đã nhập sẽ không được lưu vào kho. Hành động này không thể hoàn tác.',
            okText: 'Xác nhận Hủy',
            okType: 'danger',
            onOk: async () => {
                await cancelSession();
                message.success('Đã hủy phiếu');
                navigate('/inventory/stocktake'); // Quay về list
            }
        });
    };

    // Logic Lưu tạm (Chỉ lưu note, ko chốt kho)
    const onSaveDraft = () => {
        if (activeSession) {
            saveCheckInfo(activeSession.note || '');
        }
    };

    if (!browserSupportsSpeechRecognition) {
        // Fallback nếu trình duyệt không hỗ trợ
       // console.warn("Trình duyệt không hỗ trợ Speech Recognition");
    }

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            {/* HEADER */}
            <Header style={{ 
                background: '#fff', padding: '0 12px', display: 'flex', alignItems: 'center', 
                position: 'sticky', top: 0, zIndex: 100, borderBottom:'1px solid #ddd', height: 60, gap: 12
            }}>
                <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
                <div style={{
                    flex: 1, 
                    overflow:'hidden', 
                    display: 'flex',           // [MỚI]
                    flexDirection: 'column',   // [MỚI] Xếp dọc
                    justifyContent: 'center'   // [MỚI] Căn giữa theo chiều dọc
                    }}>
                    {/* SỬA style của div Tiêu đề */}
                    <div style={{
                        fontWeight: 700, 
                        fontSize: 16, 
                        whiteSpace:'nowrap', 
                        overflow:'hidden', 
                        textOverflow:'ellipsis',
                        lineHeight: '20px'     // [MỚI] Khống chế chiều cao dòng
                    }}>
                        {activeSession?.code || 'Đang tải...'}
                    </div>
                    
                    {/* SỬA style của Text Phụ đề */}
                    <Text type="secondary" style={{
                        fontSize: 11, 
                        lineHeight: '14px'     // [MỚI] Khống chế chiều cao dòng
                    }}>
                        {items.length} sản phẩm cần kiểm
                    </Text>
                </div>
                <Space>
                    {activeSession?.status === 'DRAFT' && (
                        <>
                            <Button 
                                danger 
                                icon={<CloseCircleOutlined />} 
                                onClick={onCancelSession}
                            >
                                Hủy
                            </Button>
                            
                            <Button 
                                icon={<SaveOutlined />} 
                                onClick={onSaveDraft}
                            >
                                Lưu tạm
                            </Button>

                            <Button 
                                type="primary" 
                                icon={<CheckCircleOutlined />} 
                                onClick={onComplete}
                            >
                                Hoàn tất
                            </Button>
                        </>
                    )}
                </Space>
            </Header>

            {/* CONTENT */}
            <Content style={{ padding: '12px', paddingBottom: 100 }}>
                {items.map(item => (
                    <ItemCard key={item.id} item={item} />
                ))}
            </Content>

            {/* VOICE FLOATING BUTTON */}
            <div style={{ position: 'fixed', bottom: 90, right: 20, zIndex: 999 }}>
                <Button 
                    type="primary" 
                    shape="circle" 
                    size="large" 
                    danger={listening} // Màu đỏ khi đang nghe
                    style={{
                        width: 64, height: 64, 
                        boxShadow: listening ? '0 0 15px rgba(255, 77, 79, 0.6)' : '0 6px 16px rgba(24, 144, 255, 0.4)', 
                        border: '2px solid #fff',
                        transition: 'all 0.3s'
                    }}
                    icon={<AudioOutlined style={{fontSize: 28}} />}
                    onClick={toggleListening}
                />
            </div>

            {/* FOOTER NAVIGATION */}
            <Footer style={{ 
                position: 'fixed', bottom: 0, width: '100%', 
                background: '#fff', borderTop: '1px solid #ddd', padding: '12px',
                display: 'flex', gap: 12, zIndex: 100
            }}>
                 <Button size="small" style={{flex: 1}} onClick={moveToNextItem}>
                    Bỏ qua (Next)
                 </Button>
                 <Button type="primary" size="small" style={{flex: 1, background: '#a0d911', borderColor:'#a0d911', color:'#fff', fontWeight:'bold'}} onClick={moveToNextItem}>
                    <CheckCircleOutlined /> Đủ / OK
                 </Button>
            </Footer>
        </Layout>
    );
};

export default InventoryCheckDetail;
