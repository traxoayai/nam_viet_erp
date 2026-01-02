import { useEffect, useState } from 'react';
import { Modal, Form, Select, Input, Radio, message } from 'antd';
import { posService } from '@/features/pos/api/posService';
import { inventoryService } from '../api/inventoryService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/contexts/AuthProvider';

export const CreateCheckModal = ({ open, onCancel }: any) => {
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Dropdown Data
    const [activeWarehouses, setActiveWarehouses] = useState<any[]>([]);
    const [cabinets, setCabinets] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [manufacturers, setManufacturers] = useState<string[]>([]);
    
    const [loading, setLoading] = useState(false);

    // Watchers
    const warehouseId = Form.useWatch('warehouse_id', form);
    const scope = Form.useWatch('scope', form);

    useEffect(() => {
        if (open) {
            form.resetFields();
            form.setFieldsValue({ scope: 'ALL' }); 

            // 1. Load Warehouses
            posService.getActiveWarehouses().then(data => {
                setActiveWarehouses(data);
                // Auto-select logic
                if (data.length === 1) {
                    form.setFieldsValue({ warehouse_id: data[0].id });
                } else if (data.length > 0) {
                     form.setFieldsValue({ warehouse_id: data[0].id });
                }
            });

            // 2. Pre-load Common Data
            inventoryService.getCategories().then(setCategories);
            inventoryService.getManufacturers().then(setManufacturers);
        }
    }, [open]);

    // 3. Dynamic Load Cabinets when Warehouse changes
    useEffect(() => {
        if (warehouseId) {
            inventoryService.getCabinets(warehouseId)
                .then(setCabinets)
                .catch(() => setCabinets([]));
        } else {
            setCabinets([]);
        }
    }, [warehouseId]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // Construct RPC Params
            const params = {
                warehouseId: values.warehouse_id,
                note: values.note,
                scope: values.scope, // 'ALL' | 'CATEGORY' | 'CABINET' | 'SUPPLIER'
                textVal: undefined,
                intVal: undefined
            };

            // Map dynamic fields to RPC params
            if (values.scope === 'CATEGORY') params.textVal = values.category_name;
            if (values.scope === 'CABINET') params.textVal = values.cabinet_name;
            if (values.scope === 'MANUFACTURER') params.textVal = values.manufacturer_name;

            // Call API
            const newId = await inventoryService.createCheckSession(params);
            
            message.success("Đã tạo phiếu kiểm kê thành công!");
            onCancel();
            navigate(`/inventory/stocktake/${newId}`);

        } catch (error) {
            console.error("Create Error:", error);
            message.error("Không thể tạo phiếu. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    const isSingleWarehouse = activeWarehouses.length === 1;

    return (
        <Modal
            title="Tạo Phiếu Kiểm Kê Mới"
            open={open}
            onCancel={onCancel}
            onOk={handleOk}
            confirmLoading={loading}
            okText="Bắt đầu kiểm"
            width={600}
        >
            <div style={{marginBottom: 20, padding: '10px 16px', background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 6, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize: 13}}>Người tạo: <b>{user?.user_metadata?.full_name || user?.email}</b></span>
            </div>

            <Form form={form} layout="vertical">
                {/* 1. KHO */}
                <Form.Item 
                    name="warehouse_id" 
                    label="1. Chọn Kho cần kiểm" 
                    rules={[{ required: true, message: 'Vui lòng chọn kho' }]}
                >
                    <Select 
                        placeholder="Chọn kho..." 
                        disabled={isSingleWarehouse}
                        size="large"
                    >
                        {activeWarehouses.map(w => <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>)}
                    </Select>
                </Form.Item>

                {/* 2. PHẠM VI */}
                <Form.Item name="scope" label="2. Phạm vi kiểm kê" initialValue="ALL">
                    <Radio.Group buttonStyle="solid" size="middle" style={{width: '100%', display:'flex'}}>
                        <Radio.Button value="ALL" style={{flex:1, textAlign:'center'}}>Toàn bộ</Radio.Button>
                        <Radio.Button value="CATEGORY" style={{flex:1, textAlign:'center'}}>Nhóm hàng</Radio.Button>
                        <Radio.Button value="CABINET" style={{flex:1, textAlign:'center'}}>Tủ / Kệ</Radio.Button>
                        <Radio.Button value="MANUFACTURER" style={{flex:1, textAlign:'center'}}>Hãng SX</Radio.Button>
                    </Radio.Group>
                </Form.Item>

                {/* 3. INPUT ĐỘNG */}
                <div style={{minHeight: 80}}>
                    {scope === 'CATEGORY' && (
                        <Form.Item 
                            name="category_name" 
                            label="Chọn Nhóm Hàng" 
                            rules={[{ required: true, message: 'Vui lòng chọn nhóm hàng' }]}
                            style={{animation: 'fadeIn 0.3s'}}
                        >
                            <Select showSearch placeholder="Tìm kiếm nhóm hàng..." size="large">
                                {categories.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
                            </Select>
                        </Form.Item>
                    )}

                    {scope === 'CABINET' && (
                        <Form.Item 
                            name="cabinet_name" 
                            label={`Chọn Tủ / Kệ (Tại kho ${activeWarehouses.find(w => w.id === warehouseId)?.name || '...'})`}
                            rules={[{ required: true, message: 'Vui lòng chọn vị trí tủ/kệ' }]}
                            style={{animation: 'fadeIn 0.3s'}}
                            help={cabinets.length === 0 ? "Kho này chưa được cấu hình vị trí (Cabinet/Row)." : null}
                        >
                            <Select showSearch placeholder="Tìm vị trí tủ/kệ..." size="large">
                                {cabinets.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
                            </Select>
                        </Form.Item>
                    )}

                    {scope === 'MANUFACTURER' && (
                        <Form.Item 
                            name="manufacturer_name" 
                            label="Chọn Hãng Sản Xuất" 
                            rules={[{ required: true, message: 'Vui lòng chọn Hãng' }]}
                            style={{animation: 'fadeIn 0.3s'}}
                        >
                            <Select showSearch placeholder="Tìm kiếm Hãng SX..." size="large">
                                {manufacturers.map(m => <Select.Option key={m} value={m}>{m}</Select.Option>)}
                            </Select>
                        </Form.Item>
                    )}
                     
                    {scope === 'ALL' && (
                        <div style={{padding: '10px 0', color: '#888', fontStyle: 'italic'}}>
                            * Hệ thống sẽ tạo phiếu kiểm kê cho TOÀN BỘ sản phẩm tồn tại trong kho này. 
                            Lưu ý: Quá trình snapshot tồn kho có thể mất vài giây.
                        </div>
                    )}
                </div>

                {/* 4. GHI CHÚ */}
                <Form.Item name="note" label="3. Ghi chú (Tên đợt kiểm)">
                    <Input placeholder="VD: Kiểm kho định kỳ tháng 12..." size="large" />
                </Form.Item>
            </Form>
        </Modal>
    );
};
