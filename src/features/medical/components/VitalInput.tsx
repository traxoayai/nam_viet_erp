// src/features/medical/components/VitalInput.tsx
import React from 'react';
import { InputNumber, Popover } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, LineChartOutlined } from '@ant-design/icons';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';


interface HistoryPoint {
  date: string;
  value: number;
}

interface Props {
  label: string;
  value: number | null;
  onChange: (val: number | null) => void;
  history?: HistoryPoint[]; // Dữ liệu 5 lần khám gần nhất
  unit?: string;
  lowerBetter?: boolean; // True nếu chỉ số càng thấp càng tốt (VD: Huyết áp), False nếu càng cao càng tốt (VD: Cân nặng trẻ em)
  warningThreshold?: { min?: number; max?: number }; // Cảnh báo nóng
}

export const VitalInput: React.FC<Props> = ({ 
  label, value, onChange, history = [], unit, lowerBetter = false, warningThreshold 
}) => {
  
  // 1. Lấy giá trị gần nhất để so sánh
  const lastRecord = history.length > 0 ? history[history.length - 1] : null;
  const lastValue = lastRecord?.value;

  // 2. Tính toán Delta (Tăng hay giảm)
  let diff = 0;
  let trendIcon = <MinusOutlined className="text-gray-400" />;
  let trendColor = "text-gray-400";

  if (value !== null && lastValue !== undefined) {
      diff = value - lastValue;
      const isIncrease = diff > 0;
      
      if (Math.abs(diff) > 0) {
          // Logic màu sắc: 
          // Nếu lowerBetter (HA): Tăng là Đỏ (Xấu), Giảm là Xanh (Tốt).
          // Nếu !lowerBetter (Cân nặng): Tăng là Xanh (Tốt), Giảm là Đỏ/Cam (Xấu - tùy ngữ cảnh, tạm để neutral).
          
          let isGood = false;
          if (lowerBetter) isGood = !isIncrease; // HA giảm -> Tốt
          else isGood = isIncrease; // Cân nặng tăng -> Tốt (Mặc định logic Nhi khoa)

          trendColor = isGood ? "text-green-500" : "text-red-500";
          trendIcon = isIncrease ? <ArrowUpOutlined /> : <ArrowDownOutlined />;
      }
  }

  // 3. Nội dung Popover (Sparkline Chart)
  const renderChart = () => {
    if (!history || history.length < 2) return <div className="p-2 text-xs text-gray-400">Chưa đủ dữ liệu lịch sử</div>;
    
    // Merge current value vào chart để thấy ngay điểm mới
    const chartData = [...history];
    if (value) {
        chartData.push({ date: 'Hôm nay', value: value });
    }

    return (
      <div className="w-[200px] h-[100px] bg-white p-2">
         <div className="text-xs font-bold text-gray-600 mb-1 border-b pb-1">Xu hướng {label}</div>
         <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
               <Line type="monotone" dataKey="value" stroke={lowerBetter ? "#ff4d4f" : "#1890ff"} strokeWidth={2} dot={{r: 2}} />
               <YAxis domain={['auto', 'auto']} hide />
            </LineChart>
         </ResponsiveContainer>
         <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{dayjs(history[0].date).format('DD/MM')}</span>
            <span>Hôm nay</span>
         </div>
      </div>
    );
  };

  // 4. Cảnh báo nóng (Immediate Warning)
  let warningStyle = "";
  if (value && warningThreshold) {
      if ((warningThreshold.max && value > warningThreshold.max) || (warningThreshold.min && value < warningThreshold.min)) {
          warningStyle = "border-red-500 bg-red-50 text-red-600 font-bold";
      }
  }

  return (
    <div className="mb-1">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">{label} {unit && `(${unit})`}</span>
        
        {/* CHỈ SỐ TREND (HIỂN THỊ LUÔN) */}
        {lastValue !== undefined && value !== null && (
            <span className={`text-xs ${trendColor} flex items-center gap-1 bg-gray-50 px-1 rounded`}>
                {trendIcon} {Math.abs(diff).toFixed(1)}
            </span>
        )}
      </div>

      <Popover content={renderChart} title={null} trigger="hover" placement="right">
          <div className="relative">
             <InputNumber 
                className={`w-full ${warningStyle}`} 
                value={value} 
                onChange={onChange}
                placeholder={lastValue ? `Trước: ${lastValue}` : "Nhập..."}
             />
             {/* Icon biểu đồ nhỏ xíu bên trong input để gợi ý là có chart */}
             {history.length > 0 && (
                 <LineChartOutlined className="absolute right-8 top-1.5 text-gray-300 text-xs pointer-events-none" />
             )}
          </div>
      </Popover>
    </div>
  );
};