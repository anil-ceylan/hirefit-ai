export function createShadowLogStore() {
  return {
    save() {
      throw new Error("ShadowLogStore.save must be implemented.");
    },
    getByRunId() {
      throw new Error("ShadowLogStore.getByRunId must be implemented.");
    },
    list() {
      throw new Error("ShadowLogStore.list must be implemented.");
    },
    clear() {
      throw new Error("ShadowLogStore.clear must be implemented.");
    },
  };
}
