// src/features/medical/components/exam-forms/ExamForm_Infant.tsx
import React, { useMemo } from 'react';
import { Card, Input, Row, Col, Select, Empty } from 'antd';
import { SmileOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';

interface Props {
  data: any;
  onChange: (key: string, val: string) => void;
  // Dữ liệu lịch sử cho biểu đồ (Optional if we calculate from birth)
  historyData?: any[]; 
  vitals?: any; // Để lấy weight hiện tại
  patientDOB?: string; // Cần DOB để tính tháng tuổi
}

// Dữ liệu chuẩn WHO (Cân nặng bé trai 0-24 tháng - Rút gọn P50 - Simplification)
const WHO_STD = [ 
    { m: 0, std: 3.3 }, { m: 2, std: 5.6 }, { m: 4, std: 7.0 }, 
    { m: 6, std: 7.9 }, { m: 8, std: 8.6 }, { m: 10, std: 9.2 }, 
    { m: 12, std: 9.6 }, { m: 18, std: 10.9 }, { m: 24, std: 12.2 } 
];

export const ExamForm_Infant: React.FC<Props> = ({ data, onChange, vitals, patientDOB }) => {
  
  // 1. Tính toán Data Biểu đồ (Realtime)
  const chartData = useMemo(() => {
      if (!patientDOB) return [];

      const now = dayjs();
      const dob = dayjs(patientDOB);
      // const ageMonths = now.diff(dob, 'month'); // Logic cũ
      const ageMonths = now.diff(dob, 'month') || 1; // Logic mới

      // Điểm lúc sinh
      // Giả sử data.birth_weight lưu ở metadata hoặc cần field nhập. 
      const p0 = { 
          month: 0, 
          weight: data.birth_weight ? parseFloat(data.birth_weight) : 3.2, // Default 3.2 if missing
          who: 3.3 
      };
      
      // Điểm hiện tại
      const currentWeight = vitals?.weight ? parseFloat(vitals.weight) : null;

      const pCurrent = {
          month: ageMonths,
          weight: currentWeight,
          who: WHO_STD.find(x => x.m >= ageMonths)?.std || 10
      };
      
      return [p0, pCurrent];
  }, [vitals?.weight, data.birth_weight, patientDOB]);

  // 2. Logic Đánh giá (Interpreter)

const nutritionalStatus = useMemo(() => {
    if (!chartData || chartData.length < 2) return null;
    const current = chartData[chartData.length - 1]; 
    if (!current.weight || !current.who) return null;

    const diff = current.weight - current.who; 
    const targetWeight = current.who; // Cân nặng lý tưởng (P50)

    if (diff < -2.0) {
        const needToGain = (targetWeight - current.weight).toFixed(1);
        return { 
            text: 'SUY DINH DƯỠNG NẶNG', 
            color: 'red', 
            bg: 'bg-red-50',
            action: `Mục tiêu cấp bách: Cần tăng thêm ${needToGain} kg để bắt kịp đà tăng trưởng.`
        };
    }
    if (diff > 2.0) {
        return { 
            text: 'BÉO PHÌ / THỪA CÂN', 
            color: 'red', 
            bg: 'bg-red-50',
            action: `Khuyến nghị: Không ép giảm cân. Giữ nguyên ${current.weight}kg, tập trung phát triển chiều cao.`
        };
    }
    if (diff < -1.0) {
        const needToGain = (targetWeight - current.weight).toFixed(1);
        return { 
            text: 'NGUY CƠ SUY DINH DƯỠNG', 
            color: 'orange', 
            bg: 'bg-orange-50',
            action: `Mục tiêu: Tăng thêm ${needToGain} kg để đạt mức lý tưởng.`
        };
    }
    
    return { 
        text: 'PHÁT TRIỂN BÌNH THƯỜNG', 
        color: 'green', 
        bg: 'bg-green-50',
        action: 'Tuyệt vời! Tiếp tục duy trì chế độ dinh dưỡng hiện tại.' 
    };
}, [chartData]);

  return (
    <div className="flex gap-4 p-2">
      {/* LEFT: FORM KHÁM */}
      <div className="flex-1">
        <Card 
            size="small" 
            title={<span className="text-pink-600 font-bold"><SmileOutlined /> Khám chuyên khoa NHI (0 - 24 tháng)</span>}
            className="shadow-sm border border-pink-100 bg-pink-50 h-full rounded-lg"
        >
            <Row gutter={[12, 12]}>
                <Col span={12}>
                    <label className="text-xs text-gray-500">Cân nặng lúc sinh (kg)</label>
                    <Input 
                        placeholder="VD: 3.2"
                        value={data.birth_weight}
                        onChange={e => onChange('birth_weight', e.target.value)}
                    />
                </Col>
                <Col span={12}>
                    <label className="text-xs text-gray-500">Thóp (Fontanelle)</label>
                    <Select 
                        className="w-full" 
                        placeholder="Chọn trạng thái"
                        value={data.fontanelle}
                        onChange={v => onChange('fontanelle', v)}
                        options={[
                            { value: 'normal', label: 'Bình thường (Phẳng, mềm)' },
                            { value: 'bulging', label: 'Phồng (Tăng áp lực)' },
                            { value: 'sunken', label: 'Lõm (Mất nước)' },
                            { value: 'closed_early', label: 'Đóng sớm' },
                            { value: 'closed_late', label: 'Đóng muộn' },
                        ]}
                    />
                </Col>
                <Col span={12}>
                    <label className="text-xs text-gray-500">Phản xạ (Reflexes)</label>
                    <Input 
                        value={data.reflexes} 
                        onChange={e => onChange('reflexes', e.target.value)} 
                        placeholder="Moro, bú, nắm tay..."
                    />
                </Col>
                <Col span={12}>
                    <label className="text-xs text-gray-500">Vàng da (Jaundice)</label>
                    <Select 
                        className="w-full"
                        value={data.jaundice}
                        onChange={v => onChange('jaundice', v)}
                        options={[
                            { value: 'none', label: 'Không' },
                            { value: 'zone_1', label: 'Vùng 1 (Mặt, cổ)' },
                            { value: 'zone_2', label: 'Vùng 2 (Ngực, lưng)' },
                            { value: 'zone_3', label: 'Vùng 3 (Bụng, đùi)' },
                            { value: 'zone_4', label: 'Vùng 4 (Tay, chân)' },
                            { value: 'zone_5', label: 'Vùng 5 (Bàn tay, chân)' },
                        ]}
                    />
                </Col>
                <Col span={24}>
                    <label className="text-xs text-gray-500">Bú / Ăn uống</label>
                    <Input 
                        value={data.feeding_status} 
                        onChange={e => onChange('feeding_status', e.target.value)} 
                        placeholder="Bú mẹ/Sữa CT/Ăn dặm..."
                    />
                </Col>
            </Row>
        </Card>
      </div>

      {/* RIGHT: CHART + ASSISTANT */}
      <div className="w-1/3 min-w-[350px]">
        <Card 
            size="small" 
            title="Biểu đồ tăng trưởng (Weight)" 
            className="h-full border border-gray-200 shadow-sm rounded-lg bg-white"
        >
            {(!chartData || chartData.length === 0) ? (
                <Empty description="Chưa có dữ liệu tăng trưởng" />
            ) : (
                <>
                    <div style={{ width: '100%', height: 200 }}>
                        <ResponsiveContainer>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" label={{ value: 'Tháng', position: 'insideBottom', offset: -5 }} />
                                <YAxis domain={[0, 'auto']} label={{ value: 'Kg', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                <Legend verticalAlign="top" height={36}/>
                                
                                <Line type="monotone" dataKey="who" stroke="#94a3b8" strokeDasharray="5 5" name="Chuẩn WHO (P50)" dot={false} strokeWidth={2}/>
                                <Line type="monotone" dataKey="weight" stroke="#db2777" strokeWidth={3} name="Bé" activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* NEW: ĐÁNH GIÁ & KHUYẾN NGHỊ */}
                    {nutritionalStatus && (
                        <div className={`mt-2 p-3 text-center border rounded-md ${nutritionalStatus.bg} border-${nutritionalStatus.color}-200`}>
                            <div className={`font-bold text-${nutritionalStatus.color}-700 text-sm mb-1`}>
                               {nutritionalStatus.text.toUpperCase()}
                            </div>
                            <div className="text-xs text-gray-700 font-medium">
                                {nutritionalStatus.action}
                            </div>
                        </div>
                    )}
                </>
            )}
        </Card>
      </div>
    </div>
  );
};
