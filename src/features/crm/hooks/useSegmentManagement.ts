import { useState, useEffect } from "react";
import { App, Form } from "antd";
import { segmentationService } from "../api/segmentationService";
import { CustomerSegmentRow, SegmentMemberDisplay } from "../types/segments"; // <-- Import từ segments.ts

export const useSegmentManagement = () => {
  const { message } = App.useApp();
  const [segments, setSegments] = useState<CustomerSegmentRow[]>([]);
  const [members, setMembers] = useState<SegmentMemberDisplay[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<CustomerSegmentRow | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  
  const [form] = Form.useForm();

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const data = await segmentationService.getSegments();
      setSegments(data);
    } catch (err: any) { message.error(err.message); } 
    finally { setLoading(false); }
  };

  const fetchMembers = async (segId: number) => {
    setLoadingMembers(true);
    try {
      const data = await segmentationService.getSegmentMembers(segId);
      setMembers(data);
    } catch (err) { console.error(err); } 
    finally { setLoadingMembers(false); }
  };

  useEffect(() => { fetchSegments(); }, []);

  useEffect(() => {
    if (selectedSegmentId) fetchMembers(selectedSegmentId);
    else setMembers([]);
  }, [selectedSegmentId]);

  const handleCreateOrUpdate = async (values: any) => {
    try {
      setLoading(true);
      if (editingSegment) {
        await segmentationService.updateSegment(editingSegment.id, values);
        message.success("Cập nhật thành công");
      } else {
        await segmentationService.createSegment(values);
        message.success("Tạo thành công");
      }
      setIsModalOpen(false);
      form.resetFields();
      fetchSegments();
      if (editingSegment && selectedSegmentId === editingSegment.id) fetchMembers(editingSegment.id);
    } catch (err: any) { message.error(err.message); } 
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    try {
        await segmentationService.deleteSegment(id);
        message.success("Đã xóa");
        fetchSegments();
        if (selectedSegmentId === id) setSelectedSegmentId(null);
    } catch (err: any) { message.error(err.message); }
  };

  const handleManualRefresh = async (id: number) => {
      try {
          setLoadingMembers(true);
          await segmentationService.refreshSegment(id);
          message.success("Đã làm mới danh sách");
          await fetchMembers(id);
      } catch (e: any) { message.error(e.message); }
      finally { setLoadingMembers(false); }
  }

  const openCreateModal = () => {
      setEditingSegment(null);
      form.resetFields();
      form.setFieldsValue({ type: 'dynamic', is_active: true });
      setIsModalOpen(true);
  }

  const openEditModal = (record: any) => {
      setEditingSegment(record);
      form.setFieldsValue(record);
      setIsModalOpen(true);
  }

  return {
    segments, members, loading, loadingMembers,
    isModalOpen, setIsModalOpen,
    editingSegment, selectedSegmentId, setSelectedSegmentId,
    form, handleCreateOrUpdate, handleDelete, handleManualRefresh,
    openCreateModal, openEditModal
  };
};
