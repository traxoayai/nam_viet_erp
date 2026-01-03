import { useState, useEffect } from 'react';
import { Table, Button, Upload, Card, Typography, Select, message, Tag, Steps, Space, Input, DatePicker } from 'antd';
import { CloudUploadOutlined, CheckCircleOutlined, DeleteOutlined, SaveOutlined, ImportOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthProvider';
import { findBestMatch } from '@/shared/utils/stringMatching';
// Import Modal tìm kiếm
import { VerifyProductModal } from '@/features/finance/components/invoices/VerifyProductModal';

const { Title, Text } = Typography;

export const OpeningStockImport = () => {
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [data, setData] = useState<any[]>([]); 
    const [uploading, setUploading] = useState(false);
    
    // State dữ liệu hệ thống
    const [systemProducts, setSystemProducts] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);

    // State cho Modal tìm kiếm
    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
    const [editingRowKey, setEditingRowKey] = useState<number | null>(null);

    // 1. [QUAN TRỌNG] Tải toàn bộ sản phẩm hệ thống (Fetch All - Cuốn chiếu)
    useEffect(() => {
        const fetchAllProducts = async () => {
            setLoadingProducts(true);
            let allProducts: any[] = [];
            let from = 0;
            const step = 1000; 
            let hasMore = true;

            try {
                while (hasMore) {
                    // [CORE FIX]: Lấy đúng cột 'retail_unit' và 'sku'
                    const { data: products, error } = await supabase
                        .from('products')
                        .select(`
                            id, 
                            sku, 
                            name, 
                            retail_unit, 
                            product_units (
                                unit_name, 
                                conversion_rate, 
                                unit_type
                            )
                        `)
                        .range(from, from + step - 1);

                    if (error) throw error;

                    if (products && products.length > 0) {
                        allProducts = [...allProducts, ...products];
                        from += step;
                        if (products.length < step) hasMore = false;
                    } else {
                        hasMore = false;
                    }
                }

                // Xử lý dữ liệu (Mapping đơn vị)
                const processedProducts = allProducts.map(p => {
                    const units = p.product_units || [];
                    
                    const largeUnit = units.sort((a: any, b: any) => {
                        if (a.unit_type === 'wholesale') return -1;
                        return b.conversion_rate - a.conversion_rate;
                    })[0];

                    const hasLargeUnit = largeUnit && largeUnit.conversion_rate > 1;

                    return {
                        ...p,
                        // Map lại tên cho thống nhất
                        unit: p.retail_unit, 
                        base_unit: p.retail_unit,
                        large_unit_name: hasLargeUnit ? largeUnit.unit_name : null,
                        conversion_rate: hasLargeUnit ? largeUnit.conversion_rate : 1,
                        has_large_unit: hasLargeUnit
                    };
                });

                setSystemProducts(processedProducts);
            } catch (err: any) {
                console.error("Lỗi tải sản phẩm:", err);
                message.error("Không tải được dữ liệu sản phẩm: " + err.message);
            } finally {
                setLoadingProducts(false);
            }
        };

        fetchAllProducts();
    }, []);

    // 2. Xử lý File Excel
    const handleFileUpload = (file: File) => {
        if (systemProducts.length === 0) {
            message.warning("Đang tải danh sách sản phẩm, vui lòng đợi...");
            return false;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const ab = e.target?.result;
            const wb = XLSX.read(ab, { type: 'array' });
            const sheetName = wb.SheetNames[0];
            const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

            if (rawData.length === 0) {
                message.error("File Excel trống!");
                return;
            }

            message.loading("Đang đối chiếu dữ liệu...", 1);

            const mappedData = rawData.map((row: any, index) => {
                const excelName = row['TenSP'] || row['product_name'] || '';
                const excelCode = row['MaSP'] || row['product_code'] || '';
                const excelQty = Number(row['SoLuong'] || row['quantity'] || 0);
                const excelCost = Number(row['GiaVon'] || row['cost_price'] || 0);
                const excelUnit = row['DonVi'] || row['unit'] || ''; 
                const excelBatch = row['LoSanXuat'] || row['batch_name'] || '';
                
                // Xử lý Hạn dùng
                let excelExpiry = null;
                if (row['HanSuDung'] || row['expiry_date']) {
                    excelExpiry = row['HanSuDung'] || row['expiry_date'];
                }

                // Thuật toán tìm kiếm (Chạy trên RAM máy tính)
                const matchResult = findBestMatch(excelName, systemProducts);

                // Logic nhận diện đơn vị Lớn
                let isLarge = false;
                if (excelUnit && (excelUnit.toString().toLowerCase().includes('lớn') || excelUnit.toString().toLowerCase().includes('buôn'))) {
                    isLarge = true;
                }

                return {
                    key: index,
                    excel_name: excelName,
                    excel_code: excelCode,
                    quantity: excelQty,
                    cost_price: excelCost,
                    
                    // Kết quả Auto-match
                    matched_product: matchResult.product, // Lưu cả object product
                    match_score: matchResult.score,
                    
                    is_large_unit: isLarge,
                    batch_name: excelBatch,
                    expiry_date: excelExpiry
                };
            });

            setData(mappedData);
            setCurrentStep(1);
        };
        reader.readAsArrayBuffer(file);
        return false;
    };

    // 3. Các hàm Modal tìm kiếm (VerifyProductModal)
    const openProductSelectModal = (rowKey: number) => {
        setEditingRowKey(rowKey);
        setIsVerifyModalOpen(true);
    };

    const handleProductSelected = (product: any) => {
        if (editingRowKey === null) return;
        // Gọi hàm để lấy thêm thông tin đơn vị cho SP vừa chọn
        fetchProductUnitsForSelected(product);
    };

    const fetchProductUnitsForSelected = async (product: any) => {
        // Lấy thông tin quy đổi (Vì Modal Search chỉ trả về thông tin cơ bản)
        const { data: units } = await supabase
            .from('product_units')
            .select('*')
            .eq('product_id', product.id);

        const largeUnit = units?.sort((a: any, b: any) => {
            if (a.unit_type === 'wholesale') return -1;
            return b.conversion_rate - a.conversion_rate;
        })[0];
        
        const hasLargeUnit = largeUnit && largeUnit.conversion_rate > 1;

        const newData = [...data];
        const idx = newData.findIndex(i => i.key === editingRowKey);
        if (idx > -1) {
            newData[idx].matched_product = {
                ...product,
                large_unit_name: hasLargeUnit ? largeUnit.unit_name : null,
                conversion_rate: hasLargeUnit ? largeUnit.conversion_rate : 1,
                has_large_unit: hasLargeUnit,
                base_unit: product.retail_unit || product.unit 
            };
            // Reset đơn vị về Lẻ nếu SP mới không có đơn vị lớn
            if (!hasLargeUnit) newData[idx].is_large_unit = false;
            // Set điểm tin cậy tuyệt đối vì user chọn tay
            newData[idx].match_score = 1; 
        }
        setData(newData);
        setIsVerifyModalOpen(false);
        setEditingRowKey(null);
    };

    // 4. Submit
    const handleSubmit = async () => {
        const validItems = data.filter(d => d.matched_product);
        if (validItems.length === 0) {
            message.error("Vui lòng chọn sản phẩm hệ thống cho ít nhất 1 dòng!");
            return;
        }

        setUploading(true);
        try {
            const payload = validItems.map(d => ({
                product_id: d.matched_product.id,
                quantity: d.quantity,
                is_large_unit: d.is_large_unit,
                cost_price: d.cost_price,
                batch_name: d.batch_name,
                expiry_date: d.expiry_date ? dayjs(d.expiry_date).format('YYYY-MM-DD') : null
            }));

            // Gọi RPC V6 (Đã hỗ trợ Lô & Hạn)
            const { data: res, error } = await supabase.rpc('import_opening_stock_v6_full', {
                p_stock_array: payload,
                p_user_id: user?.id,
                p_warehouse_id: 1 
            });

            if (error) throw error;
            message.success(`Đã nhập kho thành công ${res.imported_count} dòng!`);
            setCurrentStep(2);
        } catch (error: any) {
            console.error(error);
            message.error("Lỗi: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    // --- COLUMNS ---
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
                                {/* Hiển thị độ khớp */}
                                <div style={{marginTop: 2}}>
                                    {r.match_score >= 0.8 ? <Tag color="success">Khớp cao</Tag> : <Tag color="warning">Tự chọn</Tag>}
                                </div>
                            </div>
                        ) : (
                            <div style={{color: '#ff4d4f', fontStyle: 'italic', flex: 1, alignSelf:'center'}}>Chưa khớp</div>
                        )}
                        
                        <Button 
                            size="small" 
                            type={prod ? 'default' : 'primary'} 
                            icon={<SearchOutlined />} 
                            onClick={() => openProductSelectModal(r.key)}
                        >
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

                const totalBase = r.is_large_unit 
                    ? r.quantity * prod.conversion_rate 
                    : r.quantity;

                return (
                    <div>
                        <div style={{display:'flex', alignItems:'center', gap: 8, marginBottom: 4}}>
                            <Input 
                                style={{width: 70, textAlign:'center'}} 
                                value={r.quantity}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const newData = [...data];
                                    newData.find(i => i.key === r.key).quantity = val;
                                    setData(newData);
                                }}
                            />
                            <Select 
                                value={r.is_large_unit}
                                style={{width: 120}}
                                onChange={(val) => {
                                    const newData = [...data];
                                    newData.find(i => i.key === r.key).is_large_unit = val;
                                    setData(newData);
                                }}
                                disabled={!prod.has_large_unit}
                                options={[
                                    { label: prod.base_unit, value: false },
                                    ...(prod.has_large_unit ? [{ label: prod.large_unit_name, value: true }] : [])
                                ]}
                            />
                        </div>
                        <div style={{fontSize: 12, color: '#faad14', fontWeight: 500}}>
                            = {totalBase.toLocaleString()} {prod.base_unit}
                            {r.is_large_unit && <span style={{fontWeight:'normal', color:'#888'}}> (1 {prod.large_unit_name} = {prod.conversion_rate} {prod.base_unit})</span>}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Lô - Hạn SD',
            width: 220,
            render: (_:any, r:any) => (
                <Space direction="vertical" size={4} style={{width: '100%'}}>
                    <Input 
                        placeholder="Số Lô" 
                        size="small" 
                        value={r.batch_name}
                        onChange={(e) => {
                            const newData = [...data];
                            newData.find(i => i.key === r.key).batch_name = e.target.value;
                            setData(newData);
                        }}
                    />
                    <DatePicker 
                        placeholder="Hạn SD" 
                        size="small" 
                        style={{width: '100%'}}
                        format="DD/MM/YYYY"
                        value={r.expiry_date ? dayjs(r.expiry_date) : null}
                        onChange={(date) => {
                            const newData = [...data];
                            newData.find(i => i.key === r.key).expiry_date = date ? date.toISOString() : null;
                            setData(newData);
                        }}
                    />
                </Space>
            )
        },
        {
            title: '',
            width: 50,
            render: (_:any, r:any) => <Button danger type="text" icon={<DeleteOutlined />} onClick={() => setData(data.filter(d => d.key !== r.key))} />
        }
    ];

    return (
        <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
            <div style={{marginBottom: 24}}>
                <Title level={2} style={{marginBottom: 0}}>Nhập Tồn Đầu Kỳ</Title>
                <Text type="secondary">Nhập dữ liệu Tồn kho, Lô và Hạn sử dụng từ Sapo</Text>
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
                    {loadingProducts ? (
                        <div style={{color:'#1890ff', fontSize: 16}}>Đang tải {systemProducts.length} sản phẩm từ hệ thống...</div>
                    ) : (
                        <Space direction="vertical" size="large">
                            <ImportOutlined style={{fontSize: 64, color: '#1890ff'}} />
                            <div>
                                <Title level={4}>Tải lên file Excel</Title>
                                <Text type="secondary">Cột: TenSP, SoLuong, GiaVon, DonVi, LoSanXuat, HanSuDung</Text>
                            </div>
                            <Upload beforeUpload={handleFileUpload} showUploadList={false} accept=".xlsx,.xls">
                                <Button type="primary" size="large">Chọn File Excel</Button>
                            </Upload>
                        </Space>
                    )}
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
                            <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleSubmit} loading={uploading}>
                                Lưu Kho
                            </Button>
                        </Space>
                    </div>
                    
                    <Table 
                        columns={columns} 
                        dataSource={data} 
                        pagination={{pageSize: 50}} 
                        scroll={{y: 500}} 
                        size="middle" 
                        bordered 
                        rowClassName={(record) => !record.matched_product ? 'bg-red-50' : ''}
                    />

                    {/* Modal Tìm kiếm Sản phẩm */}
                    <VerifyProductModal 
                        open={isVerifyModalOpen}
                        onClose={() => setIsVerifyModalOpen(false)}
                        onSelect={handleProductSelected}
                    />
                </>
            )}

            {currentStep === 2 && (
                <Card style={{textAlign: 'center', padding: 60}}>
                    <CheckCircleOutlined style={{fontSize: 72, color: '#52c41a', marginBottom: 24}} />
                    <Title level={3}>Nhập kho thành công!</Title>
                    <div style={{marginTop: 32}}>
                        <Button type="primary" onClick={() => window.location.reload()}>Tiếp tục nhập</Button>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default OpeningStockImport;