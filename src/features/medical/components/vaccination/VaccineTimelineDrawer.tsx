// src/features/medical/components/vaccination/VaccineTimelineDrawer.tsx
import {
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Drawer,
  Timeline,
  Button,
  DatePicker,
  message,
  Spin,
  Typography,
  Popover,
} from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";

import {
  getCustomerTimeline,
  rescheduleDose,
} from "@/features/medical/api/vaccineService";
import { CustomerSearchSelect } from "@/features/medical/components/CustomerSearchSelect";

const { Text } = Typography;

interface VaccineTimelineDrawerProps {
  customerId: number | null;
  open: boolean;
  onClose: () => void;
}

export const VaccineTimelineDrawer: React.FC<VaccineTimelineDrawerProps> = ({
  customerId,
  open,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<any[]>([]);

  const [rescheduleData, setRescheduleData] = useState<{
    recordId: number;
    date: dayjs.Dayjs | null;
  } | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  const [localCustomerId, setLocalCustomerId] = useState<number | null>(null);
  const activeCustomerId = customerId || localCustomerId;

  const loadTimeline = async () => {
    if (!activeCustomerId) return;
    setLoading(true);
    try {
      const data = await getCustomerTimeline(activeCustomerId);
      setTimelineData(data || []);
    } catch (error: any) {
      message.error("Lỗi khi tải Sổ tiêm chủng: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && activeCustomerId) {
      loadTimeline();
    } else if (!open) {
      setTimelineData([]);
      setRescheduleData(null);
      setLocalCustomerId(null);
    }
  }, [open, activeCustomerId]);

  const handleReschedule = async () => {
    if (!rescheduleData || !rescheduleData.date) return;

    setRescheduling(true);
    try {
      const newDateStr = rescheduleData.date.format("YYYY-MM-DD");
      await rescheduleDose(rescheduleData.recordId, newDateStr);
      message.success(
        "Đã dời lịch tiêm thành công! Phác đồ tự động cập nhật lại."
      );
      setRescheduleData(null);
      loadTimeline(); // Reload
    } catch (error: any) {
      message.error("Lỗi khi dời lịch: " + error.message);
    } finally {
      setRescheduling(false);
    }
  };

  const renderTimelineItems = () => {
    if (!timelineData.length) return [];

    const today = dayjs().startOf("day");

    return timelineData.map((item) => {
      const expDate = dayjs(item.expected_date);
      const isCompleted = item.status === "completed";
      const isOverdue = !isCompleted && expDate.isBefore(today);
      const isUpcoming = !isCompleted && !expDate.isBefore(today);

      let color = "blue";
      let dot = undefined;

      if (isCompleted) {
        color = "green";
        dot = <CheckCircleOutlined style={{ fontSize: "16px" }} />;
      } else if (isOverdue) {
        color = "red";
        // Chấm đỏ nhấp nháy
        dot = (
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white shadow-sm shadow-red-200"></div>
        );
      } else if (isUpcoming) {
        color = "orange"; // Sắp tới
        dot = <ClockCircleOutlined style={{ fontSize: "16px" }} />;
      }

      // Tên vắc xin (do join với bảng products)
      // @ts-ignore
      const productName = item.products?.name || "Vắc xin không xác định";

      const popoverContent = (
        <div className="flex flex-col gap-2 p-1">
          <DatePicker
            value={
              rescheduleData?.recordId === item.id
                ? rescheduleData?.date || null
                : null
            }
            onChange={(date) => setRescheduleData({ recordId: item.id, date })}
            format="DD/MM/YYYY"
            placeholder="Chọn ngày mới"
            allowClear={false}
          />
          <Button
            type="primary"
            size="small"
            loading={rescheduling}
            onClick={handleReschedule}
            disabled={
              !rescheduleData ||
              rescheduleData.recordId !== item.id ||
              !rescheduleData.date
            }
          >
            Xác nhận dời
          </Button>
        </div>
      );

      return {
        color,
        dot,
        children: (
          <div className="mb-4 bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-1">
              <span className="font-bold text-gray-800 text-sm">
                {productName}
              </span>
              <span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                Mũi {item.dose_number}
              </span>
            </div>

            <div className="text-sm mt-2 flex flex-col gap-1">
              {!isCompleted ? (
                <div className="flex justify-between items-center">
                  <span
                    className={`${isOverdue ? "text-red-600 font-bold" : "text-gray-600"}`}
                  >
                    Ngày dự kiến: {expDate.format("DD/MM/YYYY")}
                    {isOverdue ? (
                      <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded uppercase">
                        Quá hạn
                      </span>
                    ) : null}
                  </span>

                  <Popover
                    content={popoverContent}
                    title={
                      <span className="text-xs font-bold text-gray-600 uppercase">
                        Dời lịch Mũi {item.dose_number}
                      </span>
                    }
                    trigger="click"
                    placement="left"
                    open={rescheduleData?.recordId === item.id}
                    onOpenChange={(visible) => {
                      if (!visible) setRescheduleData(null);
                      else
                        setRescheduleData({ recordId: item.id, date: expDate });
                    }}
                  >
                    <Button
                      type="link"
                      size="small"
                      className="text-blue-600 font-semibold p-0 h-auto"
                      icon={<ReloadOutlined />}
                    >
                      Dời lịch
                    </Button>
                  </Popover>
                </div>
              ) : (
                <div className="text-green-700 font-medium flex items-center gap-1">
                  <CheckCircleOutlined /> Đã tiêm ngày:{" "}
                  {dayjs(item.actual_date).format("DD/MM/YYYY")}
                  {item.administered_by ? (
                    <span className="text-xs text-gray-500 ml-2">
                      ({item.administered_by})
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ),
      };
    });
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-blue-600" />
          <span>Sổ Tiêm Chủng Cá Nhân</span>
        </div>
      }
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
      styles={{ body: { backgroundColor: "#f8fafc", padding: "24px" } }}
    >
      {!activeCustomerId ? (
        <div className="flex flex-col items-center justify-center p-8 mt-10">
          <CalendarOutlined
            style={{
              fontSize: 56,
              marginBottom: 16,
              opacity: 0.5,
              color: "#1890ff",
            }}
          />
          <Typography.Title
            level={4}
            style={{ color: "#595959", marginBottom: 24 }}
          >
            Tra Cứu Sổ Tiêm Chủng
          </Typography.Title>
          <div className="w-full max-w-sm">
            <CustomerSearchSelect onChange={setLocalCustomerId} />
          </div>
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center h-full">
          <Spin size="large" tip="Đang tải phác đồ tiêm chủng..." />
        </div>
      ) : timelineData.length > 0 ? (
        <div className="pr-4">
          <Timeline items={renderTimelineItems()} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <CalendarOutlined
            style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}
          />
          <Text type="secondary">
            Chưa có dữ liệu tiêm chủng cho bệnh nhân này.
          </Text>
        </div>
      )}
    </Drawer>
  );
};
