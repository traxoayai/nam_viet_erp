import React from 'react';
import { Drawer, Timeline, Card, Tag, Button, Empty, Tooltip } from 'antd';
import { ClockCircleOutlined, MedicineBoxOutlined, CopyOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { usePatientHistory } from '../hooks/usePatientHistory';
import { ClinicalPrescriptionItem } from '../types/medical.types';

interface Props {
  open: boolean;
  onClose: () => void;
  patientId?: number;
  patientName?: string;
  onCopyPrescription: (items: ClinicalPrescriptionItem[]) => void;
}

export const PatientHistoryDrawer: React.FC<Props> = ({ open, onClose, patientId, patientName, onCopyPrescription }) => {
  const { history, loading } = usePatientHistory(patientId);

  return (
    <Drawer
      title={<span>Lịch sử khám bệnh: <b>{patientName}</b></span>}
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
      bodyStyle={{ padding: '20px', backgroundColor: '#f9fafb' }}
    >
      {loading ? (
         <Card loading />
      ) : history.length === 0 ? (
         <Empty description="Bệnh nhân chưa có lịch sử khám" />
      ) : (
        <Timeline mode="left">
          {history.map((visit) => (
            <Timeline.Item 
                key={visit.id} 
                label={<span className="text-gray-500 text-xs">{dayjs(visit.created_at).format('DD/MM/YYYY HH:mm')}</span>}
                dot={<ClockCircleOutlined style={{ fontSize: '16px', color: '#1890ff' }} />}
            >
              <Card 
                size="small" 
                className="mb-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-blue-500 rounded-lg"
                hoverable
              >
                {/* 1. HEADER: CHẨN ĐOÁN & BÁC SĨ */}
                <div className="flex justify-between items-start mb-3 border-b pb-2 border-gray-100">
                    <div>
                        <div className="font-bold text-blue-800 text-lg">
                            {visit.diagnosis || "Chưa có chẩn đoán"}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <UserOutlined /> BS. {visit.doctor?.full_name || "N/A"}
                        </div>
                    </div>
                </div>

                {/* 2. BODY: TRIỆU CHỨNG & GHI CHÚ */}
                <div className="text-sm text-gray-700 mb-3 bg-blue-50 p-3 rounded-md">
                    <div className="mb-1"><span className="font-semibold text-blue-900">Lý do khám:</span> {visit.symptoms}</div>
                    {visit.doctor_notes && (
                        <div className="mt-2 italic text-gray-600 border-t border-blue-100 pt-2 flex gap-2">
                             <span className="font-semibold text-blue-900">Lời dặn:</span> 
                             <span>{visit.doctor_notes}</span>
                        </div>
                    )}
                </div>

                {/* 3. FOOTER: DANH SÁCH THUỐC */}
                {visit.flatMedicines && visit.flatMedicines.length > 0 ? (
                    <div>
                         <div className="flex justify-between items-center mb-2">
                            <div className="font-semibold text-gray-700 flex items-center gap-2">
                                <MedicineBoxOutlined className="text-teal-600"/> Đơn thuốc ({visit.flatMedicines.length})
                            </div>
                            <Tooltip title="Sử dụng lại đơn thuốc này cho đợt khám hiện tại">
                                <Button 
                                    size="small" 
                                    type="primary"
                                    ghost
                                    icon={<CopyOutlined />} 
                                    onClick={() => {
                                        onCopyPrescription(visit.flatMedicines);
                                        onClose(); 
                                    }}
                                >
                                    Tái kê đơn
                                </Button>
                            </Tooltip>
                         </div>
                         
                         <div className="flex flex-wrap gap-2">
                             {visit.flatMedicines.map((p: any, idx: number) => (
                                 <Tag key={idx} color="cyan" className="m-0 px-2 py-1 text-xs flex items-center gap-1">
                                     <span>{p.product_name}</span>
                                     <span className="font-bold bg-white px-1 rounded-sm text-teal-700 border border-teal-200">x{p.quantity} {p.unit_name}</span>
                                 </Tag>
                             ))}
                         </div>
                    </div>
                ) : (
                    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <MedicineBoxOutlined /> Không kê đơn thuốc
                    </div>
                )}
              </Card>
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Drawer>
  );
};