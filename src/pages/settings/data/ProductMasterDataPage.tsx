// src/pages/settings/data/ProductMasterDataPage.tsx
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import { 
    Button, 
    Card, 
    Col, 
    Layout, 
    message, 
    Row, 
    Typography, 
    Upload, 
    Progress,
    Alert
} from "antd";
import { useState } from "react";
import * as XLSX from "xlsx";

import { productMasterService } from "@/features/product-master/api/productMasterService";
import { generateExcelTemplate, parseExcelToPayload } from "@/features/product-master/utils/excelParser";
import { supabase } from "@/shared/lib/supabaseClient";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { Content } = Layout;

const ProductMasterDataPage = () => {
    const [exportLoading, setExportLoading] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    // --- EXPORT HANDLER ---
    const handleExport = async () => {
        try {
            setExportLoading(true);
            message.loading({ content: "Đang tải dữ liệu...", key: "export" });

            // 1. Get Master Data
            const data = await productMasterService.exportMasterData();
            
            // 2. Get Warehouse List (for dynamic columns)
            const { data: warehouses, error: whError } = await supabase
                .from('warehouses')
                .select('id, name')
                //.eq('is_active', true);
                
            if (whError) throw whError;

            // 3. Generate Sheet
            const ws = generateExcelTemplate(data, warehouses || []);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "MasterData");

            // 4. Download
            XLSX.writeFile(wb, `Product_Master_Data_${new Date().toISOString().slice(0,10)}.xlsx`);
            message.success({ content: "Tải xuống thành công!", key: "export" });
        } catch (error: any) {
            console.error(error);
            message.error({ content: "Lỗi tải xuống: " + error.message, key: "export" });
        } finally {
            setExportLoading(false);
        }
    };

    // --- IMPORT HANDLER ---
    const handleImport = async (file: File) => {
        setImportLoading(true);
        setProgress(0);
        
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const binaryStr = e.target?.result;
                const wb = XLSX.read(binaryStr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                
                // Read raw data
                const rawData = XLSX.utils.sheet_to_json(ws);
                if (rawData.length === 0) {
                     message.error("File trống!");
                     setImportLoading(false);
                     return;
                }

                // 2. Parse Data
                const payload = parseExcelToPayload(rawData);
                message.info(`Tìm thấy ${payload.length} dòng hợp lệ. Đang xử lý...`);

                // 3. Call API Chunked
                await productMasterService.importMasterData(payload);
                
                message.success("Import thành công toàn bộ dữ liệu!");
                setProgress(100);
            };
            
            reader.readAsBinaryString(file);
        } catch (error: any) {
             console.error(error);
             message.error("Lỗi Import: " + error.message);
        } finally {
            setImportLoading(false);
        }
        
        return false; // Prevent auto upload
    };

    return (
        <Layout style={{ minHeight: "100vh", background: "#f0f2f5" }}>
            <Content style={{ padding: 24, margin: 0 }}>
                <div style={{ maxWidth: 1000, margin: "0 auto" }}>
                    <Title level={2}>Quản lý Dữ liệu Sản phẩm (Master)</Title>
                    <Paragraph type="secondary">
                        Công cụ xử lý hàng loạt: Tải xuống file Excel, chỉnh sửa giá/đơn vị/kho, và tải lên lại để cập nhật.
                    </Paragraph>

                    <Alert
                        message="Lưu ý quan trọng"
                        description={
                            <ul>
                                <li>File Excel cần giữ nguyên định dạng các cột Header quan trọng (SKU).</li>
                                <li>Các ô để trống sẽ được BỎ QUA (giữ nguyên giá trị cũ trong hệ thống).</li>
                                <li>Nếu muốn chỉnh sửa Min/Max kho, hãy chắc chắn ID kho trong tên cột đúng định dạng "Kho [ID]...".</li>
                            </ul>
                        }
                        type="warning"
                        showIcon
                        style={{ marginBottom: 24 }}
                    />

                    <Row gutter={24}>
                        {/* EXPORT CARD */}
                        <Col span={12}>
                            <Card title="1. Xuất Dữ liệu" bordered={false} style={{ height: '100%' }}>
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <DownloadOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                                    <Paragraph>
                                        Tải toàn bộ dữ liệu sản phẩm, đơn vị, giá margin và cấu hình kho hiện tại.
                                    </Paragraph>
                                    <Button 
                                        type="primary" 
                                        icon={<DownloadOutlined />} 
                                        size="large"
                                        onClick={handleExport}
                                        loading={exportLoading}
                                    >
                                        Tải file Excel Master
                                    </Button>
                                </div>
                            </Card>
                        </Col>

                        {/* IMPORT CARD */}
                        <Col span={12}>
                            <Card title="2. Nhập Dữ liệu" bordered={false} style={{ height: '100%' }}>
                                <div style={{ padding: '20px 0' }}>
                                    <Dragger 
                                        accept=".xlsx, .xls"
                                        showUploadList={false}
                                        beforeUpload={handleImport}
                                        style={{ padding: 20 }}
                                        disabled={importLoading}
                                    >
                                        <p className="ant-upload-drag-icon">
                                            <InboxOutlined />
                                        </p>
                                        <p className="ant-upload-text">Kéo thả file Excel vào đây</p>
                                        <p className="ant-upload-hint">
                                            Hỗ trợ định dạng .xlsx, .xls.
                                        </p>
                                    </Dragger>

                                    {importLoading && (
                                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                                            <Text>Đang xử lý dữ liệu... Vui lòng không tắt trình duyệt.</Text>
                                            <Progress percent={progress > 0 ? progress : 50} status="active" />
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </div>
            </Content>
        </Layout>
    );
};

export default ProductMasterDataPage;
