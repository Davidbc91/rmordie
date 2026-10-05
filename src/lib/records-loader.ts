export const loadRecordsContent = () =>
  import("@/components/RecordsContent").then((m) => ({ default: m.RecordsContent }));
