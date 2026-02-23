// src/pages/medical/ParaclinicalPage.tsx 
import { useState } from 'react';
import { Layout, Typography, Card, Tag, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { FlaskConical, Stethoscope } from 'lucide-react';
import { paraclinicalService } from '@/features/medical/api/paraclinicalService';

import { LabWorkspace } from '@/features/medical/components/paraclinical/LabWorkspace';
import { ImagingWorkspace } from '@/features/medical/components/paraclinical/ImagingWorkspace';

const { Sider } = Layout;
const { Text, Title } = Typography;

const ParaclinicalPage = () => {
    const [selectedRequest, setSelectedRequest] = useState<any>(null);

    // Fetch queue
    const { data: queue = [], isLoading } = useQuery({
        queryKey: ['paraclinical_queue'],
        queryFn: paraclinicalService.getParaclinicalQueue,
        refetchInterval: 5000 // Tự làm mới mỗi 5 giây
    });

    const renderWorkspace = () => {
        if (!selectedRequest) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white shadow-sm rounded-lg m-4">
                     <FlaskConical size={48} className="mb-4 opacity-50" />
                     <Title level={4} className="!text-gray-400">Trạm Cận Lâm Sàng</Title>
                     <Text>Vui lòng chọn một ca thực hiện từ danh sách chờ bên trái.</Text>
                </div>
            );
        }

        const category = selectedRequest.category;
        
        if (category === 'lab') {
            return <LabWorkspace request={selectedRequest} onComplete={() => setSelectedRequest(null)} />;
        } else if (category === 'imaging' || category === 'procedure') {
            return <ImagingWorkspace request={selectedRequest} onComplete={() => setSelectedRequest(null)} />;
        }

        return <div className="p-4 bg-white m-4 flex-1">Đang xây dựng Workspace cho {category}...</div>;
    };

    return (
        <Layout className="h-screen bg-gray-50 overflow-hidden">
            {/* LIFT SIDE: QUEUE (30%) */}
            <Sider width="30%" className="bg-white border-r border-gray-200 flex flex-col h-full" theme="light">
                <div className="p-4 border-b border-gray-100 bg-blue-50/50">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-blue-800">
                        <Stethoscope size={18} /> Danh Sách Chờ TH
                    </h2>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading ? <div className="p-4 text-center">Đang tải...</div> : 
                     queue.length === 0 ? <Empty description="Trống" className="mt-10" /> :
                     queue.map(req => {
                         const isSelected = selectedRequest?.id === req.id;
                         return (
                             <Card 
                                 key={req.id} 
                                 size="small" 
                                 className={`mb-2 cursor-pointer transition-all hover:shadow-md border-l-4 ${isSelected ? 'border-l-blue-500 bg-blue-50/30' : 'border-l-transparent'}`}
                                 onClick={() => setSelectedRequest(req)}
                             >
                                 <div className="flex justify-between items-start mb-1">
                                    <Text strong className={isSelected ? 'text-blue-600' : ''}>{req.patient?.name || 'Khách vãng lai'}</Text>
                                    <Tag color={req.status === 'examining' ? 'processing' : 'warning'}>{req.status === 'examining' ? 'ĐangTH' : 'Chờ'}</Tag>
                                 </div>
                                 <div className="text-sm text-gray-600 mb-1">
                                     <Text className="font-semibold text-gray-800">{req.service_name_snapshot}</Text>
                                 </div>
                                 <div className="flex justify-between items-center text-xs text-gray-400">
                                     <span>{dayjs(req.created_at).format('HH:mm')}</span>
                                     <Tag color={req.category === 'lab' ? 'purple' : 'cyan'} className="m-0 border-0">{req.category === 'lab' ? 'Xét nghiệm' : 'Hình ảnh'}</Tag>
                                 </div>
                             </Card>
                         )
                     })}
                </div>
            </Sider>

            {/* RIGHT SIDE: WORKSPACE (70%) */}
            <Layout className="flex flex-col bg-gray-50 h-full">
                 {renderWorkspace()}
            </Layout>
        </Layout>
    );
};

export default ParaclinicalPage;
