-- Migration: Receipt Invoice Parsing RPC
-- Description: Create RPC function to analyze receipt/invoice images using Gemini Vision API
-- Date: 2026-06-14

-- Enable http extension if not already enabled
create extension if not exists http;

-- Create RPC function for analyzing receipt/invoice images
create or replace function analyze_receipt_invoice(
  p_image_base64 text,
  p_image_mime_type text
)
returns jsonb
language plpgsql
as $$
declare
  v_api_key text;
  v_response jsonb;
  v_content text;
  v_success boolean;
  v_error_message text;
begin
  -- Get Gemini API key from secrets (via environment variable)
  v_api_key := current_setting('app.settings.gemini_api_key', true);

  if v_api_key is null or v_api_key = '' then
    return jsonb_build_object(
      'success', false,
      'error', 'Gemini API key not configured'
    );
  end if;

  -- Call Gemini Vision API with the image
  begin
    select content
    into v_content
    from http_post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' || v_api_key,
      jsonb_build_object(
        'contents', jsonb_build_array(
          jsonb_build_object(
            'parts', jsonb_build_array(
              jsonb_build_object(
                'text', 'Analyze this receipt/invoice image and extract the following data in JSON format:
{
  "supplier_name": "Name of the supplier/vendor",
  "receipt_date": "Date in ISO format (YYYY-MM-DD)",
  "receipt_number": "Receipt or invoice number",
  "items": [
    {
      "product_name": "Name of the product",
      "quantity": numeric quantity,
      "unit_price": unit price (numeric),
      "total_price": total price for this item (numeric),
      "sku": "Product SKU if visible"
    }
  ],
  "total_amount": total amount on receipt (numeric),
  "confidence": confidence score 0-100 for the overall parsing accuracy,
  "errors": ["List of any parsing issues or uncertainties"]
}

If any field cannot be reliably extracted, omit it from the response. Ensure all numeric values are actual numbers, not strings.'
              ),
              jsonb_build_object(
                'inlineData', jsonb_build_object(
                  'mimeType', p_image_mime_type,
                  'data', p_image_base64
                )
              )
            )
          )
        )
      )::text,
      'Content-Type: application/json'::http_header
    ) as temp_response;

    -- Parse the API response
    v_response := v_content::jsonb;

    -- Extract the generated content from Gemini response
    if v_response -> 'candidates' -> 0 -> 'content' -> 'parts' -> 0 ? 'text' then
      v_content := v_response ->> 'candidates' -> 0 -> 'content' -> 'parts' -> 0 ->> 'text';

      -- Try to parse the JSON response from Gemini
      begin
        -- Remove markdown code block if present
        v_content := regexp_replace(v_content, '```json\n?', '', 'g');
        v_content := regexp_replace(v_content, '```\n?', '', 'g');

        return jsonb_build_object(
          'success', true,
          'data', v_content::jsonb || jsonb_build_object(
            'confidence_score', (v_content::jsonb ->> 'confidence')::numeric ?? 50
          )
        );
      exception when others then
        -- If JSON parsing fails, return raw text
        return jsonb_build_object(
          'success', true,
          'data', jsonb_build_object(
            'raw_text', v_content,
            'items', '[]'::jsonb,
            'confidence_score', 30,
            'errors', jsonb_build_array('Response could not be parsed as JSON')
          )
        );
      end;
    else
      return jsonb_build_object(
        'success', false,
        'error', 'Invalid response from Gemini API'
      );
    end if;

  exception when others then
    v_error_message := sqlerrm;
    return jsonb_build_object(
      'success', false,
      'error', v_error_message
    );
  end;
end;
$$;

-- Grant permission to authenticated users
grant execute on function analyze_receipt_invoice(text, text) to authenticated;

-- Create index for potential future logging table (optional)
-- ALTER TABLE IF EXISTS receipt_parsing_logs ADD COLUMN IF NOT EXISTS created_at timestamptz default now();
-- CREATE INDEX IF NOT EXISTS idx_receipt_parsing_logs_created_at ON receipt_parsing_logs(created_at);
