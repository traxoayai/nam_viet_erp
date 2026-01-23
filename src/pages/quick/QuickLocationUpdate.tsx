import { useState, useEffect, useRef } from 'react';
import { Layout, Input, Table, Typography, Button, message, Tag, Avatar, Select, Modal, List, Card, Grid, Space } from 'antd'; 
import { SearchOutlined, BarcodeOutlined, ArrowLeftOutlined, EnvironmentOutlined, HomeOutlined, AudioOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import { posService } from '@/features/pos/api/posService';
import { inventoryService } from '@/features/inventory/api/inventoryService';
import { WarehousePosData } from '@/features/pos/types/pos.types';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { parseLocationVoice } from '@/shared/utils/voiceUtils'; // Đảm bảo file này đã tạo ở bước trước

const { Header, Content } = Layout;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

// --- Component LocationCell ---
const LocationCell = ({ productId, warehouseId, initialVal, isMobile = false, onComplete, onVoiceStart, isListening }: any) => {
    const [val, setVal] = useState({ 
        c: initialVal.cabinet || '', 
        r: initialVal.row || '', 
        s: initialVal.slot || '' 
    });
    const [saving, setSaving] = useState(false);

    // Sync props -> state
    useEffect(() => {
        setVal({ 
            c: initialVal.cabinet || '', 
            r: initialVal.row || '', 
            s: initialVal.slot || '' 
        });
    }, [initialVal]);

    const handleSave = async (newVal = val) => {
        // Check change
        if (newVal.c === initialVal.cabinet && newVal.r === initialVal.row && newVal.s === initialVal.slot) return true;
        
        setSaving(true);
        try {
            await inventoryService.updateProductLocation(warehouseId, productId, {
                cabinet: newVal.c, row: newVal.r, slot: newVal.s
            });
            message.success({ content: 'Đã lưu vị trí!', key: 'loc_save', duration: 1 });
            return true;
        } catch {
            message.error('Lỗi lưu!');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = async (e: any) => {
        if (e.key === 'Enter') {
            const success = await handleSave();
            if (success && onComplete) onComplete(); 
        }
    };

    const inputStyle = { 
        width: isMobile ? 60 : 50,
        textAlign: 'center' as const, 
        backgroundColor: saving ? '#fffbe6' : '#fff',
        fontWeight: 500,
        padding: '4px 0'
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* 3 Ô Input */}
            <div style={{display:'flex', gap: 4, alignItems:'center'}}>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    {isMobile && <Text type="secondary" style={{fontSize: 9}}>Tủ</Text>}
                    <Input placeholder="Tủ" value={val.c} onChange={e => setVal({...val, c: e.target.value.toUpperCase()})} onBlur={() => handleSave(val)} onKeyDown={handleKeyDown} style={inputStyle} size={isMobile ? "middle" : "small"} />
                </div>
                <span style={{color:'#ccc', marginTop: isMobile ? 14 : 0}}>-</span>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    {isMobile && <Text type="secondary" style={{fontSize: 9}}>Tầng</Text>}
                    <Input placeholder="Tầng" value={val.r} onChange={e => setVal({...val, r: e.target.value.toUpperCase()})} onBlur={() => handleSave(val)} onKeyDown={handleKeyDown} style={inputStyle} size={isMobile ? "middle" : "small"} />
                </div>
                <span style={{color:'#ccc', marginTop: isMobile ? 14 : 0}}>-</span>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    {isMobile && <Text type="secondary" style={{fontSize: 9}}>Ô</Text>}
                    <Input placeholder="Ô" value={val.s} onChange={e => setVal({...val, s: e.target.value.toUpperCase()})} onBlur={() => handleSave(val)} onKeyDown={handleKeyDown} style={inputStyle} size={isMobile ? "middle" : "small"} />
                </div>
            </div>

            {/* Nút Mic */}
            <Button 
                type={isListening ? "primary" : "text"} 
                danger={isListening}
                shape="circle" 
                size={isMobile ? "large" : "middle"}
                icon={<AudioOutlined spin={isListening} />} 
                style={{ marginLeft: 4, marginTop: isMobile ? 12 : 0 }}
                onClick={onVoiceStart}
            />
        </div>
    );
};

export const QuickLocationUpdate = () => {
    const navigate = useNavigate();
    const screens = useBreakpoint();
    const isDesktop = screens.md; 

    const [warehouses, setWarehouses] = useState<WarehousePosData[]>([]);
    const [warehouseId, setWarehouseId] = useState<number>(1); 

    const [searchText, setSearchText] = useState('');
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);  
    const searchInputRef = useRef<any>(null);

    // [NEW] Voice State
    const [listeningRowId, setListeningRowId] = useState<number | null>(null);
    const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const data = await posService.getActiveWarehouses();
                setWarehouses(data);
                if (data.length > 0) setWarehouseId(data[0].id);
            } catch (err) {
                message.error("Không thể tải danh sách kho");
            }
        };
        fetchWarehouses();
    }, []);

    const searchProducts = useRef(
        debounce(async (text: string, wId: number) => {
            if (!text.trim()) {
                setProducts([]);
                return;
            }
            setLoading(true);
            try {
                const res = await posService.searchProducts(text, wId);
                // [FILTER] Chỉ lấy sản phẩm ACTIVE
                const activeProducts = res.filter((p: any) => p.status === 'active');
                setProducts(activeProducts);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }, 300)
    ).current;

    useEffect(() => {
        if (warehouseId) searchProducts(searchText, warehouseId);
    }, [searchText, warehouseId]);

    const handleProductDone = () => {
        setSearchText('');
        setProducts([]);
        if (searchInputRef.current) searchInputRef.current.focus();
        message.info({ content: 'Sẵn sàng tiếp theo', key: 'ready_next', duration: 1 });
    };

    // --- VOICE LOGIC ---
    const startVoice = (rowId: number) => {
        if (!browserSupportsSpeechRecognition) return message.error("Browser not supported");
        resetTranscript();
        setListeningRowId(rowId);
        SpeechRecognition.startListening({ language: 'vi-VN', continuous: true });
        message.info("Đang nghe... (VD: Tủ A Tầng 1 Ô 2)");
    };

    useEffect(() => {
        if (!listening && !transcript) return;
        if (!listeningRowId) return;

        const timer = setTimeout(async () => {
            if (transcript) {
                const result = parseLocationVoice(transcript);
                if (result.hasMatch) {
                    message.success(`Nghe được: ${transcript}`);
                    
                    // Update Local State & Save API
                    // Tìm item đang nghe
                    const item = products.find(p => p.id === listeningRowId);
                    if (item) {
                        const newLocation = {
                            cabinet: result.cabinet || item.location?.cabinet || '',
                            row: result.row || item.location?.row || '',
                            slot: result.slot || item.location?.slot || ''
                        };

                        // Cập nhật UI ngay lập tức
                        setProducts(prev => prev.map(p => p.id === listeningRowId ? { ...p, location: newLocation } : p));
                        
                        // Gọi API Save (Tái sử dụng logic save của LocationCell thông qua việc update products -> re-render LocationCell -> user confirm hoặc auto save nếu muốn)
                        // Tuy nhiên, LocationCell dùng internal state. 
                        // Để đơn giản, ta sẽ cập nhật thẳng vào DB tại đây luôn
                        try {
                            await inventoryService.updateProductLocation(warehouseId, listeningRowId, newLocation);
                            message.success("Đã lưu giọng nói!");
                            // handleProductDone(); // Tùy chọn: Xong thì clear luôn
                        } catch(e) {
                            message.error("Lỗi lưu giọng nói");
                        }
                    }
                    
                    SpeechRecognition.stopListening();
                    setListeningRowId(null);
                    resetTranscript();
                }
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [transcript, listening, listeningRowId]);

    // --- CAMERA LOGIC (Giữ nguyên) ---
    useEffect(() => {
        if (isScannerOpen) {
            const timeoutId = setTimeout(() => {
                const formatsToSupport = [
                    Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.QR_CODE
                ];
                const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 300, height: 150 }, aspectRatio: 1.0, formatsToSupport }, false);
                scanner.render((decodedText) => {
                    message.success(`Đã quét: ${decodedText}`);
                    setSearchText(decodedText);
                    setIsScannerOpen(false);
                    scanner.clear();
                }, () => {});
                return () => { try { scanner.clear(); } catch(e) {} };
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [isScannerOpen]);

    // RENDERERS
    const desktopColumns = [
        {
            title: 'Hình ảnh', dataIndex: 'image_url', width: 80,
            render: (url: string) => <Avatar shape="square" size={60} src={url} icon={<EnvironmentOutlined />} />
        },
        {
            title: 'Sản phẩm', dataIndex: 'name',
            render: (_: any, r: any) => (
                <div>
                    <div style={{fontWeight: 600, fontSize: 14}}>{r.name}</div>
                    <Space size={4}><Tag color="blue">{r.sku}</Tag><Tag>{r.unit}</Tag></Space>
                </div>
            )
        },
        {
            title: 'Vị trí', key: 'location', width: 320,
            render: (_: any, r: any) => (
                <LocationCell 
                    productId={r.id} warehouseId={warehouseId} initialVal={r.location || {}} isMobile={false} onComplete={handleProductDone}
                    onVoiceStart={() => startVoice(r.id)} isListening={listeningRowId === r.id}
                />
            )
        }
    ];

    const renderMobileItem = (item: any) => (
        <List.Item style={{ padding: '8px 0' }}>
            <Card size="small" style={{ width: '100%', borderRadius: 8 }} bodyStyle={{padding: 12}}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <Avatar shape="square" size={64} src={item.image_url} icon={<EnvironmentOutlined />} style={{flexShrink: 0}} />
                    <div style={{flex: 1}}>
                        <Text strong style={{ fontSize: 14, lineHeight: 1.3, display:'block', marginBottom: 4 }}>{item.name}</Text>
                        <Tag style={{marginRight: 4}}>{item.sku}</Tag>
                        <Text type="secondary" style={{fontSize: 12}}>{item.unit}</Text>
                    </div>
                </div>
                <div style={{ backgroundColor: '#f9f9f9', padding: '8px 12px', borderRadius: 6 }}>
                    <LocationCell 
                        productId={item.id} warehouseId={warehouseId} initialVal={item.location || {}} isMobile={true} onComplete={handleProductDone}
                        onVoiceStart={() => startVoice(item.id)} isListening={listeningRowId === item.id}
                    />
                </div>
            </Card>
        </List.Item>
    );

    return (
        <Layout style={{ minHeight: '100vh', background: '#fff' }}>
            {/* HEADER GIỮ NGUYÊN TỪ BẢN CŨ */}
            <Header style={{ background: '#fff', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 100, height: 64 }}>
                <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: isDesktop ? 'flex-start' : 'center', justifyContent: 'center', padding: '0 8px', overflow: 'hidden' }}>
                    <Title level={5} style={{ margin: 0, whiteSpace: 'nowrap' }}>Cài Vị Trí</Title>
                    {isDesktop && warehouses.length > 0 && <Text type="secondary" style={{ fontSize: 11 }} ellipsis>{warehouses.find(w => w.id === warehouseId)?.name}</Text>}
                </div>
                <Space>
                    {isDesktop && <Select value={warehouseId} onChange={setWarehouseId} style={{ width: 160 }} options={warehouses.map(w => ({ label: w.name, value: w.id }))} suffixIcon={<HomeOutlined />} />}
                    <Button icon={<BarcodeOutlined />} type="primary" onClick={() => setIsScannerOpen(true)}>{isDesktop ? "Quét mã" : ""}</Button>
                </Space>
            </Header>
            
            {!isDesktop && <div style={{padding: '8px 12px 0 12px'}}><Select value={warehouseId} onChange={setWarehouseId} style={{ width: '100%' }} size="large" options={warehouses.map(w => ({ label: w.name, value: w.id }))} suffixIcon={<HomeOutlined />} /></div>}

            <Content style={{ padding: 12 }}>
                <Input ref={searchInputRef} size="large" placeholder="Tìm tên, mã, hoạt chất..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} allowClear style={{ marginBottom: 12 }} />
                
                {isDesktop ? (
                    <Table dataSource={products} columns={desktopColumns} rowKey="id" size="middle" pagination={false} loading={loading} scroll={{ y: 'calc(100vh - 160px)' }} locale={{ emptyText: warehouseId ? "Sẵn sàng tìm kiếm" : "Vui lòng chọn kho" }} />
                ) : (
                    <List dataSource={products} renderItem={renderMobileItem} loading={loading} locale={{ emptyText: warehouseId ? "Sẵn sàng tìm kiếm" : "Vui lòng chọn kho" }} />
                )}
            </Content>

            <Modal title="Quét Mã Vạch" open={isScannerOpen} onCancel={() => setIsScannerOpen(false)} footer={null} centered destroyOnClose>
                <div style={{ textAlign: 'center' }}>
                    <div id="reader" style={{ width: '100%', minHeight: '300px' }}></div>
                    <p style={{marginTop: 12, color: '#888'}}>Đưa mã vạch vào khung hình</p>
                </div>
            </Modal>
        </Layout>
    );
};

export default QuickLocationUpdate;