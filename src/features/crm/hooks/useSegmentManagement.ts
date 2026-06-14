import { App, Form } from "antd";
import { useState, useEffect } from "react";

import { segmentationService } from "../api/segmentationService";
import { CustomerSegmentRow, SegmentMemberDisplay, CreateSegmentPayload } from "../types/segments"; // <-- Import từ segments.ts

export const useSegmentManagement = () => {
  const { message } = App.useApp();
  const [segments, setSegments] = useState<CustomerSegmentRow[]>([]);
  const [members, setMembers] = useState<SegmentMemberDisplay[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] =
    useState<CustomerSegmentRow | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(
    null
  );

  const [form] = Form.useForm();

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const data = await segmentationService.getSegments();
      setSegments(data);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (segId: number) => {
    setLoadingMembers(true);
    try {
      const data = await segmentationService.getSegmentMembers(segId);
      setMembers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  useEffect(() => {
    if (selectedSegmentId) fetchMembers(selectedSegmentId);
    else setMembers([]);
  }, [selectedSegmentId]);

  const handleCreateOrUpdate = async (values: Record<string, unknown>) => {
    try {
      setLoading(true);
      if (editingSegment) {
        const payload: Partial<CreateSegmentPayload> = {
          name: values.name as string,
          type: values.type as "static" | "dynamic",
          description: values.description as string | undefined,
          is_active: values.is_active as boolean,
        };
        await segmentationService.updateSegment(editingSegment.id, payload);
        message.success("Cập nhật thành công");
      } else {
        const payload: CreateSegmentPayload = {
          name: values.name as string,
          type: values.type as "static" | "dynamic",
          description: values.description as string | undefined,
          is_active: values.is_active as boolean,
        };
        await segmentationService.createSegment(payload);
        message.success("Tạo thành công");
      }
      setIsModalOpen(false);
      form.resetFields();
      fetchSegments();
      if (editingSegment && selectedSegmentId === editingSegment.id)
        fetchMembers(editingSegment.id);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await segmentationService.deleteSegment(id);
      message.success("Đã xóa");
      fetchSegments();
      if (selectedSegmentId === id) setSelectedSegmentId(null);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Lỗi không xác định");
    }
  };

  const handleManualRefresh = async (id: number) => {
    try {
      setLoadingMembers(true);
      await segmentationService.refreshSegment(id);
      message.success("Đã làm mới danh sách");
      await fetchMembers(id);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoadingMembers(false);
    }
  };

  const openCreateModal = () => {
    setEditingSegment(null);
    form.resetFields();
    form.setFieldsValue({ type: "dynamic", is_active: true });
    setIsModalOpen(true);
  };

  const openEditModal = (record: Record<string, unknown>) => {
    setEditingSegment(record as CustomerSegmentRow);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  return {
    segments,
    members,
    loading,
    loadingMembers,
    isModalOpen,
    setIsModalOpen,
    editingSegment,
    selectedSegmentId,
    setSelectedSegmentId,
    form,
    handleCreateOrUpdate,
    handleDelete,
    handleManualRefresh,
    openCreateModal,
    openEditModal,
  };
};
