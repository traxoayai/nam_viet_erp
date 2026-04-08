-- ============================================================
-- Map products từ parent category → child category
-- Dựa trên category_name ILIKE patterns chi tiết
-- Sản phẩm không match child → giữ parent
--
-- Chỉ UPDATE khi child id có trong categories (remote có thể khác seed local)
-- ============================================================

-- Parent 1: Hô hấp & Cảm cúm
UPDATE products SET category_id = 45 WHERE category_id = 1 AND category_name ILIKE '%xịt họng%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 45);
UPDATE products SET category_id = 42 WHERE category_id = 1 AND category_name ILIKE '%long đờm%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 42);
UPDATE products SET category_id = 44 WHERE category_id = 1 AND category_name ILIKE '%trị ho%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 44);
UPDATE products SET category_id = 43 WHERE category_id = 1 AND category_name ILIKE '%cảm%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 43);
UPDATE products SET category_id = 41 WHERE category_id = 1 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 41);

-- Parent 2: Tim mạch & Huyết áp
UPDATE products SET category_id = 48 WHERE category_id = 2 AND category_name ILIKE '%chống đông%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 48);
UPDATE products SET category_id = 47 WHERE category_id = 2 AND category_name ILIKE '%huyết áp%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 47);
UPDATE products SET category_id = 46 WHERE category_id = 2 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 46);

-- Parent 3: TPCN
UPDATE products SET category_id = 52 WHERE category_id = 3 AND category_name ILIKE '%gan%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 52);
UPDATE products SET category_id = 50 WHERE category_id = 3 AND category_name ILIKE '%bổ sung%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 50);
UPDATE products SET category_id = 49 WHERE category_id = 3 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 49);

-- Parent 4: Giảm đau & Hạ sốt
UPDATE products SET category_id = 55 WHERE category_id = 4 AND category_name ILIKE '%miếng dán%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 55);
UPDATE products SET category_id = 54 WHERE category_id = 4 AND (category_name ILIKE '%kháng viêm%' OR category_name ILIKE '%ngoài da%') AND EXISTS (SELECT 1 FROM public.categories WHERE id = 54);
UPDATE products SET category_id = 53 WHERE category_id = 4 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 53);

-- Parent 5: Kháng sinh & Kháng virus
UPDATE products SET category_id = 57 WHERE category_id = 5 AND category_name ILIKE '%virus%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 57);
UPDATE products SET category_id = 56 WHERE category_id = 5 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 56);

-- Parent 6: Dị ứng & Kháng histamin
UPDATE products SET category_id = 19 WHERE category_id = 6 AND category_name ILIKE '%histamin%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 19);
UPDATE products SET category_id = 20 WHERE category_id = 6 AND category_name ILIKE '%mũi%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 20);
UPDATE products SET category_id = 58 WHERE category_id = 6 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 58);

-- Parent 7: Tiêu hóa & Dạ dày
UPDATE products SET category_id = 21 WHERE category_id = 7 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 21);

-- Parent 8: Gan & Giải độc
UPDATE products SET category_id = 23 WHERE category_id = 8 AND (category_name ILIKE '%thực phẩm%' OR category_name ILIKE '%TPBVSK%') AND EXISTS (SELECT 1 FROM public.categories WHERE id = 23);
UPDATE products SET category_id = 22 WHERE category_id = 8 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 22);

-- Parent 9: Thần kinh & Tuần hoàn não
UPDATE products SET category_id = 24 WHERE category_id = 9 AND category_name ILIKE '%tuần hoàn%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 24);
UPDATE products SET category_id = 25 WHERE category_id = 9 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 25);

-- Parent 10: Da liễu & Dược mỹ phẩm
UPDATE products SET category_id = 28 WHERE category_id = 10 AND category_name ILIKE '%nấm%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 28);
UPDATE products SET category_id = 27 WHERE category_id = 10 AND (category_name ILIKE '%dược m%' OR category_name ILIKE '%kem dưỡng%') AND EXISTS (SELECT 1 FROM public.categories WHERE id = 27);
UPDATE products SET category_id = 26 WHERE category_id = 10 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 26);

-- Parent 11: Xương khớp
UPDATE products SET category_id = 30 WHERE category_id = 11 AND category_name ILIKE '%ngoài da%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 30);
UPDATE products SET category_id = 29 WHERE category_id = 11 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 29);

-- Parent 12: Vitamin & Khoáng chất
UPDATE products SET category_id = 32 WHERE category_id = 12 AND category_name ILIKE '%canxi%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 32);
UPDATE products SET category_id = 33 WHERE category_id = 12 AND category_name ILIKE '%trẻ%' AND EXISTS (SELECT 1 FROM public.categories WHERE id = 33);
UPDATE products SET category_id = 31 WHERE category_id = 12 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 31);

-- Parent 13: Chăm sóc cá nhân
UPDATE products SET category_id = 35 WHERE category_id = 13 AND (category_name ILIKE '%dầu gội%' OR category_name ILIKE '%khử mùi%') AND EXISTS (SELECT 1 FROM public.categories WHERE id = 35);
UPDATE products SET category_id = 34 WHERE category_id = 13 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 34);

-- Parent 14: Sức khỏe phụ nữ
UPDATE products SET category_id = 37 WHERE category_id = 14 AND (category_name ILIKE '%hormon%' OR category_name ILIKE '%nội tiết%') AND EXISTS (SELECT 1 FROM public.categories WHERE id = 37);
UPDATE products SET category_id = 36 WHERE category_id = 14 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 36);

-- Parent 15: Thiết bị y tế — no children, keep as-is

-- Parent 16: Đông y & Đông dược
UPDATE products SET category_id = 39 WHERE category_id = 16 AND (category_name ILIKE '%tinh dầu%' OR category_name ILIKE '%cao xoa%') AND EXISTS (SELECT 1 FROM public.categories WHERE id = 39);
UPDATE products SET category_id = 38 WHERE category_id = 16 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 38);

-- Parent 17: Tiểu đường
UPDATE products SET category_id = 40 WHERE category_id = 17 AND EXISTS (SELECT 1 FROM public.categories WHERE id = 40);
