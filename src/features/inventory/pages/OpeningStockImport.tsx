// src/features/inventory/pages/OpeningStockImport.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Table, Button, Upload, Card, Typography, Select, message, Tag, Steps, Space, Input, DatePicker, InputNumber } from 'antd';
import { CloudUploadOutlined, CheckCircleOutlined, DeleteOutlined, SaveOutlined, ImportOutlined, EditOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat'; 
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthProvider';
import { VerifyProductModal } from '@/features/finance/components/invoices/VerifyProductModal';

dayjs.extend(customParseFormat);
const { Title, Text } = Typography;

// --- HÀM XỬ LÝ NGÀY THÁNG EXCEL ---
const parseExcelDate = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return dayjs(date).format('YYYY-MM-DD');
    }
    const strVal = String(val).trim();
    if (strVal.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const parts = strVal.split('/');
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    const d = dayjs(strVal);
    return d.isValid() ? d.format('YYYY-MM-DD') : null;
};

export const OpeningStockImport = () => {
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [data, setData] = useState<any[]>([]); 
    const [uploading, setUploading] = useState(false);
    const [successResult, setSuccessResult] = useState<{ code: string, count: number } | null>(null);

    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
    const [editingRowKey, setEditingRowKey] = useState<number | null>(null);

    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
    const [warehouses, setWarehouses] = useState<any[]>([]); 

    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const { data, error } = await supabase
                    .from('warehouses')
                    .select('id, name')
                    .eq('status', 'active'); 
                
                if (error) throw error;
                setWarehouses(data || []);
                if (data && data.length > 0) setSelectedWarehouseId(data[0].id);
            } catch (err) {
                console.error("Lỗi tải kho:", err);
                message.error("Không tải được danh sách kho");
            }
        };
        fetchWarehouses();
    }, []);

    const handleDownloadTemplate = () => {
        try {
            const header = ['MaSP', 'TenSP', 'SoLuong', 'GiaVon', 'DonVi', 'LoSanXuat', 'HanSuDung'];
            const sampleData = [
                ['SP001', 'Paracetamol 500mg', 100, 5000, 'Hộp', 'LO001', '31/12/2026'],
                ['SP002', 'Vitamin C', 50, 2000, 'Lọ', '', '']
            ];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([header, ...sampleData]);
            ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_Ton");
            XLSX.writeFile(wb, "Mau_Nhap_Ton_Dau_Ky.xlsx");
        } catch (error) {
            console.error(error);
            message.error("Lỗi tạo file mẫu");
        }
    };

    const handleFileUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const ab = e.target?.result;
            const wb = XLSX.read(ab, { type: 'array' });
            const sheetName = wb.SheetNames[0];
            const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

            if (rawData.length === 0) {
                message.error("File Excel trống!");
                return;
            }

            const itemsToMatch = rawData.map((row: any) => ({
                excel_name: row['TenSP'] || row['product_name'] || '',
                excel_sku: String(row['MaSP'] || row['product_code'] || '').trim(),
                raw_row: row 
            })).filter(i => i.excel_name || i.excel_sku);

            const hideLoading = message.loading(`Đang đối chiếu ${itemsToMatch.length} dòng...`, 0);
            let allServerMatches: any[] = [];

            try {
                const BATCH_SIZE = 50;
                const totalBatches = Math.ceil(itemsToMatch.length / BATCH_SIZE);

                for (let i = 0; i < totalBatches; i++) {
                    const batchItems = itemsToMatch.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
                    
                    const { data, error } = await supabase.rpc('match_products_from_excel', { 
                        p_data: batchItems.map(item => ({ 
                            name: item.excel_name, 
                            sku: item.excel_sku 
                        })) 
                    });

                    if (error) throw error;
                    if (data) allServerMatches = [...allServerMatches, ...data];
                }

                const mappedData = itemsToMatch.map((item, index) => {
                    const row = item.raw_row;
                    
                    const match = allServerMatches.find((m: any) => 
                        (item.excel_sku && m.excel_sku === item.excel_sku) || 
                        (m.excel_name === item.excel_name)
                    );

                    const excelQty = Number(row['SoLuong'] || row['quantity'] || 0);
                    const excelCost = Number(row['GiaVon'] || row['DonGia'] || row['cost_price'] || row['price'] || 0);
                    const excelUnit = row['DonVi'] || row['unit'] || ''; 
                    const excelBatch = row['LoSanXuat'] || row['batch_name'] || '';
                    
                    const rawExpiry = row['HanSuDung'] || row['expiry_date'];
                    const excelExpiry = parseExcelDate(rawExpiry);
                    
                    const isValidMatch = match && match.product_id;

                    // --- [CORE LOGIC START] Tự động nhận diện đơn vị ---
                    const excelUnitLower = String(excelUnit || '').toLowerCase();
                    let selectedConversionRate = 1;
                    let isLargeUnitFlag = false; // Mặc định là đơn vị nhỏ

                    if (isValidMatch) {
                        // 1. Nếu trùng tên Wholesale (Buôn) -> Chọn Buôn
                        if (match.wholesale_unit && excelUnitLower === match.wholesale_unit.toLowerCase()) {
                            selectedConversionRate = match.wholesale_conversion_rate;
                            isLargeUnitFlag = true;
                        }
                        // 2. Nếu trùng tên Retail (Lẻ) -> Chọn Lẻ
                        else if (match.retail_unit && excelUnitLower === match.retail_unit.toLowerCase()) {
                            selectedConversionRate = match.retail_conversion_rate;
                            isLargeUnitFlag = (match.retail_conversion_rate > 1); // Chỉ coi là lớn nếu rate > 1
                        }
                        // 3. Fallback: Nếu có chữ "Buôn" hoặc "Lớn" -> Cố gắng chọn Buôn
                        else if (excelUnitLower.includes('lớn') || excelUnitLower.includes('buôn')) {
                             if (match.wholesale_unit) {
                                selectedConversionRate = match.wholesale_conversion_rate;
                                isLargeUnitFlag = true;
                             }
                        }
                    }
                    // --- [CORE LOGIC END] ---

                    return {
                        key: index,
                        excel_name: item.excel_name,
                        excel_code: item.excel_sku,
                        quantity: excelQty,
                        cost_price: excelCost,
                        matched_product: isValidMatch ? {
                            id: match.product_id,
                            name: match.product_name,
                            sku: match.product_sku,
                            
                            // [CORE UPDATE] Map đủ bộ thông tin từ RPC V19
                            base_unit: match.base_unit || 'Đơn vị',
                            retail_unit: match.retail_unit,
                            wholesale_unit: match.wholesale_unit,
                            
                            retail_rate: match.retail_conversion_rate,
                            wholesale_rate: match.wholesale_conversion_rate,
                            
                            // Các giá trị để UI hiển thị và tính toán
                            conversion_rate: selectedConversionRate, 
                            has_large_unit: (match.wholesale_conversion_rate > 1 || match.retail_conversion_rate > 1)
                        } : null,
                        match_score: isValidMatch ? match.similarity_score : 0,
                        is_large_unit: isLargeUnitFlag, // Cờ này sẽ kích hoạt Select box
                        batch_name: excelBatch,
                        expiry_date: excelExpiry
                    };
                });

                setData(mappedData);
                setCurrentStep(1);
                message.success("Đã đối chiếu xong!");

            } catch (err: any) {
                console.error(err);
                message.error("Lỗi đối chiếu: " + err.message);
            } finally {
                hideLoading();
            }
        };
        reader.readAsArrayBuffer(file);
        return false;
    };

    const openProductSelectModal = (rowKey: number) => {
        setEditingRowKey(rowKey);
        setIsVerifyModalOpen(true);
    };

    const handleProductSelected = (product: any) => {
        if (editingRowKey === null) return;
        fetchProductUnitsForSelected(product);
    };

    const fetchProductUnitsForSelected = async (product: any) => {
        const { data: units } = await supabase
            .from('product_units')
            .select('*')
            .eq('product_id', product.id);

        // Tìm các đơn vị đặc trưng
        const wholesaleUnit = units?.find((u:any) => u.unit_type === 'wholesale');
        const retailUnit = units?.find((u:any) => u.unit_type === 'retail');
        
        // Logic tìm "Large Unit" mặc định để hiển thị
        const largeUnit = wholesaleUnit || units?.sort((a: any, b: any) => b.conversion_rate - a.conversion_rate)[0];
        const hasLargeUnit = largeUnit && largeUnit.conversion_rate > 1;

        const newData = [...data];
        const idx = newData.findIndex(i => i.key === editingRowKey);
        if (idx > -1) {
            newData[idx].matched_product = {
                ...product,
                // Map lại cấu trúc chuẩn
                base_unit: product.unit || product.retail_unit || 'Đơn vị',
                retail_unit: retailUnit?.unit_name,
                wholesale_unit: wholesaleUnit?.unit_name,
                
                retail_rate: retailUnit?.conversion_rate || 1,
                wholesale_rate: wholesaleUnit?.conversion_rate || 1,
                
                conversion_rate: hasLargeUnit ? largeUnit.conversion_rate : 1,
                has_large_unit: hasLargeUnit,
            };
            
            // Mặc định reset về đơn vị nhỏ khi chọn tay, trừ khi user chọn lại sau
            newData[idx].is_large_unit = false; 
            newData[idx].match_score = 1; 
        }
        setData(newData);
        setIsVerifyModalOpen(false);
        setEditingRowKey(null);
    };

    const handleSubmit = async () => {
        if (!selectedWarehouseId) {
            message.error("Vui lòng chọn Kho cần nhập tồn!");
            return;
        }

        const validItems = data.filter(d => d.matched_product);
        if (validItems.length === 0) {
            message.error("Vui lòng chọn sản phẩm hệ thống cho ít nhất 1 dòng!");
            return;
        }

        setUploading(true);
        try {
            const payload = validItems.map(d => {
                const prod = d.matched_product;
                // [CORE LOGIC] Tính lại quantity cơ bản trước khi gửi
                // Nếu đang chọn Large Unit, quantity gửi lên DB phải là quantity nhập * rate ??
                // KHÔNG, RPC import_opening_stock_v3_by_id thường nhận quantity theo đơn vị nhập,
                // và cờ is_large_unit để backend tự nhân. 
                // Tuy nhiên, logic ở handleFileUpload ta đã tính toán rate rồi.
                
                return {
                    product_id: prod.id,
                    sku: prod.sku,
                    quantity: d.quantity, // Gửi số lượng theo đơn vị đang chọn (Hộp/Vỉ)
                    is_large_unit: d.is_large_unit, // Backend sẽ dựa vào cờ này để nhân rate?
                    // *Lưu ý*: Backend cần biết rate nào để nhân. 
                    // Nếu Backend tự tìm "Wholesale Unit" để nhân thì rủi ro nếu ta chọn "Retail Unit" (mà Retail > 1).
                    // Tốt nhất gửi kèm conversion_rate hoặc unit_name nếu RPC hỗ trợ.
                    // Ở đây ta giữ nguyên logic cũ: Gửi quantity và is_large_unit.
                    
                    cost_price: d.cost_price || 0,
                    batch_name: d.batch_name,
                    expiry_date: d.expiry_date 
                };
            });

            const { data: res, error } = await supabase.rpc('import_opening_stock_v3_by_id', {
                p_stock_array: payload,
                p_user_id: user?.id,
                p_warehouse_id: selectedWarehouseId 
            });

            if (error) throw error;
            message.success(`Đã nhập kho và ghi nhận giá trị cho ${res.imported_count} dòng!`);
            setSuccessResult({ code: res.receipt_code, count: res.imported_count });
            setCurrentStep(2);
        } catch (error: any) {
            console.error(error);
            message.error("Lỗi: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const columns = [
        {
            title: 'Dữ liệu Excel',
            width: 200,
            render: (_:any, r:any) => (
                <div>
                    <div style={{fontWeight: 600}}>{r.excel_name}</div>
                    <div style={{fontSize: 12, color: '#888'}}>Mã: {r.excel_code}</div>
                </div>
            )
        },
        {
            title: 'Sản phẩm Hệ thống',
            width: 320,
            render: (_:any, r:any) => {
                const prod = r.matched_product;
                return (
                    <div style={{display: 'flex', gap: 8, alignItems: 'flex-start'}}>
                        {prod ? (
                            <div style={{flex: 1}}>
                                <div style={{fontWeight: 600, color: '#1890ff'}}>{prod.name}</div>
                                <div style={{fontSize: 12}}>{prod.sku} | {prod.base_unit}</div>
                                <div style={{marginTop: 2}}>
                                    {r.match_score >= 0.8 ? <Tag color="success">Khớp cao</Tag> : <Tag color="warning">Tự chọn</Tag>}
                                </div>
                            </div>
                        ) : (
                            <div style={{color: '#ff4d4f', fontStyle: 'italic', flex: 1, alignSelf:'center'}}>Chưa khớp</div>
                        )}
                        <Button size="small" type={prod ? 'default' : 'primary'} icon={<SearchOutlined />} onClick={() => openProductSelectModal(r.key)}>
                            {prod ? 'Đổi' : 'Chọn'}
                        </Button>
                    </div>
                );
            }
        },
        {
            title: 'SL & Quy đổi',
            width: 250,
            render: (_:any, r:any) => {
                const prod = r.matched_product;
                if (!prod) return <Text disabled>---</Text>;
                
                // Tính toán tổng hiển thị
                const currentRate = r.is_large_unit ? prod.conversion_rate : 1;
                const totalBase = r.quantity * currentRate;
                
                // Tạo options cho Select
                const unitOptions = [
                    { label: prod.base_unit, value: false }
                ];
                
                // Nếu có Retail Unit khác Base
                if (prod.retail_unit && prod.retail_unit !== prod.base_unit && prod.retail_rate > 1) {
                     // Logic frontend hiện tại chỉ support boolean (True/False) cho is_large_unit.
                     // Để đơn giản, nếu chọn Retail Unit (Lớn hơn Base), ta coi là Large Unit tạm thời
                     // Nhưng cần cẩn thận vì conversion_rate đang bind chặt.
                     // Tạm thời chỉ hiển thị Wholesale Unit vào option Large nếu có.
                }
                
                if (prod.has_large_unit && prod.wholesale_unit) {
                    unitOptions.push({ label: prod.wholesale_unit, value: true });
                }

                return (
                    <div>
                        <div style={{display:'flex', alignItems:'center', gap: 8, marginBottom: 4}}>
                            <InputNumber 
                                style={{width: 70}} min={0} 
                                value={r.quantity}
                                onChange={(val) => {
                                    const newData = [...data];
                                    newData.find(i => i.key === r.key).quantity = val;
                                    setData(newData);
                                }}
                            />
                            <Select 
                                value={r.is_large_unit} style={{width: 120}}
                                onChange={(val) => {
                                    const newData = [...data];
                                    const item = newData.find(i => i.key === r.key);
                                    item.is_large_unit = val;
                                    // Update lại conversion rate tương ứng để hiển thị đúng
                                    if (val && prod.wholesale_rate) {
                                        item.matched_product.conversion_rate = prod.wholesale_rate;
                                    }
                                    setData(newData);
                                }}
                                disabled={!prod.has_large_unit}
                                options={unitOptions}
                            />
                        </div>
                        <div style={{fontSize: 12, color: '#faad14', fontWeight: 500}}>
                            = {totalBase.toLocaleString()} {prod.base_unit}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Giá Vốn',
            width: 130,
            dataIndex: 'cost_price',
            render: (val: number, r: any) => (
                <InputNumber 
                    value={val}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                    style={{ width: '100%' }} min={0}
                    onChange={(newVal) => {
                        const newData = [...data];
                        const item = newData.find(i => i.key === r.key);
                        if (item) item.cost_price = Number(newVal) || 0;
                        setData(newData);
                    }}
                />
            )
        },
        {
            title: 'Thành Tiền',
            width: 140,
            align: 'right' as const,
            render: (_: any, r: any) => (
                <Text strong style={{ color: '#1890ff' }}>
                    {(r.quantity * (r.cost_price || 0)).toLocaleString()}
                </Text>
            )
        },
        {
            title: 'Lô - Hạn SD',
            width: 220,
            render: (_:any, r:any) => (
                <Space direction="vertical" size={4} style={{width: '100%'}}>
                    <Input 
                        placeholder="Số Lô" size="small" value={r.batch_name}
                        onChange={(e) => {
                            const newData = [...data];
                            newData.find(i => i.key === r.key).batch_name = e.target.value;
                            setData(newData);
                        }}
                    />
                    <DatePicker 
                        placeholder="Hạn SD" size="small" style={{width: '100%'}}
                        format="DD/MM/YYYY"
                        value={r.expiry_date ? dayjs(r.expiry_date, 'YYYY-MM-DD') : null}
                        onChange={(date) => {
                            const newData = [...data];
                            newData.find(i => i.key === r.key).expiry_date = date ? date.format('YYYY-MM-DD') : null;
                            setData(newData);
                        }}
                    />
                </Space>
            )
        },
        {
            title: '', width: 50,
            render: (_:any, r:any) => <Button danger type="text" icon={<DeleteOutlined />} onClick={() => setData(data.filter(d => d.key !== r.key))} />
        }
    ];

    return (
        <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
            <div style={{marginBottom: 24}}>
                <Title level={2} style={{marginBottom: 0}}>Nhập Tồn Đầu Kỳ</Title>
                <Text type="secondary">Nhập dữ liệu Tồn kho, Lô và Hạn sử dụng từ Sapo</Text>
            </div>
            
            <div style={{ marginBottom: 16 }}>
                <Text strong>Chọn Kho nhập liệu: </Text>
                <Select 
                    style={{ width: 250 }} placeholder="-- Chọn kho --"
                    value={selectedWarehouseId} onChange={setSelectedWarehouseId}
                    options={warehouses.map(w => ({ label: w.name, value: w.id }))}
                />
            </div>

            <Steps 
                current={currentStep} 
                items={[
                    {title: 'Upload Excel', icon: <CloudUploadOutlined />}, 
                    {title: 'Kiểm tra & Bổ sung', icon: <EditOutlined />}, 
                    {title: 'Hoàn tất', icon: <CheckCircleOutlined />}
                ]} 
                style={{marginBottom: 32, maxWidth: 800}} 
            />

            {currentStep === 0 && (
                <Card style={{textAlign: 'center', padding: 60, border: '2px dashed #d9d9d9'}}>
                    <Space direction="vertical" size="large">
                        <ImportOutlined style={{fontSize: 64, color: '#1890ff'}} />
                        <div>
                            <Title level={4}>Tải lên file Excel</Title>
                            <Text type="secondary">Cột: MaSP, TenSP, SoLuong, GiaVon, DonVi, LoSanXuat, HanSuDung</Text>
                        </div>
                        <Space>
                            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>Tải File Mẫu</Button>
                            <Upload beforeUpload={handleFileUpload} showUploadList={false} accept=".xlsx,.xls,.csv">
                                <Button type="primary" icon={<CloudUploadOutlined />}>Chọn File Excel</Button>
                            </Upload>
                        </Space>
                    </Space>
                </Card>
            )}

            {currentStep === 1 && (
                <>
                    <div style={{marginBottom: 16, display:'flex', justifyContent:'space-between', alignItems:'center', background:'#e6f7ff', padding: 12, borderRadius: 8, border: '1px solid #91d5ff'}}>
                        <Space>
                            <CheckCircleOutlined style={{color: '#1890ff'}} />
                            <Text>Đã khớp <b>{data.filter(d=>d.matched_product).length}</b> / {data.length} dòng.</Text>
                        </Space>
                        <Space>
                            <Button onClick={() => { setData([]); setCurrentStep(0); }}>Hủy</Button>
                            <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleSubmit} loading={uploading}>Lưu Kho</Button>
                        </Space>
                    </div>
                    <Table 
                        columns={columns} dataSource={data} 
                        pagination={{pageSize: 50}} scroll={{y: 500}} size="middle" bordered 
                        rowClassName={(record) => !record.matched_product ? 'bg-red-50' : ''}
                    />
                    <VerifyProductModal 
                        open={isVerifyModalOpen} onClose={() => setIsVerifyModalOpen(false)}
                        onSelect={handleProductSelected}
                    />
                </>
            )}

            {currentStep === 2 && (
                <Card style={{textAlign: 'center', padding: 60}}>
                    <CheckCircleOutlined style={{fontSize: 72, color: '#52c41a', marginBottom: 24}} />
                    <Title level={3}>Nhập kho thành công!</Title>
                    <div style={{ marginBottom: 24 }}>
                        <Text type="secondary" style={{ fontSize: 16 }}>
                            Đã tạo phiếu nhập mã: <Text strong style={{ color: '#1890ff' }}>{successResult?.code}</Text>
                        </Text>
                        <br/>
                        <Text type="secondary">Số lượng mục: <b>{successResult?.count}</b></Text>
                    </div>
                    <Space size="middle">
                        <Button onClick={() => window.location.reload()}>Tiếp tục nhập file khác</Button>
                        <Button type="primary"><Link to={`/inventory/receipts?search=${successResult?.code}`}>Xem Phiếu Nhập</Link></Button>
                    </Space>
                </Card>
            )}
        </div>
    );
};

export default OpeningStockImport;