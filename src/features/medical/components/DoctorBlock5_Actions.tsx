import {
  SaveOutlined,
  PrinterOutlined,
  CalendarOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { Button, Popconfirm, Popover, DatePicker, message } from "antd";
import dayjs from "dayjs";
import { Syringe } from "lucide-react";
import React, { useState } from "react";

interface Props {
  onSave: (status: "in_progress" | "finished" | "ready_for_vaccine") => void;
  onPrint: () => void;
  onScheduleFollowUp: (date: string) => void;
  loading?: boolean;
  hasVaccines?: boolean;
}

export const DoctorBlock5_Actions: React.FC<Props> = ({
  onSave,
  onPrint,
  onScheduleFollowUp,
  loading,
  hasVaccines,
}) => {
  const [reExamDate, setReExamDate] = useState<dayjs.Dayjs | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleCreateAppointment = () => {
    if (!reExamDate) return message.warning("Vui lòng chọn ngày!");
    onScheduleFollowUp(reExamDate.toISOString());
    setPopoverOpen(false);
  };

  return (
    <div className="bg-white p-4 border-t border-gray-200 mt-4 flex justify-between items-center sticky bottom-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      {/* LEFT: Auxiliary Actions */}
      <div className="flex gap-2">
        <Button
          icon={<PrinterOutlined />}
          onClick={onPrint}
          className="border-blue-500 text-blue-600 hover:text-blue-700 hover:border-blue-600"
        >
          In Phiếu
        </Button>

        <Popover
          title="Chọn ngày tái khám"
          trigger="click"
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          content={
            <div className="flex gap-2">
              <DatePicker
                value={reExamDate}
                onChange={setReExamDate}
                disabledDate={(d) => d.isBefore(dayjs(), "day")}
              />
              <Button type="primary" onClick={handleCreateAppointment}>
                Hẹn
              </Button>
            </div>
          }
        >
          <Button
            icon={<CalendarOutlined />}
            className="border-blue-500 text-blue-600 hover:text-blue-700 hover:border-blue-600"
          >
            Hẹn Tái Khám
          </Button>
        </Popover>
      </div>

      {/* RIGHT: Main Actions */}
      <div className="flex gap-2">
        {hasVaccines && (
          <Popconfirm title="Xác nhận đủ sức khỏe?" onConfirm={() => onSave("ready_for_vaccine")} okText="Đồng ý">
            <Button size="large" type="primary" className="bg-purple-600 hover:bg-purple-700 border-purple-600" loading={loading} icon={<Syringe />}>
              Đủ điều kiện Tiêm chủng
            </Button>
          </Popconfirm>
        )}

        <Button
          size="large"
          icon={<SaveOutlined />}
          onClick={() => onSave("in_progress")}
          loading={loading}
        >
          Lưu Nháp
        </Button>

        <Popconfirm
          title="Hoàn tất"
          description="Đơn thuốc sẽ được gửi sang bộ phận Dược sĩ."
          onConfirm={() => onSave("finished")}
          okText="Đồng ý"
        >
          <Button
            size="large"
            type="primary"
            icon={<SendOutlined />}
            className="bg-green-600 hover:bg-green-700 border-green-600"
            loading={loading}
          >
            Hoàn tất & Chuyển Dược
          </Button>
        </Popconfirm>
      </div>
    </div>
  );
};
