-- 20260516000002_chat_feedback_table.sql
-- Sales đánh dấu tin bot sai → log để training data
-- Date: 2026-05-16

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id),
  feedback_type text NOT NULL CHECK (feedback_type IN ('wrong_answer', 'fabricated_sku', 'wrong_price', 'medical_advice', 'other')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS chat_feedback_message_idx ON public.chat_feedback (message_id);
CREATE INDEX IF NOT EXISTS chat_feedback_type_idx ON public.chat_feedback (feedback_type, created_at DESC);

ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_feedback_select_staff ON public.chat_feedback;
CREATE POLICY chat_feedback_select_staff ON public.chat_feedback FOR SELECT
  USING (public.is_chat_staff());

DROP POLICY IF EXISTS chat_feedback_insert_staff ON public.chat_feedback;
CREATE POLICY chat_feedback_insert_staff ON public.chat_feedback FOR INSERT
  WITH CHECK (public.is_chat_staff() AND reporter_id = auth.uid());

DROP POLICY IF EXISTS chat_feedback_delete_staff ON public.chat_feedback;
CREATE POLICY chat_feedback_delete_staff ON public.chat_feedback FOR DELETE
  USING (public.is_chat_staff() AND reporter_id = auth.uid());

COMMENT ON TABLE public.chat_feedback IS
  'Phản hồi sales về chất lượng bot — dùng cho training data.';

COMMIT;
