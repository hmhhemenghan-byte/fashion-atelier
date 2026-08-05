export type Locale = "zh" | "en";

export const DEFAULT_LOCALE: Locale = "zh";

export const dictionaries = {
  zh: {
    brandName: "NÉRA ATELIER",
    brandTagline: "当代时装设计展示与生产档案",
    studio: "设计师工作台",
    collections: "时装系列",
    works: "作品档案",
    pressRoom: "新闻发布中心",
    showroom: "私享展厅",
    reviewBoard: "设计评审台",
    materialRoom: "材料室与 BOM",
    technicalAtelier: "技术工艺包",
    fittingRoom: "试身审版室",
    sampleGate: "封样签核台",
    releaseDesk: "生产放行台",
    changeControl: "生产变更控制",
    provenance: "出处卷宗",
    conservation: "保存修复",
    exhibitions: "展陈与巡查",
    curation: "馆藏策展",
    exportJson: "导出 JSON",
    exportCsv: "导出 CSV",
    returnToStudio: "← 返回 STUDIO",
    accessDenied: "此账号没有管理权限。",
    switchAccount: "切换账号 →",
  },
  en: {
    brandName: "NÉRA ATELIER",
    brandTagline: "Contemporary Fashion Design Showcase & Production Archive",
    studio: "Studio Workbench",
    collections: "Collections",
    works: "Design Archive",
    pressRoom: "Press Room",
    showroom: "Private Showroom",
    reviewBoard: "Atelier Review Board",
    materialRoom: "Material Room & BOM",
    technicalAtelier: "Technical Atelier",
    fittingRoom: "Fitting Room",
    sampleGate: "Final Sample Gate",
    releaseDesk: "Production Release Desk",
    changeControl: "Production Change Control",
    provenance: "Provenance Dossiers",
    conservation: "Conservation Atelier",
    exhibitions: "Exhibition & Watch",
    curation: "Archive Curation",
    exportJson: "EXPORT JSON",
    exportCsv: "EXPORT CSV",
    returnToStudio: "← RETURN TO STUDIO",
    accessDenied: "Access denied for this account.",
    switchAccount: "Switch Account →",
  },
} as const;

export function getDictionary(locale: Locale = DEFAULT_LOCALE) {
  return dictionaries[locale] || dictionaries.zh;
}
