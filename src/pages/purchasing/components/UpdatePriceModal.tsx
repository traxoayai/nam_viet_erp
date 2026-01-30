// src/pages/purchasing/components/UpdatePriceModal.tsx
import React, { useEffect, useState } from 'react';
import { Modal, Table, InputNumber, Button, message, Tag } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { supabase } from '@/shared/lib/supabaseClient';
import { updateProductPrices } from '@/features/product/api/productService';
import { formatCurrency } from '@/shared/utils/format';

interface Props {
    visible: boolean;
    onClose: () => void;
    costingItems: any[]; // Items từ trang Costing
    oldCosts: any[]; // [NEW] Snapshot giá cũ
}

interface PriceRow {
    key: string;
    product_id: number;
    product_name: string;
    unit_name: string; // [FIX] Display Unit Name (Wholesale or Base)
    
    // Display values (converted to display unit)
    old_cost_display: number; 
    new_cost_display: number;
    
    current_sell_price: number; // For display unit
    new_sell_price: number;     // For display unit (User edited)
    
    units: any[]; // Store list to bulk update
}

export const UpdatePriceModal: React.FC<Props> = ({ visible, onClose, costingItems, oldCosts }) => {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<PriceRow[]>([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    useEffect(() => {
        if (visible && costingItems.length > 0) {
            fetchComparisonData();
        }
    }, [visible, costingItems]);

    const fetchComparisonData = async () => {
        setLoading(true);
        try {
            const productIds = [...new Set(costingItems.map(i => i.product_id))];
            
            // Lấy thông tin hiện tại trong DB (Giá cũ)
            const { data: products } = await supabase
                .from('products')
                .select(`id, name, actual_cost, wholesale_unit, product_units(*)`)
                .in('id', productIds);

            const newRows: PriceRow[] = [];
            const defaultSelected: React.Key[] = [];

            products?.forEach(p => {
                // 1. Tìm giá vốn MỚI (Từ đơn nhập hàng)
                const inputItem = costingItems.find(i => i.product_id === p.id);
                if (!inputItem) return;

                // Quy đổi giá nhập về giá Base
                const conversion = inputItem.conversion_factor || 1;
                const newBaseCost = inputItem.final_unit_cost / conversion;

                // A. Xác định "Đơn vị hiển thị" (Ưu tiên Wholesale Unit)
                // Nếu không có Wholesale Unit thì mới fallback về Base Unit
                const displayUnit = p.product_units.find((u: any) => u.unit_name === p.wholesale_unit) 
                                 || p.product_units.find((u: any) => u.is_base) 
                                 || p.product_units[0];
            
                if (!displayUnit) return;
            
                // B. Tính toán lại các loại giá theo Đơn vị hiển thị
                // Lưu ý: actual_cost và newBaseCost đang là giá của Unit Base (nhỏ nhất)
                const rate = displayUnit.conversion_rate || 1;
            
                // [FIX] Lấy giá vốn cũ từ Snapshot (Pre-update), KHÔNG lấy từ p.actual_cost
                const snapshot = oldCosts.find(o => o.id === p.id);
                const trueOldBaseCost = snapshot ? snapshot.actual_cost : (p.actual_cost || 0);

                const displayOldCost = (trueOldBaseCost || 0) * rate; // Giá vốn cũ (quy ra Hộp)
                const displayNewCost = newBaseCost * rate;          // Giá vốn mới (quy ra Hộp)
                
                // Logic gợi ý giá bán (Giữ nguyên margin cũ)
                // Ratio = Tỷ lệ tăng giá vốn
                const costRatio = displayOldCost > 0 ? (displayNewCost / displayOldCost) : 1;
                const suggestedPrice = Math.ceil((displayUnit.price * costRatio) / 1000) * 1000;
            
                // Push vào mảng rows
                const rowKey = p.id.toString();
                newRows.push({
                    key: rowKey,
                    product_id: p.id,
                    product_name: p.name,
                    unit_name: displayUnit.unit_name, // Hiển thị tên đơn vị Bán buôn (VD: Hộp)
                    
                    old_cost_display: displayOldCost, // Dùng biến này để hiện lên cột "Giá Vốn Cũ"
                    new_cost_display: displayNewCost, // Dùng biến này để hiện lên cột "Giá Vốn Mới"
                    
                    current_sell_price: displayUnit.price, // Giá bán hiện tại của Hộp
                    new_sell_price: suggestedPrice,        // Giá bán mới của Hộp
                    
                    units: p.product_units // Giữ nguyên để update đồng loạt
                });

                // Tự động check nếu giá vốn thay đổi > 1%
                if (Math.abs(costRatio - 1) > 0.01) {
                    defaultSelected.push(rowKey);
                }
            });

            setRows(newRows);
            setSelectedRowKeys(defaultSelected);

        } catch (error) {
            console.error(error);
            message.error("Lỗi lấy dữ liệu giá");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Chỉ xử lý các dòng được chọn
            const selectedRows = rows.filter(r => selectedRowKeys.includes(r.key));
            
            if (selectedRows.length === 0) {
                onClose(); 
                return;
            }

            const updates: any[] = [];

            // Duyệt qua từng sản phẩm được chọn
            selectedRows.forEach(row => {
                // Tính tỷ lệ thay đổi giá bán dựa trên đơn vị đang hiển thị (Wholesale)
                const priceChangeRatio = row.current_sell_price > 0 
                    ? (row.new_sell_price / row.current_sell_price) 
                    : 1;

                // Update TẤT CẢ unit khác theo tỷ lệ này
                row.units.forEach(unit => {
                    let newUnitTestPrice = 0;
                    
                    if (unit.unit_name === row.unit_name) {
                        // Nếu là chính đơn vị đang sửa (Hộp) -> Lấy giá user nhập
                        newUnitTestPrice = row.new_sell_price;
                    } else {
                        // Nếu là đơn vị khác (Viên) -> Tính theo tỷ lệ thay đổi
                        newUnitTestPrice = Math.ceil((unit.price * priceChangeRatio) / 100) * 100; // Làm tròn trăm đồng
                    }

                    updates.push({ id: unit.id, price: newUnitTestPrice });
                });
            });

            // Gọi API Update Bulk
            if (updates.length > 0) {
                console.log("Đang gửi updates:", updates);
                
                // Gọi hàm service mới
                const result = await updateProductPrices(updates);
                
                if (result.count > 0) {
                    message.success(`Thành công! Đã cập nhật giá mới cho ${result.count} quy cách sản phẩm.`);
                    onClose(); // Chỉ đóng khi thành công
                } else {
                    message.error("Không thể lưu vào Database. Vui lòng báo Core kiểm tra quyền (RLS) bảng product_units.");
                }
            } else {
                message.warning("Bạn chưa chọn sản phẩm nào để cập nhật giá.");
            }
        } catch (error: any) {
            message.error(`Lỗi hệ thống: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Sản phẩm',
            dataIndex: 'product_name',
            render: (text: string, r: PriceRow) => (
                <div>
                    <b>{text}</b>
                    <div style={{fontSize: 12, color: '#666'}}>Đơn vị: {r.unit_name}</div>
                </div>
            )
        },
        {
            title: 'Biến động Giá Vốn',
            render: (_: any, r: PriceRow) => {
                const diff = r.old_cost_display > 0 
                    ? ((r.new_cost_display - r.old_cost_display) / r.old_cost_display) * 100 
                    : 100;
                const color = diff > 0 ? 'red' : 'green';
                const icon = diff > 0 ? '↗' : '↘';
                
                if (Math.abs(diff) < 0.1) return <Tag>Không đổi</Tag>;

                return (
                    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <div style={{fontSize: 12, color: '#999'}}>
                            {formatCurrency(r.old_cost_display)} <ArrowRightOutlined /> <b>{formatCurrency(r.new_cost_display)}</b>
                        </div>
                        <Tag color={color}>{icon} {Math.abs(diff).toFixed(1)}%</Tag>
                    </div>
                )
            }
        },
        {
            title: 'Giá Bán Cũ',
            dataIndex: 'current_sell_price',
            width: 120,
            render: (val: number) => formatCurrency(val)
        },
        {
            title: 'Giá Bán Mới (Đề xuất)',
            dataIndex: 'new_sell_price',
            width: 150,
            render: (val: number, record: PriceRow) => (
                <InputNumber
                    value={val}
                    style={{width: '100%', fontWeight: 'bold'}}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                    onChange={(v) => {
                        setRows(prev => prev.map(r => r.key === record.key ? {...r, new_sell_price: Number(v)} : r));
                        // Auto check khi sửa giá
                        if (!selectedRowKeys.includes(record.key)) {
                            setSelectedRowKeys(prev => [...prev, record.key]);
                        }
                    }}
                />
            )
        }
    ];

    return (
        <Modal
            title="Cập nhật Giá Bán Lẻ (Dựa trên Giá Vốn mới)"
            open={visible}
            onCancel={onClose}
            width={900}
            maskClosable={false}
            footer={[
                <Button key="close" onClick={onClose}>Bỏ qua (Giữ giá cũ)</Button>,
                <Button key="save" type="primary" onClick={handleSave} loading={loading}>
                    Lưu Giá Mới ({selectedRowKeys.length})
                </Button>
            ]}
        >
            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys
                }}
                dataSource={rows}
                columns={columns}
                pagination={false}
                scroll={{ y: 400 }}
                rowKey="key"
            />
        </Modal>
    );
};
