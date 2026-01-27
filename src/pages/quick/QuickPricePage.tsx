// src/pages/quick/QuickPricePage.tsx
import React, { useState, useEffect } from 'react';
import { 
    Table, Input, InputNumber, Button, Typography, 
    Card, Space, Upload, Modal, Tag, message, Row, Col, Select, Pagination 
} from 'antd';
import { 
    UploadOutlined, ThunderboltOutlined, 
    CheckCircleOutlined, DownloadOutlined
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
    wholesale_rate: number;
    retail_rate: number; // [NEW]
    retail_unit_name: string; // [NEW]

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
    if (!val) return 'amount'; 
    if (String(val).includes('%')) return 'percent';
    return 'amount';
};

const QuickPricePage: React.FC = () => {
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [products, setProducts] = useState<ProductPriceRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');
    
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
                    id, name, sku, image_url, actual_cost,
                    retail_margin_value, retail_margin_type, wholesale_margin_value, wholesale_margin_type,
                    units:product_units ( id, unit_name, conversion_rate, price, is_base, unit_type, price_cost )
                `, { count: 'exact' })
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (debouncedSearch) {
                query = query.or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%`);
            }

            const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
            if (error) throw error;

            const rows = (data || []).map((p: any) => {
                const units = p.units || [];
                const wholesaleUnitObj = units.find((u: any) => u.unit_type === 'wholesale') 
                                      || units.find((u: any) => !u.is_base && u.conversion_rate > 1)
                                      || units.find((u: any) => u.is_base);

                const retailUnitObj = units.find((u: any) => u.unit_type === 'retail') || units.find((u: any) => u.is_base) || units[0];
                const rate = wholesaleUnitObj?.conversion_rate || 1;
                const retailRate = retailUnitObj?.conversion_rate || 1; // [NEW] Lấy hệ số lẻ
                
                // Hiển thị giá vốn theo đơn vị Buôn
                const displayCost = (p.actual_cost || 0) * rate;

                return {
                    key: p.id, id: p.id, name: p.name, sku: p.sku, imageUrl: p.image_url,
                    base_unit: retailUnitObj?.unit_name || '---',
                    wholesale_unit: wholesaleUnitObj?.unit_name || '---',
                    wholesale_rate: rate,
                    retail_rate: retailRate, // [NEW]
                    retail_unit_name: retailUnitObj?.unit_name || '---', // [NEW]
                    actual_cost: displayCost,
                    
                    // Map đúng cột Margin từ DB
                    retail_margin: p.retail_margin_value || 0,
                    retail_margin_type: p.retail_margin_type || 'amount',
                    retail_price: retailUnitObj?.price || 0,

                    wholesale_margin: p.wholesale_margin_value || 0,
                    wholesale_margin_type: p.wholesale_margin_type || 'amount',
                    wholesale_price: wholesaleUnitObj?.price || 0,

                    is_dirty: false
                };
            });
            
            setProducts(rows as ProductPriceRow[]);
            setPagination(prev => ({ ...prev, current: page, pageSize, total: count || 0 }));

        } catch (error: any) {
            message.error("Lỗi tải: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- 2. CALCULATION & INPUT ---
    const calculateDependentValues = (item: ProductPriceRow, changedField: string, value: any): Partial<ProductPriceRow> => {
        let updates: any = { [changedField]: value };
        const newItem = { ...item, ...updates };
        
        // Tính Giá Lẻ
        if (['actual_cost', 'retail_margin', 'retail_margin_type'].includes(changedField)) {
            let margin = newItem.retail_margin;
            
            // Nếu lãi % -> Tính % trên giá vốn BUÔN
            if (newItem.retail_margin_type === 'percent') {
                margin = newItem.actual_cost * (newItem.retail_margin / 100);
            }
            
            // Giá bán Buôn (đã cộng lãi) = Cost + Margin
            const pricePerWholesaleUnit = newItem.actual_cost + margin;
            
            // Giá bán cho 1 đơn vị Base = Giá Buôn / Hệ số Buôn
            const pricePerBase = pricePerWholesaleUnit / newItem.wholesale_rate;
            
            // Giá bán cho 1 đơn vị Lẻ (Vỉ) = Giá Base * Hệ số Lẻ
            updates.retail_price = Math.ceil(pricePerBase * (newItem.retail_rate || 1));
        }

        // Tính Giá Buôn
        if (['actual_cost', 'wholesale_margin', 'wholesale_margin_type'].includes(changedField)) {
            let margin = newItem.wholesale_margin;
            if (newItem.wholesale_margin_type === 'percent') {
                margin = newItem.actual_cost * (newItem.wholesale_margin / 100);
            }
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

    // --- 3. SAVE SINGLE ROW ---
    const handleSaveRow = async (row: ProductPriceRow) => {
        setSavingId(row.id);
        try {
            const baseCost = row.actual_cost / (row.wholesale_rate || 1);
            const payload = [{
                product_id: row.id,
                actual_cost: baseCost,
                retail_price: row.retail_price,
                wholesale_price: row.wholesale_price,
                // [FIX] Gửi đầy đủ margin
                retail_margin: row.retail_margin,
                retail_margin_type: row.retail_margin_type,
                wholesale_margin: row.wholesale_margin,
                wholesale_margin_type: row.wholesale_margin_type
            }];

            const { error } = await supabase.rpc('bulk_update_product_prices', { p_data: payload });
            if (error) throw error;

            message.success("Đã lưu!");
            setProducts(prev => prev.map(p => p.id === row.id ? { ...p, is_dirty: false } : p));
        } catch (e: any) {
            message.error("Lỗi lưu: " + e.message);
        } finally {
            setSavingId(null);
        }
    };

    // --- 4. EXCEL LOGIC (Full Fix) ---
    const handleDownloadTemplate = () => {
        const header = ['SKU', 'Tên sản phẩm', 'Giá Vốn', 'Lãi Lẻ', 'Đơn vị Lãi Lẻ (%/VNĐ)', 'Lãi Buôn', 'Đơn vị Lãi Buôn (%/VNĐ)', 'Giá Bán Lẻ (Cố định)', 'Giá Bán Buôn (Cố định)'];
        const sampleData = [['PAN001', 'Panadol Extra', 100000, 20, '%', 5, '%', 15000, 12000], ['EFF001', 'Efferalgan', 50000, 5000, 'VNĐ', 2000, 'VNĐ', '', 48000]];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([header, ...sampleData]);
        ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, "Mau_Cap_Nhat_Gia");
        XLSX.writeFile(wb, "Mau_Cap_Nhat_Gia_V3.xlsx");
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

    const parseNumber = (val: any) => {
        if (val === undefined || val === null || String(val).trim() === '') return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
    };

    const processExcelData = async (rows: any[]) => {
        const itemsToMatch = rows.map(r => ({
            name: r['Tên sản phẩm'], 
            sku: String(r['SKU'] || '').trim(),
            cost: parseNumber(r['Giá Vốn']),
            retailMargin: parseNumber(r['Lãi Lẻ']),
            retailUnit: parseUnitType(r['Đơn vị Lãi Lẻ (%/VNĐ)']),
            wholesaleMargin: parseNumber(r['Lãi Buôn']),
            wholesaleUnit: parseUnitType(r['Đơn vị Lãi Buôn (%/VNĐ)']),
            fixedRetailPrice: parseNumber(r['Giá Bán Lẻ (Cố định)']),
            fixedWholesalePrice: parseNumber(r['Giá Bán Buôn (Cố định)'])
        })).filter(i => i.name || i.sku);

        if (itemsToMatch.length === 0) return message.warning("File rỗng");

        // [FIX] Tách biến loading ra khỏi vòng lặp để tránh lỗi scope
        const hideLoading = message.loading("Đang đối chiếu...", 0);
        let allServerMatches: any[] = [];

        try {
            const BATCH_SIZE = 50; 
            const totalBatches = Math.ceil(itemsToMatch.length / BATCH_SIZE);
            
            for (let i = 0; i < totalBatches; i++) {
                const batchItems = itemsToMatch.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
                const { data } = await supabase.rpc('match_products_from_excel', { 
                    p_data: batchItems.map(item => ({ name: item.name, sku: item.sku })) 
                });
                if (data) allServerMatches = [...allServerMatches, ...data];
            }

            const result = itemsToMatch.map((excelItem, idx) => {
                const match = allServerMatches.find((m: any) => 
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
            message.error("Lỗi: " + err.message);
        } finally {
            hideLoading(); // [FIX] Luôn tắt loading
        }
    };

    const applyExcelMatches = async () => {
        setLoading(true);
        try {
            const matchedItems = matchedData.filter(m => m.match?.id);
            const productIds = matchedItems.map(m => m.match.id);

            // Fetch Units để lấy rate
            const { data: dbUnits } = await supabase.from('product_units')
                .select('product_id, unit_type, is_base, conversion_rate').in('product_id', productIds);

            const payload: any[] = [];
            const uiUpdates = new Map<number, Partial<ProductPriceRow>>();

            matchedItems.forEach(item => {
                const pid = item.match.id;
                const pUnits = dbUnits?.filter((u:any) => u.product_id === pid) || [];
                const wholesaleUnit = pUnits.find((u:any) => u.unit_type === 'wholesale') 
                                   || pUnits.find((u:any) => !u.is_base && u.conversion_rate > 1);
                const rate = wholesaleUnit?.conversion_rate || 1;

                const excelCost = item.excel.cost;
                let baseCost = excelCost !== undefined ? excelCost / rate : undefined;

                // Tính Giá Lẻ
                let retailPrice = undefined;
                if (item.excel.fixedRetailPrice !== undefined) {
                    retailPrice = item.excel.fixedRetailPrice;
                } else if (excelCost !== undefined && item.excel.retailMargin !== undefined) {
                    let mAmount = item.excel.retailMargin;
                    if (item.excel.retailUnit === 'percent') mAmount = excelCost * (item.excel.retailMargin / 100);
                    retailPrice = Math.ceil((excelCost + mAmount) / rate);
                }

                // Tính Giá Buôn
                let wholesalePrice = undefined;

                if (item.excel.fixedWholesalePrice !== undefined) {
                    wholesalePrice = item.excel.fixedWholesalePrice;
                } else if (excelCost !== undefined && item.excel.wholesaleMargin !== undefined) {
                    let mAmount = item.excel.wholesaleMargin;
                    if (item.excel.wholesaleUnit === 'percent') mAmount = excelCost * (item.excel.wholesaleMargin / 100);
                    wholesalePrice = Math.ceil(excelCost + mAmount);
                }

                payload.push({
                    product_id: pid,
                    actual_cost: baseCost,
                    retail_price: retailPrice,
                    wholesale_price: wholesalePrice,
                    // [FIX] Gửi margin lên để lưu
                    retail_margin: item.excel.retailMargin,
                    retail_margin_type: item.excel.retailUnit,
                    wholesale_margin: item.excel.wholesaleMargin,
                    wholesale_margin_type: item.excel.wholesaleUnit
                });

                // Update UI Local (Giả lập hiển thị để user thấy ngay)
                const updateObj: any = { is_dirty: false };
                if (excelCost !== undefined) updateObj.actual_cost = excelCost;
                if (retailPrice !== undefined) updateObj.retail_price = retailPrice;
                if (wholesalePrice !== undefined) updateObj.wholesale_price = wholesalePrice;
                if (item.excel.retailMargin !== undefined) updateObj.retail_margin = item.excel.retailMargin;
                
                uiUpdates.set(pid, updateObj);
            });

            if (payload.length > 0) {
                const { error } = await supabase.rpc('bulk_update_product_prices', { p_data: payload });
                if (error) throw error;
                message.success(`Đã cập nhật ${payload.length} sản phẩm!`);
                
                // Update State
                setProducts(prev => prev.map(p => {
                    if (uiUpdates.has(p.id)) return { ...p, ...uiUpdates.get(p.id) };
                    return p;
                }));
            }
            setReviewModalVisible(false);
        } catch (err: any) {
            message.error("Lỗi lưu: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
      {
        title: 'Sản phẩm',
        dataIndex: 'name',
        key: 'name',
        width: 300,
        render: (_: any, record: ProductPriceRow) => (
          <Space>
            {record.imageUrl && <img src={record.imageUrl} alt="" style={{width: 40, height: 40, objectFit: 'cover'}} />}
            <div>
              <div style={{fontWeight: 500}}>{record.name}</div>
              <div style={{fontSize: 12, color: '#888'}}>SKU: {record.sku}</div>
            </div>
          </Space>
        )
      },
      {
        title: `Giá Vốn (${products[0]?.wholesale_unit || 'ĐV Buôn'})`,
        key: 'actual_cost',
        width: 150,
        render: (_: any, record: ProductPriceRow) => (
          <InputNumber
            style={{ width: '100%' }}
            value={record.actual_cost}
            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
            onChange={(val) => handleCellChange(record.key, 'actual_cost', val)}
          />
        )
      },
      {
        title: 'Lãi Lẻ (Cấu hình)',
        key: 'retail_margin',
        width: 180,
        render: (_: any, record: ProductPriceRow) => (
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              style={{ width: '60%' }}
              value={record.retail_margin}
              onChange={(val) => handleCellChange(record.key, 'retail_margin', val)}
            />
            <Select 
              style={{ width: '40%' }}
              value={record.retail_margin_type}
              onChange={(val) => handleCellChange(record.key, 'retail_margin_type', val)}
            >
              <Option value="percent">%</Option>
              <Option value="amount">VNĐ</Option>
            </Select>
          </Space.Compact>
        )
      },
      {
        title: `Giá Lẻ (${products[0]?.retail_unit_name || 'ĐV Lẻ'})`,
        key: 'retail_price',
        width: 150,
        render: (_: any, record: ProductPriceRow) => (
          <div style={{ fontWeight: 'bold', color: '#1677ff' }}>
             {new Intl.NumberFormat('vi-VN').format(record.retail_price)} ₫
          </div>
        )
      },
      {
         title: 'Lãi Buôn',
         key: 'wholesale_margin',
         width: 180,
         render: (_: any, record: ProductPriceRow) => (
           <Space.Compact style={{ width: '100%' }}>
             <InputNumber
               style={{ width: '60%' }}
               value={record.wholesale_margin}
               onChange={(val) => handleCellChange(record.key, 'wholesale_margin', val)}
             />
             <Select 
               style={{ width: '40%' }}
               value={record.wholesale_margin_type}
               onChange={(val) => handleCellChange(record.key, 'wholesale_margin_type', val)}
             >
               <Option value="percent">%</Option>
               <Option value="amount">VNĐ</Option>
             </Select>
           </Space.Compact>
         )
       },
       {
         title: `Giá Buôn (${products[0]?.wholesale_unit || 'ĐV Buôn'})`,
         key: 'wholesale_price',
         width: 150,
         render: (_: any, record: ProductPriceRow) => (
            <div style={{ fontWeight: 'bold', color: '#52c41a' }}>
                 {new Intl.NumberFormat('vi-VN').format(record.wholesale_price)} ₫
            </div>
         )
       },
       {
        title: 'Hành động',
        key: 'action',
        fixed: 'right' as const,
        width: 100,
        render: (_: any, record: ProductPriceRow) => (
            <Button 
                type="primary" 
                icon={<CheckCircleOutlined />} 
                disabled={!record.is_dirty}
                loading={savingId === record.id}
                onClick={() => handleSaveRow(record)}
            />
        )
      }
    ];

    return (
        <Card>
            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                <Col>
                    <Title level={4}><ThunderboltOutlined /> Cập nhật giá nhanh</Title>
                </Col>
                <Col>
                    <Space>
                        <Search 
                            placeholder="Tìm tên hoặc SKU..." 
                            allowClear 
                            onSearch={val => setSearchText(val)}
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: 300 }} 
                        />
                        <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                            File Mẫu
                        </Button>
                        <Upload 
                            beforeUpload={handleFileUpload} 
                            showUploadList={false} 
                            accept=".xlsx,.xls"
                        >
                            <Button icon={<UploadOutlined />} type="primary">Import Excel</Button>
                        </Upload>
                    </Space>
                </Col>
            </Row>

            <Table 
                dataSource={products} 
                columns={columns} 
                rowKey="key"
                loading={loading}
                pagination={false}
                scroll={{ x: 1300, y: 600 }}
                size="small"
                bordered
            />
             <Pagination
                style={{ marginTop: 16, textAlign: 'right' }}
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onChange={(p, ps) => loadProducts(p, ps)}
                showSizeChanger
            />

            {/* MODAL REVIEW EXCEL */}
            <Modal
                title={`Kết quả đối chiếu Excel (${matchedData.filter(m => m.match).length}/${matchedData.length})`}
                open={reviewModalVisible}
                onOk={applyExcelMatches}
                onCancel={() => setReviewModalVisible(false)}
                width={800}
                confirmLoading={loading}
                okText="Áp dụng thay đổi"
                cancelText="Hủy"
            >
                <Table
                    dataSource={matchedData}
                    rowKey="rowIndex"
                    scroll={{ y: 400 }}
                    pagination={false}
                    size="small"
                    columns={[
                        { title: 'Excel: Tên SP', dataIndex: ['excel', 'name'], width: 200 },
                        { title: 'Excel: Giá Vốn', dataIndex: ['excel', 'cost'], width: 100, render: (v) => v ? v.toLocaleString() : '-' },
                        { 
                            title: 'Khớp với hệ thống', 
                            key: 'match',
                            render: (_, record) => record.match ? (
                                <Tag color="green">
                                    {record.match.name} ({record.match.sku})
                                </Tag>
                            ) : <Tag color="red">Không tìm thấy</Tag>
                        },
                         { 
                            title: 'Giá Mới (Dự kiến)', 
                            key: 'preview',
                            render: (_, record) => {
                                if(!record.match) return '-';
                                return (
                                    <Space direction="vertical" size={0} style={{fontSize: 11}}>
                                        {record.excel.cost && <div>Vốn: {record.excel.cost.toLocaleString()}</div>}
                                        {/* Hiển thị Giá Lẻ */}
                                        {record.excel.fixedRetailPrice ? (
                                            <div style={{color: 'blue'}}>Lẻ (Chốt): {record.excel.fixedRetailPrice.toLocaleString()}</div>
                                        ) : (
                                            record.excel.retailMargin && <div>Lẻ (Tính): ...</div>
                                        )}
                                        {/* Hiển thị Giá Buôn [NEW] */}
                                        {record.excel.fixedWholesalePrice ? (
                                            <div style={{color: 'green', fontWeight: 'bold'}}>Buôn (Chốt): {record.excel.fixedWholesalePrice.toLocaleString()}</div>
                                        ) : (
                                            record.excel.wholesaleMargin && <div>Buôn (Tính): ...</div>
                                        )}
                                    </Space>
                                )
                            }
                        }
                    ]}
                />
            </Modal>
        </Card>
    );
};

export default QuickPricePage;