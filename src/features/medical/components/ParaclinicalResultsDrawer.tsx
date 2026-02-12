// src/features/medical/components/ParaclinicalResultsDrawer.tsx
import React from 'react';
import { Drawer, Table, Tag, Typography, Alert, Divider } from 'antd';
import { FlaskConical, Activity, ArrowUp, ArrowDown } from 'lucide-react';

const { Text } = Typography;

interface LabResult {
    id: string;
    testName: string;
    result: number | string;
    unit: string;
    referenceRange: string;
    minNormal?: number;
    maxNormal?: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    patientName: string;
    bloodTests: LabResult[]; // Dữ liệu xét nghiệm máu
    imagingResults: string;  // Kết quả siêu âm/X-Quang (Dạng Text)
}

export const ParaclinicalResultsDrawer: React.FC<Props> = ({ open, onClose, patientName, bloodTests, imagingResults }) => {

    // Logic cốt lõi: Đánh giá chỉ số Bất thường
    const getStatus = (record: LabResult) => {
        if (typeof record.result !== 'number' || record.minNormal === undefined || record.maxNormal === undefined) {
            return 'normal';
        }
        if (record.result > record.maxNormal) return 'high';
        if (record.result < record.minNormal) return 'low';
        return 'normal';
    };

    const columns = [
        {
            title: 'Chỉ số Xét nghiệm',
            dataIndex: 'testName',
            key: 'testName',
            render: (text: string) => <span className="font-medium text-gray-700">{text}</span>
        },
        {
            title: 'Kết quả',
            key: 'result',
            render: (_: any, record: LabResult) => {
                const status = getStatus(record);
                
                if (status === 'high') {
                    return <span className="text-red-600 font-bold text-lg"><ArrowUp size={16} className="inline mr-1"/>{record.result}</span>;
                }
                if (status === 'low') {
                    return <span className="text-blue-600 font-bold text-lg"><ArrowDown size={16} className="inline mr-1"/>{record.result}</span>;
                }
                return <span className="text-gray-800">{record.result}</span>;
            }
        },
        {
            title: 'Đơn vị',
            dataIndex: 'unit',
            key: 'unit',
            render: (text: string) => <Text type="secondary" className="text-xs">{text}</Text>
        },
        {
            title: 'CSBT (Tham chiếu)',
            dataIndex: 'referenceRange',
            key: 'referenceRange',
            render: (text: string) => <Tag>{text}</Tag>
        }
    ];

    // Lọc ra các chỉ số bất thường để hiển thị cảnh báo nhanh (Summary)
    const abnormalTests = bloodTests.filter(t => getStatus(t) !== 'normal');

    return (
        <Drawer
            title={
                <div className="flex items-center gap-2 text-blue-700">
                    <FlaskConical size={20} /> 
                    <span>Kết quả Cận Lâm Sàng - {patientName}</span>
                </div>
            }
            placement="right"
            width={600} // Drawer rộng để dễ đọc bảng
            onClose={onClose}
            open={open}
            mask={false} // QUAN TRỌNG: Cho phép bác sĩ thao tác ở màn hình kê đơn bên dưới khi Drawer đang mở
            style={{ boxShadow: '-5px 0 15px rgba(0,0,0,0.05)' }}
        >
            {/* 1. SUMMARY CẢNH BÁO NHANH */}
            {abnormalTests.length > 0 ? (
                <Alert
                    message="Phát hiện chỉ số bất thường!"
                    description={
                        <ul className="list-disc pl-5 mt-1 text-red-700 font-medium text-sm">
                            {abnormalTests.map(t => (
                                <li key={t.id}>{t.testName}: {t.result} {t.unit} (CSBT: {t.referenceRange})</li>
                            ))}
                        </ul>
                    }
                    type="error"
                    showIcon
                    className="mb-4"
                />
            ) : (
                <Alert message="Các chỉ số máu nằm trong giới hạn bình thường." type="success" showIcon className="mb-4" />
            )}

            {/* 2. BẢNG CHI TIẾT XÉT NGHIỆM */}
            <div className="mb-6">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Activity size={16}/> Hóa sinh máu</h3>
                <Table 
                    columns={columns} 
                    dataSource={bloodTests} 
                    pagination={false} 
                    size="small"
                    rowKey="id"
                    rowClassName={(record) => getStatus(record) !== 'normal' ? 'bg-red-50/50' : ''} // Đổi màu nền dòng bất thường
                />
            </div>

            <Divider />

            {/* 3. KẾT QUẢ CHẨN ĐOÁN HÌNH ẢNH (Siêu âm / X-Quang) */}
            <div>
                <h3 className="font-bold text-gray-800 mb-2">Kết quả Siêu âm / X-Quang</h3>
                <div className="bg-gray-50 p-3 border border-gray-200 rounded whitespace-pre-wrap font-mono text-sm">
                    {imagingResults || "Chưa có kết quả chẩn đoán hình ảnh."}
                </div>
            </div>
        </Drawer>
    );
};