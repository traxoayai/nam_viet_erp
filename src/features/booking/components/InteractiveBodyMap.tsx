// src/features/booking/components/InteractiveBodyMap.tsx
import React from 'react';
import { Tooltip, theme } from 'antd';

/**
 * BODY_PARTS_DATA
 * Định nghĩa các vùng cơ thể với tọa độ SVG (Path Data) được tinh chỉnh
 * để mô phỏng hình dáng giải phẫu học (Anatomical Schematic).
 */
const BODY_PARTS_DATA = [
  {
    id: 'head',
    label: 'Đầu & Cổ',
    d: 'M150,20 C165,20 175,35 175,55 C175,70 165,85 150,85 C135,85 125,70 125,55 C125,35 135,20 150,20 Z', 
  },
  {
    id: 'chest',
    label: 'Ngực',
    d: 'M125,85 C135,90 165,90 175,85 C185,90 195,100 190,140 C170,145 130,145 110,140 C105,100 115,90 125,85 Z',
  },
  {
    id: 'abdomen',
    label: 'Bụng',
    d: 'M110,140 C130,145 170,145 190,140 C188,170 185,190 180,210 C160,215 140,215 120,210 C115,190 112,170 110,140 Z',
  },
  {
    id: 'pelvis',
    label: 'Khung chậu & Hông',
    d: 'M120,210 C140,215 160,215 180,210 C185,225 190,235 195,245 C175,255 125,255 105,245 C110,235 115,225 120,210 Z',
  },
  {
    id: 'left_arm',
    label: 'Tay Trái',
    d: 'M110,140 C100,140 95,130 90,100 C80,120 70,160 60,180 C65,190 75,190 80,180 C85,160 95,145 110,140 Z', 
  },
  {
    id: 'right_arm',
    label: 'Tay Phải',
    d: 'M190,140 C200,140 205,130 210,100 C220,120 230,160 240,180 C235,190 225,190 220,180 C215,160 205,145 190,140 Z',
  },
  {
    id: 'left_leg',
    label: 'Chân Trái',
    d: 'M105,245 C100,260 95,320 95,350 C105,360 115,360 125,350 C125,320 125,260 125,252 Z',
  },
  {
    id: 'right_leg',
    label: 'Chân Phải',
    d: 'M195,245 C200,260 205,320 205,350 C195,360 185,360 175,350 C175,320 175,260 175,252 Z',
  },
];

interface InteractiveBodyMapProps {
  selectedParts?: string[];
  onPartClick: (partId: string) => void;
  height?: number | string;
}

export const InteractiveBodyMap: React.FC<InteractiveBodyMapProps> = ({ 
  selectedParts = [], 
  onPartClick,
  height = 400
}) => {
  // Lấy màu từ theme hệ thống để đảm bảo tính nhất quán (Brand Consistency)
  const { token } = theme.useToken();

  return (
    <div 
      style={{ 
        width: '100%', 
        height: height, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        position: 'relative',
        userSelect: 'none'
      }}
    >
      <svg
        viewBox="0 0 300 400"
        xmlns="http://www.w3.org/2000/svg"
        style={{ 
          height: '100%', 
          width: 'auto', 
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.08))', // Soft shadow tạo chiều sâu
          overflow: 'visible' 
        }}
      >
        <defs>
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#f5f5f5', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#e0e0e0', stopOpacity: 1 }} />
          </linearGradient>
        </defs>

        {BODY_PARTS_DATA.map((part) => {
          const isSelected = selectedParts.includes(part.id);

          return (
            <Tooltip title={part.label} key={part.id} mouseEnterDelay={0.2}>
              <path
                d={part.d}
                onClick={() => onPartClick(part.id)}
                
                // Styles động
                fill={isSelected ? token.colorPrimary : "url(#bodyGradient)"}
                stroke={isSelected ? token.colorPrimaryActive : "#bfbfbf"}
                strokeWidth={isSelected ? 0 : 1.5}
                
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transformOrigin: 'center',
                  outline: 'none',
                }}
                
                // Hover effect xử lý inline để tránh re-render không cần thiết
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.fill = token.colorPrimaryBg; // Màu nền nhạt của brand
                    e.currentTarget.style.stroke = token.colorPrimary;
                    e.currentTarget.style.filter = `drop-shadow(0 0 8px ${token.colorPrimary}40)`; // Glow nhẹ
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.fill = "url(#bodyGradient)";
                    e.currentTarget.style.stroke = "#bfbfbf";
                    e.currentTarget.style.filter = "none";
                  }
                }}
              />
            </Tooltip>
          );
        })}
      </svg>
      
      {/* Legend / Guide */}
      <div style={{ 
        position: 'absolute', 
        bottom: 10, 
        left: '50%', 
        transform: 'translateX(-50%)',
        fontSize: token.fontSizeSM, 
        color: token.colorTextSecondary,
        pointerEvents: 'none',
        whiteSpace: 'nowrap'
      }}>
        Chạm vào vùng cơ thể để chọn
      </div>
    </div>
  );
};