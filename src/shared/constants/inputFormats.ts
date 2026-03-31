// Shared InputNumber formatter/parser for Vietnamese currency
// Usage: <InputNumber {...MONEY_INPUT_PROPS} />

export const MONEY_INPUT_PROPS = {
  formatter: (v: number | string | undefined) =>
    `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
  parser: (v: string | undefined) =>
    v!.replace(/,/g, "") as unknown as number,
} as const;
