import React, { useState, useEffect } from 'react';
import { 
    Table, Input, Button, Typography, Card, Space, Upload, Modal, Tag, message, Row, Col 
} from 'antd';
import { 
    UploadOutlined, BarcodeOutlined, CheckCircleOutlined, SyncOutlined, 
    DownloadOutlined, WarningOutlined 
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '@/shared/lib/supabaseClient';
import { useDebounce } from '@/shared/hooks/useDebounce'; 

const { Title } = Typography;
const { Search } = Input;

interface ProductBarcodeRow {
    key: number;
    id: number;
    name: string;
    sku: string;
    imageUrl?: string;
    
    base_unit: string;
    wholesale_unit: string;
    
    base_barcode: string;      // Mã vạch lẻ
    wholesale_barcode: string; // Mã vạch buôn

    is_dirty?: boolean;
}

const QuickBarcodePage: React.FC = () => {
    // --- STATE ---
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [products, setProducts] = useState<ProductBarcodeRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');
    
    // Excel Match
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [matchedData, setMatchedData] = useState<any[]>([]);

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
                
                // Logic tìm Unit Lẻ (Base/Retail)
                const retailObj = units.find((u: any) => u.is_base || u.unit_type === 'retail') || {};
                
                // Logic tìm Unit Buôn (Wholesale)
                // Ưu tiên type='wholesale', sau đó đến unit trùng tên wholesale_unit
                const wholesaleObj = units.find((u: any) => u.unit_type === 'wholesale') 
                                  || units.find((u: any) => !u.is_base && u.unit_name === p.wholesale_unit) || {};

                return {
                    key: p.id,
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    imageUrl: p.image_url,
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
            message.error("Lỗi tải dữ liệu: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- 2. HANDLE INPUT ---
    const handleCellChange = (key: number, field: string, value: string) => {
        setProducts(prev => prev.map(item => {
            if (item.key === key) {
                return { ...item, [field]: value, is_dirty: true };
            }
            return item;
        }));
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

            message.success("Đã cập nhật mã vạch!");
            setProducts(prev => prev.map(p => p.id === row.id ? { ...p, is_dirty: false } : p));
        } catch (e: any) {
            if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
                message.error("Lỗi: Mã vạch này đã tồn tại ở sản phẩm khác!");
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

    // --- COLUMNS ---
    const columns = [
        { 
            title: 'Sản phẩm', dataIndex: 'name', width: 250, fixed: 'left' as const,
            render: (t: string, r: any) => (
                <div>
                    <div style={{fontWeight:600}}>{t}</div>
                    <Tag>{r.sku}</Tag>
                </div>
            )
        },
        {
            title: () => <span style={{color: '#1890ff'}}><BarcodeOutlined/> Mã Lẻ (/{products[0]?.base_unit})</span>,
            dataIndex: 'base_barcode',
            width: 200,
            render: (val: string, r: ProductBarcodeRow) => (
                <Input 
                    value={val}
                    onChange={e => handleCellChange(r.id, 'base_barcode', e.target.value)}
                    onBlur={() => { if(r.is_dirty) handleSaveRow(r) }}
                    placeholder="Quét mã lẻ..."
                    suffix={<BarcodeOutlined style={{color: '#ccc'}}/>}
                />
            )
        },
        {
            title: () => <span style={{color: '#52c41a'}}><BarcodeOutlined/> Mã Buôn (/{products[0]?.wholesale_unit})</span>,
            dataIndex: 'wholesale_barcode',
            width: 200,
            render: (val: string, r: ProductBarcodeRow) => (
                <Input 
                    value={val}
                    onChange={e => handleCellChange(r.id, 'wholesale_barcode', e.target.value)}
                    onBlur={() => { if(r.is_dirty) handleSaveRow(r) }}
                    placeholder="Quét mã buôn..."
                    suffix={<BarcodeOutlined style={{color: '#ccc'}}/>}
                />
            )
        },
        {
            title: '', width: 50, fixed: 'right' as const,
            render: (_:any, r:any) => r.is_dirty ? 
                <Button 
                    type="primary" 
                    size="small" 
                    loading={savingId === r.id}
                    icon={<SyncOutlined />} 
                    onClick={() => handleSaveRow(r)} 
                /> 
                : <CheckCircleOutlined style={{color:'#52c41a'}} />
        }
    ];

    return (
        <div style={{ padding: 12 }}>
            <Card bodyStyle={{padding: 16}}>
                <Row gutter={16} align="middle" style={{marginBottom:16}}>
                    <Col span={8}><Title level={4} style={{margin:0}}><BarcodeOutlined/> Cập nhật Barcode</Title></Col>
                    <Col span={8}><Search placeholder="Tìm sản phẩm, barcode..." onSearch={val => setSearchText(val)} onChange={e => setSearchText(e.target.value)} /></Col>
                    <Col span={8} style={{textAlign:'right'}}>
                        <Space>
                            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>Tải Mẫu</Button>
                            <Upload showUploadList={false} beforeUpload={handleFileUpload} accept=".xlsx">
                                <Button type="primary" icon={<UploadOutlined />}>Nhập Excel</Button>
                            </Upload>
                        </Space>
                    </Col>
                </Row>

                <div style={{background:'#fffbe6', padding:8, marginBottom:12, borderRadius:4, border:'1px solid #ffe58f'}}>
                    <WarningOutlined style={{color:'#faad14'}}/> <b>Mẹo:</b> Đặt con trỏ chuột vào ô nhập và sử dụng máy quét mã vạch để nhập liệu siêu tốc.
                </div>

                <Table 
                    dataSource={products} columns={columns} rowKey="id" loading={loading}
                    pagination={{
                        current: pagination.current, pageSize: pagination.pageSize, total: pagination.total,
                        onChange: (p, s) => loadProducts(p, s)
                    }}
                    scroll={{x: 800, y: 600}} size="small" bordered
                />
            </Card>

            <Modal title="Kết quả Excel Barcode" width={700} open={reviewModalVisible} onCancel={() => setReviewModalVisible(false)} onOk={applyExcelMatches}>
                <Table 
                    dataSource={matchedData} rowKey="rowIndex" pagination={false} scroll={{y:400}}
                    columns={[
                        { title: 'Excel', render: (r:any) => <div><b>{r.excel.name}</b><br/>Lẻ: {r.excel.baseBarcode} | Buôn: {r.excel.wholesaleBarcode}</div> },
                        { title: 'Khớp Hệ thống', render: (r:any) => r.match ? <Tag color="green">{r.match.name}</Tag> : <Tag color="red">Không khớp</Tag> }
                    ]} 
                />
            </Modal>
        </div>
    );
};

export default QuickBarcodePage;