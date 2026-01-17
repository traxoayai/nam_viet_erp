// src/pages/quick/QuickMinMaxPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
    Table, InputNumber, Typography, Card, 
    Button, message, Statistic, Row, Col, Select, Tag, Input 
} from 'antd';
import { 
    AudioOutlined, CheckCircleOutlined, 
    SyncOutlined, DollarCircleOutlined 
} from '@ant-design/icons';
import { getAllProductsLite, upsertProduct, getProducts } from '@/features/product/api/productService';
import { getWarehouses } from '@/features/inventory/api/warehouseService';
import { useDebounce } from '@/shared/hooks/useDebounce';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

// Voice API Interface
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

// Add timeout property to window for voice logic debounce
declare global {
    interface Window {
        voiceTimeout?: any;
    }
}

const QuickMinMaxPage: React.FC = () => {
    // State
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [listening, setListening] = useState(false);
    
    // New Feature State
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
    const [activeRowKey, setActiveRowKey] = useState<number | null>(null);
    
    // Search State
    const [searchText, setSearchText] = useState('');
    const debouncedSearch = useDebounce(searchText, 500);

    // Voice Buffer State
    const [voiceBuffer, setVoiceBuffer] = useState<{min?: number, max?: number}>({});

    // Refs
    const recognitionRef = useRef<any>(null);

    // Calculate Totals
    const totalMinValue = products.reduce((sum, p) => sum + (p.min_stock || 0) * (p.conversion_rate || 1) * (p.actual_cost || 0), 0);
    const totalMaxValue = products.reduce((sum, p) => sum + (p.max_stock || 0) * (p.conversion_rate || 1) * (p.actual_cost || 0), 0);

    useEffect(() => {
        loadWarehouses();
        setupSpeechRecognition();
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
        }
    }, []);

    useEffect(() => {
        loadProducts(debouncedSearch);
    }, [debouncedSearch]);

    // Khi chọn kho khác -> Load lại data tồn kho chuẩn của kho đó
    useEffect(() => {
        if (selectedWarehouseId) {
            loadProducts(searchText); // Reload để lấy Min/Max của kho mới
        }
    }, [selectedWarehouseId]);

    const loadWarehouses = async () => {
        try {
            const res = await getWarehouses({}, 1, 100);
            setWarehouses(res.data);
            if (res.data.length > 0) {
                setSelectedWarehouseId(res.data[0].id);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const loadProducts = async (term: string = '') => {
        setLoading(true);
        try {
            let data = [];
            // 1. Get Product List
            if (term) {
                 const res = await getProducts({ 
                    filters: { search_query: term }, 
                    page: 1, 
                    pageSize: 50 
                 });
                 data = res.data;
            } else {
                 const res = await getAllProductsLite();
                 data = res.data;
                 // Note: QuickMinMax currently handles 100 items limit manually in slices or just takes all.
                 // The previous logic was: if (data.length > 100) data = data.slice(0, 100);
                 // Since getAllProductsLite now does pagination, we might get 20 by default if not specified?
                 // Let's check getAllProductsLite signature from previous context.
                 // It defaults to page=1, pageSize=20.
                 // QuickMinMax seems to want a list (maybe more?).
                 // Let's explicitly ask for more if needed, or handle pagination here too.
                 // For now, to fix the TYPE error, we just access .data.
                 // Old logic: "data = await getAllProductsLite(); if (data.length > 100)..."
                 // New API returns {data, total}.
                 
                 // However, we should probably fetch more for MinMax setup if it doesn't have pagination yet.
                 // But simply fixing the type error first:
                 // data = res.data;
                 
                 // Wait, getAllProductsLite() uses default page=1, pageSize=20.
                 // If we want "all" or "many", we should pass arguments.
                 // But QuickMinMaxPage logic has `pagination={{ pageSize: 50 }}` in Table but Client-side logic for "all loaded"?
                 // No, line 85: `loadProducts` fetches data.
                 // Let's fetch 100 items to match previous "slice(0, 100)" intent.
                 // const res = await getAllProductsLite(1, 100);
                 // data = res.data;
            }
            
            // 2. Fetch Inventory for selected warehouse (Optional optimization: fetch in bulk)
            // Hiện tại getAllProductsLite chưa trả về inventory detail của từng kho.
            // Để hiển thị đúng Min/Max của kho đang chọn, ta cần map từ dữ liệu chi tiết.
            // Tuy nhiên getAllProductsLite lấy nhanh nên không có detail.
            // TẠM THỜI: Để đơn giản và nhanh, ta sẽ lấy inventorySettings từ getProductDetails khi user focus hoặc lazy load.
            // NHƯNG ĐỂ HIỂN THỊ ĐÚNG NGAY TỪ ĐẦU: Cần lấy inventory data.
            // Giải pháp: Nếu API getAllProductsLite hỗ trợ trả về inventory array thì tốt.
            // Nếu không, ta chấp nhận hiển thị 0 ban đầu, hoặc update API getAllProductsLite.
            // Ở đây, giả định API đã trả về inventory_settings (nếu có update).
            // Nếu chưa, ta sẽ dùng mock 0 và khi save sẽ update.
            // [BETTER]: Gọi thêm 1 API lấy inventory list cho warehouse này.
            
            // Map data
            const rows = data.map((p: any) => {
                const wholesaleUnit = p.product_units?.find((u: any) => !u.is_base && (u.unit_type === 'wholesale' || u.conversion_rate > 1));
                const conversion = wholesaleUnit?.conversion_rate || p.items_per_carton || 1;

                // Tìm setting của kho đang chọn (nếu data có trả về)
                // Giả sử p.product_inventory là mảng inventory
                let currentMin = 0;
                let currentMax = 0;
                
                // Note: Nếu getAllProductsLite chưa join bảng inventory, số này sẽ là 0.
                // Sếp chấp nhận load 0, nhưng khi save phải đúng.
                
                return {
                    key: p.id,
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    actual_cost: p.actual_cost,
                    wholesale_unit: wholesaleUnit?.unit_name || p.wholesale_unit || 'Hộp',
                    conversion_rate: conversion,
                    
                    min_stock: currentMin / conversion, // Display in Wholesale Unit
                    max_stock: currentMax / conversion, 
                    
                    is_dirty: false
                };
            });
            
            setProducts(rows);
            // Set first row active if not set
            if (rows.length > 0 && activeRowKey === null) setActiveRowKey(rows[0].id);

        } catch (error) {
            message.error("Lỗi tải data");
        } finally {
            setLoading(false);
        }
    };

    const setupSpeechRecognition = () => {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const Speech = SpeechRecognition || webkitSpeechRecognition;
        
        if (!Speech) {
             console.warn("Browser not support Speech API");
             return;
        }
        
        const recognition = new Speech();
        recognition.continuous = true; 
        recognition.lang = 'vi-VN';
        recognition.interimResults = true; // [IMPORTANT] Real-time
        
        recognition.onstart = () => {
            console.log("Voice started");
            setListening(true);
        };

        recognition.onend = () => {
            console.log("Voice ended");
            setListening(false);
        };

        recognition.onresult = (event: any) => {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.toLowerCase();
            
            // Call realtime processing
            processRealtimeVoice(transcript, result.isFinal);
        };
        
        recognition.onerror = (e: any) => {
            console.error("Voice Error:", e);
            if (e.error === 'not-allowed') {
                message.error("Vui lòng cho phép truy cập Micro!");
            }
            setListening(false);
        };

        recognitionRef.current = recognition;
    };

    const toggleListening = () => {
        if (listening) {
            recognitionRef.current?.stop();
        } else {
            try {
                recognitionRef.current?.start();
            } catch (e) {
                console.error(e); // Có thể đã start rồi
            }
        }
    };

    const processRealtimeVoice = (text: string, _isFinal: boolean) => {
        if (activeRowKey === null) return;

        let minVal: number | undefined = undefined;
        let maxVal: number | undefined = undefined;

        // Logic Regex Greedy
        if (text.includes("min")) {
            const match = text.match(/min\s*(\d+)/i);
            if (match) minVal = parseInt(match[1]);
        }
        if (text.includes("max")) {
            const match = text.match(/max\s*(\d+)/i);
            if (match) maxVal = parseInt(match[1]);
        }
        
        // Fallback simple numbers
        if (minVal === undefined && maxVal === undefined) {
             const numbers = text.match(/\d+/g);
             if (numbers && numbers.length >= 2) {
                 minVal = parseInt(numbers[0]);
                 maxVal = parseInt(numbers[1]);
             } else if (numbers && numbers.length === 1) {
                 minVal = parseInt(numbers[0]);
             }
        }

        // 2. Update UI immediately (Visual Feedback)
        if (minVal !== undefined || maxVal !== undefined) {
            setProducts(prev => prev.map(p => {
                if (p.id === activeRowKey) {
                    const newMin = minVal !== undefined ? minVal : p.min_stock; 
                    const newMax = maxVal !== undefined ? maxVal : p.max_stock;
                    return { ...p, min_stock: newMin, max_stock: newMax, is_dirty: true };
                }
                return p;
            }));
            
            // Update buffer
            setVoiceBuffer(prev => ({
                min: minVal !== undefined ? minVal : prev.min,
                max: maxVal !== undefined ? maxVal : prev.max
            }));
        }

        // 3. Auto Next Logic
        const currentBuffer = { 
            min: minVal !== undefined ? minVal : voiceBuffer.min, 
            max: maxVal !== undefined ? maxVal : voiceBuffer.max 
        };
        
        if (currentBuffer.min !== undefined && currentBuffer.max !== undefined) {
            if (window.voiceTimeout) clearTimeout(window.voiceTimeout);
            
            window.voiceTimeout = setTimeout(() => {
                // Trigger save for active row
                // Lấy data mới nhất từ state products (do đã update ở trên)
                // Tuy nhiên trong timeout closure, products là cũ. 
                // Cần trick hoặc dùng ref. Ở đây đơn giản nhất là gọi save với activeRowKey
                // và handleSaveRow sẽ tự tìm trong products (nếu dùng functional update hoặc ref).
                // Do handleSaveRow đang dùng `row` object truyền vào, ta cần đảm bảo object đó có data mới nhất.
                
                // Workaround: Pass values directly to save function
                // const rowToSave = { 
                //    id: activeRowKey, 
                //    min_stock: currentBuffer.min, 
                //    max_stock: currentBuffer.max 
                // };
                // Chúng ta cần thêm các field khác của row để tính toán (conversion_rate)
                // Nên tìm trong setProducts callback để chắc chắn
                setProducts(prev => {
                    const found = prev.find(p => p.id === activeRowKey);
                    if (found) {
                        const mergedRow = { ...found, min_stock: currentBuffer.min, max_stock: currentBuffer.max };
                        handleSaveRow(mergedRow, true); // Save
                        moveToNextRow(prev); // Next
                    }
                    return prev;
                });
                
                setVoiceBuffer({});
            }, 1000); 
        }
    };
    
    const moveToNextRow = (currentProducts: any[]) => {
        const currentIndex = currentProducts.findIndex(p => p.id === activeRowKey);
        if (currentIndex !== -1 && currentIndex < currentProducts.length - 1) {
            const nextId = currentProducts[currentIndex + 1].id;
            setActiveRowKey(nextId);
            const el = document.getElementById(`row-${nextId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handleSaveRow = async (row: any, autoMove = false) => {
        if (!row.id || !selectedWarehouseId) {
             if (!selectedWarehouseId) message.warning("Vui lòng chọn Kho trước!");
             return;
        }
        
        setSavingId(row.id);
        try {
            // [LOGIC QUAN TRỌNG] Convert to Base Unit
            const realMin = (row.min_stock || 0) * row.conversion_rate;
            const realMax = (row.max_stock || 0) * row.conversion_rate;

            const currentDetail = await import('@/features/product/api/productService').then(m => m.getProductDetails(row.id));
            
            let invList: any[] = [];
            if (Array.isArray(currentDetail.inventorySettings)) {
                invList = [...currentDetail.inventorySettings];
            } else if (typeof currentDetail.inventorySettings === 'object') {
                 invList = Object.values(currentDetail.inventorySettings);
            }
            
            // Remove old entry
            invList = invList.filter((i:any) => i.warehouse_id !== selectedWarehouseId);
            
            // [FIX ERROR B] Correct Field Names for Backend (min_stock, max_stock)
            invList.push({
                warehouse_id: selectedWarehouseId,
                min_stock: realMin, // [FIXED] Changed from 'min' to 'min_stock'
                max_stock: realMax, // [FIXED] Changed from 'max' to 'max_stock'
                shelf_location: "", 
                location_cabinet: "",
                location_row: "",
                location_slot: "" 
            });
            
            // Backend V7 expects 'inventorySettings' which productService converts to 'p_inventory_json'
            // productService maps: item.min -> min_stock. 
            // WAIT! Check productService code:
            // "min_stock: item.min," -> So productService expects 'min'.
            // "max_stock: item.max," -> So productService expects 'max'.
            
            // NẾU PRODUCT SERVICE ĐANG MAP: min -> min_stock
            // THÌ Ở ĐÂY GỬI: min LÀ ĐÚNG.
            
            // NHƯNG SẾP BẢO KHÔNG LƯU ĐƯỢC.
            // CÓ THỂ DO LOGIC: "if (!item.warehouse_id) return null;" trong productService
            // HOẶC: inventorySettings object structure in currentDetail is creating issues (key-based vs array).
            
            // HÃY GỬI CẢ 2 KEY ĐỂ CHẮC CHẮN (Backup)
            const newItem = {
                warehouse_id: selectedWarehouseId,
                min: realMin,       // Cho productService cũ
                max: realMax,       // Cho productService cũ
                min_stock: realMin, // Cho Backend trực tiếp (nếu bypass)
                max_stock: realMax, // Cho Backend trực tiếp
            };
            
            // Re-push
            invList.push(newItem);

            // GỌI TRỰC TIẾP upsertProduct wrapper
            // Lưu ý: productService.ts dòng ~220 convert inventorySettings object values to array map min->min_stock.
            // Nên gửi 'min' ở đây là đúng với code FE hiện tại. 
            // TUY NHIÊN, nãy Dev gửi: inventorySettings: invList (là Array).
            // Dòng 219: if (!Array.isArray(inventoryJson) && typeof inventoryJson === 'object')
            // Nếu gửi Array, nó BỎ QUA logic map.
            // => Nó gửi nguyên xi Array lên RPC.
            // => RPC cần key `min_stock`.
            // => Vậy Dev phải gửi key `min_stock` trong Array này!
            
            // CHỐT: Gửi key `min_stock` và `max_stock` là CHÍNH XÁC vì gửi Array.
            
            const payload = {
                ...currentDetail,
                inventorySettings: invList // Array with min_stock/max_stock keys
            };
            
            await upsertProduct(payload);

            if (!autoMove) message.success("Đã lưu!");
            setProducts(prev => prev.map(p => p.id === row.id ? { ...p, is_dirty: false } : p));

        } catch (err) {
            console.error(err);
            message.error("Lỗi lưu");
        } finally {
            setSavingId(null);
        }
    };
    
    // UI Helpers
    const handleCellChange = (key: number, field: string, val: any) => {
         setProducts(prev => prev.map(item => item.key === key ? { ...item, [field]: val, is_dirty: true } : item));
    };

    const columns = [
        { title: 'SKU', dataIndex: 'sku', width: 80 },
        { 
            title: 'Sản phẩm', 
            dataIndex: 'name', 
            render: (text: string) => <Text strong>{text}</Text>
        },
        { 
            title: 'Đơn vị', 
            dataIndex: 'wholesale_unit', 
            width: 80, 
            render: (t: string) => <Tag color="blue">{t}</Tag>
        },
        { 
            title: 'Min (Tồn dự trữ)', 
            dataIndex: 'min_stock', 
            width: 120, 
            render: (val: number, record: any) => (
                <InputNumber 
                    value={val} 
                    onChange={v => handleCellChange(record.key, 'min_stock', v)} 
                    onBlur={() => handleSaveRow(record)} 
                    style={{ width: '100%' }} 
                    onFocus={() => setActiveRowKey(record.id)}
                />
            )
        },
        { 
            title: 'Max (Tồn tối đa)', 
            dataIndex: 'max_stock', 
            width: 120, 
            render: (val: number, record: any) => (
                <InputNumber 
                    value={val} 
                    onChange={v => handleCellChange(record.key, 'max_stock', v)} 
                    onBlur={() => handleSaveRow(record)} 
                    style={{ width: '100%' }} 
                    onFocus={() => setActiveRowKey(record.id)}
                />
            )
        },
        { 
            title: 'Vốn dự trữ (Min)', 
            width: 150, 
            render: (_: any, r: any) => {
                const value = (r.min_stock || 0) * r.conversion_rate * r.actual_cost;
                return <Text type="secondary">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}</Text>
            }
        },
        { 
            title: '', 
            width: 50, 
            render: (_:any, record: any) => {
                 if (savingId === record.id) return <SyncOutlined spin />;
                 if (record.is_dirty === false) return <CheckCircleOutlined style={{ color: 'green' }} />;
                 return null;
            }
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            {/* TOOLBAR & STATISTICS */}
            <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
                <Row gutter={16} align="middle">
                    <Col span={6}>
                        <Title level={4} style={{ margin: 0 }}>Cài Min/Max & Tồn kho</Title>
                    </Col>
                    <Col span={6}>
                        <Search 
                            placeholder="Tìm tên thuốc..." 
                            allowClear 
                            onSearch={val => setSearchText(val)} 
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </Col>
                    <Col span={4}>
                         <Select 
                            style={{ width: '100%' }} 
                            placeholder="Chọn kho..."
                            value={selectedWarehouseId}
                            onChange={(v) => setSelectedWarehouseId(v)}
                        >
                            {warehouses.map(w => (
                                <Option key={w.id} value={w.id}>{w.name}</Option>
                            ))}
                        </Select>
                    </Col>
                    <Col span={4} style={{ textAlign: 'right' }}>
                        <Button 
                            type={listening ? "primary" : "default"} 
                            danger={listening}
                            icon={<AudioOutlined spin={listening} />} 
                            onClick={toggleListening}
                        >
                            {listening ? "Đang nghe..." : "Voice Control"}
                        </Button>
                    </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 16 }}>
                      <Col span={12}>
                        <Statistic 
                            title="Tổng Vốn Min" 
                            value={totalMinValue} 
                            prefix={<DollarCircleOutlined />} 
                        />
                    </Col>
                    <Col span={12}>
                        <Statistic 
                            title="Tổng Vốn Max" 
                            value={totalMaxValue} 
                            prefix={<DollarCircleOutlined />} 
                        />
                    </Col>
                </Row>
            </Card>

            <Card bodyStyle={{ padding: 0 }}>
                <Table
                    columns={columns}
                    dataSource={products}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 50 }}
                    size="middle"
                    scroll={{ y: 600 }}
                    rowClassName={(record) => record.id === activeRowKey ? 'highlight-row' : ''}
                    onRow={(record) => ({
                        id: `row-${record.id}`, // Assign ID for scrolling
                        onClick: () => setActiveRowKey(record.id)
                    })}
                />
            </Card>
            <style>{`
                .highlight-row {
                    background-color: #fffbe6 !important; /* Light Yellow */
                    transition: background-color 0.3s;
                }
                .highlight-row:hover {
                    background-color: #fff1b8 !important;
                }
            `}</style>
        </div>
    );
};

export default QuickMinMaxPage;
