import { translate } from "@nocobase/portal-sdk/i18n";

export type OptionItem = {
  value: string;
  /** Translation key; labelEn is the fallback when a locale lacks the key. */
  i18nKey: string;
  labelZh: string;
  labelEn: string;
  color?: string;
};

export const PRODUCT_UNITS: OptionItem[] = [
  { value: "piece",
    i18nKey: "inv.option.unit.piece", labelZh: "件", labelEn: "Piece" },
  { value: "box",
    i18nKey: "inv.option.unit.box", labelZh: "箱", labelEn: "Box" },
  { value: "case",
    i18nKey: "inv.option.unit.case", labelZh: "盒", labelEn: "Case" },
  { value: "kg",
    i18nKey: "inv.option.unit.kg", labelZh: "公斤", labelEn: "kg" },
  { value: "meter",
    i18nKey: "inv.option.unit.meter", labelZh: "米", labelEn: "meter" },
];

export const PRODUCT_STATUS: OptionItem[] = [
  { value: "on_sale",
    i18nKey: "inv.option.productStatus.on_sale", labelZh: "在售", labelEn: "On sale", color: "green" },
  { value: "new",
    i18nKey: "inv.option.productStatus.new", labelZh: "新品", labelEn: "New", color: "gold" },
  { value: "stopped",
    i18nKey: "inv.option.productStatus.stopped", labelZh: "停售", labelEn: "Stopped", color: "red" },
];

export const MOVEMENT_TYPES: OptionItem[] = [
  {
    value: "purchase_in",
    i18nKey: "inv.option.movementType.purchase_in",
    labelZh: "采购入库",
    labelEn: "Purchase in",
    color: "green",
  },
  {
    value: "sale_out",
    i18nKey: "inv.option.movementType.sale_out",
    labelZh: "销售出库",
    labelEn: "Sale out",
    color: "blue",
  },
  {
    value: "return_in",
    i18nKey: "inv.option.movementType.return_in",
    labelZh: "退货入库",
    labelEn: "Return in",
    color: "cyan",
  },
  {
    value: "adjustment",
    i18nKey: "inv.option.movementType.adjustment",
    labelZh: "盘点调整",
    labelEn: "Adjustment",
    color: "gold",
  },
  {
    value: "loss",
    i18nKey: "inv.option.movementType.loss",
    labelZh: "报损出库",
    labelEn: "Loss out",
    color: "red",
  },
  {
    value: "initial",
    i18nKey: "inv.option.movementType.initial",
    labelZh: "期初入库",
    labelEn: "Initial in",
    color: "geekblue",
  },
];

export const STOCK_IN_TYPES = new Set([
  "purchase_in",
  "return_in",
  "initial",
]);

export const STOCK_OUT_TYPES = new Set(["sale_out", "loss"]);

export const COUNT_SCOPES: OptionItem[] = [
  { value: "all",
    i18nKey: "inv.option.countScope.all", labelZh: "全部商品", labelEn: "All products", color: "blue" },
  {
    value: "category",
    i18nKey: "inv.option.countScope.category",
    labelZh: "按分类",
    labelEn: "By category",
    color: "geekblue",
  },
  {
    value: "product",
    i18nKey: "inv.option.countScope.product",
    labelZh: "按商品",
    labelEn: "By product",
    color: "cyan",
  },
];

export const COUNT_STATUS: OptionItem[] = [
  { value: "draft",
    i18nKey: "inv.option.countStatus.draft", labelZh: "草稿", labelEn: "Draft", color: "default" },
  {
    value: "in_progress",
    i18nKey: "inv.option.countStatus.in_progress",
    labelZh: "进行中",
    labelEn: "In progress",
    color: "blue",
  },
  {
    value: "completed",
    i18nKey: "inv.option.countStatus.completed",
    labelZh: "已完成",
    labelEn: "Completed",
    color: "green",
  },
  {
    value: "cancelled",
    i18nKey: "inv.option.countStatus.cancelled",
    labelZh: "已取消",
    labelEn: "Cancelled",
    color: "red",
  },
];

export const ITEM_STATUS: OptionItem[] = [
  { value: "pending",
    i18nKey: "inv.option.itemStatus.pending", labelZh: "未盘", labelEn: "Pending", color: "default" },
  { value: "counted",
    i18nKey: "inv.option.itemStatus.counted", labelZh: "已盘", labelEn: "Counted", color: "blue" },
  {
    value: "resolved",
    i18nKey: "inv.option.itemStatus.resolved",
    labelZh: "已处理",
    labelEn: "Resolved",
    color: "green",
  },
];

export const COUNTABLE_STATUSES = new Set(["draft", "in_progress"]);

export function resolveOption(
  options: OptionItem[],
  value?: string | null
): OptionItem | undefined {
  if (!value) return undefined;
  return options.find((option) => option.value === value);
}

export function optionLabel(
  options: OptionItem[],
  value?: string | null
): string {
  const option = resolveOption(options, value);
  if (!option) return value ?? "-";
  return optionText(option);
}

/** Resolve one option's label in the active locale. */
export function optionText(option: OptionItem): string {
  return translate(option.i18nKey, { ns: "inv" }, option.labelEn);
}
