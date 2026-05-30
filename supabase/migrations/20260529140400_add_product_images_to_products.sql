-- KỶ LUẬT THÉP: Cột mới cho phép rỗng hoặc có giá trị mặc định để không sập hệ thống cũ
ALTER TABLE public.products 
ADD COLUMN product_images TEXT[] DEFAULT '{}';
