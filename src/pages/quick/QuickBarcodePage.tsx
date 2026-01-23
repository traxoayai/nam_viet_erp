import React, { useState, useEffect } from 'react';
import { 
    Table, Input, Button, Typography, Card, Space, Upload, Modal, Tag, message, Row, Col, List, Grid, Pagination
} from 'antd';
import { 
    UploadOutlined, BarcodeOutlined, CheckCircleOutlined, SyncOutlined, 
    DownloadOutlined, CameraOutlined 
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '@/shared/lib/supabaseClient';
import { useDebounce } from '@/shared/hooks/useDebounce'; 
import { Html5QrcodeScanner } from "html5-qrcode"; // Đảm bảo đã install: npm i html5-qrcode

const { Title } = Typography;
const { Search } = Input;
const { useBreakpoint } = Grid;

// --- CAMERA COMPONENT (INLINE FOR CONVENIENCE) ---
// Có thể tách ra file riêng: src/shared/ui/common/CameraScanModal.tsx
const CameraScanModal = ({ open, onCancel, onScan }: any) => {
    useEffect(() => {
        let scanner: any;
        let timeout: any;

        if (open) {
            // [FIX] Wait for Modal DOM to be ready
            timeout = setTimeout(() => {
                if (document.getElementById('reader')) {
                    scanner = new Html5QrcodeScanner(
                        "reader", { fps: 10, qrbox: 250 }, false
                    );
                    scanner.render((decodedText: any) => {
                        scanner.clear();
                        onScan(decodedText);
                    }, (error: any) => console.warn(error));
                }
            }, 300); // 300ms delay safely
        }

        return () => { 
            clearTimeout(timeout);
            try { if(scanner) scanner.clear(); } catch(e) {} 
        };
    }, [open]);

    return (
        <Modal open={open} onCancel={onCancel} footer={null} title="Quét mã vạch" destroyOnClose>
            <div id="reader" style={{ width: '100%' }}></div>
        </Modal>
    );
};

interface ProductBarcodeRow {
    key: number;
    id: number;
    name: string;
    sku: string;
    imageUrl?: string;
    base_unit: string;
    wholesale_unit: string;
    base_barcode: string;
    wholesale_barcode: string;
    is_dirty?: boolean;
}

const QuickBarcodePage: React.FC = () => {
    const screens = useBreakpoint(); // Check màn hình (Mobile vs Desktop)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [products, setProducts] = useState<ProductBarcodeRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');
    
    // Excel State
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [matchedData, setMatchedData] = useState<any[]>([]);

    // Camera State
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanTarget, setScanTarget] = useState<{ id: number, field: 'base_barcode' | 'wholesale_barcode' } | null>(null);

    const debouncedSearch = useDebounce(searchText, 500);

    useEffect(() => {
        loadProducts(1, pagination.pageSize); 
    }, [debouncedSearch]); 

    // --- 1. LOAD DATA ---
    const loadProducts = async (page = 1, pageSize = 20) => {
        setLoading(true);
        try {
            let query = supabase
                .from('products')
                .select(`
                    id, name, sku, image_url, retail_unit, wholesale_unit,
                    units:product_units ( unit_name, barcode, is_base, unit_type )
                `, { count: 'exact' })
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (debouncedSearch) {
                query = query.or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%,barcode.ilike.%${debouncedSearch}%`);
            }

            const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
            if (error) throw error;

            const rows = (data || []).map((p: any) => {
                const units = p.units || [];
                const retailObj = units.find((u: any) => u.is_base || u.unit_type === 'retail') || {};
                const wholesaleObj = units.find((u: any) => u.unit_type === 'wholesale') 
                                  || units.find((u: any) => !u.is_base && u.unit_name === p.wholesale_unit) || {};

                return {
                    key: p.id, id: p.id, name: p.name, sku: p.sku, imageUrl: p.image_url,
                    base_unit: p.retail_unit || '---',
                    wholesale_unit: p.wholesale_unit || '---',
                    base_barcode: retailObj.barcode || '',
                    wholesale_barcode: wholesaleObj.barcode || '',
                    is_dirty: false
                };
            });
            
            setProducts(rows);
            setPagination(prev => ({ ...prev, current: page, pageSize, total: count || 0 }));
        } catch (error: any) {
            message.error("Lỗi tải: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- 2. HANDLE INPUT & SCAN ---
    const handleCellChange = (key: number, field: string, value: string) => {
        setProducts(prev => prev.map(item => {
            if (item.key === key) {
                return { ...item, [field]: value, is_dirty: true };
            }
            return item;
        }));
    };

    // Mở Camera
    const openScan = (id: number, field: 'base_barcode' | 'wholesale_barcode') => {
        setScanTarget({ id, field });
        setCameraOpen(true);
    };

    // Xử lý kết quả quét
    const handleScanResult = (code: string) => {
        setCameraOpen(false);
        if (scanTarget) {
            // 1. Update UI
            handleCellChange(scanTarget.id, scanTarget.field, code);
            
            // 2. Auto Save (UX Optimization: Quét xong lưu luôn)
            const product = products.find(p => p.id === scanTarget.id);
            if (product) {
                const updatedProduct = { ...product, [scanTarget.field]: code };
                handleSaveRow(updatedProduct);
                message.success(`Đã gán mã: ${code}`);
            }
        }
    };

    // --- 3. SAVE ---
    const handleSaveRow = async (row: ProductBarcodeRow) => {
        setSavingId(row.id);
        try {
            const payload = [{
                product_id: row.id,
                base_barcode: row.base_barcode,
                wholesale_barcode: row.wholesale_barcode
            }];
            const { error } = await supabase.rpc('bulk_update_product_barcodes', { p_data: payload });
            if (error) throw error;

            setProducts(prev => prev.map(p => p.id === row.id ? { ...p, is_dirty: false } : p));
        } catch (e: any) {
            if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
                message.error("Lỗi: Mã này đã thuộc về sản phẩm khác!");
            } else {
                message.error("Lỗi lưu: " + e.message);
            }
        } finally {
            setSavingId(null);
        }
    };

    // --- 4. EXCEL LOGIC ---
    const handleDownloadTemplate = () => {
        const header = ['SKU', 'Tên sản phẩm', 'Mã Vạch Lẻ', 'Mã Vạch Buôn'];
        const sampleData = [['PAN001', 'Panadol Extra', '893111111111', '893222222222']];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([header, ...sampleData]);
        ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, "Mau_Barcode");
        XLSX.writeFile(wb, "Mau_Cap_Nhat_Barcode.xlsx");
    };

    const handleFileUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const ab = e.target?.result;
            const wb = XLSX.read(ab, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData: any[] = XLSX.utils.sheet_to_json(ws);
            processExcelData(jsonData);
        };
        reader.readAsArrayBuffer(file);
        return false; 
    };

    const processExcelData = async (rows: any[]) => {
        const itemsToMatch = rows.map(r => ({
            name: r['Tên sản phẩm'], 
            sku: String(r['SKU'] || '').trim(),
            baseBarcode: r['Mã Vạch Lẻ'] ? String(r['Mã Vạch Lẻ']) : '',
            wholesaleBarcode: r['Mã Vạch Buôn'] ? String(r['Mã Vạch Buôn']) : ''
        })).filter(i => i.name || i.sku);

        if (itemsToMatch.length === 0) return message.warning("File rỗng");

        const hideLoading = message.loading("Đang đối chiếu...", 0);
        
        try {
            // [BATCHING] Reuse logic from QuickPricePage if needed, but for simplicity here:
            const { data: matches } = await supabase.rpc('match_products_from_excel', { 
                p_data: itemsToMatch.map(i => ({ name: i.name, sku: i.sku })) 
            });

            const result = itemsToMatch.map((excelItem, idx) => {
                const match = matches?.find((m: any) => 
                    (excelItem.sku && m.excel_sku === excelItem.sku) || (m.excel_name === excelItem.name)
                );
                return {
                    rowIndex: idx,
                    excel: excelItem,
                    match: match ? { id: match.product_id, name: match.product_name, sku: match.product_sku } : null,
                    score: match?.similarity_score || 0
                };
            });

            setMatchedData(result);
            setReviewModalVisible(true);
        } catch (err: any) {
            message.error("Lỗi đối chiếu: " + err.message);
        } finally {
            hideLoading();
        }
    };

    const applyExcelMatches = async () => {
        setLoading(true);
        try {
            const matchedItems = matchedData.filter(m => m.match?.id);
            
            // Map payload chuẩn format RPC
            const payload = matchedItems.map(item => ({
                product_id: item.match.id,
                base_barcode: item.excel.baseBarcode,
                wholesale_barcode: item.excel.wholesaleBarcode
            }));

            if (payload.length === 0) {
                message.warning("Không có dữ liệu hợp lệ");
                return;
            }

            const { error } = await supabase.rpc('bulk_update_product_barcodes', { p_data: payload });
            if (error) throw error;

            message.success(`Đã cập nhật ${payload.length} mã vạch!`);
            setReviewModalVisible(false);
            loadProducts(pagination.current, pagination.pageSize);
        } catch (err: any) {
            message.error("Lỗi cập nhật: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- RENDERERS ---
    
    // [NEW] MOBILE CARD VIEW
    const renderMobileItem = (item: ProductBarcodeRow) => (
        <Card style={{ marginBottom: 12 }} bodyStyle={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 60, height: 60, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden' }}>
                    <img src={item.imageUrl || "https://placehold.co/60"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</div>
                    <Tag color="blue">{item.sku}</Tag>
                </div>
                <div>
                    {item.is_dirty ? (
                        <Button type="primary" shape="circle" icon={<SyncOutlined spin />} onClick={() => handleSaveRow(item)} />
                    ) : (
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                    )}
                </div>
            </div>

            <Space direction="vertical" style={{ width: '100%' }}>
                {/* Mã Lẻ */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Tag style={{ width: 60, textAlign: 'center' }}>{item.base_unit}</Tag>
                    <Input 
                        placeholder="Mã lẻ..." 
                        value={item.base_barcode}
                        onChange={e => handleCellChange(item.id, 'base_barcode', e.target.value)}
                        onBlur={() => item.is_dirty && handleSaveRow(item)}
                        suffix={<CameraOutlined style={{fontSize: 18, color: '#1890ff'}} onClick={() => openScan(item.id, 'base_barcode')} />}
                    />
                </div>

                {/* Mã Buôn */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Tag color="orange" style={{ width: 60, textAlign: 'center' }}>{item.wholesale_unit}</Tag>
                    <Input 
                        placeholder="Mã buôn..." 
                        value={item.wholesale_barcode}
                        onChange={e => handleCellChange(item.id, 'wholesale_barcode', e.target.value)}
                        onBlur={() => item.is_dirty && handleSaveRow(item)}
                        suffix={<CameraOutlined style={{fontSize: 18, color: '#faad14'}} onClick={() => openScan(item.id, 'wholesale_barcode')} />}
                    />
                </div>
            </Space>
        </Card>
    );

    // DESKTOP TABLE COLUMNS
    const columns = [
        { title: 'Sản phẩm', dataIndex: 'name', width: 250, render: (t:any, r:any) => <div><b>{t}</b><br/><Tag>{r.sku}</Tag></div> },
        { 
            title: `Mã Lẻ (${products[0]?.base_unit || 'Unit'})`, dataIndex: 'base_barcode', width: 200,
            render: (v:any, r:any) => <Input value={v} onChange={e => handleCellChange(r.id, 'base_barcode', e.target.value)} suffix={<CameraOutlined onClick={() => openScan(r.id, 'base_barcode')} />} onBlur={() => r.is_dirty && handleSaveRow(r)} />
        },
        { 
            title: `Mã Buôn (${products[0]?.wholesale_unit || 'Unit'})`, dataIndex: 'wholesale_barcode', width: 200,
            render: (v:any, r:any) => <Input value={v} onChange={e => handleCellChange(r.id, 'wholesale_barcode', e.target.value)} suffix={<CameraOutlined onClick={() => openScan(r.id, 'wholesale_barcode')} />} onBlur={() => r.is_dirty && handleSaveRow(r)} />
        },
        { title: '', width: 60, render: (_:any, r:any) => r.is_dirty ? <Button type="primary" icon={<SyncOutlined spin={savingId === r.id}/>} onClick={() => handleSaveRow(r)}/> : <CheckCircleOutlined style={{color: '#52c41a'}}/> }
    ];

    return (
        <div style={{ 
            paddingTop: screens.md ? 24 : 12,
            paddingLeft: screens.md ? 24 : 12,
            paddingRight: screens.md ? 24 : 12,
            paddingBottom: 80, 
            background: '#f0f2f5', 
            minHeight: '100vh' 
        }}>
            <Card bodyStyle={{padding: 16}}>
                {/* TOOLBAR */}
                <Row gutter={[16, 16]} align="middle" style={{marginBottom: 16}}>
                    <Col xs={24} md={8}><Title level={4} style={{margin:0}}><BarcodeOutlined/> Cập nhật Barcode</Title></Col>
                    <Col xs={24} md={8}><Search placeholder="Tìm sản phẩm..." onSearch={val => setSearchText(val)} onChange={e => setSearchText(e.target.value)} /></Col>
                    {screens.md && (
                        <Col span={8} style={{textAlign:'right'}}>
                            <Space><Button icon={<DownloadOutlined/>} onClick={handleDownloadTemplate}>Tải Mẫu</Button><Upload showUploadList={false} beforeUpload={handleFileUpload}><Button icon={<UploadOutlined/>}>Import</Button></Upload></Space>
                        </Col>
                    )}
                </Row>

                {/* VIEW SWITCHER */}
                {screens.md ? (
                    <Table dataSource={products} columns={columns} rowKey="id" loading={loading} pagination={false} scroll={{y: 600}} bordered size="small"/>
                ) : (
                    <List 
                        dataSource={products} 
                        renderItem={renderMobileItem} 
                        loading={loading}
                        locale={{ emptyText: "Không tìm thấy sản phẩm" }}
                    />
                )}

                {/* PAGINATION */}
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <Pagination 
                        current={pagination.current} pageSize={pagination.pageSize} total={pagination.total} 
                        onChange={(p, s) => loadProducts(p, s)} 
                    />
                </div>
            </Card>

            {/* MODALS */}
            <Modal title="Kết quả Excel" open={reviewModalVisible} onCancel={() => setReviewModalVisible(false)} onOk={applyExcelMatches} width={700}>
                <Table 
                    dataSource={matchedData} rowKey="rowIndex" pagination={false} scroll={{y:400}}
                    columns={[
                        { title: 'Excel', render: (r:any) => <div><b>{r.excel.name}</b><br/>Lẻ: {r.excel.baseBarcode} | Buôn: {r.excel.wholesaleBarcode}</div> },
                        { title: 'Khớp Hệ thống', render: (r:any) => r.match ? <Tag color="green">{r.match.name}</Tag> : <Tag color="red">Không khớp</Tag> }
                    ]} 
                />
            </Modal>

            <CameraScanModal 
                open={cameraOpen} 
                onCancel={() => setCameraOpen(false)} 
                onScan={handleScanResult} 
            />
        </div>
    );
};

export default QuickBarcodePage;