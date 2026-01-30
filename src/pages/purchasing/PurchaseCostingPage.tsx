// src/pages/purchasing/PurchaseCostingPage.tsx
import React, { useState, useEffect } from 'react';
import { 
    Layout, Card, Typography, Row, Col, InputNumber, Button, 
    Table, Space, Tag, Select, Input, message, Affix, Result
} from 'antd';
import { 
    ArrowLeftOutlined, CalculatorOutlined, GiftOutlined, 
    SaveOutlined, PlusOutlined, DeleteOutlined 
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { purchaseOrderService } from '@/features/purchasing/api/purchaseOrderService';
import { formatCurrency } from '@/shared/utils/format';

import { UpdatePriceModal } from '@/pages/purchasing/components/UpdatePriceModal';

const { Content } = Layout;
const { Title, Text } = Typography;

// --- TYPES ---
interface CostingItem {
    id: number; // PO Item ID
    product_id: number;
    sku: string;
    product_name: string;
    unit: string;
    quantity_ordered: number; // A
    unit_price: number;       // B
    
    // Editable Fields
    vat_rate: number;         // %
    rebate_rate: number;      // %
    bonus_quantity: number;   // C
    allocated_shipping: number; // D (Total amount for this line)
    
    // Calculated
    final_unit_cost: number;
    conversion_factor: number; // [FIX] Store conversion factor to calc base cost
}

interface GiftItem {
    key: string;
    name: string;
    code: string;
    quantity: number;
    estimated_value: number;
    unit_name: string;
    image_url?: string;
}

const PurchaseCostingPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [poData, setPoData] = useState<any>(null);

    // --- STATE ---
    const [showPriceModal, setShowPriceModal] = useState(false); // [NEW] Mode Update Price
    const [preUpdateCosts, setPreUpdateCosts] = useState<any[]>([]); // [NEW] Snapshot Old Costs

    const [costingItems, setCostingItems] = useState<CostingItem[]>([]);
    const [giftItems, setGiftItems] = useState<GiftItem[]>([]);
    
    // Config Block
    const [totalShippingFee, setTotalShippingFee] = useState<number>(0);
    const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
    const [programOptions, setProgramOptions] = useState<any[]>([]); // [NEW]

    // --- EFFECT: LOAD DATA ---
    useEffect(() => {
        if (!id) return;
        loadData();
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const response: any = await purchaseOrderService.getPODetail(Number(id));
            console.log("PO DATA:", response); // DEBUG

            // [FIX] Kiểm tra cấu trúc thật (Ví dụ: response là PO object luôn, hay response.data?)
            // Theo service, getPODetail trả về data directly.
            const poInfo = response.po_info || response; 
            const poItemsRaw = response.items || response.po_items || [];

            if (!poInfo) throw new Error("Không tìm thấy đơn hàng");
            
            setPoData(poInfo);
            
            // Init Costing Items
            const items = poItemsRaw.map((i: any) => ({
                id: i.id,
                product_id: i.product_id,
                sku: i.sku,
                product_name: i.product_name || i.name, // Fallback name
                unit: i.unit || i.uom_ordered,
                quantity_ordered: i.quantity_ordered || i.quantity,
                unit_price: i.unit_price || i.price,
                vat_rate: 0,
                rebate_rate: 0,
                bonus_quantity: 0,
                allocated_shipping: 0,
                final_unit_cost: i.unit_price || 0, // Init value
                conversion_factor: i.conversion_factor || 1 // [FIX] Get from API
            }));
            setCostingItems(items);
            
            // Init Shipping from PO if any
            if (poInfo.shipping_fee) {
                setTotalShippingFee(poInfo.shipping_fee);
            }

            // [NEW] Load Supplier Programs
            if (poInfo.supplier_id || poInfo.supplier?.id) {
                const supplierId = poInfo.supplier_id || poInfo.supplier.id;
                const programs = await purchaseOrderService.getActiveProgramsBySupplier(supplierId);
                setProgramOptions(programs.map((p: any) => ({
                    label: p.name, 
                    value: p.id
                })));
            }

        } catch (err: any) {
            console.error(err);
            message.error("Lỗi tải dữ liệu: " + (err.message || err));
        } finally {
            setLoading(false);
        }
    };

    // --- LOGIC: CALCULATION ---
    // Formula: Final = ( (Price * Qty * (1 - Rebate%) * (1 + VAT%)) + AllocatedShip ) / (Qty + Bonus)
    const calculateRow = (item: CostingItem) => {
        const totalBase = item.unit_price * item.quantity_ordered;
        const afterRebate = totalBase * (1 - item.rebate_rate / 100);
        const afterVat = afterRebate * (1 + item.vat_rate / 100);
        const totalCost = afterVat + item.allocated_shipping;
        
        const totalQty = item.quantity_ordered + item.bonus_quantity;
        
        return totalQty > 0 ? totalCost / totalQty : 0;
    };

    // Auto Recalc when items change
    useEffect(() => {
        setCostingItems(prev => prev.map(item => ({
            ...item,
            final_unit_cost: calculateRow(item)
        })));
    }, [JSON.stringify(costingItems.map(i => [i.vat_rate, i.rebate_rate, i.bonus_quantity, i.allocated_shipping]))]);

    // Handle Allocate Shipping
    const handleAllocateShipping = () => {
        const validItems = costingItems.filter(i => (i.quantity_ordered * i.unit_price) > 0);
        const totalValue = validItems.reduce((sum, i) => sum + (i.quantity_ordered * i.unit_price), 0);
        
        if (totalValue === 0) return;

        const newItems = costingItems.map(item => {
            const itemValue = item.quantity_ordered * item.unit_price;
            const ratio = itemValue / totalValue;
            const ship = Math.round(totalShippingFee * ratio);
            return {
                ...item,
                allocated_shipping: ship,
                final_unit_cost: calculateRow({ ...item, allocated_shipping: ship })
            };
        });
        
        setCostingItems(newItems);
        message.success(`Đã phân bổ ${formatCurrency(totalShippingFee)} phí vận chuyển!`);
    };

    // Handle Item Change
    const handleItemChange = (id: number, field: keyof CostingItem, value: number) => {
        setCostingItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            return { ...item, [field]: value };
        }));
    };

    // --- LOGIC: GIFTS ---
    const addGiftRow = () => {
        const newGift: GiftItem = {
            key: Date.now().toString(),
            name: '',
            code: '',
            quantity: 1,
            estimated_value: 0,
            unit_name: 'Cái'
        };
        setGiftItems([...giftItems, newGift]);
    };

    const removeGift = (key: string) => {
        setGiftItems(giftItems.filter(g => g.key !== key));
    };

    const updateGift = (key: string, field: keyof GiftItem, value: any) => {
        setGiftItems(giftItems.map(g => g.key === key ? { ...g, [field]: value } : g));
    };

    // [NEW] Handle Program Change
    const handleProgramChange = async (programId: string) => {
        setSelectedProgram(programId);
        if (!programId) return;

        setLoading(true);
        try {
            const details = await purchaseOrderService.getProgramDetail(programId);
            if (!details || !details.groups) {
                message.warning("Không thể tải thông tin chương trình.");
                return;
            }

            const { groups, items: programItems } = details;
            
            // Reset state
            let updatedItems = costingItems.map(i => ({ ...i, rebate_rate: 0, bonus_quantity: 0 }));
            let newGifts: GiftItem[] = []; // Reset gifts or append? Req says "Add row", but normally we might want to clear old program gifts first. 
                                           // For now, let's keep existing gifts manually added, but maybe clear auto-added ones? 
                                           // The logic implies we re-calc, so maybe just append. Or user removes manually.
            

            let rebateCount = 0;
            let bonusCount = 0;
            let giftCount = 0;

            // Iterate Groups
            groups.forEach((group: any) => {
                const rules = group.rules || {}; 
                const ruleType = group.type || 'rebate_revenue'; // Default or explicit type

                // 1. Identify Products in this Group
                const groupProductIds = programItems
                    .filter((pi: any) => pi.group_id === group.id)
                    .map((pi: any) => pi.product_id);
                
                if (groupProductIds.length === 0) return;

                // 2. Identify Matched Items in PO
                const matchedItems = updatedItems.filter(item => groupProductIds.includes(item.product_id));
                if (matchedItems.length === 0) return;

                // 3. Logic Switch
                if (ruleType === 'rebate_revenue') {
                   // --- Case 1: Rebate Revenue ---
                   const groupRevenue = matchedItems.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_price), 0);
                   const minTurnover = Number(rules.min_turnover || 0);

                   if (groupRevenue >= minTurnover) {
                       const rate = Number(rules.rate || 0);
                       updatedItems = updatedItems.map(item => {
                           if (groupProductIds.includes(item.product_id)) {
                               return { ...item, rebate_rate: rate };
                           }
                           return item;
                       });
                       rebateCount += matchedItems.length;
                   }

                } else if (ruleType === 'buy_x_get_y') {
                    // --- Case 2: Buy X Get Y ---
                    const buyQty = Number(rules.buy_qty || 0);
                    const getQty = Number(rules.get_qty || 0);

                    if (buyQty > 0 && getQty > 0) {
                        updatedItems = updatedItems.map(item => {
                            if (groupProductIds.includes(item.product_id)) {
                                const bonus = Math.floor(item.quantity_ordered / buyQty) * getQty;
                                if (bonus > 0) bonusCount += bonus;
                                return { ...item, bonus_quantity: bonus > 0 ? bonus : item.bonus_quantity };
                            }
                            return item;
                        });
                    }

                } else if (ruleType === 'buy_amt_get_gift') {
                    // --- Case 3: Buy Amount Get Gift ---
                    const groupRevenue = matchedItems.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_price), 0);
                    const minOrderVal = Number(rules.min_order_value || 0);

                    if (groupRevenue >= minOrderVal) {
                        const giftName = rules.gift_name || 'Quà tặng khuyến mãi';
                        // Add to Gifts
                        const newGift: GiftItem = {
                            key: `AUTO_${Date.now()}_${Math.random()}`,
                            name: giftName,
                            code: 'GIFT_AUTO',
                            quantity: 1,
                            estimated_value: 0,
                            unit_name: 'Cái'
                        };
                        newGifts.push(newGift);
                        giftCount++;
                    }
                }
            });

            // Update State
            setCostingItems(updatedItems);
            if (newGifts.length > 0) {
                setGiftItems(prev => [...prev, ...newGifts]);
            }

            // Summary Message
            let msgParts = [];
            if (rebateCount > 0) msgParts.push(`Giảm giá cho ${rebateCount} sản phẩm`);
            if (bonusCount > 0) msgParts.push(`Tặng ${bonusCount} hàng KM`);
            if (giftCount > 0) msgParts.push(`Thêm ${giftCount} quà tặng ngoài`);

            if (msgParts.length > 0) {
                message.success(`Đã áp dụng: ${msgParts.join(", ")}`);
            } else {
                message.info("Chưa đạt điều kiện của chương trình.");
            }

        } catch (err) {
            console.error(err);
            message.error("Lỗi áp dụng chương trình");
        } finally {
            setLoading(false);
        }
    };

    // --- SUBMIT ---
    const handleSubmit = async () => {
        if (!id) return;
        setLoading(true);
        try {
            // [FIX] Snapshot giá cũ TRƯỚC KHI update
            const productIds = [...new Set(costingItems.map(i => i.product_id))];
            const oldData = await purchaseOrderService.getProductCostsSnapshot(productIds);
            setPreUpdateCosts(oldData || []);

            const payload = {
                p_po_id: Number(id),
                p_total_shipping_fee: totalShippingFee,
                p_items_data: costingItems.map(item => ({
                    id: item.id,
                    product_id: item.product_id,
                    // [FIX] Convert to Base Cost before sending to backend (assuming backend expects base cost)
                    final_unit_cost: item.final_unit_cost / (item.conversion_factor || 1),
                    rebate_rate: item.rebate_rate,
                    vat_rate: item.vat_rate,
                    quantity_received: item.quantity_ordered + item.bonus_quantity,
                    bonus_quantity: item.bonus_quantity
                })),
                p_gifts_data: giftItems.map(g => ({
                    name: g.name,
                    code: g.code,
                    quantity: g.quantity,
                    estimated_value: g.estimated_value,
                    image_url: g.image_url,
                    unit_name: g.unit_name
                }))
            };

            await purchaseOrderService.confirmCosting(payload);
            message.success("Xác nhận giá vốn thành công!");
            
            // [NEW] Open Price Modal instead of navigate immediately
            setShowPriceModal(true);

        } catch (err: any) {
            console.error(err);
            message.error("Lỗi: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- COLUMNS ---
    const columns = [
        {
            title: 'Sản phẩm',
            dataIndex: 'product_name',
            width: 250,
            fixed: 'left' as 'left',
            render: (text: string, r: CostingItem) => (
                <div>
                    <div style={{fontWeight: 500}}>{text}</div>
                    <div style={{fontSize: 12, color: '#888'}}>{r.sku} ({r.unit})</div>
                </div>
            )
        },
        {
            title: 'SL Mua',
            dataIndex: 'quantity_ordered',
            width: 80,
            align: 'center' as 'center',
            render: (val: number) => <b>{val}</b>
        },
        {
            title: 'Đơn giá',
            dataIndex: 'unit_price',
            width: 120,
            align: 'right' as 'right',
            render: (val: number) => formatCurrency(val)
        },
        {
            title: 'Rebate %',
            width: 100,
            render: (_: any, r: CostingItem) => (
                <InputNumber 
                    min={0} max={100} 
                    value={r.rebate_rate}
                    onChange={v => handleItemChange(r.id, 'rebate_rate', Number(v))}
                />
            )
        },
        {
            title: 'VAT %',
            width: 100,
            render: (_: any, r: CostingItem) => (
                <InputNumber 
                    min={0} max={100} 
                    value={r.vat_rate}
                    onChange={v => handleItemChange(r.id, 'vat_rate', Number(v))}
                />
            )
        },
        {
            title: 'SL Tặng (Bonus)',
            width: 110,
            render: (_: any, r: CostingItem) => (
                <InputNumber 
                    min={0}
                    value={r.bonus_quantity}
                    status={r.bonus_quantity > 0 ? "warning" : ""}
                    onChange={v => handleItemChange(r.id, 'bonus_quantity', Number(v))}
                />
            )
        },
        {
            title: 'Phí Ship PB',
            width: 130,
            render: (_: any, r: CostingItem) => (
                <InputNumber 
                    style={{width: '100%'}}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                    value={r.allocated_shipping}
                    onChange={v => handleItemChange(r.id, 'allocated_shipping', Number(v))}
                />
            )
        },
        {
            title: 'GIÁ VỐN (FINAL)',
            width: 150,
            fixed: 'right' as 'right',
            align: 'right' as 'right',
            render: (_: any, r: CostingItem) => (
                <Tag color="green" style={{fontSize: 14, padding: '4px 8px'}}>
                    {formatCurrency(r.final_unit_cost)}
                </Tag>
            )
        }
    ];

    const giftColumns = [
        {
            title: 'Tên Quà Tặng',
            render: (_: any, r: GiftItem) => (
                <Input value={r.name} onChange={e => updateGift(r.key, 'name', e.target.value)} placeholder="Nhập tên quà..." />
            )
        },
        {
            title: 'Mã quản lý',
            width: 150,
            render: (_: any, r: GiftItem) => (
                <Input value={r.code} onChange={e => updateGift(r.key, 'code', e.target.value)} placeholder="GIFT-XXX" />
            )
        },
        {
            title: 'SL',
            width: 100,
            render: (_: any, r: GiftItem) => (
                <InputNumber min={1} value={r.quantity} onChange={v => updateGift(r.key, 'quantity', v)} />
            )
        },
        {
            title: 'ĐVT',
            width: 100,
            render: (_: any, r: GiftItem) => (
                <Input value={r.unit_name} onChange={e => updateGift(r.key, 'unit_name', e.target.value)} />
            )
        },
        {
            title: 'Giá trị (Ước tính)',
            width: 150,
            render: (_: any, r: GiftItem) => (
                <InputNumber 
                    style={{width: '100%'}}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                    value={r.estimated_value} 
                    onChange={v => updateGift(r.key, 'estimated_value', v)} 
                />
            )
        },
        {
            width: 50,
            render: (_: any, r: GiftItem) => (
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeGift(r.key)} />
            )
        }
    ];

    if (!id) return <Result status="404" title="Not Found" />;

    return (
        <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
            <Content style={{ padding: "16px" }}>
                
                {/* HEADER */}
                <div style={{ marginBottom: 16 }}>
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/purchase-orders/${id}`)}>Quay lại</Button>
                        <Title level={4} style={{ margin: 0 }}>Tính Giá Vốn & Nhập Kho: {poData?.code}</Title>
                    </Space>
                </div>

                {/* BLOCK A: CONFIG */}
                <Card title={<Space><CalculatorOutlined /> Cấu hình Chi Phí</Space>} style={{marginBottom: 16}}>
                    <Row gutter={24} align="bottom">
                        <Col span={8}>
                            <Text strong>Chọn Chương trình / Hợp đồng</Text>
                            <Select 
                                style={{width: '100%', marginTop: 8}} 
                                placeholder="Chọn chương trình khuyến mãi (Optional)"
                                value={selectedProgram}
                                onChange={handleProgramChange}
                                options={programOptions}
                                allowClear
                            />
                        </Col>
                        <Col span={8}>
                            <Text strong>Tổng Phí Nhập Hàng (Vận chuyển/Khác)</Text>
                            <InputNumber 
                                style={{width: '100%', marginTop: 8}} 
                                size="large"
                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={value => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                                value={totalShippingFee}
                                onChange={(val) => setTotalShippingFee(Number(val))}
                                addonAfter="₫"
                            />
                        </Col>
                        <Col span={8}>
                            <Button type="primary" onClick={handleAllocateShipping} style={{width: '40%'}} size="large">
                                Phân bổ Phí (Theo Giá trị)
                            </Button>
                        </Col>
                    </Row>
                </Card>

                {/* BLOCK B: MAIN TABLE */}
                <Card title="Chi tiết Giá Vốn Sản Phẩm" style={{marginBottom: 16}} bodyStyle={{padding: 0}}>
                    <Table 
                        dataSource={costingItems}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        scroll={{x: 1200}}
                        loading={loading}
                    />
                </Card>

                {/* BLOCK C: GIFTS */}
                <Card 
                    title={<Space><GiftOutlined /> Quà Tặng Kèm Theo (Ngoài danh mục)</Space>} 
                    style={{marginBottom: 80}}
                    extra={<Button type="dashed" icon={<PlusOutlined />} onClick={addGiftRow}>Thêm quà</Button>}
                >
                    <Table 
                        dataSource={giftItems}
                        columns={giftColumns}
                        rowKey="key"
                        pagination={false}
                        locale={{emptyText: 'Chưa có quà tặng nào'}}
                    />
                </Card>

                {/* FOOTER */}
                <Affix offsetBottom={0}>
                    <div style={{ 
                        padding: "16px 24px", 
                        background: "#fff", 
                        boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
                        textAlign: "right",
                        borderTop: "1px solid #f0f0f0"
                    }}>
                        <Space size="large">
                            <div style={{textAlign: 'right'}}>
                                <Text type="secondary" style={{display: 'block'}}>Tổng giá trị nhập kho (Dự kiến)</Text>
                                <Text strong style={{fontSize: 20, color: '#52c41a'}}>
                                    {formatCurrency(costingItems.reduce((sum, item) => sum + (item.final_unit_cost * (item.quantity_ordered + item.bonus_quantity)), 0))}
                                </Text>
                            </div>
                            <Button 
                                type="primary" 
                                size="large" 
                                icon={<SaveOutlined />} 
                                onClick={handleSubmit}
                                loading={loading}
                                style={{minWidth: 200, height: 50, fontSize: 16}}
                            >
                                Chốt Giá Vốn & Công Nợ
                            </Button>
                        </Space>
                    </div>
                </Affix>

                <UpdatePriceModal 
                    visible={showPriceModal} 
                    onClose={() => {
                        setShowPriceModal(false);
                        navigate(`/purchase-orders/${id}`);
                    }}
                    costingItems={costingItems}
                    oldCosts={preUpdateCosts} // [NEW PROP]
                />

            </Content>
        </Layout>
    );
};

export default PurchaseCostingPage;
