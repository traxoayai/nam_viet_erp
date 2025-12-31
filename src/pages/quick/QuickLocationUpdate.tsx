import { useState, useEffect, useRef } from 'react';
import { Layout, Input, Table, Typography, Button, message, Tag, Avatar, Select, Modal, List, Card, Grid, Space } from 'antd'; 
import { SearchOutlined, BarcodeOutlined, ArrowLeftOutlined, EnvironmentOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import { posService } from '@/features/pos/api/posService';
import { inventoryService } from '@/features/inventory/api/inventoryService';
import { WarehousePosData } from '@/features/pos/types/pos.types';
import { Html5QrcodeScanner } from 'html5-qrcode';

const { Header, Content } = Layout;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

// --- Component LocationCell ---
// [UPDATE]: Thêm prop onComplete
const LocationCell = ({ productId, warehouseId, initialVal, isMobile = false, onComplete }: any) => {
    const [val, setVal] = useState({ 
        c: initialVal.cabinet || '', 
        r: initialVal.row || '', 
        s: initialVal.slot || '' 
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setVal({ 
            c: initialVal.cabinet || '', 
            r: initialVal.row || '', 
            s: initialVal.slot || '' 
        });
    }, [initialVal.cabinet, initialVal.row, initialVal.slot]);

    const handleSave = async () => {
        // Nếu không có gì thay đổi thì không gọi API
        if (val.c === initialVal.cabinet && val.r === initialVal.row && val.s === initialVal.slot) return true;
        
        setSaving(true);
        try {
            await inventoryService.updateProductLocation(warehouseId, productId, {
                cabinet: val.c, row: val.r, slot: val.s
            });
            message.success({ content: 'Đã lưu vị trí!', key: 'loc_save', duration: 1 });
            return true; // Báo thành công
        } catch {
            message.error('Lỗi lưu!');
            return false;
        } finally {
            setSaving(false);
        }
    };

    // [LOGIC MỚI]: Bấm Enter -> Lưu -> Xóa màn hình
    const handleKeyDown = async (e: any) => {
        if (e.key === 'Enter') {
            const success = await handleSave();
            // Nếu lưu thành công (hoặc không đổi gì), thì kích hoạt onComplete để xóa màn hình
            if (success && onComplete) {
                onComplete(); 
            }
        }
    };

    const inputStyle = { 
        width: isMobile ? 70 : 60,
        textAlign: 'center' as const, 
        backgroundColor: saving ? '#fffbe6' : '#fff',
        fontWeight: 500
    };

    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-start' }}>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                {isMobile && <Text type="secondary" style={{fontSize: 10}}>Tủ</Text>}
                <Input placeholder={isMobile ? "" : "Tủ"} value={val.c} onChange={e => setVal({...val, c: e.target.value.toUpperCase()})} onBlur={handleSave} onKeyDown={handleKeyDown} style={inputStyle} size={isMobile ? "large" : "middle"} />
            </div>
            <span style={{color:'#ccc', marginTop: isMobile ? 14 : 0}}>-</span>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                {isMobile && <Text type="secondary" style={{fontSize: 10}}>Tầng</Text>}
                <Input placeholder={isMobile ? "" : "Tầng"} value={val.r} onChange={e => setVal({...val, r: e.target.value.toUpperCase()})} onBlur={handleSave} onKeyDown={handleKeyDown} style={inputStyle} size={isMobile ? "large" : "middle"} />
            </div>
            <span style={{color:'#ccc', marginTop: isMobile ? 14 : 0}}>-</span>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                {isMobile && <Text type="secondary" style={{fontSize: 10}}>Ô</Text>}
                <Input placeholder={isMobile ? "" : "Ô"} value={val.s} onChange={e => setVal({...val, s: e.target.value.toUpperCase()})} onBlur={handleSave} onKeyDown={handleKeyDown} style={inputStyle} size={isMobile ? "large" : "middle"} />
            </div>
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
    
    // Ref để focus lại ô tìm kiếm sau khi xóa
    const searchInputRef = useRef<any>(null);

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
            // Nếu text rỗng -> Xóa list sản phẩm
            if (!text.trim()) {
                setProducts([]);
                return;
            }

            setLoading(true);
            try {
                const res = await posService.searchProducts(text, wId);
                setProducts(res);
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

    // [LOGIC MỚI]: Hàm dọn dẹp sau khi hoàn thành 1 sản phẩm
    const handleProductDone = () => {
        setSearchText(''); // Xóa text tìm kiếm
        setProducts([]);   // Xóa danh sách sản phẩm
        // Focus lại vào ô tìm kiếm để sẵn sàng quét/nhập tiếp
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
        message.info({ content: 'Sẵn sàng nhập mã tiếp theo', key: 'ready_next', duration: 1 });
    };

    // --- LOGIC CAMERA SCANNER ---
    useEffect(() => {
        if (isScannerOpen) {
            const timeoutId = setTimeout(() => {
                const scanner = new Html5QrcodeScanner(
                    "reader", 
                    { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                    false
                );
                scanner.render((decodedText) => {
                    message.success(`Đã quét: ${decodedText}`);
                    setSearchText(decodedText);
                    setIsScannerOpen(false);
                    scanner.clear();
                }, (_errorMessage) => {});

                return () => { try { scanner.clear(); } catch(e) {} };
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [isScannerOpen]);

    const desktopColumns = [
        {
            title: 'Hình ảnh',
            dataIndex: 'image_url',
            width: 80,
            render: (url: string) => <Avatar shape="square" size={60} src={url} icon={<EnvironmentOutlined />} />
        },
        {
            title: 'Sản phẩm',
            dataIndex: 'name',
            render: (_: any, r: any) => (
                <div>
                    <div style={{fontWeight: 600, fontSize: 14}}>{r.name}</div>
                    <Space size={4}>
                        <Tag color="blue">{r.sku}</Tag>
                        <Tag>{r.unit}</Tag>
                    </Space>
                </div>
            )
        },
        {
            title: 'Vị trí (Tủ - Tầng - Ô)',
            key: 'location',
            width: 300,
            render: (_: any, r: any) => (
                <LocationCell 
                    productId={r.id} 
                    warehouseId={warehouseId} 
                    initialVal={r.location || {}} 
                    isMobile={false} 
                    onComplete={handleProductDone} // [PASS PROP]
                />
            )
        }
    ];

    const renderMobileItem = (item: any) => (
        <List.Item style={{ padding: '8px 0' }}>
            <Card size="small" style={{ width: '100%', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} bodyStyle={{padding: 12}}>
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
                        productId={item.id} 
                        warehouseId={warehouseId} 
                        initialVal={item.location || {}} 
                        isMobile={true} 
                        onComplete={handleProductDone} // [PASS PROP]
                    />
                </div>
            </Card>
        </List.Item>
    );

    return (
        <Layout style={{ minHeight: '100vh', background: '#fff' }}>
            <Header style={{ 
    background: '#fff', 
    padding: '0 12px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between', // [FIX]: Căn đều 2 bên
    borderBottom: '1px solid #f0f0f0', 
    position: 'sticky', 
    top: 0, 
    zIndex: 100, 
    height: 64, // Cố định chiều cao để không bị phình
    lineHeight: 'initial' // Reset line-height mặc định của Antd Header
}}>
    {/* Nút Back */}
    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
    
    {/* Tiêu đề chính (Căn giữa tuyệt đối trên Mobile) */}
    <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: isDesktop ? 'flex-start' : 'center', // Desktop: Trái, Mobile: Giữa
        justifyContent: 'center',
        padding: '0 8px',
        overflow: 'hidden' // Tránh tên kho quá dài làm vỡ
    }}>
        <Title level={5} style={{ margin: 0, whiteSpace: 'nowrap' }}>
            Cài Vị Trí
        </Title>
        
        {/* Chỉ hiện tên kho nhỏ trên Desktop, Mobile ẩn đi cho đỡ chật (vì đã có Select ở dưới) */}
        {isDesktop && warehouses.length > 0 && (
            <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                {warehouses.find(w => w.id === warehouseId)?.name}
            </Text>
        )}
    </div>

    {/* Khu vực nút bên phải */}
    <Space>
        {isDesktop && (
                <Select
                value={warehouseId}
                onChange={setWarehouseId}
                style={{ width: 160 }}
                options={warehouses.map(w => ({ label: w.name, value: w.id }))}
                suffixIcon={<HomeOutlined />}
            />
        )}
        
        <Button 
            icon={<BarcodeOutlined />} 
            type="primary" 
            onClick={() => setIsScannerOpen(true)}
        >
            {isDesktop ? "Quét mã" : ""}
        </Button>
    </Space>
</Header>
            
            {!isDesktop && (
                <div style={{padding: '8px 12px 0 12px'}}>
                    <Select
                        value={warehouseId}
                        onChange={setWarehouseId}
                        style={{ width: '100%' }}
                        size="large"
                        options={warehouses.map(w => ({ label: w.name, value: w.id }))}
                        suffixIcon={<HomeOutlined />}
                    />
                </div>
            )}

            <Content style={{ padding: 12 }}>
                <Input 
                    ref={searchInputRef} // [ADD REF]
                    size="large" 
                    placeholder="Tìm tên, mã, hoạt chất..." 
                    prefix={<SearchOutlined />} 
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    allowClear
                    style={{ marginBottom: 12 }}
                />

                {isDesktop ? (
                    <Table 
                        dataSource={products} 
                        columns={desktopColumns} 
                        rowKey="id" 
                        size="middle"
                        pagination={false} 
                        loading={loading}
                        scroll={{ y: 'calc(100vh - 160px)' }}
                        locale={{ emptyText: warehouseId ? "Sẵn sàng tìm kiếm / quét mã" : "Vui lòng chọn kho" }}
                    />
                ) : (
                    <List
                        dataSource={products}
                        renderItem={renderMobileItem}
                        loading={loading}
                        locale={{ emptyText: warehouseId ? "Sẵn sàng tìm kiếm / quét mã" : "Vui lòng chọn kho" }}
                    />
                )}
            </Content>

            <Modal
                title="Quét Mã Vạch"
                open={isScannerOpen}
                onCancel={() => setIsScannerOpen(false)}
                footer={null}
                centered
                destroyOnClose={true}
            >
                <div style={{ textAlign: 'center' }}>
                    <div id="reader" style={{ width: '100%', minHeight: '300px' }}></div>
                    <p style={{marginTop: 12, color: '#888'}}>Đưa mã vạch vào khung hình</p>
                </div>
            </Modal>
        </Layout>
    );
};

export default QuickLocationUpdate;