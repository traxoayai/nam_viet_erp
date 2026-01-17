// src/pages/quick/QuickUnitPage.tsx

import React, { useState, useEffect } from 'react';
import { 
    Table, Input, InputNumber, Button, Typography, 
    Card, Space, Upload, Modal, Tag, message, Row, Col, Avatar 
} from 'antd';
import { 
    UploadOutlined, ThunderboltOutlined, 
    CheckCircleOutlined, SyncOutlined, DownloadOutlined, SearchOutlined,
    FileImageOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import stringSimilarity from 'string-similarity'; 
import { getAllProductsLite, upsertProduct, getProducts, getProductDetails } from '@/features/product/api/productService'; 
import { useDebounce } from '@/shared/hooks/useDebounce'; 

const { Title, Text } = Typography;
const { Search } = Input;

// Định nghĩa cấu trúc dữ liệu cho dòng trong bảng
interface ProductRow {
    key: number;
    id: number;
    name: string;
    sku: string;
    imageUrl?: string;
    retail_unit: string;    // Đơn vị Lẻ (Base)
    wholesale_unit: string; // Đơn vị Sỉ
    conversion_rate: number; // Hệ số
    actual_cost: number;
    is_dirty?: boolean;     // Đã sửa chưa?
    is_saving?: boolean;    // Đang lưu?
}

const QuickUnitPage: React.FC = () => {
    // --- STATE ---
    // [UPDATE] Thêm state pagination
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0
    });
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');
    
    // Excel Logic State
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [matchedData, setMatchedData] = useState<any[]>([]);

    const debouncedSearch = useDebounce(searchText, 500);

    // --- EFFECT ---
    useEffect(() => {
        loadProducts(1, pagination.pageSize); 
    }, [debouncedSearch]); 

    // --- CORE: QUERY PAGE & PAGE CHANGE ---
    const handleTableChange = (newPagination: any) => {
        loadProducts(newPagination.current, newPagination.pageSize);
    };

    // --- CORE: LOAD DATA ---
    const loadProducts = async (page = 1, pageSize = 20) => {
        setLoading(true);
        try {
            let data = [];
            let total = 0;

            // 1. Nếu có từ khóa -> Gọi API Search
            if (debouncedSearch) {
                 const res = await getProducts({ 
                    filters: { search_query: debouncedSearch }, 
                    page: page, 
                    pageSize: pageSize 
                 });
                 data = res.data;
                 total = res.totalCount; 
            } else {
                 // 2. Nếu không -> Gọi API lấy tất cả (Lite) với Server-side Pagination
                 const res = await getAllProductsLite(page, pageSize);
                 data = res.data;
                 total = res.total;
            }

            // 3. Map dữ liệu DB -> State Table
            const rows = data.map((p: any) => {
                const units = p.product_units || [];
                
                // A. Tìm Đơn vị Lẻ (Base)
                const baseUnitObj = units.find((u: any) => u.is_base || u.unit_type === 'base') 
                                    || units.find((u:any) => u.conversion_rate === 1);
                
                const baseUnitName = baseUnitObj?.unit_name || p.retail_unit || 'Viên';

                // B. Tìm Đơn vị Sỉ (Wholesale)
                const bigUnitObj = units.find((u: any) => !u.is_base && (u.unit_type === 'wholesale' || u.conversion_rate > 1));
                
                return {
                    key: p.id,
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    imageUrl: p.image_url, 
                    actual_cost: p.actual_cost || 0,
                    
                    retail_unit: baseUnitName,
                    wholesale_unit: bigUnitObj?.unit_name || p.wholesale_unit || 'Hộp',
                    conversion_rate: bigUnitObj?.conversion_rate || p.items_per_carton || 10,
                    
                    is_dirty: false
                };
            });
            
            setProducts(rows);
            
            // 4. Update Pagination State
            setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize,
                total: total
            }));

        } catch (error) {
            console.error("Load Error:", error);
            message.error("Lỗi tải danh sách sản phẩm.");
        } finally {
            setLoading(false);
        }
    };

    // --- CORE: SAVE LOGIC ---
    const handleSaveRow = async (row: ProductRow) => {
        if (!row.id) return;
        setSavingId(row.id);
        
        try {
            // 1. Chuẩn bị Object Đơn vị Lẻ (Luôn là Base)
            const retailUnitObj = {
                unit_name: row.retail_unit,
                unit_type: 'retail', 
                conversion_rate: 1, 
                is_base: true,
                is_direct_sale: true,
                price: row.actual_cost // Gợi ý giá vốn base
            };

            // 2. Chuẩn bị Object Đơn vị Sỉ (Quy đổi)
            const wholesaleUnitObj = {
                unit_name: row.wholesale_unit,
                unit_type: 'wholesale',
                conversion_rate: row.conversion_rate,
                is_base: false,
                is_direct_sale: true,
                price: 0 // Để 0 để Backend tự tính giá theo Margin
            };

            // 3. Lấy chi tiết hiện tại để merge (An toàn dữ liệu)
            const currentDetail = await getProductDetails(row.id);
            
            // 4. Giữ lại các đơn vị khác (Ví dụ: Thùng, Lốc... nếu đã định nghĩa trước đó)
            // Logic: Lọc bỏ các đơn vị Base cũ và Wholesale cũ để thay bằng cái mới
            const otherUnits = (currentDetail.units || []).filter((u: any) => 
                !u.is_base && u.conversion_rate !== 1 && u.unit_type !== 'wholesale'
            );
            
            // 5. Gom mảng units mới
            const newUnits = [retailUnitObj, wholesaleUnitObj, ...otherUnits];

            // 6. Tạo Payload chuẩn form upsert_product_with_units
            const payload = {
                ...currentDetail,
                retailUnit: row.retail_unit, // Sync legacy column
                wholesaleUnit: row.wholesale_unit, // Sync legacy column
                items_per_carton: row.conversion_rate, // Sync legacy column
                units: newUnits
            };
            
            // 7. Gọi API
             await upsertProduct(payload);
             
             message.success("Đã lưu!", 0.5);
             
             // Update state local để tắt trạng thái 'dirty'
             setProducts(prev => prev.map(p => p.id === row.id ? { ...p, is_dirty: false } : p));

        } catch (err) {
            message.error("Lỗi lưu đơn vị");
            console.error(err);
        } finally {
            setSavingId(null);
        }
    };
    
    // Sự kiện khi rời khỏi ô nhập liệu (Auto-save)
    const handleBlur = (record: ProductRow) => {
        if (record.is_dirty) {
            handleSaveRow(record);
        }
    };

    // Cập nhật state local khi gõ
    const handleCellChange = (key: number, field: string, value: any) => {
        setProducts(prev => prev.map(item => {
            if (item.key === key) {
                return { ...item, [field]: value, is_dirty: true };
            }
            return item;
        }));
    };

    // --- TEMPLATE DOWNLOAD ---
    const handleDownloadTemplate = () => {
        const header = ['SKU', 'Tên Sản Phẩm', 'Đơn vị Lẻ', 'Đơn vị Sỉ', 'Hệ số'];
        const data = [
             ['PAN001', 'Panadol Extra', 'Viên', 'Hộp', 10],
             ['PAN002', 'Panadol Cảm cúm', 'Viên', 'Vỉ', 10],
        ];
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
        // Set độ rộng cột
        ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
        
        XLSX.utils.book_append_sheet(wb, ws, "Mau_Quy_Cach");
        XLSX.writeFile(wb, "Mau_Cai_Dat_Quy_Cach.xlsx");
    };

    // --- EXCEL SMART MATCH LOGIC ---
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
        return false; // Prevent default upload
    };

    const processExcelData = async (excelRows: any[]) => {
        const matches: any[] = [];
        // Lấy danh sách tên sản phẩm hiện tại để so khớp
        const dbNames = products.map(p => p.name); 
        
        excelRows.forEach((row, index) => {
            // Mapping tên cột linh hoạt
            const name = row['Tên Sản Phẩm'] || row['Product Name'] || row['Tên'] || '';
            const unitSmall = row['Đơn vị Lẻ'] || row['Base Unit'] || row['Lẻ'] || '';
            const unitBig = row['Đơn vị Sỉ'] || row['Wholesale Unit'] || row['Sỉ'] || '';
            const rate = row['Hệ số'] || row['Conversion Rate'] || 1;
            
            if (!name) return;

            let bestMatch = null;
            let bestScore = 0;
            
            // Fuzzy Search (Tìm tên gần đúng nhất)
            if (dbNames.length > 0) {
                const matchResult = stringSimilarity.findBestMatch(name, dbNames);
                const bestCandidate = matchResult.bestMatch;
                
                // Chỉ nhận nếu độ chính xác > 40%
                if (bestCandidate.rating > 0.4) { 
                    bestScore = bestCandidate.rating;
                    bestMatch = products.find(p => p.name === bestCandidate.target);
                }
            }
            
            matches.push({
                rowIndex: index,
                excel: { name, unitSmall, unitBig, rate },
                match: bestMatch,
                score: bestScore
            });
        });

        // Sắp xếp các kết quả tìm được theo độ chính xác
        const confidentMatches = matches.filter(m => m.match).sort((a,b) => b.score - a.score);
        setMatchedData(confidentMatches);
        setReviewModalVisible(true);
    };
    
    const applyMatches = async () => {
        setReviewModalVisible(false);
        setLoading(true);
        let count = 0;
        
        // Lặp qua danh sách khớp và lưu
        for (const item of matchedData) {
           if (!item.match) continue;
           
           const newConversion = Number(item.excel.rate) || item.match.conversion_rate;
           const newUnitSmall = item.excel.unitSmall || item.match.retail_unit;
           const newUnitBig = item.excel.unitBig || item.match.wholesale_unit;
           
           await handleSaveRow({
               ...item.match,
               retail_unit: newUnitSmall,
               wholesale_unit: newUnitBig,
               conversion_rate: newConversion
           });
           count++;
        }
        
        setLoading(false);
        message.success(`Đã cập nhật thành công ${count} sản phẩm!`);
        loadProducts(pagination.current, pagination.pageSize); // Reload lại bảng
    };

    // --- TABLE COLUMNS ---
    const columns = [
        {
            title: 'SKU',
            dataIndex: 'sku',
            width: 100,
            fixed: 'left' as const,
        },
        {
            title: 'Ảnh', 
            dataIndex: 'imageUrl',
            width: 70,
            render: (url: string) => (
                <Avatar 
                    shape="square" 
                    size={50} 
                    src={url} 
                    icon={<FileImageOutlined />} 
                    style={{ backgroundColor: '#f0f0f0' }}
                />
            )
        },
        {
            title: 'Sản phẩm',
            dataIndex: 'name',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Đơn vị Lẻ (Base)',
            dataIndex: 'retail_unit',
            width: 160,
            render: (text: string, record: ProductRow) => (
                <Input 
                    value={text} 
                    onChange={e => handleCellChange(record.key, 'retail_unit', e.target.value)}
                    onBlur={() => handleBlur(record)}
                    style={{ 
                        borderColor: record.is_dirty ? '#1890ff' : undefined,
                        backgroundColor: record.is_dirty ? '#e6f7ff' : undefined 
                    }}
                    placeholder="Viên/Lọ"
                />
            )
        },
        {
            title: 'Đơn vị Sỉ (Quy đổi)',
            dataIndex: 'wholesale_unit',
            width: 160,
            render: (text: string, record: ProductRow) => (
                 <Input 
                    value={text} 
                    onChange={e => handleCellChange(record.key, 'wholesale_unit', e.target.value)}
                    onBlur={() => handleBlur(record)}
                    style={{ 
                        borderColor: record.is_dirty ? '#1890ff' : undefined,
                        backgroundColor: record.is_dirty ? '#e6f7ff' : undefined 
                    }}
                    placeholder="Hộp/Thùng"
                />
            )
        },
        {
            title: 'Hệ số (1 Sỉ = ? Lẻ)',
            dataIndex: 'conversion_rate',
            width: 160,
            render: (val: number, record: ProductRow) => (
                <InputNumber
                    value={val}
                    min={1}
                    onChange={v => handleCellChange(record.key, 'conversion_rate', v)}
                    onBlur={() => handleBlur(record)}
                    style={{ 
                        width: '100%', 
                        borderColor: record.is_dirty ? '#1890ff' : undefined,
                        backgroundColor: record.is_dirty ? '#e6f7ff' : undefined 
                    }}
                />
            )
        },
        {
            title: 'Trạng thái',
            width: 80,
            align: 'center' as const,
            render: (_:any, record: ProductRow) => {
                if (savingId === record.id) return <SyncOutlined spin style={{ color: '#1890ff' }} />;
                if (record.is_dirty === false) return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
                return null;
            }
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card bodyStyle={{ padding: '16px' }}>
                {/* Header Toolbar */}
                <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
                    <Col xs={24} md={8}>
                        <Title level={4} style={{ margin: 0 }}>
                            <ThunderboltOutlined style={{ color: '#faad14' }} /> Cài đặt Quy Cách Nhanh
                        </Title>
                    </Col>
                    <Col xs={24} md={8}>
                        <Search 
                            placeholder="Tìm tên thuốc, hoạt chất..." 
                            allowClear 
                            enterButton={<SearchOutlined />}
                            onSearch={val => setSearchText(val)}
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </Col>
                    <Col xs={24} md={8} style={{ textAlign: 'right' }}>
                        <Space>
                            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                                Tải File Mẫu
                            </Button>
                            <Upload 
                                beforeUpload={handleFileUpload} 
                                showUploadList={false} 
                                accept=".xlsx, .xls"
                            >
                                <Button icon={<UploadOutlined />} type="primary" ghost>
                                    Import Excel Match
                                </Button>
                            </Upload>
                        </Space>
                    </Col>
                </Row>

                {/* Table Chính */}
                <Table
                    columns={columns}
                    dataSource={products}
                    loading={loading}
                    rowKey="key"
                    // Server-side Pagination Configuration
                    pagination={{ 
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        position: ['bottomRight'],
                        pageSizeOptions: ['10', '20', '50', '100'], 
                        showSizeChanger: true, 
                        showTotal: (total, range) => `Hiển thị ${range[0]}-${range[1]} của ${total} sản phẩm`
                    }}
                    onChange={handleTableChange} // [IMPORTANT] Trigger loading on change
                    size="middle"
                    scroll={{ y: 600 }}
                    bordered
                />
            </Card>

            {/* Modal Review Excel Match */}
            <Modal
                title="Kết quả So khớp Excel (Smart Match)"
                open={reviewModalVisible}
                onOk={applyMatches}
                onCancel={() => setReviewModalVisible(false)}
                width={800}
                okText="Áp dụng Tất cả"
                cancelText="Hủy"
            >
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                    <Table
                        dataSource={matchedData}
                        rowKey={(r) => r.rowIndex}
                        pagination={false}
                        columns={[
                            {
                                title: 'Thông tin Excel',
                                dataIndex: 'excel',
                                render: (excel) => (
                                    <div>
                                        <b>{excel.name}</b> <br/>
                                        <Text type="secondary">{excel.unitSmall} - {excel.unitBig} (x{excel.rate})</Text>
                                    </div>
                                )
                            },
                            {
                                title: 'Khớp với (Hệ thống)',
                                dataIndex: 'match',
                                render: (match, record) => (
                                    <div style={{ 
                                        padding: 8, 
                                        background: record.score > 0.8 ? '#f6ffed' : '#fffbe6', 
                                        borderRadius: 4, 
                                        border: '1px solid #ddd' 
                                    }}>
                                        {match ? (
                                            <>
                                                <div>{match.name}</div>
                                                <Tag color={record.score > 0.8 ? 'green' : 'orange'}>
                                                    Độ khớp: {Math.round(record.score * 100)}%
                                                </Tag>
                                            </>
                                        ) : <Text type="danger">Không tìm thấy</Text>}
                                    </div>
                                )
                            }
                        ]}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default QuickUnitPage;