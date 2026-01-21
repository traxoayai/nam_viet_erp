// src/pages/quick/QuickPricePage.tsx
import React, { useState, useEffect } from 'react';
import { 
    Table, Input, InputNumber, Button, Typography, 
    Card, Space, Upload, Modal, Tag, message, Row, Col, Select  
} from 'antd';
import { 
    UploadOutlined, ThunderboltOutlined, 
    CheckCircleOutlined, SyncOutlined, DownloadOutlined,
    WarningOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '@/shared/lib/supabaseClient';
import { useDebounce } from '@/shared/hooks/useDebounce'; 

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

interface ProductPriceRow {
    key: number;
    id: number;
    name: string;
    sku: string;
    imageUrl?: string;
    
    base_unit: string;
    wholesale_unit: string;
    wholesale_rate: number; // Tỉ lệ quy đổi (VD: 10)

    actual_cost: number; // Giá vốn (Hiển thị theo đơn vị Buôn)
    
    // Margin Inputs
    retail_margin: number;
    retail_margin_type: 'percent' | 'amount';
    retail_price: number; 

    wholesale_margin: number;
    wholesale_margin_type: 'percent' | 'amount';
    wholesale_price: number;

    is_dirty?: boolean;
}

// Helper: Chuyển đổi string 'VNĐ'/'%' thành type chuẩn
const parseUnitType = (val: string): 'amount' | 'percent' => {
    if (!val) return 'amount'; // Mặc định
    if (String(val).includes('%')) return 'percent';
    return 'amount';
};

const QuickPricePage: React.FC = () => {
    // --- STATE ---
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [products, setProducts] = useState<ProductPriceRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');
    
    // Excel Match State (Copy from QuickUnitPage)
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [matchedData, setMatchedData] = useState<any[]>([]);

    const debouncedSearch = useDebounce(searchText, 500);

    useEffect(() => {
        loadProducts(1, pagination.pageSize); 
    }, [debouncedSearch]); 

    // --- LOAD DATA (Fix lỗi query) ---
    const loadProducts = async (page = 1, pageSize = 20) => {
        setLoading(true);
        try {
            // A. Query (Không select cột wholesale_rate ảo)
            let query = supabase
                .from('products')
                .select(`
                    id, name, sku, image_url, actual_cost,
                    units:product_units ( id, unit_name, conversion_rate, price, is_base, unit_type, price_cost )
                `, { count: 'exact' })
                .order('created_at', { ascending: false });

            if (debouncedSearch) {
                query = query.or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%`);
            }

            const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
            if (error) throw error;

            // B. Map Data
            const rows = (data || []).map((p: any) => {
                const units = p.units || [];
                // 1. Tìm đơn vị Buôn (Ưu tiên type='wholesale' hoặc rate > 1)
                const wholesaleUnitObj = units.find((u: any) => u.unit_type === 'wholesale') 
                                      || units.find((u: any) => !u.is_base && u.conversion_rate > 1)
                                      || units.find((u: any) => u.is_base); // Fallback

                // 2. Tìm đơn vị Lẻ (Base)
                const retailUnitObj = units.find((u: any) => u.is_base || u.unit_type === 'retail') || units[0];

                const rate = wholesaleUnitObj?.conversion_rate || 1;
                
                // 3. Tính giá vốn hiển thị (BaseCost * Rate)
                const baseCost = p.actual_cost || 0;
                const displayCost = baseCost * rate;

                return {
                    key: p.id,
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    imageUrl: p.image_url,
                    
                    base_unit: retailUnitObj?.unit_name || '---',
                    wholesale_unit: wholesaleUnitObj?.unit_name || '---',
                    wholesale_rate: rate,

                    actual_cost: displayCost,
                    
                    retail_margin: 0,
                    retail_margin_type: 'amount',
                    retail_price: retailUnitObj?.price || 0,

                    wholesale_margin: 0,
                    wholesale_margin_type: 'amount',
                    wholesale_price: wholesaleUnitObj?.price || 0,

                    is_dirty: false
                };
            });
            
            setProducts(rows as ProductPriceRow[]);
            setPagination(prev => ({ ...prev, current: page, pageSize, total: count || 0 }));

        } catch (error: any) {
            message.error("Lỗi tải dữ liệu: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- CALCULATION LOGIC (Auto Update Price) ---
    const calculateDependentValues = (item: ProductPriceRow, changedField: string, value: any): Partial<ProductPriceRow> => {
        let updates: any = { [changedField]: value };
        const newItem = { ...item, ...updates };
        
        // Khi sửa Giá Vốn hoặc Margin Lẻ -> Tính lại Giá Bán Lẻ
        if (['actual_cost', 'retail_margin', 'retail_margin_type'].includes(changedField)) {
            let margin = newItem.retail_margin;
            if (newItem.retail_margin_type === 'percent') {
                margin = newItem.actual_cost * (newItem.retail_margin / 100);
            }
            // Giá bán lẻ (1 viên) = (Giá vốn 1 hộp + Lãi 1 hộp) / Số viên trong hộp
            updates.retail_price = Math.ceil((newItem.actual_cost + margin) / newItem.wholesale_rate);
        }

        // Khi sửa Giá Vốn hoặc Margin Buôn -> Tính lại Giá Bán Buôn
        if (['actual_cost', 'wholesale_margin', 'wholesale_margin_type'].includes(changedField)) {
            let margin = newItem.wholesale_margin;
            if (newItem.wholesale_margin_type === 'percent') {
                margin = newItem.actual_cost * (newItem.wholesale_margin / 100);
            }
            // Giá bán buôn (1 hộp) = Giá vốn 1 hộp + Lãi 1 hộp
            updates.wholesale_price = Math.ceil(newItem.actual_cost + margin);
        }

        return updates;
    };

    const handleCellChange = (key: number, field: string, value: any) => {
        setProducts(prev => prev.map(item => {
            if (item.key === key) {
                const updates = calculateDependentValues(item, field, value);
                return { ...item, ...updates, is_dirty: true };
            }
            return item;
        }));
    };

    // --- SAVE LOGIC (To Server) ---
    const handleSaveRow = async (row: ProductPriceRow) => {
        setSavingId(row.id);
        try {
            // Quy đổi ngược về Base Cost để lưu
            const baseCost = row.actual_cost / (row.wholesale_rate || 1);

            const payload = [{
                product_id: row.id,
                actual_cost: baseCost,
                retail_price: row.retail_price,
                wholesale_price: row.wholesale_price
            }];

            const { error } = await supabase.rpc('bulk_update_product_prices', { p_data: payload });
            if (error) throw error;

            message.success("Đã cập nhật!");
            setProducts(prev => prev.map(p => p.id === row.id ? { ...p, is_dirty: false } : p));
        } catch (e: any) {
            message.error("Lỗi: " + e.message);
        } finally {
            setSavingId(null);
        }
    };

    // --- EXCEL & TEMPLATE ---
    const handleDownloadTemplate = () => {
        try {
            // 1. Header chuẩn 7 Cột
            const header = [
                'SKU',                     // Cột A: Bắt buộc
                'Tên sản phẩm',            // Cột B: Bắt buộc
                'Giá Vốn',                 // Cột C: Optional
                'Lãi Lẻ',                  // Cột D: User nhập số
                'Đơn vị Lãi Lẻ (%/VNĐ)',   // Cột E: User nhập '%' hoặc 'VNĐ'
                'Lãi Buôn',                // Cột F: User nhập số
                'Đơn vị Lãi Buôn (%/VNĐ)'  // Cột G: User nhập '%' hoặc 'VNĐ'
            ];

            // 2. Dữ liệu mẫu (Sample Data) minh họa cả 2 trường hợp
            const sampleData = [
                // Dòng 1: Ví dụ dùng Phần trăm (%)
                ['PAN001', 'Panadol Extra (Ví dụ %)', 100000, 20, '%', 5, '%'],
                
                // Dòng 2: Ví dụ dùng Số tiền cố định (VNĐ)
                ['EFF001', 'Efferalgan (Ví dụ Tiền)', 50000, 5000, 'VNĐ', 2000, 'VNĐ']
            ];

            // 3. Tạo Workbook
            const wb = XLSX.utils.book_new();

            // 4. Tạo Worksheet từ mảng dữ liệu
            const ws = XLSX.utils.aoa_to_sheet([header, ...sampleData]);

            // 5. Set độ rộng cột cho dễ nhìn
            ws['!cols'] = [
                { wch: 15 }, // SKU
                { wch: 30 }, // Tên
                { wch: 15 }, // Giá Vốn
                { wch: 10 }, // Lãi Lẻ
                { wch: 20 }, // Đơn vị Lẻ
                { wch: 10 }, // Lãi Buôn
                { wch: 20 }  // Đơn vị Buôn
            ];

            // 6. [QUAN TRỌNG] Append sheet vào workbook (Fix lỗi Empty)
            XLSX.utils.book_append_sheet(wb, ws, "Mau_Cap_Nhat_Gia");

            // 7. Xuất file
            XLSX.writeFile(wb, "Mau_Cap_Nhat_Gia_V2.xlsx");

        } catch (error: any) {
            console.error("Download Error:", error);
            message.error("Lỗi tạo file mẫu: " + error.message);
        }
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
        // 1. Map dữ liệu từ Header Tiếng Việt sang Object chuẩn
        const itemsToMatch = rows.map(r => ({
            // Map các cột bắt buộc
            name: r['Tên sản phẩm'], 
            sku: String(r['SKU'] || '').trim(),
            
            // Map các cột giá & lãi
            cost: Number(r['Giá Vốn']) || 0,
            
            retailMargin: Number(r['Lãi Lẻ']) || 0,
            retailUnit: parseUnitType(r['Đơn vị Lãi Lẻ (%/VNĐ)']),
            
            wholesaleMargin: Number(r['Lãi Buôn']) || 0,
            wholesaleUnit: parseUnitType(r['Đơn vị Lãi Buôn (%/VNĐ)'])
        })).filter(i => i.name || i.sku); // Lọc dòng rỗng

        if (itemsToMatch.length === 0) {
            message.warning("File không có dữ liệu hợp lệ (Kiểm tra cột 'Tên sản phẩm' hoặc 'SKU')");
            return;
        }

        message.loading("Đang đối chiếu dữ liệu...", 1);
        
        try {
            // 2. Gọi RPC đối chiếu
            const { data: matches, error } = await supabase.rpc('match_products_from_excel', { 
                p_data: itemsToMatch.map(i => ({ name: i.name, sku: i.sku })) 
            });
            
            if (error) throw error;

            // 3. Ghép kết quả Match với Dữ liệu Excel đã đọc
            const result = itemsToMatch.map((excelItem, idx) => {
                const match = matches?.find((m: any) => 
                    (excelItem.sku && m.excel_sku === excelItem.sku) || 
                    (m.excel_name === excelItem.name)
                );

                return {
                    rowIndex: idx,
                    excel: excelItem, // Lưu nguyên cục data excel đã map ở bước 1
                    match: match ? { 
                        id: match.product_id, 
                        name: match.product_name, 
                        sku: match.product_sku 
                    } : null,
                    score: match?.similarity_score || 0
                };
            });

            setMatchedData(result);
            setReviewModalVisible(true);

        } catch (err: any) {
            console.error(err);
            message.error("Lỗi đối chiếu: " + err.message);
        }
    };

    const applyExcelMatches = async () => {
        setLoading(true);
        try {
            const payload: any[] = [];
            
            // Duyệt qua các dòng đã khớp
            matchedData.filter(m => m.match?.id).forEach(item => {
                const pid = item.match.id;
                
                // [TRICK] Tìm sản phẩm này trong state 'products' hiện tại để lấy wholesale_rate
                const currentProd = products.find(p => p.id === pid);
                const rate = currentProd?.wholesale_rate || 1;

                // 1. Tính Giá Vốn Cơ Sở (Base Cost)
                // Excel nhập Giá Vốn (đơn vị Buôn) -> Chia cho Rate
                const baseCost = (item.excel.cost || 0) / rate;

                // 2. Tính Giá Bán Lẻ (Retail Price)
                let retailPrice = 0;
                if (item.excel.retailUnit === 'percent') {
                     // Lãi % (trên giá buôn) -> Cộng vào rồi chia rate
                    const marginAmount = (item.excel.cost || 0) * (item.excel.retailMargin / 100);
                    retailPrice = ((item.excel.cost || 0) + marginAmount) / rate;
                } else {
                     // Lãi tiền (trên đơn vị buôn) -> Cộng vào rồi chia rate
                    retailPrice = ((item.excel.cost || 0) + item.excel.retailMargin) / rate;
                }

                // 3. Tính Giá Bán Buôn (Wholesale Price)
                let wholesalePrice = 0;
                if (item.excel.wholesaleUnit === 'percent') {
                     const marginAmount = (item.excel.cost || 0) * (item.excel.wholesaleMargin / 100);
                     wholesalePrice = (item.excel.cost || 0) + marginAmount;
                } else {
                     wholesalePrice = (item.excel.cost || 0) + item.excel.wholesaleMargin;
                }

                // Push vào payload
                payload.push({
                    product_id: pid,
                    actual_cost: Math.round(baseCost),
                    retail_price: Math.round(retailPrice),
                    wholesale_price: Math.round(wholesalePrice)
                });
            });

            if (payload.length === 0) {
                message.warning("Không có dữ liệu hợp lệ để lưu.");
                setLoading(false);
                return;
            }

            // Gọi RPC Bulk Update
            const { error } = await supabase.rpc('bulk_update_product_prices', { p_data: payload });
            if (error) throw error;

            message.success(`Đã cập nhật giá cho ${payload.length} sản phẩm!`);
            setReviewModalVisible(false);
            
            // Reload lại bảng để thấy giá mới
            loadProducts(pagination.current, pagination.pageSize);

        } catch (err: any) {
            message.error("Lỗi lưu giá: " + err.message);
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
                    <div style={{fontWeight:600, color:'#1890ff'}}>{t}</div>
                    <Space size="small" style={{fontSize:11, color:'#666'}}>
                        <Tag>{r.sku}</Tag>
                        <span>1 {r.wholesale_unit} = {r.wholesale_rate} {r.base_unit}</span>
                    </Space>
                </div>
            )
        },
        {
            title: () => <span className="text-red-600">Giá Vốn / {products[0]?.wholesale_unit || 'ĐV Buôn'}</span>,
            dataIndex: 'actual_cost',
            width: 140,
            render: (val: number, r: ProductPriceRow) => (
                <InputNumber 
                    style={{width: '100%', borderColor:'#ffa39e', backgroundColor:'#fff1f0'}}
                    value={val}
                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={v => Number(v!.replace(/\$\s?|(,*)/g, ''))}
                    onChange={v => handleCellChange(r.id, 'actual_cost', Number(v))}
                    onBlur={() => { if(r.is_dirty) handleSaveRow(r) }}
                />
            )
        },
        // ... Các cột Lãi/Giá Lẻ/Giá Buôn (Giữ nguyên code trước) ...
        {
            title: 'Lãi Lẻ',
            width: 130,
            render: (_: any, r: any) => (
                <Space.Compact>
                    <InputNumber value={r.retail_margin} onChange={v => handleCellChange(r.key, 'retail_margin', v)} style={{width:60}} />
                    <Select value={r.retail_margin_type} onChange={v => handleCellChange(r.key, 'retail_margin_type', v)} style={{width:60}}>
                        <Option value="percent">%</Option><Option value="amount">$</Option>
                    </Select>
                </Space.Compact>
            )
        },
        {
            title: <span style={{color:'#1890ff'}}>Giá Bán Lẻ</span>,
            dataIndex: 'retail_price',
            width: 140,
            render: (v: number, r:any) => (
                <div>
                    <InputNumber value={v} onChange={val => handleCellChange(r.id, 'retail_price', Number(val))} 
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={v => Number(v!.replace(/\$\s?|(,*)/g, ''))}
                        style={{width:'100%', fontWeight:'bold', color:'#1890ff'}}
                    />
                    <div style={{fontSize:10, color:'#999'}}>/{r.base_unit}</div>
                </div>
            )
        },
        {
            title: 'Lãi Buôn',
            width: 130,
            render: (_: any, r: any) => (
                <Space.Compact>
                    <InputNumber value={r.wholesale_margin} onChange={v => handleCellChange(r.key, 'wholesale_margin', v)} style={{width:60}} />
                    <Select value={r.wholesale_margin_type} onChange={v => handleCellChange(r.key, 'wholesale_margin_type', v)} style={{width:60}}>
                        <Option value="percent">%</Option><Option value="amount">$</Option>
                    </Select>
                </Space.Compact>
            )
        },
        {
            title: <span style={{color:'#52c41a'}}>Giá Bán Buôn</span>,
            dataIndex: 'wholesale_price',
            width: 140,
            render: (v: number, r:any) => (
                <div>
                    <InputNumber value={v} onChange={val => handleCellChange(r.id, 'wholesale_price', Number(val))}
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={v => Number(v!.replace(/\$\s?|(,*)/g, ''))}
                        style={{width:'100%', fontWeight:'bold', color:'#52c41a'}}
                    />
                    <div style={{fontSize:10, color:'#999'}}>/{r.wholesale_unit}</div>
                </div>
            )
        },
        {
            title: '', width: 50, fixed: 'right' as const,
            render: (_:any, r:any) => r.is_dirty ? 
                <Button 
                    type="primary" 
                    size="small" 
                    icon={<SyncOutlined spin={savingId === r.id}/>} 
                    loading={savingId === r.id}
                    onClick={() => handleSaveRow(r)} 
                /> 
                : <CheckCircleOutlined style={{color:'#52c41a'}} />
        }
    ];

    return (
        <div style={{ padding: 12 }}>
            <Card bodyStyle={{padding: 16}}>
                <Row gutter={16} align="middle" style={{marginBottom:16}}>
                    <Col span={8}><Title level={4} style={{margin:0}}><ThunderboltOutlined style={{color:'#faad14'}}/> Cài đặt Giá</Title></Col>
                    <Col span={8}><Search placeholder="Tìm sản phẩm..." onSearch={val => setSearchText(val)} onChange={e => setSearchText(e.target.value)} /></Col>
                    <Col span={8} style={{textAlign:'right'}}>
                        <Space>
                            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>Tải Mẫu</Button>
                            <Upload showUploadList={false} beforeUpload={handleFileUpload} accept=".xlsx">
                                <Button type="primary" icon={<UploadOutlined />}>Nhập Excel</Button>
                            </Upload>
                        </Space>
                    </Col>
                </Row>

                <div style={{background:'#e6f7ff', padding:8, marginBottom:12, borderRadius:4, border:'1px solid #91d5ff'}}>
                    <WarningOutlined style={{color:'#1890ff'}}/> Giá vốn nhập là giá của <b>Đơn vị Buôn</b>. Hệ thống tự chia cho hệ số quy đổi để lưu giá gốc.
                </div>

                <Table 
                    dataSource={products} 
                    columns={columns} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{
                        current: pagination.current, pageSize: pagination.pageSize, total: pagination.total,
                        onChange: (p, s) => loadProducts(p, s)
                    }}
                    scroll={{x: 1300, y: 600}}
                    size="small"
                    bordered
                />
            </Card>

            <Modal title="Kết quả Excel" width={800} open={reviewModalVisible} onCancel={() => setReviewModalVisible(false)} onOk={applyExcelMatches}>
                <Table 
                    dataSource={matchedData} 
                    rowKey="rowIndex"
                    columns={[
                        { 
                            title: 'Dữ liệu Excel', 
                            render: (r:any) => (
                                <div>
                                    <div style={{fontWeight:'bold'}}>{r.excel.name}</div>
                                    <div style={{fontSize:12, color:'#666'}}>
                                        Vốn: {r.excel.cost?.toLocaleString()} | 
                                        Lãi Lẻ: {r.excel.retailMargin}{r.excel.retailUnit === 'percent' ? '%' : 'đ'} | 
                                        Lãi Buôn: {r.excel.wholesaleMargin}{r.excel.wholesaleUnit === 'percent' ? '%' : 'đ'}
                                    </div>
                                </div>
                            ) 
                        },
                        { 
                            title: 'Khớp Hệ thống', 
                            render: (r:any) => r.match ? 
                                <Tag color="green">ID: {r.match.id} - {r.match.name}</Tag> : 
                                <Tag color="red">Không khớp</Tag> 
                        }
                    ]} 
                    pagination={false} 
                    scroll={{y:400}} 
                />
            </Modal>
        </div>
    );
};

export default QuickPricePage;