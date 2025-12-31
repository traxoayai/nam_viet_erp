import  { useState, useEffect, useRef } from 'react';
import { Layout, Input, Table, Typography, Button, message, Tag, Avatar, Select } from 'antd'; 
import { SearchOutlined, BarcodeOutlined, ArrowLeftOutlined, EnvironmentOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import { posService } from '@/features/pos/api/posService';
import { inventoryService } from '@/features/inventory/api/inventoryService';
import { WarehousePosData } from '@/features/pos/types/pos.types';

const { Header, Content } = Layout;
const { Text, Title } = Typography;

// Component Input Vị Trí (Tích hợp sẵn logic lưu)
const LocationCell = ({ productId, warehouseId, initialVal }: any) => {
    const [val, setVal] = useState({ 
        c: initialVal.cabinet || '', 
        r: initialVal.row || '', 
        s: initialVal.slot || '' 
    });
    const [saving, setSaving] = useState(false);

    // Update state khi props thay đổi (Quan trọng khi chuyển kho hoặc search lại)
    useEffect(() => {
        setVal({ 
            c: initialVal.cabinet || '', 
            r: initialVal.row || '', 
            s: initialVal.slot || '' 
        });
    }, [initialVal.cabinet, initialVal.row, initialVal.slot]);

    const handleSave = async () => {
        // Chỉ lưu nếu có thay đổi so với initial (hoặc luôn lưu để chắc chắn)
        if (val.c === initialVal.cabinet && val.r === initialVal.row && val.s === initialVal.slot) return;
        
        setSaving(true);
        try {
            await inventoryService.updateProductLocation(warehouseId, productId, {
                cabinet: val.c, row: val.r, slot: val.s
            });
            message.success({ content: 'Đã lưu!', key: 'loc_save', duration: 1 });
        } catch {
            message.error('Lỗi lưu!');
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter') handleSave();
    };

    return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <Input 
                placeholder="Tủ" 
                value={val.c} 
                onChange={e => setVal({...val, c: e.target.value.toUpperCase()})} 
                onBlur={handleSave} 
                onKeyDown={handleKeyDown}
                style={{ width: 50, textAlign: 'center', backgroundColor: saving ? '#fffbe6' : '#fff' }} 
            />
            <span style={{color:'#ccc'}}>-</span>
            <Input 
                placeholder="Tầng" 
                value={val.r} 
                onChange={e => setVal({...val, r: e.target.value.toUpperCase()})} 
                onBlur={handleSave} 
                onKeyDown={handleKeyDown}
                style={{ width: 50, textAlign: 'center', backgroundColor: saving ? '#fffbe6' : '#fff' }} 
            />
            <span style={{color:'#ccc'}}>-</span>
            <Input 
                placeholder="Ô" 
                value={val.s} 
                onChange={e => setVal({...val, s: e.target.value.toUpperCase()})} 
                onBlur={handleSave} 
                onKeyDown={handleKeyDown}
                style={{ width: 50, textAlign: 'center', backgroundColor: saving ? '#fffbe6' : '#fff' }} 
            />
        </div>
    );
};

export const QuickLocationUpdate = () => {
    const navigate = useNavigate();
    
    // State quản lý Kho
    const [warehouses, setWarehouses] = useState<WarehousePosData[]>([]);
    const [warehouseId, setWarehouseId] = useState<number>(1); 

    const [searchText, setSearchText] = useState('');
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // 1. Load danh sách kho khi vào trang
    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const data = await posService.getActiveWarehouses();
                setWarehouses(data);
                // Nếu có kho trả về, set kho đầu tiên làm mặc định (hoặc lấy từ localStorage nếu muốn nhớ)
                if (data.length > 0) {
                    setWarehouseId(data[0].id);
                }
            } catch (err) {
                message.error("Không thể tải danh sách kho");
            }
        };
        fetchWarehouses();
    }, []);

    // 2. Logic tìm kiếm (Tự động chạy lại khi searchText hoặc warehouseId đổi)
    const searchProducts = useRef(
        debounce(async (text: string, wId: number) => {
            setLoading(true);
            try {
                // Nếu không có text thì không tìm (hoặc tìm gợi ý)
                // Ở đây ta cho phép tìm rỗng để xem list (tùy logic RPC của Sếp)
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
        if (warehouseId) {
            searchProducts(searchText, warehouseId);
        }
    }, [searchText, warehouseId]);

    const columns = [
        {
            title: 'SP',
            dataIndex: 'image_url',
            width: 60,
            render: (url: string) => (
                <Avatar shape="square" size={48} src={url} icon={<EnvironmentOutlined />} />
            )
        },
        {
            title: 'Thông tin',
            dataIndex: 'name',
            render: (_: any, r: any) => (
                <div>
                    <div style={{fontWeight: 600, fontSize: 13}}>{r.name}</div>
                    <Tag style={{marginRight: 4}}>{r.sku}</Tag>
                    <Text type="secondary" style={{fontSize: 11}}>{r.unit}</Text>
                </div>
            )
        },
        {
            title: 'Vị trí (Tủ-Tầng-Ô)',
            key: 'location',
            width: 200,
            render: (_: any, r: any) => (
                <LocationCell 
                    productId={r.id} 
                    warehouseId={warehouseId} 
                    initialVal={r.location || {}} 
                />
            )
        }
    ];

    const handleScan = () => {
        setIsScannerOpen(true);
        message.info("Tính năng camera đang được tích hợp...");
    };

    return (
        <Layout style={{ minHeight: '100vh', background: '#fff' }}>
            <Header style={{ background: '#fff', padding: '0 12px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0', position:'sticky', top:0, zIndex:100, gap: 8 }}>
                <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
                
                <div style={{flex: 1, display:'flex', flexDirection:'column', lineHeight: 1.2}}>
                    <Title level={5} style={{ margin: 0 }}>Cài Vị Trí</Title>
                </div>

                {/* [NEW] SELECTOR KHO */}
                <Select
                    value={warehouseId}
                    onChange={setWarehouseId}
                    style={{ width: 140 }}
                    size="middle"
                    loading={warehouses.length === 0}
                    options={warehouses.map(w => ({ label: w.name, value: w.id }))}
                    suffixIcon={<HomeOutlined />}
                />

                <Button icon={<BarcodeOutlined />} type="primary" onClick={handleScan}></Button>
            </Header>

            <Content style={{ padding: 12 }}>
                <Input 
                    size="large" 
                    placeholder="Tìm tên, mã, hoạt chất..." 
                    prefix={<SearchOutlined />} 
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    allowClear
                    style={{ marginBottom: 12 }}
                />

                <Table 
                    dataSource={products} 
                    columns={columns} 
                    rowKey="id" 
                    size="small" 
                    pagination={false} 
                    loading={loading}
                    scroll={{ y: 'calc(100vh - 140px)' }}
                    locale={{ emptyText: warehouseId ? "Không có dữ liệu hoặc chưa tìm kiếm" : "Vui lòng chọn kho" }}
                />
            </Content>
        </Layout>
    );
};

export default QuickLocationUpdate;
